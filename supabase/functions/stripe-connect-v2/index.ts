/**
 * Stripe Connect Integration (Express Accounts)
 *
 * This edge function handles all Stripe Connect operations using the standard V1 API
 * with Express accounts - the most widely supported and stable approach.
 *
 * Endpoints:
 * - create-account: Creates a new Express connected account
 * - create-account-link: Generates onboarding URL for account setup
 * - get-account-status: Checks if account can process payments
 * - create-product: Creates products on connected accounts
 * - list-products: Lists products for storefronts
 * - create-checkout: Creates checkout sessions with application fees
 * - get-checkout-session: Retrieves session details for success page
 * - webhook: Handles Stripe webhook events
 *
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Your platform's Stripe secret key (sk_test_*** or sk_live_***)
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint secret (whsec_***)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// =============================================================================
// CONFIGURATION
// =============================================================================

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Initialize Stripe client
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if Stripe is configured
  if (!stripe) {
    return jsonResponse({
      success: false,
      error: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.",
    }, 500);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Route to appropriate handler
    switch (path) {
      case "create-account":
        return await handleCreateAccount(req);
      case "create-account-link":
        return await handleCreateAccountLink(req);
      case "get-account-status":
        return await handleGetAccountStatus(req);
      case "create-product":
        return await handleCreateProduct(req);
      case "list-products":
        return await handleListProducts(req);
      case "create-checkout":
        return await handleCreateCheckout(req);
      case "get-checkout-session":
        return await handleGetCheckoutSession(req);
      case "webhook":
        return await handleWebhook(req);
      default:
        return jsonResponse({ error: "Unknown endpoint" }, 404);
    }
  } catch (error) {
    console.error("Request error:", error);
    return jsonResponse({
      success: false,
      error: error.message || "An unexpected error occurred",
    }, 500);
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

// =============================================================================
// CONNECTED ACCOUNT HANDLERS
// =============================================================================

/**
 * CREATE CONNECTED ACCOUNT (Express)
 *
 * Creates a new Stripe Express account. Express accounts are the recommended
 * account type for most platforms - they provide a Stripe-hosted onboarding
 * flow and dashboard for your connected users.
 *
 * Request body:
 * - email: Contact email for the account (required)
 * - country: Two-letter country code, e.g., 'US', 'GB' (default: 'US')
 * - businessName: Optional business/display name
 * - userId: Optional - your internal user ID to link the account
 *
 * Benefits of Express accounts:
 * - Stripe handles identity verification
 * - Stripe-hosted onboarding (less compliance burden)
 * - Connected users get their own Stripe Dashboard
 * - Automatic updates for compliance requirements
 */
async function handleCreateAccount(req: Request) {
  const { email, country = "US", businessName, userId } = await req.json();

  if (!email) {
    return jsonResponse({
      success: false,
      error: "Missing required field: email",
    }, 400);
  }

  console.log(`Creating Express account for: ${email} (${country})`);

  try {
    // Create an Express connected account
    const account = await stripe!.accounts.create({
      // Express accounts are fully managed by Stripe
      type: "express",
      // Country determines available features and requirements
      country: country.toUpperCase(),
      // Email for Stripe communications
      email: email,
      // Request payment capabilities
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      // Business information (optional but recommended)
      business_profile: {
        name: businessName || undefined,
      },
      // Payout settings - manual gives you control over when payouts happen
      settings: {
        payouts: {
          schedule: {
            interval: "manual",
          },
        },
      },
      // Metadata for tracking
      metadata: {
        platform: "ticketrack",
        user_id: userId || undefined,
      },
    });

    console.log(`Created Express account: ${account.id}`);

    // Optional: Store the account mapping in your database
    if (userId) {
      try {
        const supabase = getSupabaseClient();
        await supabase.from("stripe_connect_accounts").upsert({
          user_id: userId,
          stripe_account_id: account.id,
          email: email,
          country: country,
          account_type: "express",
          created_at: new Date().toISOString(),
        });
      } catch (dbError) {
        console.warn("Failed to store account mapping:", dbError);
        // Don't fail - account was created successfully
      }
    }

    return jsonResponse({
      success: true,
      accountId: account.id,
      message: "Express account created successfully",
    });

  } catch (error: any) {
    console.error("Error creating account:", error);
    return jsonResponse({
      success: false,
      error: error.message || "Failed to create connected account",
    }, 400);
  }
}

