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
import { timingSafeEqual } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { 
  errorResponse, 
  logError, 
  safeLog,
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ticketrack.com",
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

    if (!signature || !flutterwaveSecretHash) {
      logError("flutterwave_webhook_auth", new Error("Missing webhook signature or secret hash"));
      return errorResponse(
        ERROR_CODES.AUTH_INVALID,
        401,
        undefined,
        "Missing webhook signature",
        corsHeaders
      );
    }

    // Verify webhook signature using constant-time comparison to prevent timing attacks
    const encoder = new TextEncoder();
    const signatureBytes = encoder.encode(signature);
    const expectedBytes = encoder.encode(flutterwaveSecretHash);

    const isValidSignature = signatureBytes.length === expectedBytes.length &&
      timingSafeEqual(signatureBytes, expectedBytes);

    if (!isValidSignature) {
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
    .select("*, order_items(id, quantity, ticket_type_id, unit_price, ticket_types(price)), events(title, organizer_id, organizers(id, business_name, user_id, email, business_email, flutterwave_subaccount_id))")
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

  // Verify Flutterwave-charged amount matches expected total
  if (order.order_items?.length > 0) {
    let verifiedSubtotal = 0;
    for (const item of order.order_items) {
      const ticketPrice = parseFloat(item.ticket_types?.price || item.unit_price || 0);
      verifiedSubtotal += ticketPrice * item.quantity;
    }
    verifiedSubtotal = Math.round(verifiedSubtotal * 100) / 100;

    let verifiedDiscount = 0;
    if (order.promo_code_id && parseFloat(order.discount_amount || 0) > 0) {
      const { data: promo } = await supabase
        .from("promo_codes").select("discount_type, discount_value")
        .eq("id", order.promo_code_id).single();
      if (promo) {
        verifiedDiscount = promo.discount_type === 'percentage'
          ? Math.round(verifiedSubtotal * parseFloat(promo.discount_value) / 100 * 100) / 100
          : Math.min(parseFloat(promo.discount_value), verifiedSubtotal);
      }
    }

    const orderPlatformFee = Math.max(0, parseFloat(order.platform_fee || 0));
    const expectedTotal = Math.round((verifiedSubtotal + orderPlatformFee - verifiedDiscount) * 100) / 100;

    if (Math.abs(amount - expectedTotal) > 1) {
      logError("flutterwave_amount_mismatch", new Error(
        `Paid ${amount} but expected ${expectedTotal} for order ${order.id}`
      ));
      await supabase.from("orders").update({
        status: "failed",
        notes: `Payment amount mismatch: paid ${amount}, expected ${expectedTotal}`,
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);
      return;
    }
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

  // Send confirmation email to attendee
  await sendConfirmationEmail(supabase, order);

  // Send sale notification to organizer
  const organizerEmail = order.events?.organizers?.email || order.events?.organizers?.business_email;
  if (organizerEmail) {
    try {
      const totalQty = order.order_items?.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0) || 1;
      await sendEmailWithServiceRole({
        type: "new_ticket_sale",
        to: organizerEmail,
        data: {
          eventTitle: order.events?.title,
          eventId: order.event_id,
          ticketType: "Ticket",
          quantity: totalQty,
          buyerName: order.buyer_name,
          buyerEmail: order.buyer_email,
          buyerPhone: order.buyer_phone || null,
          amount: order.total_amount,
          currency: order.currency || "NGN",
          isFree: parseFloat(order.total_amount) === 0,
          appUrl: "https://ticketrack.com",
        },
      });
    } catch (emailErr) {
      safeLog.warn("Failed to send organizer sale notification:", emailErr);
    }
  }

  // Check if event is now sold out and send congratulatory email
  try {
    const { data: ticketTypes } = await supabase
      .from("ticket_types")
      .select("quantity_available, quantity_sold")
      .eq("event_id", order.event_id);

    if (ticketTypes && ticketTypes.length > 0) {
      const isSoldOut = ticketTypes.every(
        (tt: any) => (tt.quantity_sold || 0) >= (tt.quantity_available || 0) && (tt.quantity_available || 0) > 0
      );

      if (isSoldOut && organizerEmail) {
        const { data: eventInfo } = await supabase
          .from("events")
          .select("title, start_date, tickets_sold, capacity, currency")
          .eq("id", order.event_id)
          .single();

        const { data: revenueData } = await supabase
          .from("orders")
          .select("total_amount")
          .eq("event_id", order.event_id)
          .eq("status", "completed");

        const totalRevenue = revenueData?.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || 0), 0) || 0;

        await sendEmailWithServiceRole({
          type: "event_sold_out",
          to: organizerEmail,
          data: {
            eventTitle: eventInfo?.title || order.events?.title,
            eventId: order.event_id,
            totalSold: eventInfo?.tickets_sold || ticketTypes.reduce((sum: number, tt: any) => sum + (tt.quantity_sold || 0), 0),
            totalRevenue,
            currency: eventInfo?.currency || order.currency || "NGN",
            eventDate: eventInfo?.start_date,
            appUrl: "https://ticketrack.com",
          },
        });
        safeLog.info(`Sold out email sent for event ${order.event_id}`);
      }
    }
  } catch (soldOutErr) {
    safeLog.warn("Failed to check/send sold-out notification:", soldOutErr);
  }

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

  // === FRAUD DETECTION: Fetch card metadata and run rules ===
  try {
    await fetchFlutterwaveCardMetadataAndRunFraudRules(supabase, order, data);
  } catch (fraudErr) {
    safeLog.warn("Fraud detection error (non-blocking):", fraudErr);
  }

  safeLog.info(`Order ${order.id} marked as completed via Flutterwave`);
}

