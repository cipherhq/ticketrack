import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Verify via Twilio Verify API
async function verifyTwilioCode(
  to: string,
  code: string,
  accountSid: string,
  authToken: string,
  verifyServiceSid: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const formattedTo = '+' + formatPhoneNumber(to);
    const credentials = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          Code: code,
        }),
      }
    );

    const data = await response.json();
    console.log('Twilio Verify Check response:', JSON.stringify(data));

    if (response.ok && data.status === 'approved') {
      return { success: true, status: data.status };
    }
    return { success: false, error: data.message || 'Invalid code', status: data.status };
  } catch (error) {
    console.error('Twilio Verify Check error:', error);
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

    const { phone, otp, type = 'login' } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: 'Phone and OTP are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);

    // Find the OTP record to determine provider
    const { data: otpRecord, error: fetchError } = await supabase
      .from('phone_otps')
      .select('*')
      .eq('phone', formattedPhone)
      .eq('type', type)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: 'OTP expired or not found. Please request a new one.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      await supabase.from('phone_otps').delete().eq('id', otpRecord.id);
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please request a new OTP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let verified = false;

    // If sent via Twilio Verify, verify through their API
    if (otpRecord.otp_hash === 'TWILIO_VERIFY' || otpRecord.provider === 'twilio_verify') {
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioVerifySid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

      if (!twilioSid || !twilioToken || !twilioVerifySid) {
        return new Response(
          JSON.stringify({ error: 'Verification service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await verifyTwilioCode(formattedPhone, otp, twilioSid, twilioToken, twilioVerifySid);
      verified = result.success;

      if (!verified) {
        await supabase
          .from('phone_otps')
          .update({ attempts: otpRecord.attempts + 1 })
          .eq('id', otpRecord.id);

        return new Response(
          JSON.stringify({ error: 'Invalid verification code. Please try again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // For Termii/other providers, verify against stored OTP
      if (otpRecord.otp_hash !== otp) {
        await supabase
          .from('phone_otps')
          .update({ attempts: otpRecord.attempts + 1 })
          .eq('id', otpRecord.id);

        return new Response(
          JSON.stringify({ error: 'Invalid OTP. Please try again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      verified = true;
    }

    // Mark OTP as verified
    await supabase
      .from('phone_otps')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    // Find existing user by phone
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .eq('phone', formattedPhone)
      .single();

    if (existingProfile) {
      // User exists - get their auth record and create session
      const { data: authData } = await supabase.auth.admin.getUserById(existingProfile.id);
      
      if (authData?.user?.email) {
        // Generate a magic link and extract the token for direct sign-in
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: authData.user.email,
          options: {
            redirectTo: `${Deno.env.get('SITE_URL') || 'https://ticketrack.com'}/profile`
          }
        });

        if (!linkError && linkData?.properties?.hashed_token) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              verified: true,
              user: {
                id: existingProfile.id,
                phone: formattedPhone,
                email: authData.user.email,
                full_name: existingProfile.full_name,
              },
              // Return token info for client-side session creation
              token_hash: linkData.properties.hashed_token,
              email: authData.user.email,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Fallback - return user info without session
      return new Response(
        JSON.stringify({ 
          success: true, 
          verified: true,
          user: {
            id: existingProfile.id,
            phone: formattedPhone,
            full_name: existingProfile.full_name,
          },
          requiresEmailLogin: true,
          message: 'Phone verified. Please login with email to continue.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // New user - phone verified but needs to complete registration
      return new Response(
        JSON.stringify({ 
          success: true, 
          verified: true,
          isNewUser: true,
          phone: formattedPhone,
          message: 'Phone verified. Please complete registration.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
