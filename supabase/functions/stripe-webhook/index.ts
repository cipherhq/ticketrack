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
      await supabase.functions.invoke("send-email", {
        body: {
          type: "split_payment_complete",
          to: share.email,
          data: {
            name: share.name,
            eventTitle: splitPayment.event?.title,
            orderNumber: order.order_number,
            shareAmount: share.share_amount,
            currency: splitPayment.currency,
          },
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
          await supabase.functions.invoke("send-email", {
            body: {
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