// === Fraud Detection Helpers ===

async function fetchFlutterwaveCardMetadataAndRunFraudRules(supabase: any, order: any, paymentData: any) {
  let cardMeta: any = null;

  // Verify transaction to get card details
  const flwSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  const transactionId = paymentData.id;

  if (flwSecretKey && transactionId) {
    try {
      const verifyRes = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        { headers: { Authorization: `Bearer ${flwSecretKey}` } }
      );
      const verifyData = await verifyRes.json();
      const card = verifyData?.data?.card;
      if (card) {
        cardMeta = {
          order_id: order.id,
          user_id: order.user_id,
          card_last4: card.last_4digits || null,
          card_first6: card.first_6digits || null,
          card_brand: card.type || null,
          card_type: card.type || null,
          card_country: card.country || null,
          card_bank: card.issuer || null,
          card_exp_month: card.expiry ? card.expiry.split('/')[0] : null,
          card_exp_year: card.expiry ? card.expiry.split('/')[1] : null,
          card_channel: verifyData?.data?.payment_type || null,
          card_signature: null, // Flutterwave doesn't provide card signature
          provider: 'flutterwave',
          provider_transaction_id: String(transactionId),
          raw_data: card,
        };
      }
    } catch (err) {
      safeLog.warn("Failed to verify Flutterwave transaction for card metadata:", err);
    }
  }

  // Insert card metadata if available
  if (cardMeta) {
    await supabase.from("fraud_card_metadata").insert(cardMeta);
  }

  // Run fraud rules (same logic as Paystack)
  await runFraudRulesFlutterwave(supabase, order, cardMeta);
}

