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

// Helper to send emails with service role authentication
async function sendEmailWithServiceRole(body: any): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[sendEmail] Missing environment variables");
    return { success: false, error: "Missing configuration" };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("[sendEmail] Error:", error);
    return { success: false, error: error.message };
  }
}

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

  // Check if this is a split payment
  if (meta?.type === "split_payment" && meta?.share_id) {
    await handleSplitPaymentSuccess(supabase, tx_ref, meta);
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
  // Check if tickets already exist
  const { data: existingTickets } = await supabase
    .from("tickets")
    .select("id")
    .eq("order_id", order.id);

  if (existingTickets && existingTickets.length > 0) {
    safeLog.debug(`Tickets already exist for order ${order.id}`);
    return;
  }

  // Get order items
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  if (!orderItems || orderItems.length === 0) return;

  const ticketsToCreate: any[] = [];

  // Generate tickets for each item
  for (const item of orderItems) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = "TKT" + Date.now().toString(36).toUpperCase() +
                        Math.random().toString(36).substring(2, 8).toUpperCase();

      ticketsToCreate.push({
        order_id: order.id,
        event_id: order.event_id,
        ticket_type_id: item.ticket_type_id,
        user_id: order.user_id,
        ticket_code: ticketCode,
        qr_code: ticketCode,
        status: "active",
        attendee_email: order.buyer_email,
        attendee_name: order.buyer_name,
        attendee_phone: order.buyer_phone || null,
        unit_price: item.unit_price,
        total_price: item.unit_price,
        payment_reference: order.payment_reference,
        payment_status: "completed",
        payment_method: "flutterwave",
      });
    }
  }

  if (ticketsToCreate.length > 0) {
    const { data: newTickets, error: ticketError } = await supabase
      .from("tickets")
      .insert(ticketsToCreate)
      .select();

    if (ticketError) {
      safeLog.error("Error creating tickets:", ticketError);
    } else {
      safeLog.info(`Created ${newTickets?.length || 0} tickets for order ${order.id}`);

      // Decrement ticket quantities
      for (const item of orderItems) {
        await supabase.rpc("decrement_ticket_quantity", {
          p_ticket_type_id: item.ticket_type_id,
          p_quantity: item.quantity,
        });
      }
    }
  }
}