/**
 * CREATE ACCOUNT LINK (Onboarding)
 *
 * Generates a URL to onboard the connected account. The user will be
 * redirected to Stripe's hosted onboarding flow where they can:
 * - Verify their identity
 * - Provide business information
 * - Set up their bank account for payouts
 *
 * Request body:
 * - accountId: The Stripe account ID (acct_***)
 * - returnUrl: URL after successful onboarding (optional)
 * - refreshUrl: URL if the link expires (optional)
 *
 * Important: Account links expire after 5 minutes, so generate them
 * just before redirecting the user.
 */
async function handleCreateAccountLink(req: Request) {
  const { accountId, returnUrl, refreshUrl } = await req.json();

  if (!accountId) {
    return jsonResponse({
      success: false,
      error: "Missing required field: accountId",
    }, 400);
  }

  const origin = req.headers.get("origin") || "http://localhost:5173";
  const finalReturnUrl = returnUrl || `${origin}/connect/demo?accountId=${accountId}&onboarding=complete`;
  const finalRefreshUrl = refreshUrl || `${origin}/connect/demo?accountId=${accountId}&onboarding=refresh`;

  console.log(`Creating account link for: ${accountId}`);

  try {
    // Create an account link for onboarding
    const accountLink = await stripe!.accountLinks.create({
      account: accountId,
      // Where to send user after onboarding completes
      return_url: finalReturnUrl,
      // Where to send user if link expires (they can request a new one)
      refresh_url: finalRefreshUrl,
      // account_onboarding: Full onboarding flow
      // account_update: Update existing information
      type: "account_onboarding",
    });

    console.log(`Created account link, expires at: ${new Date(accountLink.expires_at * 1000).toISOString()}`);

    return jsonResponse({
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    });

  } catch (error: any) {
    console.error("Error creating account link:", error);

    // Handle invalid/deleted accounts
    if (error.message?.includes("does not exist") ||
        error.message?.includes("not connected")) {
      return jsonResponse({
        success: false,
        error: "This account no longer exists. Please create a new account.",
        code: "account_invalid",
      }, 400);
    }

    return jsonResponse({
      success: false,
      error: error.message || "Failed to create account link",
    }, 400);
  }
}

/**
 * GET ACCOUNT STATUS
 *
 * Retrieves the current status of a connected account. Use this to:
 * - Check if onboarding is complete
 * - Verify the account can process payments
 * - See what requirements are outstanding
 *
 * Query params:
 * - accountId: The Stripe account ID (acct_***)
 *
 * Key status indicators:
 * - charges_enabled: Can accept payments
 * - payouts_enabled: Can receive payouts
 * - details_submitted: User completed onboarding form
 */
async function handleGetAccountStatus(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");

  if (!accountId) {
    return jsonResponse({
      success: false,
      error: "Missing required query parameter: accountId",
    }, 400);
  }

  console.log(`Getting account status for: ${accountId}`);

  try {
    // Retrieve the account
    const account = await stripe!.accounts.retrieve(accountId);

    // Determine readiness
    const readyToProcessPayments = account.charges_enabled && account.payouts_enabled;
    const onboardingComplete = account.details_submitted;

    // Get capability statuses
    const cardPaymentsStatus = account.capabilities?.card_payments || "inactive";
    const transfersStatus = account.capabilities?.transfers || "inactive";

    // Get outstanding requirements
    const currentlyDue = account.requirements?.currently_due || [];
    const eventuallyDue = account.requirements?.eventually_due || [];
    const pastDue = account.requirements?.past_due || [];

    return jsonResponse({
      success: true,
      accountId: account.id,
      displayName: account.business_profile?.name || account.email,
      email: account.email,
      country: account.country,
      status: {
        // Can this account accept payments?
        readyToProcessPayments,
        // Has the user completed onboarding?
        onboardingComplete,
        // Individual capability statuses
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        // Capability statuses
        cardPaymentsStatus,
        transfersStatus,
      },
      // Outstanding requirements (if any)
      requirements: {
        currentlyDue,
        eventuallyDue,
        pastDue,
        disabledReason: account.requirements?.disabled_reason || null,
      },
    });

  } catch (error: any) {
    console.error("Error getting account status:", error);
    return jsonResponse({
      success: false,
      error: error.message || "Failed to get account status",
    }, 400);
  }
}

