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
    const { orderId, successUrl, cancelUrl } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, events(title, currency, country_code)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Get Stripe config
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

    // Initialize Stripe
    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: order.currency?.toLowerCase() || "usd",
            product_data: {
              name: "Tickets for " + (order.events?.title || "Event"),
              description: "Order #" + order.order_number,
            },
            unit_amount: Math.round(order.total_amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl + "?session_id={CHECKOUT_SESSION_ID}&order_id=" + orderId,
      cancel_url: cancelUrl + "?order_id=" + orderId,
      customer_email: order.buyer_email,
      metadata: {
        order_id: orderId,
        event_id: order.event_id,
      },
      payment_intent_data: {
        metadata: {
          order_id: orderId,
        },
      },
    });

    // Update order with Stripe session ID
    await supabase
      .from("orders")
      .update({ 
        payment_reference: session.id,
        payment_provider: "stripe"
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
