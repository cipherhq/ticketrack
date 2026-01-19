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
// US/UK/CA use Twilio Verify, Nigeria/Ghana/Kenya/ZA use Termii
const PROVIDER_PRIORITY: Record<string, string[]> = {
  'US': ['twilio_verify'],
  'GB': ['twilio_verify'],
  'CA': ['twilio_verify'],
  'NG': ['termii', 'twilio_verify'],
  'GH': ['termii', 'twilio_verify'],
  'KE': ['termii', 'twilio_verify'],
  'ZA': ['termii', 'twilio_verify'],
  'DEFAULT': ['twilio_verify', 'termii'],
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

// Twilio Verify - sends OTP via Twilio's pre-registered service
async function sendTwilioVerify(
  to: string,
  accountSid: string,
  authToken: string,
  verifyServiceSid: string,
  channel: string = 'sms'
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const formattedTo = '+' + formatPhoneNumber(to);
    const credentials = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          Channel: channel,
        }),
      }
    );

    const data = await response.json();
    console.log('Twilio Verify response:', JSON.stringify(data));

    if (response.ok && data.status === 'pending') {
      return { success: true, status: data.status };
    }
    return { success: false, error: data.message || 'Twilio Verify failed' };
  } catch (error) {
    console.error('Twilio Verify error:', error);
    return { success: false, error: error.message };
  }
}

// Termii SMS - for Nigeria, Ghana, Kenya, South Africa, and other supported countries
async function sendTermiiOTP(
  to: string,
  otp: string,
  apiKey: string,
  senderId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const message = `Your Ticketrack verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    
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

// Cryptographically secure OTP generation using Web Crypto API
function generateOTP(): string {
  // Generate secure random bytes
  const array = new Uint8Array(3); // 3 bytes = 24 bits, enough for 6-digit OTP
  crypto.getRandomValues(array);
  
  // Convert to 6-digit number (100000-999999)
  // Combine bytes to create a number in the desired range
  const randomValue = (array[0] << 16) | (array[1] << 8) | array[2];
  const otp = 100000 + (randomValue % 900000);
  
  return otp.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, type = 'login', channel = 'sms' } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    const country = detectCountryFromPhone(formattedPhone);

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

    // Get provider credentials
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioVerifySid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');
    const termiiKey = Deno.env.get('TERMII_API_KEY');
    const termiiSender = Deno.env.get('TERMII_SENDER_ID') || 'Ticketrack';

    // Get provider priority for this country
    const providers = PROVIDER_PRIORITY[country] || PROVIDER_PRIORITY['DEFAULT'];
    
    let result: { success: boolean; status?: string; messageId?: string; error?: string } = { 
      success: false, 
      error: 'No provider available' 
    };
    let usedProvider = '';
    let otp = '';
    let useTwilioVerify = false;

    // Try providers in priority order
    for (const provider of providers) {
      if (provider === 'twilio_verify' && twilioSid && twilioToken && twilioVerifySid) {
        console.log(`Trying Twilio Verify for ${country}...`);
        result = await sendTwilioVerify(formattedPhone, twilioSid, twilioToken, twilioVerifySid, channel);
        if (result.success) {
          usedProvider = 'twilio_verify';
          useTwilioVerify = true;
          break;
        }
      } else if (provider === 'termii' && termiiKey) {
        console.log(`Trying Termii for ${country}...`);
        otp = generateOTP();
        result = await sendTermiiOTP(formattedPhone, otp, termiiKey, termiiSender);
        if (result.success) {
          usedProvider = 'termii';
          break;
        }
      }
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: 'Failed to send OTP. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For Termii, store OTP in database (Twilio Verify handles this internally)
    if (!useTwilioVerify && otp) {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      const { error: insertError } = await supabase
        .from('phone_otps')
        .insert({
          phone: formattedPhone,
          otp_hash: otp,
          type,
          expires_at: expiresAt.toISOString(),
          attempts: 0,
          provider: usedProvider,
        });

      if (insertError) {
        console.error('Failed to store OTP:', insertError);
      }
    } else {
      // For Twilio Verify, store a record without OTP (verification happens via Twilio API)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await supabase
        .from('phone_otps')
        .insert({
          phone: formattedPhone,
          otp_hash: 'TWILIO_VERIFY', // Marker that Twilio Verify handles this
          type,
          expires_at: expiresAt.toISOString(),
          attempts: 0,
          provider: 'twilio_verify',
        });
    }

    // Log success
    console.log(`OTP sent via ${usedProvider} to ${formattedPhone.slice(0, 5)}***`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent successfully',
        phone: `+${formattedPhone.slice(0, 3)}****${formattedPhone.slice(-4)}`,
        expiresIn: 600,
        provider: usedProvider,
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