async function runFraudRulesFlutterwave(supabase: any, order: any, cardMeta: any) {
  const flags: any[] = [];
  let totalScore = 0;
  let hasCritical = false;

  const addFlag = (ruleCode: string, ruleName: string, severity: string, score: number, details: any) => {
    flags.push({
      order_id: order.id,
      user_id: order.user_id,
      rule_code: ruleCode,
      rule_name: ruleName,
      severity,
      score,
      details,
    });
    totalScore += score;
    if (severity === 'critical') hasCritical = true;
  };

  // RULE: Blocklist checks
  const blockChecks: [string, string | null, string][] = [
    ['email', order.buyer_email, 'BLOCKLISTED_EMAIL'],
    ['phone', order.buyer_phone, 'BLOCKLISTED_PHONE'],
    ['ip', order.ip_address, 'BLOCKLISTED_IP'],
    ['device_fingerprint', order.device_fingerprint, 'BLOCKLISTED_DEVICE'],
  ];

  if (cardMeta?.card_first6) {
    blockChecks.push(['card_bin', cardMeta.card_first6, 'BLOCKLISTED_BIN']);
  }

  for (const [blockType, value, ruleCode] of blockChecks) {
    if (!value) continue;
    const { data: blocked } = await supabase
      .from("fraud_blocklist")
      .select("id, reason")
      .eq("block_type", blockType)
      .eq("block_value", blockType === 'email' ? value.toLowerCase() : value)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (blocked) {
      addFlag(ruleCode, `Blocklisted ${blockType}`, 'critical', 100, { block_type: blockType, value, reason: blocked.reason });
    }
  }

  // RULE: Email velocity
  if (order.buyer_email) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_email", order.buyer_email)
      .gte("created_at", oneHourAgo);

    if (count && count > 5) {
      addFlag('VELOCITY_HIGH', 'High email velocity', 'high', 40, { email: order.buyer_email, orders_in_hour: count });
    } else if (count && count > 3) {
      addFlag('VELOCITY_MEDIUM', 'Medium email velocity', 'medium', 20, { email: order.buyer_email, orders_in_hour: count });
    }
  }

  // RULE: IP velocity
  if (order.ip_address) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", order.ip_address)
      .gte("created_at", oneHourAgo);

    if (count && count > 10) {
      addFlag('IP_VELOCITY_HIGH', 'High IP velocity', 'high', 35, { ip: order.ip_address, orders_in_hour: count });
    }
  }

  // RULE: Geo mismatch
  if (cardMeta?.card_country) {
    const { data: eventData } = await supabase
      .from("events")
      .select("country_code")
      .eq("id", order.event_id)
      .single();

    if (eventData?.country_code && cardMeta.card_country.toUpperCase() !== eventData.country_code.toUpperCase()) {
      addFlag('GEO_MISMATCH', 'Card country differs from event country', 'medium', 25, {
        card_country: cardMeta.card_country,
        event_country: eventData.country_code,
      });
    }
  }

  // RULE: Cross-user card (BIN+last4 for Flutterwave since no card_signature)
  if (cardMeta?.card_first6 && cardMeta?.card_last4) {
    const { data: otherCards } = await supabase
      .from("fraud_card_metadata")
      .select("user_id")
      .eq("card_first6", cardMeta.card_first6)
      .eq("card_last4", cardMeta.card_last4)
      .neq("user_id", order.user_id)
      .limit(5);

    if (otherCards && otherCards.length > 0) {
      const uniqueUsers = [...new Set(otherCards.map((c: any) => c.user_id))];
      addFlag('DUPLICATE_CARD_BIN_LAST4', 'Same BIN+last4 on different users', 'medium', 25, {
        card_first6: cardMeta.card_first6,
        card_last4: cardMeta.card_last4,
        other_user_count: uniqueUsers.length,
      });
    }
  }

  // RULE: Multi-user device
  if (order.device_fingerprint) {
    const { data: deviceOrders } = await supabase
      .from("orders")
      .select("user_id")
      .eq("device_fingerprint", order.device_fingerprint)
      .neq("user_id", order.user_id)
      .limit(10);

    if (deviceOrders) {
      const uniqueUsers = [...new Set(deviceOrders.map((o: any) => o.user_id))];
      if (uniqueUsers.length >= 3) {
        addFlag('DEVICE_MULTI_USER', 'Device used by 3+ accounts', 'medium', 20, {
          device_fingerprint: order.device_fingerprint,
          user_count: uniqueUsers.length + 1,
        });
      }
    }
  }

  // RULE: High value order
  const thresholds: Record<string, number> = {
    NGN: 500000, GHS: 5000, USD: 1000, GBP: 800, CAD: 1200, EUR: 1000, KES: 150000, ZAR: 18000, AUD: 1500,
  };
  const orderAmount = parseFloat(order.total_amount || 0);
  const threshold = thresholds[order.currency?.toUpperCase()] || 1000;
  if (orderAmount > threshold) {
    addFlag('HIGH_VALUE_ORDER', 'High value order', 'low', 10, { amount: orderAmount, currency: order.currency, threshold });
  }

  totalScore = Math.min(totalScore, 100);

  let fraudStatus = 'clean';
  if (hasCritical) fraudStatus = 'blocked';
  else if (totalScore >= 50) fraudStatus = 'flagged';

  if (flags.length > 0) {
    await supabase.from("fraud_flags").insert(flags);
  }

  if (fraudStatus !== 'clean' || totalScore > 0) {
    await supabase.from("orders").update({
      fraud_risk_score: totalScore,
      fraud_status: fraudStatus,
    }).eq("id", order.id);
  }

  if (flags.length > 0) {
    safeLog.info(`Fraud detection: order ${order.id} scored ${totalScore}, status: ${fraudStatus}, flags: ${flags.length}`);
  }
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
