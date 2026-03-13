import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { errorResponse, logError } from '../_shared/errorHandler.ts';
import { optionalAuth, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ticketrack.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Optional auth - buyers may or may not be logged in
    const auth = await optionalAuth(req);
    const supabase = auth?.supabase ?? createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { orderId, successUrl, cancelUrl } = await req.json();

    // Validate redirect URLs to prevent open redirect attacks
    const allowedOrigins = ["https://ticketrack.com", "https://www.ticketrack.com"];
    const isValidUrl = (url: string) => {
      try { return allowedOrigins.includes(new URL(url).origin); } catch { return false; }
    };
    if (!isValidUrl(successUrl) || !isValidUrl(cancelUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid redirect URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, events(title, currency, country_code)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Verify order is still pending - prevent double payment
    if (order.status !== "pending") {
      throw new Error("Order is no longer pending");
    }

    // Server-side order total verification
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("ticket_type_id, quantity, ticket_types(price)")
      .eq("order_id", orderId);
    if (!orderItems || orderItems.length === 0) throw new Error("Order has no items");

    let verifiedSubtotal = 0;
    for (const item of orderItems) {
      const ticketPrice = parseFloat((item as any).ticket_types?.price || 0);
      if (ticketPrice < 0) throw new Error("Invalid ticket price");
      verifiedSubtotal += ticketPrice * item.quantity;
    }
    verifiedSubtotal = Math.round(verifiedSubtotal * 100) / 100;

    let verifiedDiscount = 0;
    if (order.promo_code_id && parseFloat(order.discount_amount || 0) > 0) {
      const { data: promo } = await supabase
        .from("promo_codes").select("discount_type, discount_value")
        .eq("id", order.promo_code_id).single();
      if (promo) {
        verifiedDiscount = promo.discount_type === 'percentage'
          ? Math.round(verifiedSubtotal * parseFloat(promo.discount_value) / 100 * 100) / 100
          : Math.min(parseFloat(promo.discount_value), verifiedSubtotal);
      }
    }

    const orderPlatformFee = Math.max(0, parseFloat(order.platform_fee || 0));
    const serverTotalAmount = Math.round((verifiedSubtotal + orderPlatformFee - verifiedDiscount) * 100) / 100;

    if (Math.abs(serverTotalAmount - parseFloat(order.total_amount)) > 1) {
      return new Response(
        JSON.stringify({ error: "Order total mismatch. Please refresh and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
            value: serverTotalAmount.toFixed(2),
          },
          custom_id: orderId,
        }],
        application_context: {
          brand_name: "ticketRack",
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
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    logError('paypal-checkout', error);
    return errorResponse('PAY_001', 400, error, 'Failed to create PayPal checkout', corsHeaders);
  }
});
