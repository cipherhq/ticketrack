import { supabase } from './supabase';
import { sendLowWhatsAppBalanceEmail } from './emailService';

const LOW_BALANCE_THRESHOLD = 5.00; // $5 USD threshold

export async function getOrCreateWallet(organizerId) {
  if (!organizerId) throw new Error('Organizer ID required');
  let { data: wallet, error } = await supabase.from('organizer_whatsapp_wallet').select('*').eq('organizer_id', organizerId).single();
  if (error && error.code === 'PGRST116') {
    const { data: newWallet, error: createError } = await supabase.from('organizer_whatsapp_wallet').insert({ organizer_id: organizerId }).select().single();
    if (createError) throw createError;
    return newWallet;
  }
  if (error) throw error;
  return wallet;
}

export async function getWalletBalance(organizerId) {
  const wallet = await getOrCreateWallet(organizerId);
  return wallet.balance || 0;
}

export async function getMessageRate(messageType = 'utility') {
  const { data } = await supabase.from('platform_whatsapp_config').select('*').eq('message_type', messageType).eq('is_active', true).single();
  const defaults = { utility: 0.0144, marketing: 0.0630, authentication: 0.0072, service: 0 };
  return data?.selling_rate || defaults[messageType] || 0.0144;
}

export async function hasEnoughCredits(organizerId, messageType = 'utility', count = 1) {
  const balance = await getWalletBalance(organizerId);
  const rate = await getMessageRate(messageType);
  return balance >= (rate * count);
}

export async function deductCredits(organizerId, messageType, recipientPhone, messageId = null) {
  const rate = await getMessageRate(messageType);
  if (rate === 0) return true;
  const wallet = await getOrCreateWallet(organizerId);
  if (wallet.balance < rate) throw new Error('Insufficient WhatsApp credits');

  const newBalance = wallet.balance - rate;

  await supabase.from('organizer_whatsapp_wallet').update({
    balance: newBalance,
    total_used: (wallet.total_used || 0) + rate,
    updated_at: new Date().toISOString()
  }).eq('organizer_id', organizerId);

  const { data: config } = await supabase.from('platform_whatsapp_config').select('meta_rate').eq('message_type', messageType).single();
  await supabase.from('whatsapp_credit_usage').insert({
    organizer_id: organizerId,
    message_type: messageType,
    recipient_phone: recipientPhone,
    credits_used: rate,
    meta_cost: config?.meta_rate || 0,
    message_id: messageId,
    status: 'sent'
  });

  // Check for low balance and send alert if needed
  if (newBalance <= LOW_BALANCE_THRESHOLD && wallet.balance > LOW_BALANCE_THRESHOLD) {
    // Balance just dropped below threshold - send alert
    try {
      const { data: organizer } = await supabase
        .from('organizers')
        .select('business_name, email, business_email')
        .eq('id', organizerId)
        .single();

      const organizerEmail = organizer?.email || organizer?.business_email;
      if (organizerEmail) {
        sendLowWhatsAppBalanceEmail(organizerEmail, {
          organizerName: organizer?.business_name || 'Organizer',
          balance: newBalance,
          currency: 'USD',
        }, organizerId);
      }
    } catch (err) {
      console.error('Failed to send low WhatsApp balance alert:', err);
    }
  }

  return true;
}

export async function addCredits(organizerId, credits, purchaseId) {
  const wallet = await getOrCreateWallet(organizerId);
  await supabase.from('organizer_whatsapp_wallet').update({
    balance: (wallet.balance || 0) + credits,
    total_purchased: (wallet.total_purchased || 0) + credits,
    updated_at: new Date().toISOString()
  }).eq('organizer_id', organizerId);
  if (purchaseId) {
    await supabase.from('whatsapp_credit_purchases').update({ payment_status: 'completed' }).eq('id', purchaseId);
  }
  return true;
}

export async function getPurchaseHistory(organizerId) {
  const { data } = await supabase.from('whatsapp_credit_purchases').select('*, whatsapp_credit_packages (name)').eq('organizer_id', organizerId).order('created_at', { ascending: false });
  return data || [];
}

export async function getUsageStats(organizerId) {
  const { data } = await supabase.from('whatsapp_credit_usage').select('message_type, credits_used').eq('organizer_id', organizerId);
  const stats = { total_messages: data?.length || 0, total_spent: 0, by_type: {} };
  data?.forEach(row => {
    stats.total_spent += parseFloat(row.credits_used) || 0;
    if (!stats.by_type[row.message_type]) stats.by_type[row.message_type] = { count: 0, spent: 0 };
    stats.by_type[row.message_type].count++;
    stats.by_type[row.message_type].spent += parseFloat(row.credits_used) || 0;
  });
  return stats;
}

export default { getOrCreateWallet, getWalletBalance, getMessageRate, hasEnoughCredits, deductCredits, addCredits, getPurchaseHistory, getUsageStats };
