import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { requireAuth, requireOrganizerOrAdmin, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const { user, supabase } = await requireAuth(req);

    const { organizerId } = await req.json();

    if (!organizerId) {
      return new Response(
        JSON.stringify({ error: "Organizer ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns this organizer or is admin
    await requireOrganizerOrAdmin(supabase, user.id, organizerId);

    // Get organizer details
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("id, stripe_connect_id, stripe_connect_status, country_code")
      .eq("id", organizerId)
      .single();

    if (orgError || !organizer) {
      throw new Error("Organizer not found");
    }

    if (!organizer.stripe_connect_id) {
      throw new Error("No Stripe Connect account linked");
    }

    if (organizer.stripe_connect_status !== "active") {
      throw new Error("Stripe Connect account is not active");
    }

    // Get Stripe config
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", organizer.country_code === "CA" ? "US" : organizer.country_code)
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured");
    }

    // Initialize Stripe
    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Fetch balance from connected account
    const balance = await stripe.balance.retrieve({
      stripeAccount: organizer.stripe_connect_id,
    });

    // Format balance data
    const available = balance.available.map(b => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    }));

    const pending = balance.pending.map(b => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    }));

    // Calculate totals (assuming single currency for simplicity)
    const totalAvailable = available.reduce((sum, b) => sum + b.amount, 0);
    const totalPending = pending.reduce((sum, b) => sum + b.amount, 0);
    const primaryCurrency = available[0]?.currency || pending[0]?.currency || "USD";

    return new Response(
      JSON.stringify({
        success: true,
        balance: {
          available: totalAvailable,
          pending: totalPending,
          currency: primaryCurrency,
          breakdown: {
            available,
            pending,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("Get balance error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve balance" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
