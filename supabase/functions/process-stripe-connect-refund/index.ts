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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { refundRequestId, organizerId, notes } = await req.json();

    if (!refundRequestId || !organizerId) {
      throw new Error("refundRequestId and organizerId are required");
    }

    // Get refund request
    const { data: refundRequest, error: refundError } = await supabase
      .from("refund_requests")
      .select("*")
      .eq("id", refundRequestId)
      .single();

    if (refundError || !refundRequest) {
      throw new Error("Refund request not found");
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", refundRequest.order_id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Verify this is a Connect order
    if (!order.is_stripe_connect) {
      throw new Error("This is not a Stripe Connect order. Use standard refund flow.");
    }

    // Verify organizer owns this refund request
    if (refundRequest.organizer_id !== organizerId) {
      throw new Error("Unauthorized: You do not own this refund request");
    }

    // Check refund hasn't been processed already
    if (refundRequest.stripe_refund_id) {
      throw new Error("This refund has already been processed");
    }

    // Get organizer details
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("id, stripe_connect_id, stripe_connect_status, country_code, user_id")
      .eq("id", organizerId)
      .single();

    if (orgError || !organizer) {
      throw new Error("Organizer not found");
    }

    if (!organizer.stripe_connect_id || organizer.stripe_connect_status !== "active") {
      throw new Error("Stripe Connect account is not active");
    }

    if (!order.payment_reference) {
      throw new Error("No payment reference found for this order");
    }

    // Get Stripe config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", "US")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured");
    }

    // Initialize Stripe
    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Get payment intent from checkout session
    let paymentIntentId = order.payment_reference;
    
    if (paymentIntentId.startsWith("cs_")) {
      console.log("Retrieving checkout session:", paymentIntentId);
      const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
      paymentIntentId = session.payment_intent as string;
      console.log("Payment intent ID:", paymentIntentId);
    }

    if (!paymentIntentId) {
      throw new Error("Could not find payment intent for this order");
    }

    // Refund the FULL amount the customer paid
    const fullRefundAmountCents = Math.round(parseFloat(order.total_amount) * 100);
    
    console.log("Processing refund:", {
      paymentIntentId,
      fullRefundAmountCents,
      orderTotal: order.total_amount,
    });

    // Process the refund with reverse transfer
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: fullRefundAmountCents,
      reason: "requested_by_customer",
      metadata: {
        refund_request_id: refundRequestId,
        organizer_id: organizerId,
        order_id: order.id,
        platform: "ticketrack",
      },
      reverse_transfer: true,
      refund_application_fee: true,
    });

    console.log("Refund created:", refund.id, refund.status);

    // Update refund request - use 'processed' status (allowed by constraint)
    const { error: updateError } = await supabase
      .from("refund_requests")
      .update({
        status: "processed",
        stripe_refund_id: refund.id,
        refund_reference: refund.id,
        organizer_decision: "approved",
        organizer_notes: notes || null,
        organizer_decided_at: new Date().toISOString(),
        organizer_decided_by: organizer.user_id,
        processed_at: new Date().toISOString(),
        processed_by: organizer.user_id,
        is_stripe_connect: true,
        platform_fee_refunded: parseFloat(order.platform_fee_amount) || 0,
        refund_amount: parseFloat(order.total_amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", refundRequestId);

    if (updateError) {
      console.error("Failed to update refund request:", updateError);
    }

    // Update ticket status
    if (refundRequest.ticket_id) {
      await supabase
        .from("tickets")
        .update({
          status: "cancelled",
          payment_status: "refunded",
          refunded_at: new Date().toISOString(),
          refund_reason: refundRequest.reason,
        })
        .eq("id", refundRequest.ticket_id);
    }

    // Check if all tickets for order are refunded
    const { data: remainingTickets } = await supabase
      .from("tickets")
      .select("id")
      .eq("order_id", order.id)
      .neq("status", "cancelled");

    if (!remainingTickets || remainingTickets.length === 0) {
      await supabase
        .from("orders")
        .update({
          status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
    }

    // Send notification email
    try {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("attendee_name, attendee_email")
        .eq("id", refundRequest.ticket_id)
        .single();

      const { data: event } = await supabase
        .from("events")
        .select("title")
        .eq("id", refundRequest.event_id)
        .single();

      if (ticket?.attendee_email) {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "refund_processed",
            to: ticket.attendee_email,
            data: {
              attendeeName: ticket.attendee_name,
              eventTitle: event?.title,
              refundAmount: parseFloat(order.total_amount),
              currency: order.currency || "USD",
            },
          },
        });
      }
    } catch (emailErr) {
      console.error("Failed to send refund email:", emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundId: refund.id,
        amount: fullRefundAmountCents / 100,
        currency: refund.currency,
        status: refund.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process refund error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
