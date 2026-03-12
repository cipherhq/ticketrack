// Create Credit Purchase - Multi-gateway payment for communication credits

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireAuth, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ticketrack.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Require authentication - only logged-in organizers can purchase credits
    const { user, supabase } = await requireAuth(req);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      organizerId,
      credits,
      bonusCredits,
      amount,
      currency = 'NGN',
      email,
      callbackUrl,
      provider = 'paystack'
    } = body;

    // Validate required fields
    if (!organizerId || !credits || !amount || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Validate credits and amount match a valid sms_credit_packages record
    const { data: validPackage, error: pkgError } = await supabase
      .from('sms_credit_packages')
      .select('id, credits, bonus_credits, price, currency')
      .eq('credits', credits)
      .eq('is_active', true)
      .single();

    if (pkgError || !validPackage) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credit package' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the amount matches the package price (allow minor float tolerance)
    const dbPrice = parseFloat(validPackage.price);
    const clientAmount = parseFloat(amount);
    if (isNaN(clientAmount) || Math.abs(clientAmount - dbPrice) > 0.01) {
      return new Response(
        JSON.stringify({ success: false, error: 'Amount does not match package price' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the DB price, not client-supplied amount
    const verifiedAmount = dbPrice;

    const reference = `CREDIT-${String(organizerId).substring(0, 8)}-${Date.now()}`;

    // Route to appropriate payment provider
    if (provider === 'stripe') {
      const { data: gatewayConfig } = await supabase
        .from('payment_gateway_config')
        .select('secret_key_encrypted')
        .eq('provider', 'stripe')
        .eq('is_active', true)
        .in('country_code', ['US', 'GB'])
        .limit(1)
        .single();

      if (!gatewayConfig?.secret_key_encrypted) {
        return new Response(
          JSON.stringify({ success: false, error: 'Stripe not configured. Please contact support.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Dynamically import Stripe
      const Stripe = (await import('https://esm.sh/stripe@14.5.0?target=deno')).default;
      const stripe = new Stripe(gatewayConfig.secret_key_encrypted, { apiVersion: '2023-10-16' });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${credits} Message Credits`,
                description: `${credits}${bonusCredits ? ` + ${bonusCredits} bonus` : ''} credits for SMS, WhatsApp, and Email`,
              },
              unit_amount: Math.round(verifiedAmount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: callbackUrl,
        cancel_url: callbackUrl.replace('payment=success', 'payment=cancelled'),
        customer_email: email,
        metadata: {
          type: 'credit_purchase',
          organizer_id: organizerId,
          credits: String(credits),
          bonus_credits: String(bonusCredits || 0),
          reference,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: session.url,
          url: session.url,
          session_id: session.id,
          reference,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (provider === 'flutterwave') {
      const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (!FLUTTERWAVE_SECRET_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'Flutterwave not configured. Please contact support.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: verifiedAmount,
          currency,
          redirect_url: callbackUrl,
          customer: { email },
          customizations: {
            title: 'Message Credits',
            description: `${credits} credits`,
          },
          meta: {
            type: 'credit_purchase',
            organizer_id: organizerId,
            credits,
            bonus_credits: bonusCredits || 0,
          },
        }),
      });

      const flutterwaveData = await flutterwaveResponse.json();

      if (flutterwaveData.status !== 'success') {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment initialization failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: flutterwaveData.data.link,
          reference,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Default: Paystack (for NGN, GHS, ZAR, KES)
      const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!PAYSTACK_SECRET_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'Paystack not configured. Please contact support.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: Math.round(verifiedAmount * 100),
          currency,
          reference,
          callback_url: callbackUrl,
          metadata: {
            type: 'credit_purchase',
            organizer_id: organizerId,
            credits,
            bonus_credits: bonusCredits || 0,
          },
        }),
      });

      const paystackData = await paystackResponse.json();

      if (!paystackData.status) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment initialization failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error('Create credit purchase error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create credit purchase' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
