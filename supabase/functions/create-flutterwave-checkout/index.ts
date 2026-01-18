import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  errorResponse, 
  logError, 
  safeLog,
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`*, events(id, title, currency, country_code, organizer_id, organizers(id, flutterwave_subaccount_id, flutterwave_subaccount_status, business_name, business_email, country_code))`)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
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
        platformFeePercentage = parseFloat(feeSettings.value);
      }

      const totalAmountCents = Math.round(order.total_amount * 100);
      applicationFee = Math.round(totalAmountCents * (platformFeePercentage / 100));
    }

    // Create Flutterwave payment link
    const paymentData = {
      tx_ref: `TKT-${orderId}-${Date.now()}`,
      amount: order.total_amount,
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