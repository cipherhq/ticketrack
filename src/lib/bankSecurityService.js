/**
 * Bank Account Security Service
 * 
 * Implements security layers for bank account management:
 * - 48-hour cooling period for new/updated accounts
 * - Email confirmation for changes
 * - Suspicious activity detection
 * - Change logging
 */

import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Get device/browser fingerprint for security logging
 */
function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Get user's IP address (via external service)
 * In production, this should be done server-side
 */
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Failed to get IP:', error);
    return null;
  }
}

/**
 * Add a new bank account with security measures
 * 
 * @param {string} organizerId - Organizer ID
 * @param {object} bankData - Bank account details
 * @param {boolean} requireConfirmation - Whether to require email confirmation
 * @returns {Promise<{success: boolean, bankAccountId?: string, requiresConfirmation?: boolean, coolingUntil?: string, error?: string}>}
 */
export async function addBankAccount(organizerId, bankData, requireConfirmation = true) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required' };
    }

    const deviceInfo = getDeviceInfo();
    const ipAddress = await getClientIP();

    // Calculate cooling period (48 hours from now)
    const coolingUntil = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Generate confirmation token if required
    const confirmationToken = requireConfirmation ? crypto.randomUUID() : null;
    const confirmationExpires = requireConfirmation 
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      : null;

    // Insert bank account
    const { data: bankAccount, error: insertError } = await supabase
      .from('organizer_bank_accounts')
      .insert({
        organizer_id: organizerId,
        bank_name: bankData.bankName,
        bank_code: bankData.bankCode,
        account_number: bankData.accountNumber,
        account_name: bankData.accountName,
        is_default: bankData.isDefault || false,
        is_active: true,
        is_verified: false,
        cooling_until: coolingUntil,
        is_pending_confirmation: requireConfirmation,
        confirmation_token: confirmationToken,
        confirmation_expires_at: confirmationExpires,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Bank insert error:', insertError);
      return { success: false, error: insertError.message };
    }

    // Log the change
    await supabase.rpc('log_bank_account_change', {
      p_organizer_id: organizerId,
      p_bank_account_id: bankAccount.id,
      p_user_id: session.user.id,
      p_change_type: 'added',
      p_new_bank_name: bankData.bankName,
      p_new_account_name: bankData.accountName,
      p_new_account_number: bankData.accountNumber,
      p_ip_address: ipAddress,
      p_user_agent: deviceInfo.userAgent,
    });

    // Send security email notification
    await sendBankSecurityEmail('bank_account_added', organizerId, {
      bankName: bankData.bankName,
      accountName: bankData.accountName,
      accountNumber: bankData.accountNumber,
      addedAt: new Date().toISOString(),
      activeAfter: coolingUntil,
      confirmationRequired: requireConfirmation,
      confirmationUrl: requireConfirmation 
        ? `${window.location.origin}/organizer/bank-accounts/confirm?token=${confirmationToken}`
        : null,
    });

    return {
      success: true,
      bankAccountId: bankAccount.id,
      requiresConfirmation: requireConfirmation,
      coolingUntil: coolingUntil,
    };
  } catch (error) {
    console.error('Add bank account error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update bank account with security measures
 * 
 * @param {string} bankAccountId - Bank account ID
 * @param {string} organizerId - Organizer ID
 * @param {object} updates - Fields to update
 * @returns {Promise<{success: boolean, requiresConfirmation?: boolean, coolingUntil?: string, error?: string}>}
 */
export async function updateBankAccount(bankAccountId, organizerId, updates) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required' };
    }

    // Get current bank account for logging
    const { data: currentBank, error: fetchError } = await supabase
      .from('organizer_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('organizer_id', organizerId)
      .single();

    if (fetchError || !currentBank) {
      return { success: false, error: 'Bank account not found' };
    }

    // Check if account number or bank is changing (requires confirmation)
    const isCriticalChange = 
      (updates.accountNumber && updates.accountNumber !== currentBank.account_number) ||
      (updates.bankCode && updates.bankCode !== currentBank.bank_code);

    const deviceInfo = getDeviceInfo();
    const ipAddress = await getClientIP();
    const coolingUntil = isCriticalChange 
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : currentBank.cooling_until;

    // Generate confirmation token for critical changes
    const confirmationToken = isCriticalChange ? crypto.randomUUID() : null;
    const confirmationExpires = isCriticalChange 
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : null;

    // Update bank account
    const { error: updateError } = await supabase
      .from('organizer_bank_accounts')
      .update({
        ...updates,
        ...(isCriticalChange && {
          is_verified: false,
          cooling_until: coolingUntil,
          is_pending_confirmation: true,
          confirmation_token: confirmationToken,
          confirmation_expires_at: confirmationExpires,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankAccountId)
      .eq('organizer_id', organizerId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the change
    await supabase.rpc('log_bank_account_change', {
      p_organizer_id: organizerId,
      p_bank_account_id: bankAccountId,
      p_user_id: session.user.id,
      p_change_type: 'updated',
      p_previous_bank_name: currentBank.bank_name,
      p_previous_account_name: currentBank.account_name,
      p_previous_account_number: currentBank.account_number,
      p_new_bank_name: updates.bankName || currentBank.bank_name,
      p_new_account_name: updates.accountName || currentBank.account_name,
      p_new_account_number: updates.accountNumber || currentBank.account_number,
      p_ip_address: ipAddress,
      p_user_agent: deviceInfo.userAgent,
    });

    // Send security email
    await sendBankSecurityEmail('bank_account_updated', organizerId, {
      bankName: updates.bankName || currentBank.bank_name,
      accountName: updates.accountName || currentBank.account_name,
      accountNumber: updates.accountNumber || currentBank.account_number,
      updatedAt: new Date().toISOString(),
      activeAfter: coolingUntil,
    });

    return {
      success: true,
      requiresConfirmation: isCriticalChange,
      coolingUntil: coolingUntil,
    };
  } catch (error) {
    console.error('Update bank account error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a bank account
 * 
 * @param {string} bankAccountId - Bank account ID
 * @param {string} organizerId - Organizer ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeBankAccount(bankAccountId, organizerId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required' };
    }

    // Get current bank account for logging
    const { data: currentBank, error: fetchError } = await supabase
      .from('organizer_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('organizer_id', organizerId)
      .single();

    if (fetchError || !currentBank) {
      return { success: false, error: 'Bank account not found' };
    }

    // Check if this is the only bank account
    const { count } = await supabase
      .from('organizer_bank_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', organizerId)
      .eq('is_active', true);

    if (count <= 1) {
      return { success: false, error: 'Cannot remove the only bank account' };
    }

    // Check for pending payouts
    const { data: pendingPayouts } = await supabase
      .from('payouts')
      .select('id')
      .eq('organizer_id', organizerId)
      .eq('status', 'pending')
      .limit(1);

    if (pendingPayouts?.length > 0) {
      return { success: false, error: 'Cannot remove bank account with pending payouts' };
    }

    const deviceInfo = getDeviceInfo();
    const ipAddress = await getClientIP();

    // Soft delete (mark as inactive)
    const { error: updateError } = await supabase
      .from('organizer_bank_accounts')
      .update({
        is_active: false,
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankAccountId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the removal
    await supabase.rpc('log_bank_account_change', {
      p_organizer_id: organizerId,
      p_bank_account_id: bankAccountId,
      p_user_id: session.user.id,
      p_change_type: 'removed',
      p_previous_bank_name: currentBank.bank_name,
      p_previous_account_name: currentBank.account_name,
      p_previous_account_number: currentBank.account_number,
      p_ip_address: ipAddress,
      p_user_agent: deviceInfo.userAgent,
    });

    // Send security email
    await sendBankSecurityEmail('bank_account_removed', organizerId, {
      bankName: currentBank.bank_name,
      accountNumber: currentBank.account_number,
      removedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Remove bank account error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Confirm bank account change via email token
 * 
 * @param {string} token - Confirmation token from email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function confirmBankAccountChange(token) {
  try {
    // Find bank account by confirmation token
    const { data: bankAccount, error: fetchError } = await supabase
      .from('organizer_bank_accounts')
      .select('*, organizers(id, user_id, business_name)')
      .eq('confirmation_token', token)
      .eq('is_pending_confirmation', true)
      .single();

    if (fetchError || !bankAccount) {
      return { success: false, error: 'Invalid or expired confirmation link' };
    }

    // Check if token is expired
    if (new Date(bankAccount.confirmation_expires_at) < new Date()) {
      return { success: false, error: 'Confirmation link has expired. Please request a new one.' };
    }

    // Update bank account
    const { error: updateError } = await supabase
      .from('organizer_bank_accounts')
      .update({
        is_pending_confirmation: false,
        confirmation_token: null,
        confirmation_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankAccount.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Update the change log
    await supabase
      .from('bank_account_changes')
      .update({
        confirmed_at: new Date().toISOString(),
      })
      .eq('bank_account_id', bankAccount.id)
      .eq('confirmation_required', true)
      .is('confirmed_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    return { success: true };
  } catch (error) {
    console.error('Confirm bank account error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if organizer can receive payouts
 * 
 * @param {string} organizerId - Organizer ID
 * @returns {Promise<{canReceive: boolean, reason: string, bankAccountId?: string}>}
 */
export async function canReceivePayout(organizerId) {
  try {
    const { data, error } = await supabase
      .rpc('can_organizer_receive_payout', { org_id: organizerId })
      .single();

    if (error) {
      console.error('Payout check error:', error);
      return { canReceive: false, reason: 'Unable to verify bank account status' };
    }

    return {
      canReceive: data.can_receive,
      reason: data.reason,
      bankAccountId: data.bank_account_id,
    };
  } catch (error) {
    console.error('Can receive payout error:', error);
    return { canReceive: false, reason: error.message };
  }
}

/**
 * Get bank account change history
 * 
 * @param {string} organizerId - Organizer ID
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>}
 */
export async function getBankChangeHistory(organizerId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('bank_account_changes')
      .select(`
        id,
        change_type,
        previous_bank_name,
        previous_account_name,
        previous_account_number_masked,
        new_bank_name,
        new_account_name,
        new_account_number_masked,
        is_suspicious,
        suspicious_reason,
        confirmation_required,
        confirmed_at,
        created_at
      `)
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get bank history error:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Get bank change history error:', error);
    return [];
  }
}

/**
 * Get time remaining in cooling period
 * 
 * @param {string} coolingUntil - ISO date string
 * @returns {{hours: number, minutes: number, isActive: boolean}}
 */
export function getCoolingTimeRemaining(coolingUntil) {
  if (!coolingUntil) return { hours: 0, minutes: 0, isActive: false };
  
  const now = new Date();
  const cooling = new Date(coolingUntil);
  const diff = cooling - now;
  
  if (diff <= 0) return { hours: 0, minutes: 0, isActive: false };
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes, isActive: true };
}

/**
 * Helper function to send bank security emails
 * 
 * @param {string} emailType - Type of security email
 * @param {string} organizerId - Organizer ID
 * @param {object} data - Email data
 */
async function sendBankSecurityEmail(emailType, organizerId, data) {
  try {
    // Get organizer details
    const { data: organizer, error } = await supabase
      .from('organizers')
      .select('business_name, user_id, profiles(email)')
      .eq('id', organizerId)
      .single();

    if (error || !organizer) {
      console.error('Failed to get organizer for email:', error);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    // Call the email Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify({
        type: emailType,
        to: organizer.profiles.email,
        data: {
          organizerName: organizer.business_name,
          ...data,
        },
        organizerId: organizerId,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send security email:', await response.text());
    }
  } catch (error) {
    console.error('Send bank security email error:', error);
  }
}

/**
 * Resend bank account confirmation email
 * 
 * @param {string} bankAccountId - Bank account ID
 * @param {string} organizerId - Organizer ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resendBankConfirmation(bankAccountId, organizerId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Authentication required' };
    }

    // Get bank account
    const { data: bankAccount, error: fetchError } = await supabase
      .from('organizer_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('organizer_id', organizerId)
      .eq('is_pending_confirmation', true)
      .single();

    if (fetchError || !bankAccount) {
      return { success: false, error: 'Bank account not found or already confirmed' };
    }

    // Generate new token
    const newToken = crypto.randomUUID();
    const newExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Update token
    const { error: updateError } = await supabase
      .from('organizer_bank_accounts')
      .update({
        confirmation_token: newToken,
        confirmation_expires_at: newExpires,
      })
      .eq('id', bankAccountId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Send new confirmation email
    await sendBankSecurityEmail('bank_change_confirmation', organizerId, {
      changeType: 'confirm',
      bankName: bankAccount.bank_name,
      accountNumber: bankAccount.account_number,
      requestedAt: new Date().toISOString(),
      confirmationUrl: `${window.location.origin}/organizer/bank-accounts/confirm?token=${newToken}`,
      cancelUrl: `${window.location.origin}/organizer/bank-accounts`,
    });

    return { success: true };
  } catch (error) {
    console.error('Resend confirmation error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  addBankAccount,
  updateBankAccount,
  removeBankAccount,
  confirmBankAccountChange,
  canReceivePayout,
  getBankChangeHistory,
  getCoolingTimeRemaining,
  resendBankConfirmation,
};
