import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone prefix to country mapping
const PHONE_PREFIX_TO_COUNTRY: Record<string, string> = {
  '234': 'NG', '233': 'GH', '254': 'KE', '27': 'ZA',
  '1': 'US', '44': 'GB', '1242': 'BS', '1246': 'BB',
};

// Provider priority by country
const PROVIDER_PRIORITY: Record<string, string[]> = {
  'US': ['messagebird', 'twilio'],
  'GB': ['messagebird', 'twilio'],
  'CA': ['messagebird', 'twilio'],
  'NG': ['messagebird', 'termii'],
  'GH': ['messagebird', 'termii'],
  'KE': ['messagebird', 'termii'],
  'ZA': ['messagebird', 'termii'],
  'DEFAULT': ['messagebird', 'twilio', 'termii'],
};

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

function detectCountryFromPhone(phone: string): string {
  const cleaned = formatPhoneNumber(phone);
  for (let len = 4; len >= 1; len--) {
    const prefix = cleaned.substring(0, len);
    if (PHONE_PREFIX_TO_COUNTRY[prefix]) {
      return PHONE_PREFIX_TO_COUNTRY[prefix];
    }
  }
  return 'NG';
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// MessageBird SMS
async function sendMessageBirdSMS(
  to: string,
  message: string,
  apiKey: string,
  originator: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const formattedTo = '+' + formatPhoneNumber(to);
    
    const response = await fetch('https://rest.messagebird.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originator: originator,
        recipients: [formattedTo],
        body: message,
      }),
    });

    const data = await response.json();
    console.log('MessageBird response:', JSON.stringify(data));

    if (response.ok && data.id) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.errors?.[0]?.description || 'MessageBird failed' };
  } catch (error) {
    console.error('MessageBird error:', error);
    return { success: false, error: error.message };
  }
}

// Twilio SMS
async function sendTwilioSMS(
  to: string,
  message: string,
  accountSid: string,
  authToken: string,
  fromNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const formattedTo = '+' + formatPhoneNumber(to);
    const credentials = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append('To', formattedTo);
    formData.append('From', fromNumber);
    formData.append('Body', message);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    const data = await response.json();
    console.log('Twilio response:', JSON.stringify(data));

    if (response.ok && data.sid) {
      return { success: true, messageId: data.sid };
    }
    return { success: false, error: data.message || 'Twilio failed' };
  } catch (error) {
    console.error('Twilio error:', error);
    return { success: false, error: error.message };
  }
}

// Termii SMS
async function sendTermiiSMS(
  to: string,
  message: string,
  apiKey: string,
  senderId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    console.log('Termii response:', JSON.stringify(data));

    if (data.code === 'ok' || response.ok) {
      return { success: true, messageId: data.message_id };
    }
    return { success: false, error: data.message || 'Termii failed' };
  } catch (error) {
    console.error('Termii error:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, type = 'login' } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    const country = detectCountryFromPhone(formattedPhone);
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Rate limiting: Check for recent OTPs
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentOtps } = await supabase
      .from('phone_otps')
      .select('id')
      .eq('phone', formattedPhone)
      .gte('created_at', fiveMinutesAgo);

    if (recentOtps && recentOtps.length >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many OTP requests. Please wait 5 minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('phone_otps')
      .insert({
        phone: formattedPhone,
        otp_hash: otp,
        type,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      });

    if (insertError) {
      console.error('Failed to store OTP:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get provider credentials from environment
    const messagebirdKey = Deno.env.get('MESSAGEBIRD_API_KEY');
    const messagebirdOriginator = Deno.env.get('MESSAGEBIRD_ORIGINATOR') || 'Ticketrack';
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioFrom = Deno.env.get('TWILIO_FROM_NUMBER');
    const termiiKey = Deno.env.get('TERMII_API_KEY');
    const termiiSender = Deno.env.get('TERMII_SENDER_ID') || 'Ticketrack';

    const message = `Your Ticketrack verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    
    // Get provider priority for this country
    const providers = PROVIDER_PRIORITY[country] || PROVIDER_PRIORITY['DEFAULT'];
    
    let result: { success: boolean; messageId?: string; error?: string } = { success: false, error: 'No provider available' };
    let usedProvider = '';

    // Try providers in priority order
    for (const provider of providers) {
      if (provider === 'messagebird' && messagebirdKey) {
        console.log(`Trying MessageBird for ${country}...`);
        result = await sendMessageBirdSMS(formattedPhone, message, messagebirdKey, messagebirdOriginator);
        if (result.success) {
          usedProvider = 'messagebird';
          break;
        }
      } else if (provider === 'twilio' && twilioSid && twilioToken && twilioFrom) {
        console.log(`Trying Twilio for ${country}...`);
        result = await sendTwilioSMS(formattedPhone, message, twilioSid, twilioToken, twilioFrom);
        if (result.success) {
          usedProvider = 'twilio';
          break;
        }
      } else if (provider === 'termii' && termiiKey) {
        console.log(`Trying Termii for ${country}...`);
        result = await sendTermiiSMS(formattedPhone, message, termiiKey, termiiSender);
        if (result.success) {
          usedProvider = 'termii';
          break;
        }
      }
    }

    if (!result.success) {
      // Clean up failed OTP
      await supabase
        .from('phone_otps')
        .delete()
        .eq('phone', formattedPhone)
        .eq('otp_hash', otp);

      return new Response(
        JSON.stringify({ error: 'Failed to send OTP. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log success
    console.log(`OTP sent via ${usedProvider} to ${formattedPhone.slice(0, 5)}***`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent successfully',
        phone: `+${formattedPhone.slice(0, 3)}****${formattedPhone.slice(-4)}`,
        expiresIn: 600,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OTP Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
