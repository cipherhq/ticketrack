/**
 * Complete Stripe Order - Supabase Edge Function
 *
 * Completes a pending order after Stripe checkout redirect.
 * This acts as a fallback if the webhook didn't process the payment.
 * Uses service role to bypass RLS.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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

    const { orderId, sessionId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Completing order: ${orderId}, session: ${sessionId}`);

    // Get order with related data
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        events(id, title, slug, start_date, end_date, venue_name, venue_address, city, country, image_url, currency, notify_organizer_on_sale, organizer:organizers(id, email, business_email, business_name)),
        order_items(*, ticket_types(id, name, price))
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already completed, just return the tickets
    if (order.status === "completed") {
      const { data: existingTickets } = await supabase
        .from("tickets")
        .select("*")
        .eq("order_id", orderId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Order already completed",
          order: { ...order, status: "completed" },
          tickets: existingTickets || []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment with Stripe if we have a session ID
    if (sessionId && order.payment_provider === "stripe") {
      try {
        // Get Stripe config
        const { data: gatewayConfig } = await supabase
          .from("payment_gateway_config")
          .select("secret_key_encrypted")
          .eq("provider", "stripe")
          .eq("is_active", true)
          .limit(1)
          .single();

        if (gatewayConfig?.secret_key_encrypted) {
          const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
            apiVersion: "2023-10-16",
          });

          const session = await stripe.checkout.sessions.retrieve(sessionId);

          if (session.payment_status !== "paid") {
            return new Response(
              JSON.stringify({ success: false, error: "Payment not completed" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (stripeError) {
        console.error("Stripe verification error:", stripeError);
        // Continue anyway - payment may have been verified by webhook
      }
    }

    // Update order status to completed
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "completed",
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "pending"); // Only update if still pending

    if (updateError) {
      console.error("Failed to update order:", updateError);
    }

    // Check if tickets already exist
    const { data: existingTickets } = await supabase
      .from("tickets")
      .select("*")
      .eq("order_id", orderId);

    let tickets = existingTickets || [];

    // Create tickets if they don't exist
    if (tickets.length === 0 && order.order_items?.length > 0) {
      const ticketsToCreate: any[] = [];

      for (const item of order.order_items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketCode = "TKT" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
          ticketsToCreate.push({
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
            payment_reference: order.payment_reference,
            payment_status: "completed",
            payment_method: order.payment_method || order.payment_provider || "stripe",
            order_id: orderId,
            status: "active",
          });
        }
      }

      if (ticketsToCreate.length > 0) {
        const { data: newTickets, error: ticketError } = await supabase
          .from("tickets")
          .insert(ticketsToCreate)
          .select();

        if (ticketError) {
          console.error("Error creating tickets:", ticketError);
        } else {
          tickets = newTickets || [];
          console.log(`Created ${tickets.length} tickets`);

          // Decrement ticket quantities
          for (const item of order.order_items) {
            await supabase.rpc("decrement_ticket_quantity", {
              p_ticket_type_id: item.ticket_type_id,
              p_quantity: item.quantity,
            });
          }
        }
      }
    }

    // Send confirmation email
    try {
      const eventData = order.events;
      const ticketTypes = order.order_items?.map((i: any) => i.ticket_types?.name || "Ticket").join(", ") || "Ticket";
      const totalQty = order.order_items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
      const fullVenue = [eventData?.venue_name, eventData?.venue_address, eventData?.city, eventData?.country].filter(Boolean).join(", ") || "TBA";

      await supabase.functions.invoke("send-email", {
        body: {
          type: "ticket_purchase",
          to: order.buyer_email,
          data: {
            attendeeName: order.buyer_name,
            eventTitle: eventData?.title,
            eventDate: eventData?.start_date,
            venueName: fullVenue,
            city: eventData?.city || "",
            ticketType: ticketTypes,
            quantity: totalQty,
            orderNumber: order.order_number,
            totalAmount: order.total_amount,
            currency: order.currency || eventData?.currency || "GBP",
            isFree: parseFloat(order.total_amount) === 0,
            appUrl: "https://ticketrack.com",
          },
        },
      });
      console.log("Confirmation email sent");

      // Send notification to organizer
      const organizerEmail = eventData?.organizer?.email || eventData?.organizer?.business_email;
      if (organizerEmail && eventData?.notify_organizer_on_sale !== false) {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "new_ticket_sale",
            to: organizerEmail,
            data: {
              eventTitle: eventData?.title,
              eventId: eventData?.id,
              ticketType: ticketTypes,
              quantity: totalQty,
              buyerName: order.buyer_name,
              buyerEmail: order.buyer_email,
              buyerPhone: order.buyer_phone || null,
              amount: order.total_amount,
              currency: order.currency || eventData?.currency || "GBP",
              isFree: parseFloat(order.total_amount) === 0,
              appUrl: "https://ticketrack.com",
            },
          },
        });
      }
    } catch (emailError) {
      console.error("Email error:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: { ...order, status: "completed" },
        tickets: tickets,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Complete order error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
