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

    const { eventId, organizerId, triggeredBy } = await req.json();

    if (!eventId && !organizerId) {
      throw new Error("Either eventId or organizerId is required");
    }

    let organizer;
    if (organizerId) {
      const { data, error } = await supabase
        .from("organizers")
        .select("*")
        .eq("id", organizerId)
        .single();
      if (error || !data) throw new Error("Organizer not found");
      organizer = data;
    } else {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventId)
        .single();
      if (eventError || !event) throw new Error("Event not found");
      const { data, error } = await supabase
        .from("organizers")
        .select("*")
        .eq("id", event.organizer_id)
        .single();
      if (error || !data) throw new Error("Organizer not found");
      organizer = data;
    }

    // SECURITY: Stripe Connect validation
    if (!organizer.stripe_connect_id) {
      throw new Error("Organizer does not have Stripe Connect configured");
    }
    if (organizer.stripe_connect_status !== "active") {
      throw new Error("Organizer Stripe Connect account is not active");
    }
    if (!organizer.stripe_connect_payouts_enabled) {
      throw new Error("Payouts are not enabled for this Stripe Connect account");
    }

    // SECURITY: KYC VERIFICATION CHECK - CRITICAL
    const isKYCVerified = await checkKYCStatus(supabase, organizer);
    
    if (!isKYCVerified) {
      await supabase.from("admin_audit_logs").insert({
        action: "payout_blocked_kyc",
        entity_type: "organizer",
        entity_id: organizer.id,
        details: {
          reason: "KYC verification required",
          kyc_status: organizer.kyc_status,
          kyc_verified: organizer.kyc_verified,
          stripe_identity_status: organizer.stripe_identity_status,
          triggered_by: triggeredBy || "manual",
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "KYC verification required before payouts can be processed",
          error_code: "KYC_REQUIRED",
          details: {
            kyc_status: organizer.kyc_status,
            kyc_verified: organizer.kyc_verified,
            message: "Please complete identity verification to receive payouts.",
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "stripe")
      .eq("country_code", organizer.country_code === "CA" ? "US" : organizer.country_code)
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured for this region");
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    const balance = await stripe.balance.retrieve({
      stripeAccount: organizer.stripe_connect_id,
    });

    const availableBalances = balance.available.filter(
      (b) => b.amount > 0 && ["usd", "gbp", "cad"].includes(b.currency)
    );

    if (availableBalances.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No available balance to payout", 
          balance: balance.available 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "stripe_connect_minimum_payout")
      .single();

    const minimumPayout = parseFloat(settings?.value || "10") * 100;
    const payoutResults = [];

    for (const bal of availableBalances) {
      if (bal.amount < minimumPayout) {
        payoutResults.push({ 
          currency: bal.currency, 
          status: "skipped", 
          reason: "Below minimum" 
        });
        continue;
      }

      try {
        const payout = await stripe.payouts.create(
          {
            amount: bal.amount,
            currency: bal.currency,
            description: eventId 
              ? `Ticketrack payout for event ${eventId}` 
              : "Ticketrack balance payout",
            metadata: { 
              organizer_id: organizer.id, 
              event_id: eventId || null, 
              platform: "ticketrack",
              kyc_verified: "true",
            },
          },
          { stripeAccount: organizer.stripe_connect_id }
        );

        await supabase.from("stripe_connect_payouts").insert({
          organizer_id: organizer.id,
          event_id: eventId || null,
          stripe_payout_id: payout.id,
          stripe_account_id: organizer.stripe_connect_id,
          amount: bal.amount / 100,
          currency: bal.currency.toUpperCase(),
          status: payout.status,
          triggered_by: triggeredBy || null,
          triggered_at: new Date().toISOString(),
        });

        payoutResults.push({ 
          currency: bal.currency, 
          amount: bal.amount / 100, 
          status: "initiated", 
          payoutId: payout.id 
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
                  amount: (bal.amount / 100).toFixed(2),
                  currency: bal.currency.toUpperCase(),
                },
              },
            });
          }
        } catch (emailErr) {
          console.error("Failed to send payout email:", emailErr);
        }
      } catch (payoutErr) {
        console.error("Payout error:", payoutErr);
        payoutResults.push({ 
          currency: bal.currency, 
          status: "failed", 
          error: payoutErr.message 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizer_id: organizer.id, 
        payouts: payoutResults 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trigger payout error:", error);
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
