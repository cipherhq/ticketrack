/**
 * Paystack Webhook Handler - Supabase Edge Function
 * 
 * Handles Paystack webhook events for:
 * - Payment verification (charge.success)
 * - Transfer status updates (transfer.success, transfer.failed, transfer.reversed)
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
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
    const signature = req.headers.get("x-paystack-signature");

    // Verify webhook signature (check both NG and GH secret keys)
    const paystackSecretNG = Deno.env.get("PAYSTACK_SECRET_KEY_NG");
    const paystackSecretGH = Deno.env.get("PAYSTACK_SECRET_KEY_GH");

    let isValidSignature = false;

    if (signature && paystackSecretNG) {
      const hash = createHmac("sha512", paystackSecretNG)
        .update(body)
        .toString();
      if (hash === signature) isValidSignature = true;
    }

    if (!isValidSignature && signature && paystackSecretGH) {
      const hash = createHmac("sha512", paystackSecretGH)
        .update(body)
        .toString();
      if (hash === signature) isValidSignature = true;
    }

    // In development, allow unsigned webhooks
    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    if (!isValidSignature && !isDev) {
      logError("paystack_webhook_auth", new Error("Invalid signature"));
      return errorResponse(
        ERROR_CODES.AUTH_INVALID,
        401,
        undefined,
        "Invalid webhook signature",
        corsHeaders
      );
    }

    const event = JSON.parse(body);
    safeLog.info(`Paystack webhook received: ${event.event}`);

    switch (event.event) {
      case "charge.success": {
        await handleChargeSuccess(supabase, event.data);
        break;
      }

      case "transfer.success": {
        await handleTransferSuccess(supabase, event.data);
        break;
      }

      case "transfer.failed": {
        await handleTransferFailed(supabase, event.data);
        break;
      }

      case "transfer.reversed": {
        await handleTransferReversed(supabase, event.data);
        break;
      }

      case "refund.processed": {
        await handleRefundProcessed(supabase, event.data);
        break;
      }

      default:
        safeLog.debug(`Unhandled Paystack event: ${event.event}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("paystack_webhook", error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      error,
      undefined,
      corsHeaders
    );
  }
});

async function handleChargeSuccess(supabase: any, data: any) {
  const { reference, amount, metadata } = data;
  
  safeLog.info(`Processing charge.success for reference: ${reference}`);

  // Find the order by payment reference
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, events(title, organizer_id)")
    .eq("payment_reference", reference)
    .single();

  if (orderError || !order) {
    safeLog.warn("Order not found for reference:", reference);
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Log the payment
  await supabase.from("admin_audit_logs").insert({
    action: order.is_donation ? "donation_payment_received" : "payment_received",
    entity_type: "order",
    entity_id: order.id,
    details: {
      reference,
      amount: amount / 100,
      currency: data.currency,
      is_donation: order.is_donation,
      event_id: order.event_id,
    },
  });

  safeLog.info(`Order ${order.id} marked as completed`);
}

async function handleTransferSuccess(supabase: any, data: any) {
  const { reference, transfer_code, amount, recipient } = data;
  
  safeLog.info(`Processing transfer.success for reference: ${reference}`);

  // Update payout status
  const { data: payout, error } = await supabase
    .from("paystack_payouts")
    .update({
      status: "success",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("transfer_reference", reference)
    .select("*, organizers(business_name, user_id)")
    .single();

  if (error) {
    logError("payout_update_failed", error, { reference });
    return;
  }

  // Update related orders
  await supabase
    .from("orders")
    .update({
      payout_status: "completed",
      payout_completed_at: new Date().toISOString(),
    })
    .eq("payout_reference", reference);

  // Send success notification to organizer
  if (payout?.organizers?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", payout.organizers.user_id)
      .single();

    if (profile?.email) {
      await supabase.functions.invoke("send-email", {
        body: {
          type: "paystack_payout_completed",
          to: profile.email,
          data: {
            organizerName: payout.organizers.business_name,
            amount: (amount / 100).toFixed(2),
            currency: payout.currency,
            reference: reference,
            isDonation: payout.is_donation,
          },
        },
      });
    }
  }

  // Log audit
  await supabase.from("admin_audit_logs").insert({
    action: payout.is_donation ? "donation_payout_completed" : "paystack_payout_completed",
    entity_type: "payout",
    entity_id: payout.id,
    details: {
      reference,
      transfer_code,
      amount: amount / 100,
      currency: payout.currency,
      organizer_id: payout.organizer_id,
    },
  });

  safeLog.info(`Payout ${reference} completed successfully`);
}

async function handleTransferFailed(supabase: any, data: any) {
  const { reference, reason } = data;
  
  safeLog.info(`Processing transfer.failed for reference: ${reference}`);

  // Update payout status
  await supabase
    .from("paystack_payouts")
    .update({
      status: "failed",
      failure_reason: reason || "Transfer failed",
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
    action: "paystack_payout_failed",
    entity_type: "payout",
    entity_id: reference,
    details: {
      reference,
      reason,
    },
  });

  safeLog.warn(`Payout ${reference} failed: ${reason}`);
}

async function handleTransferReversed(supabase: any, data: any) {
  const { reference, reason } = data;
  
  safeLog.info(`Processing transfer.reversed for reference: ${reference}`);

  // Update payout status
  await supabase
    .from("paystack_payouts")
    .update({
      status: "reversed",
      failure_reason: reason || "Transfer reversed",
      updated_at: new Date().toISOString(),
    })
    .eq("transfer_reference", reference);

  // Update related orders
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
    action: "paystack_payout_reversed",
    entity_type: "payout",
    entity_id: reference,
    details: {
      reference,
      reason,
    },
  });

  safeLog.warn(`Payout ${reference} reversed: ${reason}`);
}

async function handleRefundProcessed(supabase: any, data: any) {
  const { reference, amount, transaction_reference } = data;
  
  safeLog.info(`Processing refund for transaction: ${transaction_reference}`);

  // Find the refund request
  const { data: refund } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("payment_reference", transaction_reference)
    .eq("status", "approved")
    .single();

  if (refund) {
    await supabase
      .from("refund_requests")
      .update({
        status: "completed",
        refund_reference: reference,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", refund.id);

    safeLog.info(`Refund ${refund.id} marked as completed`);
  }
}
