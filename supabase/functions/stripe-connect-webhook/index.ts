import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createHmac, timingSafeEqual } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Manual Stripe signature verification (Deno compatible)
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
    
    // Check timestamp is within 5 minutes
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (timestampAge > 300) return false;
    
    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    
    // Timing-safe comparison
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
      console.error("No Stripe signature found");
      return new Response(JSON.stringify({ error: "No signature" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get webhook secret from config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("webhook_secret_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", "US")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig?.webhook_secret_encrypted) {
      console.error("Webhook secret not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Verify signature
    const isValid = verifyStripeSignature(body, signature, gatewayConfig.webhook_secret_encrypted);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Parse event
    const event = JSON.parse(body);
    console.log(`Processing webhook event: ${event.type}`);

    // Log event for audit trail
    await supabase.from("stripe_connect_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      stripe_account_id: event.account || null,
      payload: event.data.object,
    });

    // Handle different event types
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object;
        console.log(`Account updated: ${account.id}, charges_enabled: ${account.charges_enabled}, payouts_enabled: ${account.payouts_enabled}`);
        
        // Find organizer by Connect ID
        const { data: organizer } = await supabase
          .from("organizers")
          .select("id, stripe_connect_status")
          .eq("stripe_connect_id", account.id)
          .single();

        if (organizer) {
          // Determine status based on account state
          let status = "pending";
          if (account.charges_enabled && account.payouts_enabled) {
            status = "active";
          } else if (account.requirements?.disabled_reason) {
            status = "restricted";
          }

          console.log(`Updating organizer ${organizer.id} to status: ${status}`);

          // Update organizer record
          const { error: updateError } = await supabase
            .from("organizers")
            .update({
              stripe_connect_status: status,
              stripe_connect_payouts_enabled: account.payouts_enabled || false,
              stripe_connect_charges_enabled: account.charges_enabled || false,
              stripe_connect_onboarded_at: status === "active" ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", organizer.id);

          if (updateError) {
            console.error("Failed to update organizer:", updateError);
          } else {
            // Send activation email if status changed to active
            if (status === "active" && organizer.stripe_connect_status !== "active") {
              try {
                const { data: orgDetails } = await supabase
                  .from("organizers")
                  .select("business_name, user_id")
                  .eq("id", organizer.id)
                  .single();
                
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("email")
                  .eq("id", orgDetails?.user_id)
                  .single();
                
                if (profile?.email) {
                  await supabase.functions.invoke("send-email", {
                    body: {
                      type: "stripe_connect_activated",
                      to: profile.email,
                      data: {
                        organizerName: orgDetails?.business_name,
                        platformFeePercent: "5",
                        appUrl: "https://ticketrack.com",
                      },
                    },
                  });
                  console.log("Sent Connect activation email to:", profile.email);
                }
              } catch (emailErr) {
                console.error("Failed to send activation email:", emailErr);
              }
            }
            console.log(`Successfully updated organizer ${organizer.id}`);
          }
        } else {
          console.log(`No organizer found for account ${account.id}`);
        }
        break;
      }

      case "account.application.deauthorized": {
        const account = event.data.object;
        console.log(`Account deauthorized: ${account.id}`);
        
        await supabase
          .from("organizers")
          .update({
            stripe_connect_status: "disabled",
            stripe_connect_disabled_reason: "Account disconnected by user",
            stripe_connect_disabled_at: new Date().toISOString(),
            stripe_connect_payouts_enabled: false,
            stripe_connect_charges_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_connect_id", account.id);
        break;
      }

      case "payout.paid": {
        const payout = event.data.object;
        console.log(`Payout paid: ${payout.id}`);
        
        await supabase
          .from("stripe_connect_payouts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payout_id", payout.id);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object;
        console.log(`Payout failed: ${payout.id}`);
        
        await supabase
          .from("stripe_connect_payouts")
          .update({
            status: "failed",
            failure_reason: payout.failure_message || "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payout_id", payout.id);
        break;
      }

      case "capability.updated": {
        const capability = event.data.object;
        console.log(`Capability updated: ${capability.id}, status: ${capability.status}`);
        
        if (capability.account && capability.status === "inactive") {
          const { data: organizer } = await supabase
            .from("organizers")
            .select("id")
            .eq("stripe_connect_id", capability.account)
            .single();

          if (organizer) {
            await supabase
              .from("organizers")
              .update({
                stripe_connect_status: "restricted",
                updated_at: new Date().toISOString(),
              })
              .eq("id", organizer.id);
          }
        }
        break;
      }

      // ===== STRIPE IDENTITY EVENTS =====
      case "identity.verification_session.verified": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        console.log(`Identity verified for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            kyc_status: "verified",
            kyc_verified: true,
            kyc_level: 1,
            stripe_identity_status: "verified",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);

          // Send success email
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
        console.log(`Identity requires input for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "requires_input",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);

          // Notify organizer
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
        console.log(`Identity canceled for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "canceled",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
        }
        break;
      }

      case "identity.verification_session.processing": {
        const session = event.data.object;
        const organizerId = session.metadata?.organizer_id;
        console.log(`Identity processing for organizer: ${organizerId}`);

        if (organizerId) {
          await supabase.from("organizers").update({
            stripe_identity_status: "processing",
            updated_at: new Date().toISOString(),
          }).eq("id", organizerId);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
