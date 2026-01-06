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

    // Find valid OTP
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

    // Verify OTP
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

    // Mark OTP as verified
    await supabase
      .from('phone_otps')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    // For login - find user and generate session
    if (type === 'login') {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('phone', formattedPhone)
        .single();

      if (existingUser) {
        // Generate magic link for session
        const { data: authData } = await supabase.auth.admin.getUserById(existingUser.id);
        
        if (authData?.user?.email) {
          const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: authData.user.email,
          });

          if (!linkError && linkData) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                verified: true,
                user: {
                  id: existingUser.id,
                  phone: formattedPhone,
                  email: authData.user.email,
                  full_name: existingUser.full_name,
                },
                actionLink: linkData.properties?.action_link,
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            verified: true,
            user: {
              id: existingUser.id,
              phone: formattedPhone,
              full_name: existingUser.full_name,
            },
            requiresEmailLogin: true,
            message: 'Phone verified. Please login with email to continue.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
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
    }

    // For signup verification
    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: true,
        phone: formattedPhone,
        message: 'Phone verified successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
