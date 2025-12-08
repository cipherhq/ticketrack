// Termii API Integration
// Docs: https://developers.termii.com/

const TERMII_API_URL = 'https://api.ng.termii.com/api';

// Get API key from Supabase platform config
export async function getTermiiConfig(supabase) {
  const { data } = await supabase
    .from('platform_sms_config')
    .select('*')
    .single();
  
  return data;
}

// Send SMS via Termii
export async function sendSMS({ to, message, apiKey, senderId = 'Ticketrack' }) {
  try {
    const response = await fetch(`${TERMII_API_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        to: formatPhoneNumber(to),
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
      }),
    });

    const data = await response.json();
    
    if (data.code === 'ok' || response.ok) {
      return { success: true, messageId: data.message_id, data };
    } else {
      return { success: false, error: data.message || 'Failed to send SMS' };
    }
  } catch (error) {
    console.error('Termii SMS error:', error);
    return { success: false, error: error.message };
  }
}

// Send WhatsApp via Termii
export async function sendWhatsApp({ to, message, apiKey }) {
  try {
    const response = await fetch(`${TERMII_API_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        to: formatPhoneNumber(to),
        from: 'Ticketrack',
        sms: message,
        type: 'plain',
        channel: 'whatsapp',
      }),
    });

    const data = await response.json();
    
    if (data.code === 'ok' || response.ok) {
      return { success: true, messageId: data.message_id, data };
    } else {
      return { success: false, error: data.message || 'Failed to send WhatsApp' };
    }
  } catch (error) {
    console.error('Termii WhatsApp error:', error);
    return { success: false, error: error.message };
  }
}

// Send bulk SMS
export async function sendBulkSMS({ recipients, message, apiKey, senderId = 'Ticketrack' }) {
  const results = [];
  
  for (const recipient of recipients) {
    const phone = recipient.phone || recipient.attendee_phone || recipient.customer_phone;
    if (!phone) continue;
    
    const result = await sendSMS({
      to: phone,
      message,
      apiKey,
      senderId,
    });
    
    results.push({
      phone,
      name: recipient.name || recipient.attendee_name || recipient.customer_name,
      ...result,
    });
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

// Send bulk WhatsApp
export async function sendBulkWhatsApp({ recipients, message, apiKey }) {
  const results = [];
  
  for (const recipient of recipients) {
    const phone = recipient.phone || recipient.attendee_phone || recipient.customer_phone;
    if (!phone) continue;
    
    const result = await sendWhatsApp({
      to: phone,
      message,
      apiKey,
    });
    
    results.push({
      phone,
      name: recipient.name || recipient.attendee_name || recipient.customer_name,
      ...result,
    });
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

// Check account balance
export async function getBalance(apiKey) {
  try {
    const response = await fetch(`${TERMII_API_URL}/get-balance?api_key=${apiKey}`);
    const data = await response.json();
    return { success: true, balance: data.balance, currency: data.currency };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Verify phone number format (Nigerian numbers)
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Handle Nigerian numbers
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

export default {
  sendSMS,
  sendWhatsApp,
  sendBulkSMS,
  sendBulkWhatsApp,
  getBalance,
};
