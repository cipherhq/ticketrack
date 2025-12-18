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
    const { orderId, paypalOrderId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get PayPal config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "paypal")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("PayPal not configured");
    }

    const clientId = gatewayConfig.public_key;
    const clientSecret = gatewayConfig.secret_key_encrypted;
    const sandboxMode = gatewayConfig.sandbox_mode;
    const baseUrl = sandboxMode 
      ? "https://api-m.sandbox.paypal.com" 
      : "https://api-m.paypal.com";

    // Get PayPal access token
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    const authData = await authResponse.json();
    if (!authData.access_token) {
      throw new Error("Failed to get PayPal access token");
    }

    // Capture the payment
    const captureResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData.access_token}`,
        },
      }
    );

    const captureData = await captureResponse.json();

    if (captureData.status !== "COMPLETED") {
      console.error("PayPal capture failed:", captureData);
      throw new Error("Payment capture failed");
    }

    // Update order status
    await supabase
      .from("orders")
      .update({
        status: "completed",
        payment_reference: captureData.id,
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
      const ticketInserts = [];
      for (const item of order.order_items || []) {
        for (let i = 0; i < item.quantity; i++) {
          ticketInserts.push({
            order_id: orderId,
            event_id: order.event_id,
            ticket_type_id: item.ticket_type_id,
            user_id: order.user_id,
            status: "valid",
            qr_code: `TKT-${orderId.slice(0, 8)}-${Date.now()}-${i}`,
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

    return new Response(
      JSON.stringify({ success: true, captureId: captureData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("PayPal capture error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
