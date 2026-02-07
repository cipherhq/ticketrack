// Create Credit Purchase - Multi-gateway payment for communication credits

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON: ' + e.message }),
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
        received: { organizerId: !!organizerId, credits: !!credits, amount: !!amount, email: !!email }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const reference = `CREDIT-${String(organizerId).substring(0, 8)}-${Date.now()}`;

  try {
    // Route to appropriate payment provider
    if (provider === 'stripe') {
      const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
      if (!STRIPE_SECRET_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'Stripe not configured. Please contact support.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Dynamically import Stripe
      const Stripe = (await import('https://esm.sh/stripe@14.5.0?target=deno')).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

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
              unit_amount: Math.round(Number(amount) * 100),
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
          amount: Number(amount),
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
          JSON.stringify({ success: false, error: 'Flutterwave: ' + (flutterwaveData.message || 'Payment failed') }),
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
          amount: Math.round(Number(amount) * 100),
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
          JSON.stringify({ success: false, error: 'Paystack: ' + (paystackData.message || 'Payment failed') }),
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
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Exception: ' + e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
