import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, reason = "Event cancelled", organizerId } = await req.json();

    if (!eventId) {
      throw new Error("eventId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, start_date, end_date, organizer_id, parent_event_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    // Get all tickets for this event (from completed orders)
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_code,
        attendee_email,
        attendee_name,
        unit_price,
        total_price,
        order_id,
        orders!inner(
          id,
          order_number,
          user_id,
          buyer_email,
          buyer_name,
          payment_provider,
          payment_reference,
          total_amount,
          currency,
          is_stripe_connect,
          status
        )
      `)
      .eq("event_id", eventId)
      .eq("payment_status", "completed")
      .eq("orders.status", "completed")
      .not("orders.payment_provider", "is", null);

    if (ticketsError) {
      throw new Error(`Failed to fetch tickets: ${ticketsError.message}`);
    }

    if (!tickets || tickets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No completed tickets to refund",
          refundsProcessed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group tickets by order to avoid duplicate refund processing
    const ordersMap = new Map();
    tickets.forEach((ticket: any) => {
      const orderId = ticket.order_id;
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          order: ticket.orders,
          tickets: [],
        });
      }
      ordersMap.get(orderId).tickets.push(ticket);
    });

    const refundResults = [];
    let successCount = 0;
    let failureCount = 0;
    const emailsSent = new Set<string>(); // Track which orders got emails

    // Process refunds for each order (create refund request for first ticket, refund full order)
    for (const [orderId, { order, tickets: orderTickets }] of ordersMap.entries()) {
      try {
        // Use first ticket to create refund request (will refund full order amount)
        const firstTicket = orderTickets[0];
        
        // Create refund request for the first ticket (refund full order amount)
        const { data: refundRequest, error: refundRequestError } = await supabase
          .from("refund_requests")
          .insert({
            ticket_id: firstTicket.id,
            order_id: orderId,
            event_id: eventId,
            organizer_id: organizerId || event.organizer_id,
            user_id: order.user_id,
            amount: parseFloat(order.total_amount), // Refund full order
            original_amount: parseFloat(order.total_amount),
            currency: order.currency || "NGN",
            reason: reason,
            status: "approved", // Auto-approve for cancellations
            organizer_decision: "approved",
            organizer_notes: `Automatic refund due to event cancellation`,
            organizer_decided_at: new Date().toISOString(),
            escalated_to_admin: false,
          })
          .select()
          .single();

        if (refundRequestError || !refundRequest) {
          console.error(`Failed to create refund request for order ${orderId}:`, refundRequestError);
          failureCount++;
          continue;
        }

        // Check if this is a test order (test orders have payment_reference starting with "TEST-")
        const isTestOrder = order.payment_reference && order.payment_reference.startsWith("TEST-");
        
        let processResult = null;
        let processError = null;
        let refundProcessed = false;

        if (isTestOrder) {
          // For test orders, skip actual payment gateway refund but simulate success
          console.log(`Test order detected (${order.payment_reference}), skipping gateway refund`);
          refundProcessed = true;
          processResult = {
            success: true,
            refund_reference: `TEST-REFUND-${Date.now()}`,
            test_order: true
          };
        } else {
          // Process refund via appropriate provider for real orders
          // Note: process-refund expects refundRequest.status === "approved", which we set above
          // Small delay to ensure refund request is fully committed to database
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Call process-refund Edge Function via HTTP
          const processRefundUrl = `${supabaseUrl}/functions/v1/process-refund`;
          const processRefundResponse = await fetch(processRefundUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ refundRequestId: refundRequest.id }),
          });
          
          if (processRefundResponse.ok) {
            try {
              processResult = await processRefundResponse.json();
            } catch (e) {
              processError = new Error(`Failed to parse refund response: ${e.message}`);
            }
          } else {
            try {
              const errorBody = await processRefundResponse.json();
              processError = new Error(errorBody.error || errorBody.message || `Refund processing failed: ${processRefundResponse.status}`);
            } catch (e) {
              processError = new Error(`Refund processing failed: ${processRefundResponse.status}`);
            }
          }

          // Check if refund was processed successfully
          refundProcessed = !processError && (processResult?.success || processResult?.refund_reference);
        }

        if (refundProcessed) {
          // Update refund request with refund reference (for both test and real orders)
          if (processResult?.refund_reference) {
            await supabase
              .from("refund_requests")
              .update({
                refund_reference: processResult.refund_reference,
                status: isTestOrder ? "processed" : refundRequest.status, // Keep approved for real orders until gateway confirms
                processed_at: new Date().toISOString(),
              })
              .eq("id", refundRequest.id);
          }

          // Update ALL tickets for this order (not just the one with refund request)
          await supabase
            .from("tickets")
            .update({
              status: "cancelled",
              payment_status: "refunded",
              refunded_at: new Date().toISOString(),
              refund_reason: reason,
            })
            .in("id", orderTickets.map((t: any) => t.id));

          // Update order status
          await supabase
            .from("orders")
            .update({
              status: "refunded",
              notes: `Automatic refund due to event cancellation: ${reason}`,
            })
            .eq("id", orderId);

          // Send cancellation email to attendee (once per order)
          if (!emailsSent.has(orderId) && order.buyer_email) {
            try {
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "event_cancelled",
                  to: order.buyer_email,
                  data: {
                    attendeeName: order.buyer_name || "there",
                    eventTitle: event.title,
                    eventDate: event.start_date,
                    orderNumber: order.order_number,
                    refundAmount: order.total_amount,
                    currency: order.currency,
                    refundReference: processResult?.refund_reference || refundRequest.refund_reference,
                    reason: reason,
                  },
                  userId: order.user_id,
                  eventId: eventId,
                },
              });
              emailsSent.add(orderId);
            } catch (emailError) {
              console.error(`Failed to send cancellation email to ${order.buyer_email}:`, emailError);
            }
          }

          successCount += orderTickets.length; // Count tickets refunded
          refundResults.push({
            orderId: orderId,
            orderNumber: order.order_number,
            ticketsRefunded: orderTickets.length,
            status: "success",
            refundAmount: order.total_amount,
            currency: order.currency,
          });
        } else {
          failureCount += orderTickets.length;
          refundResults.push({
            orderId: orderId,
            orderNumber: order.order_number,
            ticketsRefunded: orderTickets.length,
            status: "failed",
            error: processResult?.error || processError?.message || "Refund processing failed",
          });
        }
      } catch (error) {
        console.error(`Error processing refund for order ${orderId}:`, error);
        failureCount += orderTickets.length;
        refundResults.push({
          orderId: orderId,
          orderNumber: order.order_number,
          ticketsRefunded: orderTickets.length,
          status: "failed",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${successCount} refunds successfully, ${failureCount} failed`,
        refundsProcessed: successCount,
        refundsFailed: failureCount,
        results: refundResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-refund on cancellation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
