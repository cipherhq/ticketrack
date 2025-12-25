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
    const { refundRequestId } = await req.json();

    if (!refundRequestId) {
      throw new Error("refundRequestId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get refund request with order details
    const { data: refundRequest, error: refundError } = await supabase
      .from("refund_requests")
      .select(`
        *,
        order:orders(id, payment_reference, payment_provider, currency, country_code),
        ticket:tickets(id, ticket_code, attendee_email, attendee_name)
      `)
      .eq("id", refundRequestId)
      .single();

    if (refundError || !refundRequest) {
      throw new Error("Refund request not found");
    }

    if (refundRequest.status !== "approved") {
      throw new Error("Refund request must be approved before processing");
    }

    if (refundRequest.refund_reference) {
      throw new Error("Refund already processed");
    }

    const paymentProvider = refundRequest.order?.payment_provider || refundRequest.payment_provider;
    const paymentReference = refundRequest.order?.payment_reference || refundRequest.payment_reference;
    const countryCode = refundRequest.order?.country_code || "NG";
    const refundAmount = Math.round(refundRequest.amount * 100); // Convert to kobo/cents

    let refundReference = null;
    let refundStatus = "processing";

    if (paymentProvider === "paystack") {
      // Process Paystack refund
      const { data: paystackConfig } = await supabase
        .from("payment_gateway_config")
        .select("secret_key_encrypted")
        .eq("provider", "paystack")
        .eq("is_active", true)
        .in("country_code", [countryCode, "NG"])
        .limit(1)
        .single();

      if (!paystackConfig) {
        throw new Error("Paystack not configured");
      }

      const paystackResponse = await fetch("https://api.paystack.co/refund", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackConfig.secret_key_encrypted}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction: paymentReference,
          amount: refundAmount,
        }),
      });

      const paystackResult = await paystackResponse.json();

      if (paystackResult.status) {
        refundReference = paystackResult.data?.id || paystackResult.data?.transaction?.id;
        refundStatus = "processed";
      } else {
        throw new Error(paystackResult.message || "Paystack refund failed");
      }

    } else if (paymentProvider === "stripe") {
      // Process Stripe refund
      const { data: stripeConfig } = await supabase
        .from("payment_gateway_config")
        .select("secret_key_encrypted")
        .eq("provider", "stripe")
        .eq("is_active", true)
        .in("country_code", [countryCode, "US", "GB"])
        .limit(1)
        .single();

      if (!stripeConfig) {
        throw new Error("Stripe not configured");
      }

      const stripe = new Stripe(stripeConfig.secret_key_encrypted, {
        apiVersion: "2023-10-16",
      });

      const refund = await stripe.refunds.create({
        payment_intent: paymentReference,
        amount: refundAmount,
      });

      refundReference = refund.id;
      refundStatus = refund.status === "succeeded" ? "processed" : "processing";

    } else {
      throw new Error(`Unsupported payment provider: ${paymentProvider}`);
    }

    // Update refund request
    await supabase
      .from("refund_requests")
      .update({
        refund_reference: refundReference,
        status: refundStatus,
        processed_at: new Date().toISOString(),
      })
      .eq("id", refundRequestId);

    // Update ticket status to cancelled
    if (refundRequest.ticket_id) {
      await supabase
        .from("tickets")
        .update({ status: "cancelled" })
        .eq("id", refundRequest.ticket_id);
    }

    // Log to audit trail
    await supabase.from("refund_audit_log").insert({
      refund_request_id: refundRequestId,
      action: "refund_processed",
      payment_provider: paymentProvider,
      refund_reference: refundReference,
      amount: refundRequest.amount,
      currency: refundRequest.currency,
    }).catch(() => {}); // Don't fail if audit table doesn't exist

    return new Response(
      JSON.stringify({
        success: true,
        refundReference,
        status: refundStatus,
        message: "Refund processed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Refund error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
