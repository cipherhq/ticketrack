import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
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
    // Optional auth - split payment participants may or may not be logged in
    const auth = await optionalAuth(req);
    const supabase = auth?.supabase ?? createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // CRITICAL: Validate client-supplied amount matches the DB share amount
    const dbShareAmount = parseFloat(share.amount);
    const clientAmount = parseFloat(amount);
    if (isNaN(clientAmount) || Math.abs(clientAmount - dbShareAmount) > 0.01) {
      throw new Error("Amount mismatch");
    }

    // Get Flutterwave config
    const countryCode = splitPayment.events?.country_code || "NG";
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "flutterwave")
      .eq("is_active", true)
      .in("country_code", [countryCode, "NG"])
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("Flutterwave not configured for this region");
    }

    const txRef = `SPLIT-${shareId}-${Date.now()}`;

    // Create Flutterwave payment link - use DB amount, not client amount
    const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayConfig.secret_key_encrypted}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: dbShareAmount,
        currency: currency || "NGN",
        redirect_url: successUrl,
        customer: {
          email: email,
          name: name || email.split("@")[0],
        },
        meta: {
          type: "split_payment",
          share_id: shareId,
          split_payment_id: splitPaymentId,
          event_id: splitPayment.event_id,
          payer_name: name,
          payer_email: email,
        },
        customizations: {
          title: "Ticketrack Split Payment",
          description: `Your share - ${eventTitle || "Event"}`,
          logo: "https://ticketrack.com/ticketrackLogo.png",
        },
      }),
    });

    const flwData = await flutterwaveResponse.json();

    if (flwData.status !== "success") {
      throw new Error(flwData.message || "Failed to create Flutterwave payment");
    }

    // Update share with payment reference
    await supabase
      .from("group_split_shares")
      .update({
        payment_reference: txRef,
        payment_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq("id", shareId);

    return new Response(
      JSON.stringify({
        txRef: txRef,
        url: flwData.data.link
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("Split Flutterwave checkout error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create split payment checkout" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
