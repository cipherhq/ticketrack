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

      if (orderId) {
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
          // Create tickets
          const ticketInserts: any[] = [];
          for (const item of order.order_items || []) {
            for (let i = 0; i < item.quantity; i++) {
              ticketInserts.push({
                order_id: orderId,
                event_id: order.event_id,
                ticket_type_id: item.ticket_type_id,
                user_id: order.user_id,
                status: "valid",
                qr_code: "TKT-" + orderId.slice(0, 8) + "-" + Date.now() + "-" + i,
                payment_status: "completed",
                total_price: item.unit_price,
              });
            }
          }

          if (ticketInserts.length > 0) {
            await supabase.from("tickets").insert(ticketInserts);
          }

          // Update ticket_types quantities
          for (const item of order.order_items || []) {
            await supabase.rpc("decrement_ticket_quantity", {
              p_ticket_type_id: item.ticket_type_id,
              p_quantity: item.quantity,
            });
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
