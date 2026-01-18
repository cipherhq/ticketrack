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
        order:orders(id, payment_reference, payment_provider, currency),
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
    // Get country code from event if available, otherwise default to NG
    const countryCode = "NG"; // Default for test orders, can be fetched from event if needed
    const refundAmount = Math.round(refundRequest.amount * 100); // Convert to kobo/cents
    const currency = refundRequest.currency || refundRequest.order?.currency || "NGN";

    let refundReference = null;
    let refundStatus = "processing";

    // ========== PAYSTACK REFUND ==========
    if (paymentProvider === "paystack") {
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

    // ========== STRIPE REFUND ==========
    } else if (paymentProvider === "stripe") {
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

    // ========== PAYPAL REFUND ==========
    } else if (paymentProvider === "paypal") {
      // Get PayPal config
      const { data: paypalConfig } = await supabase
        .from("payment_gateway_config")
        .select("*")
        .eq("provider", "paypal")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!paypalConfig) {
        throw new Error("PayPal not configured");
      }

      const clientId = paypalConfig.public_key;
      const clientSecret = paypalConfig.secret_key_encrypted;
      const sandboxMode = paypalConfig.sandbox_mode;
      const baseUrl = sandboxMode 
        ? "https://api-m.sandbox.paypal.com" 
        : "https://api-m.paypal.com";

      // Step 1: Get PayPal access token
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
        console.error("PayPal auth failed:", authData);
        throw new Error("Failed to get PayPal access token");
      }

      const accessToken = authData.access_token;

      // Step 2: Get the order details to find the capture ID
      // payment_reference stores the PayPal Order ID
      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${paymentReference}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const orderData = await orderResponse.json();
      
      if (!orderData.id) {
        console.error("PayPal order fetch failed:", orderData);
        throw new Error("Failed to fetch PayPal order details");
      }

      // Extract capture ID from order - look in purchase_units[0].payments.captures[0].id
      const captureId = orderData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      
      if (!captureId) {
        console.error("No capture found in order:", JSON.stringify(orderData, null, 2));
        throw new Error("No PayPal capture found for this order. The payment may not have been captured yet.");
      }

      // Step 3: Process the refund using the capture ID
      const refundAmountDecimal = (refundRequest.amount).toFixed(2);
      
      const refundResponse = await fetch(`${baseUrl}/v2/payments/captures/${captureId}/refund`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: {
            value: refundAmountDecimal,
            currency_code: currency.toUpperCase() === "NGN" ? "USD" : currency.toUpperCase(), // PayPal doesn't support NGN
          },
          note_to_payer: "Refund from Ticketrack",
        }),
      });

      const refundData = await refundResponse.json();

      if (refundData.id && (refundData.status === "COMPLETED" || refundData.status === "PENDING")) {
        refundReference = refundData.id;
        refundStatus = refundData.status === "COMPLETED" ? "processed" : "processing";
      } else {
        console.error("PayPal refund failed:", refundData);
        const errorMessage = refundData.details?.[0]?.description || refundData.message || "PayPal refund failed";
        throw new Error(errorMessage);
      }

    // ========== FLUTTERWAVE REFUND ==========
    } else if (paymentProvider === "flutterwave") {
      const { data: flutterwaveConfig } = await supabase
        .from("payment_gateway_config")
        .select("secret_key_encrypted")
        .eq("provider", "flutterwave")
        .eq("is_active", true)
        .in("country_code", [countryCode, "NG", "GH"])
        .limit(1)
        .single();

      if (!flutterwaveConfig) {
        throw new Error("Flutterwave not configured");
      }

      // Flutterwave refund API
      // payment_reference should be the transaction ID (tx_ref or id from Flutterwave)
      const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/transactions/refund", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${flutterwaveConfig.secret_key_encrypted}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: paymentReference, // Transaction ID
          amount: refundAmount / 100, // Convert back to currency unit (Flutterwave uses actual amounts, not cents)
        }),
      });

      const flutterwaveResult = await flutterwaveResponse.json();

      if (flutterwaveResult.status === "success" && flutterwaveResult.data) {
        refundReference = flutterwaveResult.data.id || flutterwaveResult.data.refund_id;
        refundStatus = flutterwaveResult.data.status === "completed" ? "processed" : "processing";
      } else {
        throw new Error(flutterwaveResult.message || "Flutterwave refund failed");
      }

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

    // Send email notification to attendee
    try {
      const attendeeEmail = refundRequest.ticket?.attendee_email;
      const attendeeName = refundRequest.ticket?.attendee_name || "Customer";
      
      if (attendeeEmail) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            to: attendeeEmail,
            subject: "Your Refund Has Been Processed",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2969FF;">Refund Processed</h2>
                <p>Hi ${attendeeName},</p>
                <p>Great news! Your refund has been processed successfully.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Refund Amount:</strong> ${currency} ${refundRequest.amount.toFixed(2)}</p>
                  <p style="margin: 5px 0;"><strong>Reference:</strong> ${refundReference}</p>
                  <p style="margin: 5px 0;"><strong>Status:</strong> ${refundStatus === "processed" ? "Completed" : "Processing"}</p>
                </div>
                <p>The funds should appear in your account within 5-10 business days depending on your payment provider.</p>
                <p>Thank you for using Ticketrack!</p>
              </div>
            `,
          }),
        });
      }
    } catch (emailError) {
      console.error("Failed to send refund email:", emailError);
      // Don't fail the refund if email fails
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
