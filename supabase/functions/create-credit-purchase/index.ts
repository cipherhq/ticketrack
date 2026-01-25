// Create Credit Purchase - Initialize Paystack payment for communication credits

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const PAYSTACK_API_URL = 'https://api.paystack.co';

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
        payment_provider: 'paystack',
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

    // Initialize Paystack payment
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
      
      // Mark transaction as failed
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
  } catch (error) {
    console.error('Credit purchase error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
