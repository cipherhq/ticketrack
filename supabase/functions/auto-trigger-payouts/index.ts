import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting auto-payout process...");

    const { data: delaySetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "stripe_connect_payout_delay_days")
      .single();

    const payoutDelayDays = parseInt(delaySetting?.value || "3");
    console.log(`Payout delay: ${payoutDelayDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - payoutDelayDays);
    const cutoffDateStr = cutoffDate.toISOString();

    console.log(`Looking for events ended before: ${cutoffDateStr}`);

    const { data: eligibleEvents, error: eventsError } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        end_date,
        organizer_id,
        organizers!inner (
          id,
          business_name,
          user_id,
          stripe_connect_id,
          stripe_connect_status,
          stripe_connect_payouts_enabled,
          stripe_connect_charges_enabled,
          country_code,
          kyc_status,
          kyc_verified,
          stripe_identity_status
        )
      `)
      .lt("end_date", cutoffDateStr)
      .not("organizers.stripe_connect_id", "is", null)
      .eq("organizers.stripe_connect_status", "active")
      .eq("organizers.stripe_connect_payouts_enabled", true);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw new Error("Failed to fetch eligible events");
    }

    console.log(`Found ${eligibleEvents?.length || 0} eligible events`);

    if (!eligibleEvents || eligibleEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No events eligible for payout",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", "US")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured");
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    const { data: minPayoutSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "stripe_connect_minimum_payout")
      .single();

    const minimumPayout = parseFloat(minPayoutSetting?.value || "10");

    const results = [];
    const kycBlockedOrganizers = [];
    const processedOrganizers = new Set();

    for (const event of eligibleEvents) {
      const organizer = event.organizers;

      if (processedOrganizers.has(organizer.id)) {
        console.log(`Skipping ${organizer.business_name} - already processed`);
        continue;
      }

      console.log(`Processing organizer: ${organizer.business_name}`);

      // SECURITY: KYC VERIFICATION CHECK
      const isKYCVerified = await checkKYCStatus(supabase, organizer);

      if (!isKYCVerified) {
        console.log(`KYC not verified for ${organizer.business_name} - skipping payout`);
        
        kycBlockedOrganizers.push({
          organizer_id: organizer.id,
          business_name: organizer.business_name,
          kyc_status: organizer.kyc_status,
          event_title: event.title,
        });

        await supabase.from("admin_audit_logs").insert({
          action: "auto_payout_blocked_kyc",
          entity_type: "organizer",
          entity_id: organizer.id,
          details: {
            reason: "KYC verification required",
            event_id: event.id,
            event_title: event.title,
            kyc_status: organizer.kyc_status,
            kyc_verified: organizer.kyc_verified,
            stripe_identity_status: organizer.stripe_identity_status,
          },
        });

        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", organizer.user_id)
            .single();

          if (profile?.email) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "payout_blocked_kyc",
                to: profile.email,
                data: {
                  organizerName: organizer.business_name,
                  eventTitle: event.title,
                  message: "Your payout is pending KYC verification. Please complete identity verification to receive your funds.",
                  appUrl: "https://ticketrack.com/organizer/kyc-verification",
                },
              },
            });
          }
        } catch (emailErr) {
          console.error("Failed to send KYC blocked email:", emailErr);
        }

        processedOrganizers.add(organizer.id);
        continue;
      }

      try {
        const { data: existingPayout } = await supabase
          .from("stripe_connect_payouts")
          .select("id")
          .eq("event_id", event.id)
          .eq("organizer_id", organizer.id)
          .in("status", ["pending", "completed"])
          .single();

        if (existingPayout) {
          console.log(`Payout already exists for event ${event.title}`);
          continue;
        }

        const balance = await stripe.balance.retrieve({
          stripeAccount: organizer.stripe_connect_id,
        });

        for (const available of balance.available) {
          const amount = available.amount / 100;
          const currency = available.currency.toUpperCase();

          console.log(`${organizer.business_name}: ${currency} ${amount} available`);

          if (amount < minimumPayout) {
            console.log(`Below minimum threshold (${minimumPayout}), skipping`);
            continue;
          }

          const payout = await stripe.payouts.create(
            {
              amount: available.amount,
              currency: available.currency,
              metadata: {
                organizer_id: organizer.id,
                event_id: event.id,
                triggered_by: "auto_payout_system",
                kyc_verified: "true",
              },
            },
            {
              stripeAccount: organizer.stripe_connect_id,
            }
          );

          console.log(`Payout created: ${payout.id}`);

          const { error: insertError } = await supabase
            .from("stripe_connect_payouts")
            .insert({
              organizer_id: organizer.id,
              event_id: event.id,
              stripe_payout_id: payout.id,
              stripe_account_id: organizer.stripe_connect_id,
              amount: amount,
              currency: currency,
              status: "pending",
              triggered_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error("Failed to record payout:", insertError);
          }

          results.push({
            organizer: organizer.business_name,
            event: event.title,
            amount,
            currency,
            payoutId: payout.id,
            status: "success",
          });

          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", organizer.user_id)
              .single();

            if (profile?.email) {
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "stripe_connect_payout_initiated",
                  to: profile.email,
                  data: {
                    organizerName: organizer.business_name,
                    eventTitle: event.title,
                    amount: amount.toFixed(2),
                    currency: currency,
                  },
                },
              });
            }
          } catch (emailErr) {
            console.error("Failed to send payout email:", emailErr);
          }
        }

        processedOrganizers.add(organizer.id);
      } catch (err) {
        console.error(`Error processing ${organizer.business_name}:`, err);
        results.push({
          organizer: organizer.business_name,
          event: event.title,
          status: "error",
          error: err.message,
        });
      }
    }

    await supabase.from("admin_audit_logs").insert({
      admin_id: null,
      action: "auto_payout_triggered",
      entity_type: "payout",
      details: {
        events_checked: eligibleEvents.length,
        payouts_created: results.filter((r) => r.status === "success").length,
        kyc_blocked: kycBlockedOrganizers.length,
        kyc_blocked_organizers: kycBlockedOrganizers,
        results,
      },
    });

    console.log("Auto-payout process completed");
    console.log(`KYC blocked: ${kycBlockedOrganizers.length} organizers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} payouts`,
        processed: results.filter((r) => r.status === "success").length,
        kyc_blocked: kycBlockedOrganizers.length,
        results,
        kyc_blocked_organizers: kycBlockedOrganizers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-payout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkKYCStatus(supabase: any, organizer: any): Promise<boolean> {
  if (organizer.kyc_verified === true) return true;
  if (organizer.stripe_identity_status === "verified") return true;

  if (
    organizer.stripe_connect_status === "active" &&
    organizer.stripe_connect_charges_enabled === true &&
    organizer.stripe_connect_payouts_enabled === true
  ) {
    const { data: autoTrustSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "stripe_connect_auto_trust_kyc")
      .single();

    if (autoTrustSetting?.value === "true") return true;
  }

  const { data: approvedDocs, error } = await supabase
    .from("kyc_documents")
    .select("id, status")
    .eq("organizer_id", organizer.id)
    .eq("status", "approved")
    .limit(1);

  if (!error && approvedDocs && approvedDocs.length > 0) return true;

  const { data: kycVerification } = await supabase
    .from("kyc_verifications")
    .select("verification_level, bvn_verified, status")
    .eq("organizer_id", organizer.id)
    .single();

  if (kycVerification) {
    if (kycVerification.verification_level >= 1 && kycVerification.status === "verified") return true;
    if (kycVerification.bvn_verified === true) return true;
  }

  return false;
}
