import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, firstName, lastName, phone, countryCode, marketingConsent } = await req.json();

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !phone) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (remove + prefix for storage)
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    // Check if email already exists
    const { data: existingByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingByEmail) {
      return new Response(
        JSON.stringify({ error: "EMAIL_ALREADY_REGISTERED", userMessage: "An account with this email already exists." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if phone already exists (normalize for comparison)
    const normalizedPhone = formattedPhone.replace(/\D/g, '');
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, phone');

    const existingByPhone = allProfiles?.find(p => {
      const pNormalized = (p.phone || '').replace(/\D/g, '');
      return pNormalized === normalizedPhone;
    });

    if (existingByPhone) {
      return new Response(
        JSON.stringify({ error: "This phone number is already registered with another account." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user via Admin API WITHOUT sending confirmation email
    // The user will be created with email_confirmed_at = null
    // They will verify via either phone OTP or email OTP (their choice)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: false, // Do NOT send confirmation email
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: formattedPhone,
        country_code: countryCode || 'NG',
        marketing_consent: marketingConsent || false,
        marketing_consent_date: marketingConsent ? new Date().toISOString() : null,
      },
    });

    if (authError) {
      console.error('Signup error:', authError);

      if (authError.message?.includes('already registered') ||
          authError.message?.includes('already exists') ||
          authError.message?.includes('duplicate')) {
        return new Response(
          JSON.stringify({ error: "EMAIL_ALREADY_REGISTERED", userMessage: "An account with this email already exists." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send welcome email (non-blocking)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'welcome',
          to: email.toLowerCase().trim(),
          data: {
            firstName: firstName.trim(),
            appUrl: Deno.env.get('SITE_URL') || 'https://ticketrack.com'
          }
        }
      });
    } catch (emailErr) {
      console.warn('Welcome email may not have been sent:', emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created! Please verify your account.",
        email: email.toLowerCase().trim(),
        userId: authData.user.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Signup error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
