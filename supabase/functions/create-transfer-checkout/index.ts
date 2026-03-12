import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { requireAuth, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ticketrack.com",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication - only logged-in users can transfer tickets
    const { user, supabase } = await requireAuth(req);

    const {
      ticketId,
      recipientEmail,
      transferFee,
      currency,
      reference,
      successUrl,
      cancelUrl,
    } = await req.json();

    // Validate redirect URLs to prevent open redirect attacks
    const allowedOrigins = ["https://ticketrack.com", "https://www.ticketrack.com"];
    const isValidUrl = (url: string) => {
      try { return allowedOrigins.includes(new URL(url).origin); } catch { return false; }
    };
    if (successUrl && !isValidUrl(successUrl) || cancelUrl && !isValidUrl(cancelUrl)) {
      return new Response(
        JSON.stringify({ error: "Invalid redirect URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ticketId || !recipientEmail || !transferFee || !currency) {
      throw new Error("Missing required fields");
    }

    // Verify ticket exists and get event info
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, event_id, user_id, events(id, title, currency, country_code)")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket not found");
    }

    // CRITICAL: Validate transferFee matches the platform's configured transfer fee
    const { data: transferFeeSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "ticket_transfer_fee")
      .single();

    if (transferFeeSetting?.value) {
      const configuredFee = parseFloat(transferFeeSetting.value);
      const clientFee = parseFloat(transferFee);
      if (isNaN(clientFee) || Math.abs(clientFee - configuredFee) > 0.01) {
        throw new Error("Invalid transfer fee");
      }
    }

    // Use the configured fee (or the validated client fee)
    const verifiedFee = transferFeeSetting?.value
      ? parseFloat(transferFeeSetting.value)
      : parseFloat(transferFee);

    const countryCode = ticket.events?.country_code || "US";

    // Get Stripe config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "stripe")
      .eq("is_active", true)
      .in("country_code", [countryCode, "GB", "US"])
      .limit(1)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured for this region");
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Create Stripe Checkout session for transfer fee
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Ticket Transfer Fee`,
              description: `Transfer fee for ${ticket.events?.title || "event ticket"}`,
            },
            unit_amount: Math.round(verifiedFee * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "ticket_transfer",
        ticket_id: ticketId,
        recipient_email: recipientEmail,
        reference: reference,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("Error creating transfer checkout:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create transfer checkout" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
