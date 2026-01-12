import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createHmac, timingSafeEqual } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const parts = signature.split(',');
    let timestamp = '';
    let sig = '';
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') sig = value;
    }
    if (!timestamp || !sig) return false;
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) return false;
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = createHmac('sha256', secret).update(signedPayload).digest('hex');
    const sigBuffer = new TextEncoder().encode(sig);
    const expectedBuffer = new TextEncoder().encode(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("webhook_secret_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", "US")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig?.webhook_secret_encrypted) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { 
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const isValid = verifyStripeSignature(body, signature, gatewayConfig.webhook_secret_encrypted);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const event = JSON.parse(body);
    console.log(`Processing Identity webhook: ${event.type}`);

    switch (event.type) {
      case "identity.verification_session.verified": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        if (organizerId) {
          await supabase.from("organizers").update({
            kyc_status: "verified",
            kyc_verified: true,
            kyc_level: 1,
            stripe_identity_status: "verified",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);

          const { data: organizer } = await supabase.from("organizers")
            .select("business_name, user_id").eq("id", organizerId).single();
          if (organizer) {
            const { data: profile } = await supabase.from("profiles")
              .select("email").eq("id", organizer.user_id).single();
            if (profile?.email) {
              await supabase.functions.invoke("send-email", {
                body: { type: "kyc_verified", to: profile.email, data: { organizerName: organizer.business_name, appUrl: "https://ticketrack.com" } },
              });
            }
          }
          await supabase.from("admin_audit_logs").insert({
            action: "kyc_auto_verified", entity_type: "organizer", entity_id: organizerId,
            details: { method: "stripe_identity", session_id: session.id },
          });
        }
        break;
      }
      case "identity.verification_session.requires_input": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "requires_input", updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
          const { data: organizer } = await supabase.from("organizers")
            .select("business_name, user_id").eq("id", organizerId).single();
          if (organizer) {
            const { data: profile } = await supabase.from("profiles")
              .select("email").eq("id", organizer.user_id).single();
            if (profile?.email) {
              await supabase.functions.invoke("send-email", {
                body: { type: "kyc_action_required", to: profile.email, data: { organizerName: organizer.business_name, appUrl: "https://ticketrack.com", message: "Additional information is required." } },
              });
            }
          }
        }
        break;
      }
      case "identity.verification_session.canceled": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "canceled", updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
        }
        break;
      }
      case "identity.verification_session.processing": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "processing", updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
        }
        break;
      }
      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
