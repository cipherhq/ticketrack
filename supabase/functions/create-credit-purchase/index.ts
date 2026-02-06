// Create Credit Purchase - Initialize payment for communication credits (multi-gateway)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const PAYSTACK_API_URL = 'https://api.paystack.co';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const FLUTTERWAVE_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      organizerId,
      packageId,
      credits,
      bonusCredits,
      amount,
      currency = 'NGN',
      email,
      callbackUrl,
      provider = 'paystack',
    } = await req.json();

    // Validation
    if (!organizerId || !credits || !amount || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organizer exists
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('id, business_name, user_id')
      .eq('id', organizerId)
      .single();

    if (orgError || !organizer) {
      return new Response(
        JSON.stringify({ error: 'Organizer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get package details if provided
    let packageDetails = null;
    if (packageId) {
      const { data: pkg } = await supabase
        .from('communication_credit_packages')
        .select('*')
        .eq('id', packageId)
        .single();
      packageDetails = pkg;
    }

    // Generate unique reference
    const reference = `CREDIT-${organizerId.substring(0, 8)}-${Date.now()}`;

    // Create pending transaction record
    const { data: transaction, error: txError } = await supabase
      .from('communication_credit_transactions')
      .insert({
        organizer_id: organizerId,
        type: 'purchase',
        amount: credits,
        bonus_amount: bonusCredits || 0,
        balance_after: 0, // Will be updated on webhook
        bonus_balance_after: 0,
        reference,
        package_id: packageId || null,
        amount_paid: amount,
        currency,
        payment_provider: provider,
        description: packageDetails
          ? `Credit purchase: ${packageDetails.name} (${credits}${bonusCredits ? ` + ${bonusCredits} bonus` : ''} credits)`
          : `Credit purchase: ${credits} credits`,
        metadata: {
          status: 'pending',
          email,
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction create error:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate payment provider
    if (provider === 'stripe') {
      // Initialize Stripe payment
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: packageDetails?.name || `${credits} Message Credits`,
                description: `${credits}${bonusCredits ? ` + ${bonusCredits} bonus` : ''} credits for SMS, WhatsApp, and Email`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: callbackUrl,
        cancel_url: callbackUrl.replace('payment=success', 'payment=cancelled'),
        metadata: {
          type: 'credit_purchase',
          organizer_id: organizerId,
          transaction_id: transaction.id,
          credits: String(credits),
          bonus_credits: String(bonusCredits || 0),
          package_id: packageId || '',
          reference,
        },
      });

      // Update transaction with Stripe session
      await supabase
        .from('communication_credit_transactions')
        .update({
          payment_reference: session.id,
          metadata: { status: 'pending', stripe_session_id: session.id },
        })
        .eq('id', transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          url: session.url,
          authorization_url: session.url,
          session_id: session.id,
          reference,
          transaction_id: transaction.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (provider === 'flutterwave') {
      // Initialize Flutterwave payment
      const flutterwavePayload = {
        tx_ref: reference,
        amount,
        currency,
        redirect_url: callbackUrl,
        customer: {
          email,
        },
        customizations: {
          title: 'Message Credits',
          description: packageDetails?.name || `${credits} credits`,
        },
        meta: {
          type: 'credit_purchase',
          organizer_id: organizerId,
          transaction_id: transaction.id,
          credits,
          bonus_credits: bonusCredits || 0,
          package_id: packageId || null,
        },
      };

      const flutterwaveResponse = await fetch(`${FLUTTERWAVE_API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flutterwavePayload),
      });

      const flutterwaveData = await flutterwaveResponse.json();

      if (!flutterwaveResponse.ok || flutterwaveData.status !== 'success') {
        console.error('Flutterwave error:', flutterwaveData);
        await supabase
          .from('communication_credit_transactions')
          .update({
            metadata: { status: 'failed', error: flutterwaveData.message },
          })
          .eq('id', transaction.id);

        return new Response(
          JSON.stringify({ error: flutterwaveData.message || 'Payment initialization failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update transaction with Flutterwave reference
      await supabase
        .from('communication_credit_transactions')
        .update({
          payment_reference: reference,
          metadata: { status: 'pending' },
        })
        .eq('id', transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          link: flutterwaveData.data.link,
          authorization_url: flutterwaveData.data.link,
          reference,
          transaction_id: transaction.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Default to Paystack
      const paystackPayload = {
        email,
        amount: Math.round(amount * 100), // Paystack uses kobo
        currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          type: 'credit_purchase',
          organizer_id: organizerId,
          transaction_id: transaction.id,
          credits,
          bonus_credits: bonusCredits || 0,
          package_id: packageId || null,
        },
      };

      const paystackResponse = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paystackPayload),
      });

      const paystackData = await paystackResponse.json();

      if (!paystackResponse.ok || !paystackData.status) {
        console.error('Paystack error:', paystackData);

        await supabase
          .from('communication_credit_transactions')
          .update({
            metadata: { status: 'failed', error: paystackData.message },
          })
          .eq('id', transaction.id);

        return new Response(
          JSON.stringify({ error: paystackData.message || 'Payment initialization failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update transaction with Paystack reference
      await supabase
        .from('communication_credit_transactions')
        .update({
          payment_reference: paystackData.data.reference,
          metadata: { status: 'pending', access_code: paystackData.data.access_code },
        })
        .eq('id', transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
          transaction_id: transaction.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Credit purchase error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