async function sendConfirmationEmail(supabase: any, order: any) {
  try {
    await sendEmailWithServiceRole({
      type: order.is_donation ? "donation_receipt" : "order_confirmation",
      to: order.buyer_email,
      data: {
        buyerName: order.buyer_name,
        orderNumber: order.order_number,
        eventTitle: order.events?.title,
        totalAmount: order.total_amount,
        currency: order.currency,
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

// ============================================================================
// SPLIT PAYMENT HANDLERS
// ============================================================================

async function handleSplitPaymentSuccess(supabase: any, reference: string, meta: any) {
  const shareId = meta.share_id;
  const splitPaymentId = meta.split_payment_id;

  if (!shareId) {
    safeLog.warn("Split payment metadata missing share_id:", reference);
    return;
  }

  safeLog.info(`Processing Flutterwave split payment for share: ${shareId}`);

  // Get the share details for notifications
  const { data: paidShare } = await supabase
    .from("group_split_shares")
    .select("name, email, split_payment_id")
    .eq("id", shareId)
    .single();

  // Record the share payment
  const { data: shareResult, error: shareError } = await supabase.rpc("record_share_payment", {
    p_share_id: shareId,
    p_payment_reference: reference,
    p_payment_method: "flutterwave"
  });

  if (shareError) {
    logError("flutterwave_split_payment_record", shareError, { shareId, reference });
    return;
  }

  safeLog.info(`Split payment share ${shareId} recorded via Flutterwave, all_paid: ${shareResult?.all_paid}`);

  // Notify other members that someone paid (if not all paid yet)
  if (!shareResult?.all_paid && paidShare?.split_payment_id) {
    try {
      const { data: otherShares } = await supabase
        .from("group_split_shares")
        .select("email, name")
        .eq("split_payment_id", paidShare.split_payment_id)
        .eq("payment_status", "unpaid")
        .neq("id", shareId);

      const { data: splitPayment } = await supabase
        .from("group_split_payments")
        .select("event:events(title)")
        .eq("id", paidShare.split_payment_id)
        .single();

      const eventTitle = splitPayment?.event?.title || "the event";
      const payerName = paidShare?.name || "A group member";

      for (const share of otherShares || []) {
        await sendEmailWithServiceRole({
          type: "split_payment_progress",
          to: share.email,
          data: {
            name: share.name,
            payerName,
            eventTitle,
            remainingCount: (otherShares?.length || 1),
          },
        });
      }
    } catch (notifyError) {
      safeLog.warn("Failed to send split payment notifications:", notifyError);
    }
  }

  // Check if all shares are paid
  if (shareResult?.all_paid && splitPaymentId) {
    await handleSplitPaymentCompleted(supabase, splitPaymentId);
  }
}

async function handleSplitPaymentCompleted(supabase: any, splitPaymentId: string) {
  try {
    // Get split payment details
    const { data: splitPayment } = await supabase
      .from("group_split_payments")
      .select(`
        *,
        event:events(*),
        session:group_buy_sessions(*)
      `)
      .eq("id", splitPaymentId)
      .single();

    if (!splitPayment || splitPayment.order_id) {
      return;
    }

    // Get all shares
    const { data: shares } = await supabase
      .from("group_split_shares")
      .select("*")
      .eq("split_payment_id", splitPaymentId);

    if (!shares || shares.length === 0) return;

    // Create order for the group
    const orderNumber = `GRP-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        event_id: splitPayment.event_id,
        user_id: splitPayment.initiated_by,
        status: "completed",
        total_amount: splitPayment.grand_total,
        currency: splitPayment.currency,
        payment_provider: "flutterwave_split",
        payment_reference: splitPaymentId,
        paid_at: new Date().toISOString(),
        buyer_email: shares[0].email,
        is_group_order: true,
      })
      .select()
      .single();

    if (orderError || !order) {
      logError("flutterwave_split_order_create", orderError, { splitPaymentId });
      return;
    }

    // Create order items from ticket selection
    const ticketSelection = splitPayment.ticket_selection || [];
    const orderItems = ticketSelection.map((ticket: any) => ({
      order_id: order.id,
      ticket_type_id: ticket.ticket_type_id,
      quantity: ticket.quantity,
      unit_price: ticket.price,
      subtotal: ticket.price * ticket.quantity,
    }));

    await supabase.from("order_items").insert(orderItems);

    // Create tickets for each share holder
    const ticketInserts: any[] = [];
    let ticketIndex = 0;

    for (const item of ticketSelection) {
      const ticketsPerMember = Math.floor(item.quantity / shares.length);
      let remainder = item.quantity % shares.length;

      for (const share of shares) {
        const numTickets = ticketsPerMember + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);

        for (let i = 0; i < numTickets; i++) {
          ticketInserts.push({
            order_id: order.id,
            event_id: splitPayment.event_id,
            ticket_type_id: item.ticket_type_id,
            user_id: share.user_id,
            attendee_email: share.email,
            attendee_name: share.name,
            status: "valid",
            qr_code: `TKT-${order.id.slice(0, 8)}-${Date.now()}-${ticketIndex++}`,
            payment_status: "completed",
            total_price: item.price,
          });
        }
      }
    }

    if (ticketInserts.length > 0) {
      await supabase.from("tickets").insert(ticketInserts);
    }

    // Update ticket quantities
    for (const item of ticketSelection) {
      await supabase.rpc("decrement_ticket_quantity", {
        p_ticket_type_id: item.ticket_type_id,
        p_quantity: item.quantity,
      });
    }

    // Update split payment with order reference
    await supabase
      .from("group_split_payments")
      .update({
        order_id: order.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", splitPaymentId);

    // Send confirmation emails to all members
    for (const share of shares) {
      await sendEmailWithServiceRole({
        type: "split_payment_complete",
        to: share.email,
        data: {
          name: share.name,
          eventTitle: splitPayment.event?.title,
          orderNumber: order.order_number,
          shareAmount: share.share_amount,
          currency: splitPayment.currency,
        },
      });
    }

    safeLog.info(`Flutterwave split payment ${splitPaymentId} completed, order ${order.id} created`);
  } catch (error) {
    logError("flutterwave_split_payment_complete", error, { splitPaymentId });
  }
}
