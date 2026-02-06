// Create Credit Purchase - Simplified for debugging

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Step 1: Test basic response
  const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

  if (!PAYSTACK_SECRET_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'PAYSTACK_SECRET_KEY not configured in Supabase Edge Function secrets'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Step 2: Parse request body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON in request body: ' + e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { organizerId, credits, bonusCredits, amount, currency = 'NGN', email, callbackUrl } = body;

  // Step 3: Validate required fields
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

  // Step 4: Call Paystack
  try {
    const reference = `CREDIT-${String(organizerId).substring(0, 8)}-${Date.now()}`;

    const paystackPayload = {
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
    };

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Paystack error: ' + (paystackData.message || 'Unknown error'),
          paystackResponse: paystackData
        }),
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
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Exception: ' + e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
