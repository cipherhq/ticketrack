import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order with event + organizer data (same query as create-stripe-checkout)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `*, events(id, title, currency, country_code, organizer_id, organizers(id, stripe_connect_id, stripe_connect_status, stripe_connect_charges_enabled, country_code))`
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Get Stripe secret key from payment_gateway_config
    const countryCode = order.events?.country_code || "US";
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "stripe")
      .eq("is_active", true)
      .in("country_code", [countryCode, "GB", "US"])
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured for this region");
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Detect Stripe Connect (same conditions as create-stripe-checkout)
    const organizer = order.events?.organizers;
    const useStripeConnect =
      organizer?.stripe_connect_id &&
      organizer?.stripe_connect_status === "active" &&
      organizer?.stripe_connect_charges_enabled === true;

    let applicationFeeAmount = 0;
    let platformFeePercentage = 5;

    if (useStripeConnect) {
      const { data: feeSettings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "stripe_connect_platform_fee_percentage")
        .single();

      if (feeSettings?.value) {
        platformFeePercentage = parseFloat(feeSettings.value);
      }

      const totalAmountCents = Math.round(order.total_amount * 100);
      applicationFeeAmount = Math.round(
        totalAmountCents * (platformFeePercentage / 100)
      );
    }

    // Build PaymentIntent config
    const intentConfig: any = {
      amount: Math.round(order.total_amount * 100),
      currency: order.currency?.toLowerCase() || "usd",
      payment_method_types: ["card"],
      metadata: {
        order_id: orderId,
        event_id: order.event_id,
        is_stripe_connect: useStripeConnect ? "true" : "false",
        organizer_id: organizer?.id || "",
        payment_flow: "inline_wallet",
      },
    };

    if (useStripeConnect) {
      intentConfig.application_fee_amount = applicationFeeAmount;
      intentConfig.transfer_data = {
        destination: organizer.stripe_connect_id,
      };
      intentConfig.metadata.platform_fee_amount = (
        applicationFeeAmount / 100
      ).toFixed(2);
    }

    const paymentIntent = await stripe.paymentIntents.create(intentConfig);

    // Update order with payment reference
    const orderUpdate: any = {
      payment_reference: paymentIntent.id,
      payment_provider: "stripe",
    };
    if (useStripeConnect) {
      orderUpdate.is_stripe_connect = true;
      orderUpdate.stripe_account_id = organizer.stripe_connect_id;
      orderUpdate.platform_fee_amount = applicationFeeAmount / 100;
      orderUpdate.organizer_payout_amount =
        order.total_amount - applicationFeeAmount / 100;
    } else {
      orderUpdate.is_stripe_connect = false;
    }

    await supabase.from("orders").update(orderUpdate).eq("id", orderId);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        isStripeConnect: useStripeConnect,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Create payment intent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
