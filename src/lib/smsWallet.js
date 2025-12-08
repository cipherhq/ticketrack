import { supabase } from './supabase';

export async function getOrCreateWallet(organizerId) {
  let { data: wallet } = await supabase
    .from('organizer_sms_wallet')
    .select('*')
    .eq('organizer_id', organizerId)
    .single();

  if (!wallet) {
    const { data: newWallet, error } = await supabase
      .from('organizer_sms_wallet')
      .insert({ organizer_id: organizerId, balance: 0, total_purchased: 0, total_used: 0 })
      .select()
      .single();
    
    if (!error) wallet = newWallet;
  }

  return wallet;
}

export async function hasEnoughCredits(organizerId, creditsNeeded) {
  const wallet = await getOrCreateWallet(organizerId);
  return wallet && wallet.balance >= creditsNeeded;
}

export async function deductCredits(organizerId, creditsUsed, smsCount, recipientCount, eventId = null, auditId = null) {
  const wallet = await getOrCreateWallet(organizerId);
  
  if (!wallet || wallet.balance < creditsUsed) {
    throw new Error('Insufficient SMS credits');
  }

  const newBalance = wallet.balance - creditsUsed;

  await supabase
    .from('organizer_sms_wallet')
    .update({
      balance: newBalance,
      total_used: wallet.total_used + creditsUsed,
      updated_at: new Date().toISOString(),
    })
    .eq('organizer_id', organizerId);

  await supabase
    .from('sms_credit_usage')
    .insert({
      organizer_id: organizerId,
      credits_used: creditsUsed,
      sms_count: smsCount,
      recipient_count: recipientCount,
      event_id: eventId,
      audit_id: auditId,
      balance_before: wallet.balance,
      balance_after: newBalance,
    });

  // Check if balance is low (less than 50) and send alert
  if (newBalance < 50 && newBalance > 0) {
    // Will trigger low balance alert
    console.log('Low SMS balance alert needed:', newBalance);
  }

  return { success: true, newBalance };
}

export async function addCredits(organizerId, creditsPurchased, bonusCredits = 0) {
  const wallet = await getOrCreateWallet(organizerId);
  const totalCredits = creditsPurchased + bonusCredits;
  const newBalance = (wallet?.balance || 0) + totalCredits;

  const { error } = await supabase
    .from('organizer_sms_wallet')
    .upsert({
      organizer_id: organizerId,
      balance: newBalance,
      total_purchased: (wallet?.total_purchased || 0) + totalCredits,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organizer_id' });

  if (error) throw error;

  return { success: true, newBalance, creditsAdded: totalCredits };
}

export async function getCreditPackages() {
  const { data, error } = await supabase
    .from('sms_credit_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

export async function createPurchase(organizerId, packageId, credits, bonusCredits, amount, reference) {
  const { data, error } = await supabase
    .from('sms_credit_purchases')
    .insert({
      organizer_id: organizerId,
      package_id: packageId,
      credits_purchased: credits,
      bonus_credits: bonusCredits,
      amount_paid: amount,
      payment_reference: reference,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completePurchase(purchaseId) {
  // Get purchase details
  const { data: purchase, error: fetchError } = await supabase
    .from('sms_credit_purchases')
    .select('*, sms_credit_packages(name)')
    .eq('id', purchaseId)
    .single();

  if (fetchError || !purchase) throw new Error('Purchase not found');
  if (purchase.status === 'completed') return { success: true, alreadyCompleted: true };

  // Add credits to wallet
  const result = await addCredits(purchase.organizer_id, purchase.credits_purchased, purchase.bonus_credits);

  // Update purchase status
  const { error: updateError } = await supabase
    .from('sms_credit_purchases')
    .update({ 
      status: 'completed', 
      completed_at: new Date().toISOString() 
    })
    .eq('id', purchaseId);

  if (updateError) throw updateError;

  // Log to admin logs
  await supabase.from('admin_logs').insert({
    action: 'sms_credits_purchased',
    target_type: 'sms_credit_purchases',
    target_id: purchaseId,
    details: {
      organizer_id: purchase.organizer_id,
      package: purchase.sms_credit_packages?.name,
      credits: purchase.credits_purchased,
      bonus: purchase.bonus_credits,
      amount: purchase.amount_paid,
      reference: purchase.payment_reference,
    },
  });

  return { 
    success: true, 
    newBalance: result.newBalance,
    purchase: purchase,
  };
}

export async function getWalletBalance(organizerId) {
  const wallet = await getOrCreateWallet(organizerId);
  return wallet?.balance || 0;
}
