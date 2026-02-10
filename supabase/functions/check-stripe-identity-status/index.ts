import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organizer_id } = await req.json();
    if (!organizer_id) {
      return new Response(JSON.stringify({ error: "organizer_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organizer and verify ownership
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("id, user_id, business_name, stripe_identity_session_id, stripe_identity_status, kyc_status, kyc_verified")
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

    // Already verified
    if (organizer.kyc_verified || organizer.stripe_identity_status === "verified") {
      return new Response(JSON.stringify({ status: "verified" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No session to check
    if (!organizer.stripe_identity_session_id) {
      return new Response(JSON.stringify({ status: "no_session" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Stripe secret key
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

    // Check session status with Stripe
    const sessionResponse = await fetch(
      `https://api.stripe.com/v1/identity/verification_sessions/${organizer.stripe_identity_session_id}`,
      {
        headers: {
          "Authorization": `Bearer ${gatewayConfig.secret_key_encrypted}`,
        },
      }
    );

    const session = await sessionResponse.json();

    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeStatus = session.status; // verified, requires_input, canceled, processing

    // Update organizer based on Stripe session status
    if (stripeStatus === "verified") {
      await supabase.from("organizers").update({
        kyc_status: "verified",
        kyc_verified: true,
        stripe_identity_status: "verified",
        updated_at: new Date().toISOString(),
      }).eq("id", organizer_id);

      // Send verification email
      const { data: profile } = await supabase.from("profiles")
        .select("email").eq("id", organizer.user_id).single();
      if (profile?.email) {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "kyc_verified",
            to: profile.email,
            data: { organizerName: organizer.business_name, appUrl: "https://ticketrack.com" },
          },
        });
      }

      // Audit log
      await supabase.from("admin_audit_logs").insert({
        action: "kyc_auto_verified",
        entity_type: "organizer",
        entity_id: organizer_id,
        details: { method: "stripe_identity_poll", session_id: session.id },
      });
    } else if (stripeStatus !== organizer.stripe_identity_status) {
      // Update status if changed
      await supabase.from("organizers").update({
        stripe_identity_status: stripeStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", organizer_id);
    }

    return new Response(JSON.stringify({ status: stripeStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error checking identity status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
