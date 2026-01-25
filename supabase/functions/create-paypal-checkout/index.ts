import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { errorResponse, logError } from '../_shared/errorHandler.ts';

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

    // Get PayPal config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "paypal")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("PayPal not configured");
    }

    const clientId = gatewayConfig.public_key;
    const clientSecret = gatewayConfig.secret_key_encrypted;
    const sandboxMode = gatewayConfig.sandbox_mode;
    const baseUrl = sandboxMode 
      ? "https://api-m.sandbox.paypal.com" 
      : "https://api-m.paypal.com";

    // Get PayPal access token
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    const authData = await authResponse.json();
    if (!authData.access_token) {
      throw new Error("Failed to get PayPal access token");
    }

    // Create PayPal order
    const currency = order.currency?.toUpperCase() || "USD";
    const paypalOrder = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authData.access_token}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: orderId,
          description: `Tickets for ${order.events?.title || "Event"}`,
          amount: {
            currency_code: currency,
            value: order.total_amount.toFixed(2),
          },
          custom_id: orderId,
        }],
        application_context: {
          brand_name: "Ticketrack",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          return_url: `${successUrl}?order_id=${orderId}&provider=paypal`,
          cancel_url: `${cancelUrl}?order_id=${orderId}`,
        },
      }),
    });

    const paypalOrderData = await paypalOrder.json();

    if (!paypalOrderData.id) {
      console.error("PayPal error:", paypalOrderData);
      throw new Error("Failed to create PayPal order");
    }

    // Update order with PayPal order ID
    await supabase
      .from("orders")
      .update({
        payment_reference: paypalOrderData.id,
        payment_provider: "paypal",
      })
      .eq("id", orderId);

    // Get approval URL
    const approvalUrl = paypalOrderData.links?.find(
      (link: any) => link.rel === "approve"
    )?.href;

    return new Response(
      JSON.stringify({ 
        paypalOrderId: paypalOrderData.id, 
        approvalUrl 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError('paypal-checkout', error);
    return errorResponse('PAY_001', 400, error, undefined, corsHeaders);
  }
});
