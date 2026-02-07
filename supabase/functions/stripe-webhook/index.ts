import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  errorResponse, 
  logError, 
  safeLog,
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
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

// Helper function to handle completed split payments
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
      // Already processed or not found
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
        payment_provider: "split_payment",
        payment_reference: splitPaymentId,
        paid_at: new Date().toISOString(),
        buyer_email: shares[0].email,
        is_group_order: true,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Error creating order for split payment:", orderError);
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

    safeLog.info(`Split payment ${splitPaymentId} completed, order ${order.id} created`);
  } catch (error) {
    console.error("Error handling split payment completion:", error);
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

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // Get webhook secret from config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("webhook_secret_encrypted, secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured");
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature!,
        gatewayConfig.webhook_secret_encrypted
      );
    } catch (err) {
      logError("stripe_webhook_auth", err);
      return errorResponse(
        ERROR_CODES.AUTH_INVALID,
        400,
        err,
        "Invalid webhook signature",
        corsHeaders
      );
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      const paymentType = session.metadata?.type;

      // Handle split payment
      if (paymentType === "split_payment") {
        const shareId = session.metadata?.share_id;
        const splitPaymentId = session.metadata?.split_payment_id;

        if (shareId) {
          // Get the share details for notifications
          const { data: paidShare } = await supabase
            .from("group_split_shares")
            .select("name, email, split_payment_id")
            .eq("id", shareId)
            .single();

          // Record the share payment
          const { data: shareResult, error: shareError } = await supabase.rpc("record_share_payment", {
            p_share_id: shareId,
            p_payment_reference: session.payment_intent || session.id,
            p_payment_method: "stripe"
          });

          if (shareError) {
            console.error("Error recording split payment:", shareError);
          } else if (shareResult?.all_paid) {
            // All shares paid - create the order and tickets
            await handleSplitPaymentCompleted(supabase, splitPaymentId);
          } else if (paidShare?.split_payment_id) {
            // Notify other members that someone paid
            try {
              const { data: otherShares } = await supabase
                .from("group_split_shares")
                .select("email, name")
                .eq("split_payment_id", paidShare.split_payment_id)
                .eq("payment_status", "unpaid")
                .neq("id", shareId);

              const { data: splitPaymentData } = await supabase
                .from("group_split_payments")
                .select("event:events(title)")
                .eq("id", paidShare.split_payment_id)
                .single();

              const eventTitle = splitPaymentData?.event?.title || "the event";
              const payerName = paidShare?.name || "A group member";

              for (const share of otherShares || []) {
                await supabase.functions.invoke("send-email", {
                  body: {
                    type: "split_payment_progress",
                    to: share.email,
                    data: {
                      name: share.name,
                      payerName,
                      eventTitle,
                      remainingCount: (otherShares?.length || 1),
                    },
                  },
                });
              }
            } catch (notifyError) {
              safeLog.warn("Failed to send split payment notifications:", notifyError);
            }
          }

          safeLog.info(`Split payment share ${shareId} completed via Stripe`);
        }
      } else if (orderId) {
        // Update order status
        await supabase
          .from("orders")
          .update({
            status: "completed",
            payment_reference: session.payment_intent,
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        // Get order details for ticket creation
        const { data: order } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", orderId)
          .single();

        if (order) {
          // Check if tickets already exist
          const { data: existingTickets } = await supabase
            .from("tickets")
            .select("id")
            .eq("order_id", orderId);

          // Only create tickets if they don't exist
          if (!existingTickets || existingTickets.length === 0) {
            const ticketInserts: any[] = [];
            for (const item of order.order_items || []) {
              for (let i = 0; i < item.quantity; i++) {
                const ticketCode = "TKT" + Date.now().toString(36).toUpperCase() +
                                  Math.random().toString(36).substring(2, 8).toUpperCase();
                ticketInserts.push({
                  order_id: orderId,
                  event_id: order.event_id,
                  ticket_type_id: item.ticket_type_id,
                  user_id: order.user_id,
                  attendee_email: order.buyer_email,
                  attendee_name: order.buyer_name,
                  attendee_phone: order.buyer_phone || null,
                  ticket_code: ticketCode,
                  qr_code: ticketCode,
                  unit_price: item.unit_price,
                  total_price: item.unit_price,
                  payment_reference: session.payment_intent,
                  payment_status: "completed",
                  payment_method: "stripe",
                  status: "active",
                });
              }
            }

            if (ticketInserts.length > 0) {
              const { error: ticketError } = await supabase.from("tickets").insert(ticketInserts);
              if (ticketError) {
                console.error("Error creating tickets:", ticketError);
              } else {
                // Update ticket_types quantities
                for (const item of order.order_items || []) {
                  await supabase.rpc("decrement_ticket_quantity", {
                    p_ticket_type_id: item.ticket_type_id,
                    p_quantity: item.quantity,
                  });
                }
              }
            }
          }
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;

      if (orderId) {
        await supabase
          .from("orders")
          .update({ status: "expired" })
          .eq("id", orderId);
      }
    } else if (event.type === "charge.dispute.created") {
      // Handle new chargeback/dispute
      const dispute = event.data.object;
      await handleStripeDispute(supabase, stripe, dispute, "opened");
    } else if (event.type === "charge.dispute.updated") {
      // Handle dispute status update
      const dispute = event.data.object;
      await handleStripeDispute(supabase, stripe, dispute, "updated");
    } else if (event.type === "charge.dispute.closed") {
      // Handle dispute resolution
      const dispute = event.data.object;
      await handleStripeDisputeClosed(supabase, dispute);
    } else if (event.type === "payout.paid") {
      // Handle payout completion - send notification to organizer
      const payout = event.data.object;

      console.log(`Payout ${payout.id} completed for account ${payout.destination}`);

      // Find the payout record in our database
      const { data: payoutRecord } = await supabase
        .from("stripe_connect_payouts")
        .select(`
          *,
          organizers (
            id,
            business_name,
            user_id
          ),
          events (
            title
          )
        `)
        .eq("stripe_payout_id", payout.id)
        .single();

      if (payoutRecord) {
        // Update payout status
        await supabase
          .from("stripe_connect_payouts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", payoutRecord.id);

        // Send payout received notification
        const organizer = payoutRecord.organizers;
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", organizer.user_id)
          .single();

        if (profile?.email) {
          await sendEmailWithServiceRole({
            type: "stripe_connect_payout_completed",
            to: profile.email,
            data: {
              organizerName: organizer.business_name,
              eventTitle: payoutRecord.events?.title || "Event",
              amount: (payout.amount / 100).toFixed(2),
              currency: payout.currency.toUpperCase(),
              arrivalDate: new Date().toLocaleDateString(),
              payoutId: payout.id,
            },
          });
        }

        safeLog.info(`Payout completion notification sent for ${payout.id}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logError("stripe_webhook", error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      400,
      error,
      undefined,
      corsHeaders
    );
  }
});

// Handle Stripe dispute/chargeback events
async function handleStripeDispute(supabase: any, stripe: Stripe, dispute: any, action: string) {
  try {
    safeLog.info(`Processing Stripe dispute ${dispute.id} - ${action}`);

    // Get the charge to find the order
    const charge = await stripe.charges.retrieve(dispute.charge as string);

    // Try to find order by payment intent or charge ID
    let order = null;
    const { data: orderByIntent } = await supabase
      .from("orders")
      .select("*, events(organizer_id, title)")
      .eq("payment_reference", charge.payment_intent || charge.id)
      .single();

    order = orderByIntent;

    if (!order) {
      // Try by metadata
      if (charge.metadata?.order_id) {
        const { data: orderById } = await supabase
          .from("orders")
          .select("*, events(organizer_id, title)")
          .eq("id", charge.metadata.order_id)
          .single();
        order = orderById;
      }
    }

    // Calculate evidence due date
    const evidenceDueBy = dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create or update chargeback record
    const { data: result, error } = await supabase.rpc("create_chargeback_from_webhook", {
      p_provider: "stripe",
      p_provider_dispute_id: dispute.id,
      p_provider_charge_id: charge.id,
      p_order_id: order?.id || null,
      p_disputed_amount: dispute.amount / 100,
      p_currency: dispute.currency.toUpperCase(),
      p_reason: dispute.reason,
      p_reason_code: dispute.reason,
      p_evidence_due_by: evidenceDueBy,
      p_provider_data: JSON.stringify(dispute),
    });

    if (error) {
      logError("create_stripe_chargeback", error, { dispute_id: dispute.id });
      return;
    }

    // Send notification to organizer
    if (order?.events?.organizer_id) {
      const { data: organizer } = await supabase
        .from("organizers")
        .select("business_name, user_id")
        .eq("id", order.events.organizer_id)
        .single();

      if (organizer?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", organizer.user_id)
          .single();

        if (profile?.email) {
          await sendEmailWithServiceRole({
            type: "chargeback_received",
            to: profile.email,
            data: {
              organizerName: organizer.business_name,
              eventTitle: order.events?.title || "Event",
              orderNumber: order.order_number,
              amount: (dispute.amount / 100).toFixed(2),
              currency: dispute.currency.toUpperCase(),
              reason: dispute.reason,
              evidenceDueBy: new Date(evidenceDueBy).toLocaleDateString(),
              chargebackUrl: "https://ticketrack.com/organizer/chargebacks",
            },
          });
        }
      }
    }

    // Also notify finance team
    await sendEmailWithServiceRole({
      type: "chargeback_alert",
      to: Deno.env.get("FINANCE_ADMIN_EMAIL") || "finance@ticketrack.com",
      data: {
        disputeId: dispute.id,
        orderId: order?.id,
        amount: (dispute.amount / 100).toFixed(2),
        currency: dispute.currency.toUpperCase(),
        reason: dispute.reason,
        eventTitle: order?.events?.title || "Unknown",
      },
    });

    safeLog.info(`Stripe dispute ${dispute.id} recorded successfully`);
  } catch (err) {
    logError("handle_stripe_dispute", err, { dispute_id: dispute.id });
  }
}

// Handle Stripe dispute closure
async function handleStripeDisputeClosed(supabase: any, dispute: any) {
  try {
    safeLog.info(`Processing closed Stripe dispute ${dispute.id}`);

    // Map Stripe status to our status
    let resolution: string;
    let status: string;

    switch (dispute.status) {
      case "won":
        resolution = "won";
        status = "won";
        break;
      case "lost":
        resolution = "lost";
        status = "lost";
        break;
      case "warning_closed":
        resolution = "withdrawn";
        status = "withdrawn";
        break;
      default:
        resolution = "lost";
        status = "closed";
    }

    // Update chargeback status
    const { data: chargeback } = await supabase
      .from("chargebacks")
      .select("id, organizer_id, disputed_amount, currency")
      .eq("provider_dispute_id", dispute.id)
      .single();

    if (chargeback) {
      await supabase.rpc("update_chargeback_status", {
        p_chargeback_id: chargeback.id,
        p_new_status: status,
        p_resolution: resolution,
        p_notes: `Dispute ${dispute.status} via Stripe webhook`,
      });

      // Send resolution notification
      const { data: organizer } = await supabase
        .from("organizers")
        .select("business_name, user_id")
        .eq("id", chargeback.organizer_id)
        .single();

      if (organizer?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", organizer.user_id)
          .single();

        if (profile?.email) {
          await sendEmailWithServiceRole({
            type: resolution === "won" ? "chargeback_won" : "chargeback_lost",
            to: profile.email,
            data: {
              organizerName: organizer.business_name,
              amount: chargeback.disputed_amount,
              currency: chargeback.currency,
              resolution,
            },
          });
        }
      }
    }

    safeLog.info(`Stripe dispute ${dispute.id} closed: ${resolution}`);
  } catch (err) {
    logError("handle_stripe_dispute_closed", err, { dispute_id: dispute.id });
  }
}
