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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`[complete-stripe-order] URL exists: ${!!supabaseUrl}, Key exists: ${!!supabaseKey}, Key length: ${supabaseKey?.length || 0}`);

    if (!supabaseUrl || !supabaseKey) {
      console.error("[complete-stripe-order] Missing environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log(`[complete-stripe-order] Received body:`, JSON.stringify(body));
    let { orderId, sessionId } = body;

    // Sanitize orderId - trim whitespace and ensure it's a string
    if (orderId) {
      orderId = String(orderId).trim();
    }

    console.log(`[complete-stripe-order] Sanitized orderId: "${orderId}", type: ${typeof orderId}, length: ${orderId?.length}`);

    // If no orderId but we have sessionId, try to get orderId from Stripe session metadata
    if (!orderId && sessionId) {
      console.log(`[complete-stripe-order] No orderId provided, trying to get from Stripe session: ${sessionId}`);
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
          console.log(`[complete-stripe-order] Stripe session metadata:`, JSON.stringify(session.metadata));

          if (session.metadata?.order_id) {
            orderId = session.metadata.order_id;
            console.log(`[complete-stripe-order] Got orderId from Stripe session: ${orderId}`);
          }
        }
      } catch (stripeErr) {
        console.error(`[complete-stripe-order] Error getting orderId from Stripe:`, stripeErr);
      }
    }

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing orderId - could not retrieve from URL or Stripe session" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      console.error(`[complete-stripe-order] Invalid orderId format: ${orderId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid orderId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[complete-stripe-order] Starting order completion: ${orderId}, session: ${sessionId}`);

    // First, get the basic order data (simple query that should always work with service role)
    const { data: baseOrder, error: baseError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    console.log(`[complete-stripe-order] Base order query: found=${!!baseOrder}, error=${baseError?.message || 'none'}`);

    if (baseError || !baseOrder) {
      console.error("[complete-stripe-order] Base order not found:", JSON.stringify({
        orderId,
        error: baseError?.message,
        errorCode: baseError?.code,
        errorDetails: baseError?.details
      }));
      return new Response(
        JSON.stringify({ success: false, error: "Order not found", details: baseError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build order object with related data - fetch separately to avoid join issues
    let order: any = { ...baseOrder };

    // If order has no event_id, try to get it from Stripe session metadata
    let eventId = baseOrder.event_id;
    if (!eventId && sessionId) {
      console.log(`[complete-stripe-order] Order has no event_id, trying to get from Stripe session metadata`);
      try {
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
          if (session.metadata?.event_id) {
            eventId = session.metadata.event_id;
            console.log(`[complete-stripe-order] Got event_id from Stripe metadata: ${eventId}`);
            // Update the order with the event_id
            await supabase.from("orders").update({ event_id: eventId }).eq("id", orderId);
            order.event_id = eventId;
          }
        }
      } catch (stripeErr) {
        console.error(`[complete-stripe-order] Error getting event_id from Stripe:`, stripeErr);
      }
    }

    console.log(`[complete-stripe-order] Fetching event for event_id: ${eventId}`);

    // Fetch event data
    if (eventId) {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, slug, start_date, end_date, venue_name, venue_address, city, country, image_url, currency, notify_organizer_on_sale, organizer_id")
        .eq("id", eventId)
        .single();

      console.log(`[complete-stripe-order] Event query result: found=${!!eventData}, error=${eventError?.message || 'none'}, code=${eventError?.code || 'none'}`);

      if (eventError) {
        console.error(`[complete-stripe-order] Event fetch error:`, JSON.stringify({
          message: eventError.message,
          code: eventError.code,
          details: eventError.details,
          hint: eventError.hint
        }));
      }

      if (eventData) {
        console.log(`[complete-stripe-order] Event found: "${eventData.title}", organizer_id: ${eventData.organizer_id}`);
        // Fetch organizer data
        const { data: organizerData, error: orgError } = await supabase
          .from("organizers")
          .select("id, email, business_email, business_name")
          .eq("id", eventData.organizer_id)
          .single();

        if (orgError) {
          console.error(`[complete-stripe-order] Organizer fetch error:`, orgError.message);
        }
        console.log(`[complete-stripe-order] Organizer found: ${organizerData?.business_name || 'none'}`);

        order.events = { ...eventData, organizer: organizerData };
      } else {
        console.error(`[complete-stripe-order] No event found for event_id: ${eventId}`);
      }
    } else {
      console.error(`[complete-stripe-order] Order has no event_id and could not retrieve from Stripe!`);
    }

    // Fetch order items with ticket types
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*, ticket_types(id, name, price)")
      .eq("order_id", orderId);

    if (itemsError) {
      console.error(`[complete-stripe-order] Order items fetch error:`, itemsError.message);
    }

    order.order_items = orderItems || [];

    console.log(`[complete-stripe-order] Order ${orderId} assembled: user_id=${order.user_id}, event=${order.events?.title || 'MISSING'}, items=${order.order_items?.length || 0}`);

    // If already completed, just return the tickets
    if (order.status === "completed") {
      console.log(`[complete-stripe-order] Order ${orderId} already completed, returning existing tickets`);

      const { data: existingTickets } = await supabase
        .from("tickets")
        .select("*, ticket_types(name)")
        .eq("order_id", orderId);

      // Add ticket_type_name to tickets for frontend PDF generation
      const ticketsWithTypeName = (existingTickets || []).map(t => ({
        ...t,
        ticket_type_name: t.ticket_types?.name || "Ticket"
      }));

      return new Response(
        JSON.stringify({
          success: true,
          message: "Order already completed",
          order: { ...order, status: "completed" },
          tickets: ticketsWithTypeName
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
          console.error("[complete-stripe-order] Error creating tickets:", ticketError);
          console.error("[complete-stripe-order] Tickets attempted:", JSON.stringify(ticketsToCreate.slice(0, 2)));
        } else {
          // Add ticket_type_name to tickets for frontend PDF generation
          const ticketTypeMap = new Map(
            order.order_items?.map((i: any) => [i.ticket_type_id, i.ticket_types?.name || "Ticket"]) || []
          );
          tickets = (newTickets || []).map(t => ({
            ...t,
            ticket_type_name: ticketTypeMap.get(t.ticket_type_id) || "Ticket"
          }));
          console.log(`[complete-stripe-order] Created ${tickets.length} tickets for user_id: ${order.user_id}`);

          // Decrement ticket quantities (skip if ticket_type_id is null - free events)
          for (const item of order.order_items) {
            if (item.ticket_type_id) {
              await supabase.rpc("decrement_ticket_quantity", {
                p_ticket_type_id: item.ticket_type_id,
                p_quantity: item.quantity,
              });
            }
          }
        }
      }
    }

    // Send emails: attendee confirmation + organizer notification
    try {
      const eventData = order.events;
      const ticketTypes = order.order_items?.map((i: any) => i.ticket_types?.name || "Ticket").join(", ") || "Ticket";
      const totalQty = order.order_items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
      const venueName = [eventData?.venue_name, eventData?.venue_address, eventData?.city].filter(Boolean).join(", ") || "TBA";

      // Only send emails if we have event data (to avoid "undefined" emails)
      if (!eventData?.title) {
        console.error("[complete-stripe-order] Skipping emails - event data missing. Event title:", eventData?.title);
        console.error("[complete-stripe-order] Full order.events:", JSON.stringify(order.events));
      } else {
        // NOTE: Attendee confirmation email with PDF is sent from frontend (WebPaymentSuccess)
        // This edge function only sends the organizer notification
        console.log("[complete-stripe-order] Attendee email will be sent from frontend with PDF attachment");

        // Send notification to organizer
        const organizerEmail = eventData?.organizer?.email || eventData?.organizer?.business_email;
        if (organizerEmail && eventData?.notify_organizer_on_sale !== false) {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              type: "new_ticket_sale",
              to: organizerEmail,
              data: {
                eventTitle: eventData.title,
                eventId: eventData.id,
                ticketType: ticketTypes,
                quantity: totalQty,
                buyerName: order.buyer_name,
                buyerEmail: order.buyer_email,
                buyerPhone: order.buyer_phone || null,
                amount: order.total_amount,
                currency: order.currency || eventData.currency || "GBP",
                isFree: parseFloat(order.total_amount) === 0,
                appUrl: "https://ticketrack.com",
              },
            }),
          });
          const emailResult = await emailResponse.json();
          if (emailResult.success) {
            console.log("[complete-stripe-order] Organizer notification email sent");
          } else {
            console.error("[complete-stripe-order] Organizer email failed:", emailResult.error);
          }
        }
      }
    } catch (emailError) {
      console.error("[complete-stripe-order] Email error:", emailError);
    }

    console.log(`[complete-stripe-order] Order ${orderId} completed successfully. Tickets: ${tickets.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        order: { ...order, status: "completed" },
        tickets: tickets,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[complete-stripe-order] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
