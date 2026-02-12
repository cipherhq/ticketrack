import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();

    if (!reference) {
      throw new Error("Missing payment reference");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user from the request
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Find the Stripe checkout session by reference in metadata
    // We need to check all active Stripe configs
    const { data: gatewayConfigs } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "stripe")
      .eq("is_active", true);

    let session = null;

    for (const config of gatewayConfigs || []) {
      try {
        const stripe = new Stripe(config.secret_key_encrypted, {
          apiVersion: "2023-10-16",
        });

        // Search for the checkout session by metadata reference
        const sessions = await stripe.checkout.sessions.list({
          limit: 5,
        });

        session = sessions.data.find(
          (s: any) =>
            s.metadata?.reference === reference &&
            s.metadata?.type === "ticket_transfer" &&
            s.payment_status === "paid"
        );

        if (session) break;
      } catch {
        continue;
      }
    }

    if (!session) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Payment not found or not yet confirmed. Please wait a moment and try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const ticketId = session.metadata.ticket_id;
    const recipientEmail = session.metadata.recipient_email;

    if (!ticketId || !recipientEmail) {
      throw new Error("Invalid session metadata");
    }

    // Execute the transfer via RPC
    const { data, error } = await supabase.rpc("transfer_ticket", {
      p_ticket_id: ticketId,
      p_from_user_id: user.id,
      p_to_user_email: recipientEmail,
      p_payment_reference: reference,
    });

    if (error) throw error;

    // Send transfer emails
    if (data?.success) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("*, events(title, start_date)")
        .eq("id", ticketId)
        .single();

      // Send notification emails (best-effort)
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "ticket_transfer_sent",
            to: user.email,
            data: {
              senderName: user.email,
              recipientName: data.recipient_name,
              recipientEmail: data.recipient_email,
              eventTitle: ticket?.events?.title,
              eventDate: ticket?.events?.start_date,
              appUrl: Deno.env.get("PUBLIC_APP_URL") || "https://ticketrack.com",
            },
          },
        });
      } catch {
        // Email failures should not block transfer
      }

      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "ticket_transfer_received",
            to: data.recipient_email,
            data: {
              senderName: user.email,
              recipientName: data.recipient_name,
              eventTitle: ticket?.events?.title,
              eventDate: ticket?.events?.start_date,
              appUrl: Deno.env.get("PUBLIC_APP_URL") || "https://ticketrack.com",
            },
          },
        });
      } catch {
        // Email failures should not block transfer
      }
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error completing stripe transfer:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
