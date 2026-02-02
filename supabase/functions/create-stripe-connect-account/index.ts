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

    if (orgError) {
      console.error("Database error fetching organizer:", orgError);
      throw new Error("Failed to fetch organizer details");
    }

    if (!organizer) {
      throw new Error("Organizer not found");
    }

    console.log("Organizer country_code:", organizer.country_code);

    // Check if country code is set
    if (!organizer.country_code) {
      throw new Error("Please set your country in your organizer profile before connecting Stripe");
    }

    // Check if organizer is from eligible country (US, UK, CA, AU, IE, DE, FR, ES, IT, NL, BE, AT, CH)
    const eligibleCountries = ["US", "GB", "CA", "AU", "IE", "DE", "FR", "ES", "IT", "NL", "BE", "AT", "CH"];
    if (!eligibleCountries.includes(organizer.country_code)) {
      throw new Error(`Stripe Connect is not available in your country (${organizer.country_code}). It's available in: US, UK, Canada, Australia, and EU countries.`);
    }

    // Check if already has an active Connect account
    if (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") {
      throw new Error("Organizer already has an active Stripe Connect account");
    }

    // Get Stripe config from database
    // Map countries to their Stripe config region (EU countries use GB or US config)
    const countryToConfigMap: Record<string, string> = {
      US: "US",
      GB: "GB",
      CA: "US", // Canada uses US Stripe
      AU: "US", // Australia uses US Stripe
      IE: "GB", // Ireland uses GB Stripe
      DE: "GB", // Germany uses GB Stripe
      FR: "GB", // France uses GB Stripe
      ES: "GB", // Spain uses GB Stripe
      IT: "GB", // Italy uses GB Stripe
      NL: "GB", // Netherlands uses GB Stripe
      BE: "GB", // Belgium uses GB Stripe
      AT: "GB", // Austria uses GB Stripe
      CH: "GB", // Switzerland uses GB Stripe
    };

    const configCountry = countryToConfigMap[organizer.country_code] || "US";
    console.log("Looking for Stripe config for country:", configCountry);

    const { data: gatewayConfig, error: configError } = await supabase
      .from("payment_gateway_config")
      .select("*")
      .eq("provider", "stripe")
      .eq("country_code", configCountry)
      .eq("is_active", true)
      .single();

    if (configError) {
      console.error("Error fetching gateway config:", configError);
    }

    if (!gatewayConfig) {
      throw new Error(`Stripe is not configured for your region. Please contact support.`);
    }

    if (!gatewayConfig.secret_key_encrypted) {
      throw new Error("Stripe API key not configured. Please contact support.");
    }

    // Initialize Stripe
    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    let accountId = organizer.stripe_connect_id;

    // Create new Express account if doesn't exist
    if (!accountId) {
      // Map country codes for Stripe (Stripe uses ISO country codes)
      const stripeCountryMap: Record<string, string> = {
        US: "US",
        GB: "GB",
        CA: "CA",
        AU: "AU",
        IE: "IE",
        DE: "DE",
        FR: "FR",
        ES: "ES",
        IT: "IT",
        NL: "NL",
        BE: "BE",
        AT: "AT",
        CH: "CH",
      };

      const stripeCountry = stripeCountryMap[organizer.country_code] || "US";
      console.log("Creating Stripe Express account for country:", stripeCountry);

      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: stripeCountry,
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
        console.log("Created Stripe account:", accountId);
      } catch (stripeError: any) {
        console.error("Stripe account creation error:", stripeError);
        throw new Error(stripeError.message || "Failed to create Stripe account");
      }

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
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl || `${req.headers.get("origin")}/organizer/stripe-connect?refresh=true`,
        return_url: returnUrl || `${req.headers.get("origin")}/organizer/stripe-connect?success=true`,
        type: "account_onboarding",
      });
      console.log("Created account link for account:", accountId);
    } catch (linkError: any) {
      console.error("Stripe account link creation error:", linkError);

      // If the account doesn't exist or isn't connected, clear it and create a new one
      if (linkError.message?.includes("not connected to your platform") ||
          linkError.message?.includes("does not exist") ||
          linkError.code === "account_invalid") {
        console.log("Invalid account detected, clearing and creating new account...");

        // Clear the invalid account ID
        await supabase
          .from("organizers")
          .update({
            stripe_connect_id: null,
            stripe_connect_status: "not_started",
            updated_at: new Date().toISOString(),
          })
          .eq("id", organizerId);

        // Create a new account
        const stripeCountryMap: Record<string, string> = {
          US: "US", GB: "GB", CA: "CA", AU: "AU", IE: "IE",
          DE: "DE", FR: "FR", ES: "ES", IT: "IT", NL: "NL",
          BE: "BE", AT: "AT", CH: "CH",
        };
        const stripeCountry = stripeCountryMap[organizer.country_code] || "US";

        const newAccount = await stripe.accounts.create({
          type: "express",
          country: stripeCountry,
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
              schedule: { interval: "manual" },
            },
          },
          metadata: {
            organizer_id: organizerId,
            platform: "ticketrack",
          },
        });

        accountId = newAccount.id;
        console.log("Created new Stripe account:", accountId);

        // Save new account ID
        await supabase
          .from("organizers")
          .update({
            stripe_connect_id: accountId,
            stripe_connect_status: "pending",
            stripe_connect_terms_accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", organizerId);

        // Create account link for new account
        accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: refreshUrl || `${req.headers.get("origin")}/organizer/stripe-connect?refresh=true`,
          return_url: returnUrl || `${req.headers.get("origin")}/organizer/stripe-connect?success=true`,
          type: "account_onboarding",
        });
        console.log("Created account link for new account:", accountId);
      } else {
        throw new Error(linkError.message || "Failed to create Stripe onboarding link");
      }
    }

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
    // Return 200 with error in body so frontend can read the error message
    // (Supabase functions.invoke doesn't parse body on non-2xx responses)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to create Stripe Connect account"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
