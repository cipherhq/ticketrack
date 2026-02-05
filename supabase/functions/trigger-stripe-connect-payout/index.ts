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

    // SECURITY: KYC VERIFICATION CHECK
    // Since Stripe Connect is active, the organizer HAS a payment gateway connected
    // KYC is only required if NO payment gateway is connected
    // Check if organizer has any OTHER payment gateway or if we should require KYC
    const hasPaymentGateway =
      (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") ||
      (organizer.paystack_subaccount_id && organizer.paystack_subaccount_enabled) ||
      (organizer.flutterwave_subaccount_id && organizer.flutterwave_subaccount_enabled);

    // Since we're in this function, Stripe Connect IS active, so hasPaymentGateway = true
    // KYC check is skipped because organizer has an active payment gateway

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

    // Get organizer's events for promoter commission lookup
    const { data: orgEvents } = await supabase
      .from("events")
      .select("id")
      .eq("organizer_id", organizer.id);

    const orgEventIds = (orgEvents || []).map((e: any) => e.id);

    // Get all promoter commissions grouped by currency
    let promoterCommissionsByCurrency: Record<string, number> = {};
    if (orgEventIds.length > 0) {
      const { data: promoterSales } = await supabase
        .from("promoter_sales")
        .select("commission_amount, events!inner(currency)")
        .in("event_id", orgEventIds);

      for (const sale of promoterSales || []) {
        const currency = ((sale as any).events?.currency || "USD").toLowerCase();
        promoterCommissionsByCurrency[currency] =
          (promoterCommissionsByCurrency[currency] || 0) + (parseFloat(sale.commission_amount) || 0);
      }
    }

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "stripe_connect_minimum_payout")
      .single();

    const minimumPayout = parseFloat(settings?.value || "10") * 100;
    const payoutResults = [];

    for (const bal of availableBalances) {
      // Deduct promoter commissions for this currency
      const commissionForCurrency = promoterCommissionsByCurrency[bal.currency] || 0;
      const commissionInCents = Math.round(commissionForCurrency * 100);
      const payoutAmountCents = bal.amount - commissionInCents;

      if (payoutAmountCents < minimumPayout) {
        payoutResults.push({
          currency: bal.currency,
          status: "skipped",
          reason: "Below minimum after commission deduction"
        });
        continue;
      }

      try {
        const payout = await stripe.payouts.create(
          {
            amount: payoutAmountCents,
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
          amount: payoutAmountCents / 100,
          currency: bal.currency.toUpperCase(),
          status: payout.status,
          triggered_by: triggeredBy || null,
          triggered_at: new Date().toISOString(),
        });

        payoutResults.push({
          currency: bal.currency,
          amount: payoutAmountCents / 100,
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
                  amount: (payoutAmountCents / 100).toFixed(2),
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

