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
    const { 
      shareId, 
      splitPaymentId, 
      email, 
      name, 
      amount, 
      currency, 
      eventTitle,
      successUrl, 
      cancelUrl 
    } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get split payment details
    const { data: splitPayment, error: splitError } = await supabase
      .from("group_split_payments")
      .select(`*, events(id, title, currency, country_code)`)
      .eq("id", splitPaymentId)
      .single();

    if (splitError || !splitPayment) {
      throw new Error("Split payment not found");
    }

    // Get share details
    const { data: share, error: shareError } = await supabase
      .from("group_split_shares")
      .select("*")
      .eq("id", shareId)
      .single();

    if (shareError || !share) {
      throw new Error("Share not found");
    }

    // Check if already paid
    if (share.payment_status === 'paid') {
      throw new Error("This share has already been paid");
    }

    // Get Stripe config
    const countryCode = splitPayment.events?.country_code || "US";
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

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (currency || "usd").toLowerCase(),
            product_data: {
              name: `Your share - ${eventTitle || "Event"}`,
              description: `Split payment share for ${name || email}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        type: "split_payment",
        share_id: shareId,
        split_payment_id: splitPaymentId,
        event_id: splitPayment.event_id,
        payer_name: name,
        payer_email: email,
      },
      payment_intent_data: {
        metadata: {
          type: "split_payment",
          share_id: shareId,
          split_payment_id: splitPaymentId,
          event_id: splitPayment.event_id,
        },
      },
    });

    // Update share with payment reference
    await supabase
      .from("group_split_shares")
      .update({ 
        payment_reference: session.id,
        payment_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq("id", shareId);

    return new Response(
      JSON.stringify({ 
        sessionId: session.id, 
        url: session.url 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Split Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
