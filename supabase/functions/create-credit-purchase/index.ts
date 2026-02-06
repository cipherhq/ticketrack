// Create Credit Purchase - Initialize payment for communication credits (multi-gateway)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const PAYSTACK_API_URL = 'https://api.paystack.co';
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

    const body = await req.json();
    console.log('Received request body:', JSON.stringify(body));

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
    } = body;

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

    // Get package details if provided (check both new and legacy tables)
    let packageDetails = null;
    let validPackageId = null;
    if (packageId) {
      // Try new table first
      const { data: pkg } = await supabase
        .from('communication_credit_packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkg) {
        packageDetails = pkg;
        validPackageId = packageId;
      } else {
        // Try legacy table
        const { data: legacyPkg } = await supabase
          .from('sms_credit_packages')
          .select('*')
          .eq('id', packageId)
          .single();

        if (legacyPkg) {
          packageDetails = {
            ...legacyPkg,
            price_ngn: legacyPkg.price,
          };
          // Don't set validPackageId as it's from legacy table and might cause FK errors
        }
      }
    }

    // Generate unique reference
    const reference = `CREDIT-${organizerId.substring(0, 8)}-${Date.now()}`;

    // Skip transaction table - go directly to payment
    // We'll create transaction record in webhook after successful payment
    console.log('Initializing payment for organizer:', organizerId, 'Provider:', provider);

    const transactionId = crypto.randomUUID(); // Temporary ID for metadata

    // Route to appropriate payment provider
    if (provider === 'stripe') {
      // Dynamically import Stripe only when needed
      const Stripe = (await import('https://esm.sh/stripe@14.5.0?target=deno')).default;
      const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
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
          transaction_id: transactionId,
          credits: String(credits),
          bonus_credits: String(bonusCredits || 0),
          package_id: packageId || '',
          reference,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          url: session.url,
          authorization_url: session.url,
          session_id: session.id,
          reference,
          transaction_id: transactionId,
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
          transaction_id: transactionId,
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
        return new Response(
          JSON.stringify({ error: flutterwaveData.message || 'Payment initialization failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          link: flutterwaveData.data.link,
          authorization_url: flutterwaveData.data.link,
          reference,
          transaction_id: transactionId,
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
          transaction_id: transactionId,
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
        return new Response(
          JSON.stringify({ error: paystackData.message || 'Payment initialization failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference,
          transaction_id: transactionId,
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
