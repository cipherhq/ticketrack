import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  errorResponse,
  logError,
  safeLog,
  ERROR_CODES
} from "../_shared/errorHandler.ts";
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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`*, events(id, title, currency, country_code, organizer_id, organizers(id, flutterwave_subaccount_id, flutterwave_subaccount_status, business_name, business_email, country_code))`)
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

    const countryCode = order.events?.country_code || "NG";
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "flutterwave")
      .eq("is_active", true)
      .in("country_code", [countryCode, "NG", "GH"])
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("Flutterwave not configured for this region");
    }

    const FLW_PUBLIC_KEY = gatewayConfig.public_key;
    const FLW_SECRET_KEY = gatewayConfig.secret_key_encrypted;
    const FLW_ENCRYPTION_KEY = gatewayConfig.config?.encryption_key_encrypted;

    if (!FLW_PUBLIC_KEY || !FLW_SECRET_KEY) {
      throw new Error("Flutterwave credentials not configured");
    }

    const organizer = order.events?.organizers;
    const useSubaccount =
      organizer?.flutterwave_subaccount_id &&
      organizer?.flutterwave_subaccount_status === 'active';

    // Calculate platform fee
    let platformFeePercentage = 5;
    let applicationFee = 0;

    if (useSubaccount) {
      const { data: feeSettings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "flutterwave_subaccount_platform_fee_percentage")
        .single();

      if (feeSettings?.value) {
        const parsed = parseFloat(feeSettings.value);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          platformFeePercentage = parsed;
        }
      }

      const totalAmountCents = Math.round(serverTotalAmount * 100);
      applicationFee = Math.round(totalAmountCents * (platformFeePercentage / 100));
    }

    // Create Flutterwave payment link
    const paymentData = {
      tx_ref: `TKT-${orderId}-${Date.now()}`,
      amount: serverTotalAmount,
      currency: order.currency?.toUpperCase() || 'NGN',
      redirect_url: successUrl + `?order_id=${orderId}`,
      customer: {
        email: order.buyer_email,
        name: order.buyer_name,
        phone_number: order.buyer_phone || undefined,
      },
      customizations: {
        title: `Tickets for ${order.events?.title || 'Event'}`,
        description: `Order #${order.order_number}`,
      },
      meta: {
        order_id: orderId,
        event_id: order.event_id,
        organizer_id: organizer?.id || null,
        is_subaccount: useSubaccount ? "true" : "false",
      },
    };

    // Add subaccount if available
    if (useSubaccount && organizer.flutterwave_subaccount_id) {
      paymentData.subaccounts = [{
        id: organizer.flutterwave_subaccount_id,
        transaction_split_ratio: 100, // 100% to subaccount, platform fee calculated separately
        transaction_charge_type: "flat",
        transaction_charge: applicationFee / 100, // Convert back to currency unit
      }];
    }

    // Make request to Flutterwave API
    const flwResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    });

    if (!flwResponse.ok) {
      const errorData = await flwResponse.json();
      throw new Error(errorData.message || "Failed to create Flutterwave payment");
    }

    const flwData = await flwResponse.json();

    if (flwData.status !== "success" || !flwData.data?.link) {
      throw new Error("Failed to create Flutterwave payment link");
    }

    // Update order with payment reference
    await supabase
      .from("orders")
      .update({
        payment_reference: paymentData.tx_ref,
        payment_provider: "flutterwave",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        url: flwData.data.link,
        tx_ref: paymentData.tx_ref,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    logError('flutterwave_checkout_error', error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      400,
      error,
      'Failed to initialize Flutterwave payment. Please try again or use an alternative payment method.',
      corsHeaders
    );
  }
});
