// Create Fund Contribution - Multi-gateway payment for party fund contributions
// No auth required - guests are anonymous

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fundId, guestName, guestEmail, amount, message, callbackUrl } = body;

    // Validate required fields
    if (!fundId || !guestEmail || !amount || !callbackUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: fundId, guestEmail, amount, callbackUrl' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Amount must be a positive number' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up fund and verify it's active
    const { data: fund, error: fundError } = await supabase
      .from('party_invite_funds')
      .select('id, invite_id, organizer_id, currency, is_active, title')
      .eq('id', fundId)
      .single();

    if (fundError || !fund) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fund not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fund.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'This fund is no longer accepting contributions' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine payment provider based on currency
    const currency = fund.currency || 'NGN';
    const paystackCurrencies = ['NGN', 'GHS', 'ZAR', 'KES'];
    let provider: string;

    if (paystackCurrencies.includes(currency)) {
      provider = 'paystack';
    } else {
      // Default to Stripe for USD, GBP, EUR, etc.
      provider = 'stripe';
    }

    const reference = `FUND-${String(fundId).substring(0, 8)}-${Date.now()}`;

    // Insert pending contribution row
    const { data: contribution, error: insertError } = await supabase
      .from('party_invite_contributions')
      .insert({
        fund_id: fundId,
        guest_name: guestName || 'Anonymous',
        guest_email: guestEmail,
        amount,
        message: message || null,
        payment_status: 'pending',
        payment_provider: provider,
        payment_reference: reference,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting contribution:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create contribution record' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to provider
    if (provider === 'stripe') {
      // Look up Stripe config
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
          JSON.stringify({ success: false, error: 'Payment provider not configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const Stripe = (await import('https://esm.sh/stripe@14.5.0?target=deno')).default;
      const stripe = new Stripe(gatewayConfig.secret_key_encrypted, { apiVersion: '2023-10-16' });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Contribution to ${fund.title}`,
                description: `Gift from ${guestName || 'Guest'}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: callbackUrl,
        cancel_url: callbackUrl,
        customer_email: guestEmail,
        metadata: {
          type: 'fund_contribution',
          fund_id: fundId,
          contribution_id: contribution.id,
          reference,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: session.url,
          reference,
          provider: 'stripe',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Paystack
      const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!PAYSTACK_SECRET_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment provider not configured' }),
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
          email: guestEmail,
          amount: Math.round(amount * 100), // Convert to kobo/pesewas
          currency,
          reference,
          callback_url: callbackUrl,
          metadata: {
            type: 'fund_contribution',
            fund_id: fundId,
            contribution_id: contribution.id,
          },
        }),
      });

      const paystackData = await paystackResponse.json();

      if (!paystackData.status) {
        console.error('Paystack initialization failed:', paystackData);
        return new Response(
          JSON.stringify({ success: false, error: 'Payment initialization failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          reference: paystackData.data.reference,
          provider: 'paystack',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Create fund contribution error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create fund contribution' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
