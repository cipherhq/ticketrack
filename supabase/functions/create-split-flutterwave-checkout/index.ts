import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    // Create Flutterwave payment link
    const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayConfig.secret_key_encrypted}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount,
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
    console.error("Split Flutterwave checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
