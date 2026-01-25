/**
 * Flutterwave Webhook Handler - Supabase Edge Function
 * 
 * Handles Flutterwave webhook events for:
 * - Payment verification (charge.completed)
 * - Transfer status updates (transfer.completed, transfer.failed)
 * - Refund events
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { 
  errorResponse, 
  logError, 
  safeLog,
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("verif-hash");

    // Get Flutterwave secret hash from environment
    const flutterwaveSecretHash = Deno.env.get("FLUTTERWAVE_SECRET_HASH");

    // Verify webhook signature
    let isValidSignature = false;

    if (signature && flutterwaveSecretHash) {
      // Flutterwave uses a simple hash comparison
      isValidSignature = signature === flutterwaveSecretHash;
    }

    // In development, allow unsigned webhooks
    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    if (!isValidSignature && !isDev) {
      logError("flutterwave_webhook_auth", new Error("Invalid signature"));
      return errorResponse(
        ERROR_CODES.AUTH_INVALID,
        401,
        undefined,
        "Invalid webhook signature",
        corsHeaders
      );
    }

    const event = JSON.parse(body);
    safeLog.info(`Flutterwave webhook received: ${event.event}`);

    switch (event.event) {
      case "charge.completed": {
        await handleChargeCompleted(supabase, event.data);
        break;
      }

      case "transfer.completed": {
        await handleTransferCompleted(supabase, event.data);
        break;
      }

      case "transfer.failed": {
        await handleTransferFailed(supabase, event.data);
        break;
      }

      default:
        safeLog.debug(`Unhandled Flutterwave event: ${event.event}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("flutterwave_webhook", error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      error,
      undefined,
      corsHeaders
    );
  }
});

async function handleChargeCompleted(supabase: any, data: any) {
  const { tx_ref, flw_ref, amount, currency, status, meta } = data;
  
  safeLog.info(`Processing charge.completed for tx_ref: ${tx_ref}`);

  // Only process successful charges
  if (status !== "successful") {
    safeLog.warn(`Charge ${tx_ref} was not successful: ${status}`);
    return;
  }

  // Find the order by payment reference (tx_ref format: TKT-{orderId}-{timestamp})
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, events(title, organizer_id, organizers(id, business_name, user_id, flutterwave_subaccount_id))")
    .eq("payment_reference", tx_ref)
    .single();

  if (orderError || !order) {
    safeLog.warn("Order not found for tx_ref:", tx_ref);
    return;
  }

  // Skip if already completed
  if (order.status === "completed") {
    safeLog.debug("Order already completed:", order.id);
    return;
  }

  // Update order status
  await supabase
    .from("orders")
    .update({
      status: "completed",
      paid_at: new Date().toISOString(),
      payment_provider_reference: flw_ref,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Generate tickets
  await generateTickets(supabase, order);

  // Send confirmation email
  await sendConfirmationEmail(supabase, order);

  // Log the payment
  await supabase.from("admin_audit_logs").insert({
    action: order.is_donation ? "donation_payment_received" : "payment_received",
    entity_type: "order",
    entity_id: order.id,
    details: {
      tx_ref,
      flw_ref,
      amount,
      currency,
      is_donation: order.is_donation,
      event_id: order.event_id,
      payment_provider: "flutterwave",
      is_subaccount: meta?.is_subaccount === "true",
    },
  });

  safeLog.info(`Order ${order.id} marked as completed via Flutterwave`);
}

async function generateTickets(supabase: any, order: any) {
  // Get order items
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  if (!orderItems || orderItems.length === 0) return;

  // Generate tickets for each item
  for (const item of orderItems) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = `TKT-${order.order_number}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      await supabase.from("tickets").insert({
        order_id: order.id,
        order_item_id: item.id,
        event_id: order.event_id,
        ticket_type_id: item.ticket_type_id,
        ticket_code: ticketCode,
        status: "valid",
        buyer_email: order.buyer_email,
        buyer_name: order.buyer_name,
        buyer_phone: order.buyer_phone,
        price: item.unit_price,
        currency: order.currency,
      });
    }
  }

  safeLog.info(`Generated tickets for order ${order.id}`);
}

async function sendConfirmationEmail(supabase: any, order: any) {
  try {
    await supabase.functions.invoke("send-email", {
      body: {
        type: order.is_donation ? "donation_receipt" : "order_confirmation",
        to: order.buyer_email,
        data: {
          buyerName: order.buyer_name,
          orderNumber: order.order_number,
          eventTitle: order.events?.title,
          totalAmount: order.total_amount,
          currency: order.currency,
        },
      },
    });
  } catch (error) {
    logError("confirmation_email_failed", error, { orderId: order.id });
  }
}

async function handleTransferCompleted(supabase: any, data: any) {
  const { reference, amount, status, currency } = data;
  
  safeLog.info(`Processing transfer.completed for reference: ${reference}`);

  if (status !== "SUCCESSFUL") {
    safeLog.warn(`Transfer ${reference} was not successful: ${status}`);
    return;
  }

  // Update payout status in flutterwave_payouts table
  const { data: payout, error } = await supabase
    .from("flutterwave_payouts")
    .update({
      status: "success",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("transfer_reference", reference)
    .select("*, organizers(business_name, user_id)")
    .single();

  if (error) {
    // Try paystack_payouts table as fallback (some systems might share tables)
    const { data: paystackPayout, error: psError } = await supabase
      .from("paystack_payouts")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("transfer_reference", reference)
      .select("*, organizers(business_name, user_id)")
      .single();

    if (psError) {
      logError("payout_update_failed", error, { reference });
      return;
    }
  }

  // Update related orders
  await supabase
    .from("orders")
    .update({
      payout_status: "completed",
      payout_completed_at: new Date().toISOString(),
    })
    .eq("payout_reference", reference);

  // Log audit
  await supabase.from("admin_audit_logs").insert({
    action: "flutterwave_payout_completed",
    entity_type: "payout",
    entity_id: reference,
    details: {
      reference,
      amount,
      currency,
      payment_provider: "flutterwave",
    },
  });

  safeLog.info(`Flutterwave payout ${reference} completed successfully`);
}

async function handleTransferFailed(supabase: any, data: any) {
  const { reference, complete_message } = data;
  
  safeLog.info(`Processing transfer.failed for reference: ${reference}`);

  // Update payout status
  await supabase
    .from("flutterwave_payouts")
    .update({
      status: "failed",
      failure_reason: complete_message || "Transfer failed",
      updated_at: new Date().toISOString(),
    })
    .eq("transfer_reference", reference);

  // Update related orders - mark as pending so they can be retried
  await supabase
    .from("orders")
    .update({
      payout_status: "pending",
      payout_reference: null,
      payout_initiated_at: null,
    })
    .eq("payout_reference", reference);

  // Log audit
  await supabase.from("admin_audit_logs").insert({
    action: "flutterwave_payout_failed",
    entity_type: "payout",
    entity_id: reference,
    details: {
      reference,
      reason: complete_message,
      payment_provider: "flutterwave",
    },
  });

  safeLog.warn(`Flutterwave payout ${reference} failed: ${complete_message}`);
}
