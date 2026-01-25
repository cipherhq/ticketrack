import { supabase } from '@/lib/supabase';

/**
 * Split Payment Service
 * Enables group members to split ticket costs among friends
 */

// Create a split payment for a group purchase
export async function createSplitPayment({
  sessionId,
  ticketSelection,
  totalAmount,
  currency,
  serviceFee = 0,
  members, // Array of { email, name, user_id? }
  splitType = 'equal',
  deadlineHours = 24
}) {
  const { data, error } = await supabase.rpc('create_split_payment', {
    p_session_id: sessionId,
    p_ticket_selection: ticketSelection,
    p_total_amount: totalAmount,
    p_currency: currency,
    p_service_fee: serviceFee,
    p_member_emails: members,
    p_split_type: splitType,
    p_deadline_hours: deadlineHours
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Failed to create split payment');
  
  return data;
}

// Get split payment details
export async function getSplitPayment(splitPaymentId) {
  const { data, error } = await supabase.rpc('get_split_payment', {
    p_split_id: splitPaymentId
  });

  if (error) throw error;
  return data;
}

// Get share by payment token (for pay-your-share links)
export async function getShareByToken(token) {
  const { data, error } = await supabase.rpc('get_share_by_token', {
    p_token: token
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Invalid payment link');
  
  return data;
}

// Get all shares for a split payment
export async function getSplitShares(splitPaymentId) {
  const { data, error } = await supabase
    .from('group_split_shares')
    .select('*')
    .eq('split_payment_id', splitPaymentId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

// Get my pending split payments
export async function getMyPendingSplits() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('group_split_shares')
    .select(`
      *,
      split_payment:group_split_payments(
        *,
        event:events(id, title, slug, start_date, image_url, currency)
      )
    `)
    .eq('user_id', user.id)
    .eq('payment_status', 'unpaid')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data?.filter(s => s.split_payment?.status !== 'expired' && s.split_payment?.status !== 'cancelled') || [];
}

// Record a successful payment
export async function recordSharePayment(shareId, paymentReference, paymentMethod) {
  const { data, error } = await supabase.rpc('record_share_payment', {
    p_share_id: shareId,
    p_payment_reference: paymentReference,
    p_payment_method: paymentMethod
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Failed to record payment');
  
  return data;
}

// Mark reminder as sent
export async function markReminderSent(shareId) {
  const { error } = await supabase.rpc('mark_reminder_sent', {
    p_share_id: shareId
  });

  if (error) throw error;
}

// Send payment reminder (via edge function)
export async function sendPaymentReminder(shareId) {
  const { data, error } = await supabase.functions.invoke('send-split-reminder', {
    body: { shareId }
  });

  if (error) throw error;
  return data;
}

// Cancel a split payment (host only)
export async function cancelSplitPayment(splitPaymentId) {
  const { error } = await supabase
    .from('group_split_payments')
    .update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', splitPaymentId);

  if (error) throw error;
}

// Generate pay-your-share link
export function getPayYourShareLink(paymentToken) {
  return `${window.location.origin}/pay-share/${paymentToken}`;
}

// Subscribe to real-time updates for a split payment
export function subscribeToSplitPayment(splitPaymentId, callbacks) {
  const { onShareUpdate, onSplitUpdate } = callbacks;

  // Subscribe to share changes
  const shareChannel = supabase
    .channel(`split-shares-${splitPaymentId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'group_split_shares',
      filter: `split_payment_id=eq.${splitPaymentId}`
    }, payload => {
      if (onShareUpdate) onShareUpdate(payload);
    })
    .subscribe();

  // Subscribe to split payment changes
  const splitChannel = supabase
    .channel(`split-payment-${splitPaymentId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'group_split_payments',
      filter: `id=eq.${splitPaymentId}`
    }, payload => {
      if (onSplitUpdate) onSplitUpdate(payload.new);
    })
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(shareChannel);
    supabase.removeChannel(splitChannel);
  };
}

// Calculate split amounts
export function calculateSplitAmounts(totalAmount, memberCount, splitType = 'equal') {
  if (splitType === 'equal') {
    const perPerson = Math.ceil((totalAmount / memberCount) * 100) / 100; // Round up to nearest cent
    const lastPerson = totalAmount - (perPerson * (memberCount - 1)); // Last person pays remainder
    
    return Array(memberCount).fill(perPerson).map((amount, index) => 
      index === memberCount - 1 ? lastPerson : amount
    );
  }
  
  // For custom splits, return equal by default (can be customized in UI)
  return Array(memberCount).fill(totalAmount / memberCount);
}

// Format share status for display
export function formatShareStatus(status) {
  const statusMap = {
    unpaid: { label: 'Awaiting Payment', color: 'yellow' },
    pending: { label: 'Processing', color: 'blue' },
    paid: { label: 'Paid', color: 'green' },
    failed: { label: 'Failed', color: 'red' },
    refunded: { label: 'Refunded', color: 'gray' }
  };
  return statusMap[status] || { label: status, color: 'gray' };
}

// Format split payment status for display
export function formatSplitStatus(status) {
  const statusMap = {
    pending: { label: 'Waiting for Payments', color: 'yellow' },
    partial: { label: 'Partially Paid', color: 'blue' },
    completed: { label: 'All Paid', color: 'green' },
    expired: { label: 'Expired', color: 'red' },
    cancelled: { label: 'Cancelled', color: 'gray' },
    refunding: { label: 'Refunding', color: 'orange' },
    refunded: { label: 'Refunded', color: 'gray' }
  };
  return statusMap[status] || { label: status, color: 'gray' };
}

// Calculate time remaining until expiry
export function getTimeRemaining(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;

  if (diff <= 0) return { expired: true, text: 'Expired' };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { expired: false, text: `${days}d ${hours % 24}h left` };
  }
  if (hours > 0) {
    return { expired: false, text: `${hours}h ${minutes}m left` };
  }
  return { expired: false, text: `${minutes}m left`, urgent: true };
}