// =============================================================================
// PRODUCT HANDLERS
// =============================================================================

/**
 * CREATE PRODUCT
 *
 * Creates a product on a connected account. The product belongs to the
 * connected account (not your platform) and appears in their Stripe Dashboard.
 *
 * Request body:
 * - accountId: The connected account ID (required)
 * - name: Product name (required)
 * - description: Product description (optional)
 * - priceInCents: Price in smallest currency unit (required)
 * - currency: Three-letter currency code (default: 'usd')
 * - imageUrl: Product image URL (optional)
 *
 * The stripeAccount option creates the product on the connected account.
 */
async function handleCreateProduct(req: Request) {
  const { accountId, name, description, priceInCents, currency = "usd", imageUrl } = await req.json();

  if (!accountId || !name || !priceInCents) {
    return jsonResponse({
      success: false,
      error: "Missing required fields: accountId, name, and priceInCents are required",
    }, 400);
  }

  console.log(`Creating product "${name}" for account: ${accountId}`);

  try {
    // Create product on the connected account
    const product = await stripe!.products.create(
      {
        name: name,
        description: description || undefined,
        // Create a default price for this product
        default_price_data: {
          unit_amount: priceInCents,
          currency: currency.toLowerCase(),
        },
        images: imageUrl ? [imageUrl] : undefined,
      },
      {
        // This header creates the product on the connected account
        stripeAccount: accountId,
      }
    );

    console.log(`Created product: ${product.id}`);

    return jsonResponse({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        priceId: product.default_price,
        images: product.images,
      },
    });

  } catch (error: any) {
    console.error("Error creating product:", error);
    return jsonResponse({
      success: false,
      error: error.message || "Failed to create product",
    }, 400);
  }
}

/**
 * LIST PRODUCTS
 *
 * Lists all active products from a connected account's catalog.
 * Used to build customer-facing storefronts.
 *
 * Query params:
 * - accountId: The connected account ID (required)
 * - limit: Max products to return (default: 20)
 */
async function handleListProducts(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  if (!accountId) {
    return jsonResponse({
      success: false,
      error: "Missing required query parameter: accountId",
    }, 400);
  }

  console.log(`Listing products for account: ${accountId}`);

  try {
    // List products from the connected account
    const products = await stripe!.products.list(
      {
        limit: limit,
        active: true,
        expand: ["data.default_price"],
      },
      {
        stripeAccount: accountId,
      }
    );

    // Format products for frontend
    const formattedProducts = products.data.map((product) => {
      const price = product.default_price as Stripe.Price | null;
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        price: price ? {
          id: price.id,
          amount: price.unit_amount,
          currency: price.currency,
          formatted: price.unit_amount
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: price.currency,
              }).format(price.unit_amount / 100)
            : null,
        } : null,
      };
    });

    return jsonResponse({
      success: true,
      products: formattedProducts,
      hasMore: products.has_more,
    });

  } catch (error: any) {
    console.error("Error listing products:", error);
    return jsonResponse({
      success: false,
      error: error.message || "Failed to list products",
    }, 400);
  }
}

// =============================================================================
// CHECKOUT HANDLERS
// =============================================================================

