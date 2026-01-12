import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body
    const { organizerId, refreshUrl, returnUrl } = await req.json();

    if (!organizerId) {
      throw new Error("Organizer ID is required");
    }

    // Get organizer details
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("*, profiles:user_id(email, full_name)")
      .eq("id", organizerId)
      .single();

    if (orgError || !organizer) {
      throw new Error("Organizer not found");
    }

    // Check if organizer is from eligible country (US, UK, CA)
    const eligibleCountries = ["US", "GB", "CA"];
    if (!eligibleCountries.includes(organizer.country_code)) {
      throw new Error("Stripe Connect is only available for US, UK, and Canada organizers");
    }

    // Check if already has an active Connect account
    if (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") {
      throw new Error("Organizer already has an active Stripe Connect account");
    }

    // Get Stripe config from database
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "stripe")
      .eq("country_code", organizer.country_code === "CA" ? "US" : organizer.country_code)
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured for this region");
    }

    // Initialize Stripe
    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    let accountId = organizer.stripe_connect_id;

    // Create new Express account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: organizer.country_code === "GB" ? "GB" : organizer.country_code === "CA" ? "CA" : "US",
        email: organizer.profiles?.email || organizer.business_email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        business_profile: {
          name: organizer.business_name,
          url: organizer.website_url || undefined,
        },
        settings: {
          payouts: {
            schedule: {
              interval: "manual", // We control when payouts happen
            },
          },
        },
        metadata: {
          organizer_id: organizerId,
          platform: "ticketrack",
        },
      });

      accountId = account.id;

      // Save account ID to database
      const { error: updateError } = await supabase
        .from("organizers")
        .update({
          stripe_connect_id: accountId,
          stripe_connect_status: "pending",
          stripe_connect_terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizerId);

      if (updateError) {
        console.error("Failed to save Connect account ID:", updateError);
        // Don't throw - account was created, we can retry saving
      }
    }

    // Create account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl || `${req.headers.get("origin")}/organizer/stripe-connect?refresh=true`,
      return_url: returnUrl || `${req.headers.get("origin")}/organizer/stripe-connect?success=true`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        success: true,
        accountId: accountId,
        onboardingUrl: accountLink.url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create Connect account error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
