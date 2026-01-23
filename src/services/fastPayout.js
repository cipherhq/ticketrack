import { supabase } from '@/lib/supabase';

/**
 * Fast Payout Service
 * Enables organizers to request early payouts with a 0.5% fee
 */

// Check eligibility for fast payout
export async function checkFastPayoutEligibility(organizerId, eventId = null) {
  const { data, error } = await supabase.rpc('check_fast_payout_eligibility', {
    p_organizer_id: organizerId,
    p_event_id: eventId
  });

  if (error) throw error;
  return data;
}

// Request a fast payout
export async function requestFastPayout(organizerId, amount, eventId = null) {
  // First create the request via RPC
  const { data: createResult, error: createError } = await supabase.rpc('create_fast_payout_request', {
    p_organizer_id: organizerId,
    p_amount: amount,
    p_event_id: eventId
  });

  if (createError) throw createError;
  if (!createResult?.success) {
    throw new Error(createResult?.error || 'Failed to create fast payout request');
  }

  // Then process it via edge function
  const { data, error } = await supabase.functions.invoke('process-fast-payout', {
    body: {
      requestId: createResult.request_id
    }
  });

  if (error) throw error;
  return data;
}

// Get fast payout history for organizer
export async function getFastPayoutHistory(organizerId) {
  const { data, error } = await supabase
    .from('fast_payout_requests')
    .select(`
      *,
      event:events(id, title, slug)
    `)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get pending fast payout requests
export async function getPendingFastPayouts(organizerId) {
  const { data, error } = await supabase
    .from('fast_payout_requests')
    .select('*')
    .eq('organizer_id', organizerId)
    .in('status', ['pending', 'approved', 'processing'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get fast payout settings
export async function getFastPayoutSettings() {
  const { data, error } = await supabase
    .from('fast_payout_settings')
    .select('*')
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || {
    enabled: true,
    fee_percentage: 0.005,
    min_ticket_sales_percentage: 50,
    cap_bronze: 70,
    cap_silver: 80,
    cap_gold: 90,
    cap_trusted: 95
  };
}

// Format fast payout status for display
export function formatFastPayoutStatus(status) {
  const statusMap = {
    pending: { label: 'Pending', color: 'yellow', description: 'Awaiting processing' },
    approved: { label: 'Approved', color: 'blue', description: 'Ready to process' },
    processing: { label: 'Processing', color: 'blue', description: 'Transfer in progress' },
    completed: { label: 'Completed', color: 'green', description: 'Funds sent' },
    failed: { label: 'Failed', color: 'red', description: 'Transfer failed' },
    rejected: { label: 'Rejected', color: 'red', description: 'Request rejected' },
    cancelled: { label: 'Cancelled', color: 'gray', description: 'Request cancelled' }
  };
  return statusMap[status] || { label: status, color: 'gray', description: '' };
}

// Calculate fee for a given amount
export function calculateFastPayoutFee(amount, feePercentage = 0.005) {
  const fee = Math.round(amount * feePercentage * 100) / 100;
  const net = amount - fee;
  return { gross: amount, fee, net };
}