/**
 * CREATE CHECKOUT SESSION
 *
 * Creates a Stripe Checkout session for purchasing from a connected account.
 * Uses Direct Charges - the payment is processed directly on the connected
 * account with an application fee going to your platform.
 *
 * Request body:
 * - accountId: The connected account selling the product (required)
 * - priceId: Stripe price ID (use this OR productName+priceInCents)
 * - productName: Product name for inline pricing
 * - priceInCents: Price amount for inline pricing
 * - currency: Currency code (default: 'usd')
 * - quantity: Number of items (default: 1)
 * - applicationFeePercent: Platform fee percentage (default: 10)
 * - successUrl: URL after successful payment
 * - cancelUrl: URL if payment is cancelled
 *
 * Direct Charges vs Destination Charges:
 * - Direct: Connected account is merchant of record, platform takes app fee
 * - Destination: Platform is merchant of record, transfers to connected account
 *
 * We use Direct Charges here as it's simpler and the connected account
 * handles refunds, disputes, etc.
 */
async function handleCreateCheckout(req: Request) {
  const {
    accountId,
    priceId,
    productName,
    priceInCents,
    currency = "usd",
    quantity = 1,
    applicationFeePercent = 10,
    successUrl,
    cancelUrl,
  } = await req.json();

  if (!accountId) {
    return jsonResponse({
      success: false,
      error: "Missing required field: accountId",
    }, 400);
  }

  if (!priceId && (!productName || !priceInCents)) {
    return jsonResponse({
      success: false,
      error: "Either priceId or (productName and priceInCents) is required",
    }, 400);
  }

  const origin = req.headers.get("origin") || "http://localhost:5173";
  const finalSuccessUrl = successUrl || `${origin}/connect/checkout-success?session_id={CHECKOUT_SESSION_ID}&accountId=${accountId}`;
  const finalCancelUrl = cancelUrl || `${origin}/connect/store/${accountId}?cancelled=true`;

  console.log(`Creating checkout for account: ${accountId}`);

  try {
    // Calculate application fee (platform's cut)
    const totalAmount = priceId ? 0 : priceInCents * quantity;
    const applicationFeeAmount = priceId
      ? undefined // Will calculate after getting price
      : Math.round((totalAmount * applicationFeePercent) / 100);

    // Build line items
    const lineItems = priceId
      ? [{ price: priceId, quantity }]
      : [{
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: priceInCents,
            product_data: { name: productName },
          },
          quantity,
        }];

    // If using priceId, fetch price to calculate application fee
    let finalApplicationFee = applicationFeeAmount;
    if (priceId && !applicationFeeAmount) {
      const price = await stripe!.prices.retrieve(priceId, {}, { stripeAccount: accountId });
      if (price.unit_amount) {
        finalApplicationFee = Math.round((price.unit_amount * quantity * applicationFeePercent) / 100);
      }
    }

    // Create checkout session on the connected account (Direct Charge)
    const session = await stripe!.checkout.sessions.create(
      {
        line_items: lineItems,
        mode: "payment",
        payment_intent_data: {
          // Application fee goes to your platform account
          application_fee_amount: finalApplicationFee,
        },
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
      },
      {
        // Create on connected account for Direct Charges
        stripeAccount: accountId,
      }
    );

    console.log(`Created checkout session: ${session.id}`);

    return jsonResponse({
      success: true,
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error("Error creating checkout:", error);
    return jsonResponse({
      success: false,
      error: error.message || "Failed to create checkout session",
    }, 400);
  }
}

/**
 * GET CHECKOUT SESSION
 *
 * Retrieves a completed checkout session's details.
 * Used to display order confirmation on the success page.
 *
 * Request body:
 * - sessionId: The Stripe checkout session ID (required)
 * - accountId: The connected account that processed the payment (required)
 */
async function handleGetCheckoutSession(req: Request) {
  const { sessionId, accountId } = await req.json();

  if (!sessionId || !accountId) {
    return jsonResponse({
      success: false,
      error: "Missing required fields: sessionId and accountId",
    }, 400);
  }

  console.log(`Retrieving checkout session: ${sessionId}`);

  try {
    // Retrieve session from connected account
    const session = await stripe!.checkout.sessions.retrieve(
      sessionId,
      { expand: ["payment_intent", "line_items"] },
      { stripeAccount: accountId }
    );

    // Get receipt URL if available
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent;
    const receiptUrl = paymentIntent?.latest_charge
      ? (await stripe!.charges.retrieve(
          paymentIntent.latest_charge as string,
          {},
          { stripeAccount: accountId }
        )).receipt_url
      : null;

    return jsonResponse({
      success: true,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email,
        amount_total: session.amount_total,
        currency: session.currency,
        receipt_url: receiptUrl,
      },
    });

  } catch (error: any) {
    console.error("Error retrieving session:", error);
    return jsonResponse({
      success: false,
      error: error.message || "Failed to retrieve checkout session",
    }, 400);
  }
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

/**
 * WEBHOOK HANDLER
 *
 * Handles Stripe webhook events for connected accounts.
 *
 * Key events to listen for:
 * - account.updated: Account status changed (onboarding complete, etc.)
 * - checkout.session.completed: Payment successful
 * - payment_intent.succeeded: Payment confirmed
 * - payout.paid: Funds sent to connected account's bank
 *
 * To test locally:
 * stripe listen --forward-to localhost:54321/functions/v1/stripe-connect-v2/webhook
 *
 * For Connect events, also add:
 * stripe listen --forward-connect-to localhost:54321/functions/v1/stripe-connect-v2/webhook
 */
async function handleWebhook(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return jsonResponse({ error: "Webhook secret not configured" }, 500);
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return jsonResponse({ error: "Missing stripe-signature header" }, 400);
  }

  try {
    // Verify webhook signature
    const event = stripe!.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

    console.log(`Webhook received: ${event.type} (${event.id})`);

    // Handle different event types
    switch (event.type) {
      case "account.updated":
        await handleAccountUpdated(event);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;

      case "payment_intent.succeeded":
        console.log(`Payment succeeded: ${(event.data.object as any).id}`);
        break;

      case "payout.paid":
        console.log(`Payout completed: ${(event.data.object as any).id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return jsonResponse({ received: true });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return jsonResponse({ error: error.message }, 400);
  }
}

/**
 * Handle account.updated webhook
 *
 * Fires when a connected account's status changes.
 * Use this to track onboarding completion and capability changes.
 */
async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;

  console.log(`Account updated: ${account.id}`);
  console.log(`- Charges enabled: ${account.charges_enabled}`);
  console.log(`- Payouts enabled: ${account.payouts_enabled}`);
  console.log(`- Details submitted: ${account.details_submitted}`);

  // Check if account just became ready
  if (account.charges_enabled && account.payouts_enabled) {
    console.log(`Account ${account.id} is now ready to accept payments!`);

    // TODO: Update your database, send notification, etc.
    // const supabase = getSupabaseClient();
    // await supabase.from('organizers')
    //   .update({ stripe_connect_status: 'active' })
    //   .eq('stripe_connect_id', account.id);
  }

  // Check for issues
  if (account.requirements?.disabled_reason) {
    console.warn(`Account ${account.id} is disabled: ${account.requirements.disabled_reason}`);
  }
}

/**
 * Handle checkout.session.completed webhook
 *
 * Fires when a customer completes checkout.
 * The payment may still be processing (check payment_status).
 */
async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  console.log(`Checkout completed: ${session.id}`);
  console.log(`- Payment status: ${session.payment_status}`);
  console.log(`- Amount: ${session.amount_total} ${session.currency}`);
  console.log(`- Customer: ${session.customer_details?.email}`);

  // For Connect events, event.account contains the connected account ID
  const connectedAccountId = (event as any).account;
  if (connectedAccountId) {
    console.log(`- Connected account: ${connectedAccountId}`);
  }

  // TODO: Fulfill the order, send confirmation email, etc.
}
