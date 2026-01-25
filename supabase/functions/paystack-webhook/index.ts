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

    // Verify webhook signature (check all possible secret key names)
    const paystackSecrets = [
      Deno.env.get("PAYSTACK_SECRET_KEY"),
      Deno.env.get("PAYSTACK_SECRET_KEY_NG"),
      Deno.env.get("PAYSTACK_SECRET_KEY_GH"),
    ].filter(Boolean);

    let isValidSignature = false;

    for (const secret of paystackSecrets) {
      if (signature && secret) {
        const hash = createHmac("sha512", secret)
          .update(body)
          .toString();
        if (hash === signature) {
          isValidSignature = true;
          break;
        }
      }
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

  // Check if this is a credit purchase
  if (metadata?.type === 'credit_purchase') {
    await handleCreditPurchase(supabase, data);
    return;
  }

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

async function handleCreditPurchase(supabase: any, data: any) {
  const { reference, amount, metadata, currency } = data;
  const { organizer_id, transaction_id, credits, bonus_credits, package_id } = metadata;

  safeLog.info(`Processing credit purchase for organizer: ${organizer_id}`);

  // Add credits using the database function
  const { data: txId, error: addError } = await supabase.rpc('add_communication_credits', {
    p_organizer_id: organizer_id,
    p_credits: parseInt(credits),
    p_bonus_credits: parseInt(bonus_credits || 0),
    p_package_id: package_id || null,
    p_amount_paid: amount / 100,
    p_currency: currency || 'NGN',
    p_payment_provider: 'paystack',
    p_payment_reference: reference,
    p_description: `Credit purchase via Paystack`,
  });

  if (addError) {
    safeLog.error('Failed to add credits:', addError);
    return;
  }

  // Update the original transaction record if exists
  if (transaction_id) {
    const { data: balance } = await supabase
      .from('communication_credit_balances')
      .select('balance, bonus_balance')
      .eq('organizer_id', organizer_id)
      .single();

    await supabase
      .from('communication_credit_transactions')
      .update({
        balance_after: balance?.balance || 0,
        bonus_balance_after: balance?.bonus_balance || 0,
        payment_reference: reference,
        metadata: { status: 'completed', paid_at: new Date().toISOString() },
      })
      .eq('id', transaction_id);
  }

  // Get organizer for email notification
  const { data: organizer } = await supabase
    .from('organizers')
    .select('business_name, user_id')
    .eq('id', organizer_id)
    .single();

  if (organizer?.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', organizer.user_id)
      .single();

    if (profile?.email) {
      // Get new balance
      const { data: balance } = await supabase
        .from('communication_credit_balances')
        .select('balance, bonus_balance')
        .eq('organizer_id', organizer_id)
        .single();

      await supabase.functions.invoke('send-email', {
        body: {
          type: 'sms_units_purchased', // Reusing existing template
          to: profile.email,
          data: {
            organizerName: organizer.business_name,
            units: parseInt(credits) + parseInt(bonus_credits || 0),
            amount: amount / 100,
            currency: currency || 'NGN',
            newBalance: (balance?.balance || 0) + (balance?.bonus_balance || 0),
          },
        },
      });
    }
  }

  // Log audit
  await supabase.from('admin_audit_logs').insert({
    action: 'credit_purchase_completed',
    entity_type: 'credit_purchase',
    entity_id: transaction_id || reference,
    details: {
      reference,
      organizer_id,
      credits: parseInt(credits),
      bonus_credits: parseInt(bonus_credits || 0),
      amount: amount / 100,
      currency: currency || 'NGN',
    },
  });

  safeLog.info(`Credit purchase completed: ${credits} + ${bonus_credits || 0} credits for ${organizer_id}`);
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
