import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const { organizer_id, return_url } = await req.json();

    if (!organizer_id) {
      return new Response(JSON.stringify({ error: "organizer_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify organizer belongs to user and is in eligible country
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("id, user_id, business_name, country_code, kyc_status, stripe_identity_status")
      .eq("id", organizer_id)
      .single();

    if (orgError || !organizer) {
      return new Response(JSON.stringify({ error: "Organizer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (organizer.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check eligible countries for Stripe Identity
    const eligibleCountries = ["US", "GB", "CA"];
    if (!eligibleCountries.includes(organizer.country_code)) {
      return new Response(JSON.stringify({ 
        error: "Stripe Identity not available for your country",
        country_code: organizer.country_code 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already verified
    if (organizer.kyc_status === "verified" || organizer.stripe_identity_status === "verified") {
      return new Response(JSON.stringify({ 
        error: "Already verified",
        status: "verified"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Stripe secret key from payment_gateway_config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", "US")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig?.secret_key_encrypted) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = gatewayConfig.secret_key_encrypted;

    // Create Stripe Identity VerificationSession
    const sessionResponse = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "type": "document",
        "metadata[organizer_id]": organizer_id,
        "metadata[user_id]": user.id,
        "options[document][allowed_types][]": "passport",
        "options[document][allowed_types][]": "driving_license", 
        "options[document][allowed_types][]": "id_card",
        "return_url": return_url || `${req.headers.get("origin")}/organizer/kyc?session_complete=true`,
      }),
    });

    const session = await sessionResponse.json();

    if (session.error) {
      console.error("Stripe Identity error:", session.error);
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update organizer with session ID
    await supabase
      .from("organizers")
      .update({
        stripe_identity_session_id: session.id,
        stripe_identity_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizer_id);

    // Log the event
    await supabase.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "stripe_identity_session_created",
      entity_type: "organizer",
      entity_id: organizer_id,
      details: {
        session_id: session.id,
        country_code: organizer.country_code,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      session_id: session.id,
      url: session.url,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error creating identity session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
