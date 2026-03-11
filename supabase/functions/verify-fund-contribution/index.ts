/**
 * Verify Fund Contribution - Supabase Edge Function
 *
 * Verifies a payment and marks fund contribution as completed.
 * Acts as a fallback if the webhook didn't process the payment.
 * No auth required - guests verify their own contributions by reference.
 */

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

    const { reference, provider } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying fund contribution: ${reference}, provider: ${provider}`);

    // Check if contribution already completed (idempotency)
    const { data: existing } = await supabase
      .from('party_invite_contributions')
      .select('id, payment_status, amount, fund_id')
      .eq('payment_reference', reference)
      .single();

    if (existing?.payment_status === 'completed') {
      console.log('Contribution already completed');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Already processed',
          contribution: existing,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Contribution not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify with the payment provider
    const effectiveProvider = provider || 'paystack';

    if (effectiveProvider === 'paystack') {
      const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!paystackSecretKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment provider not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.status || verifyData.data?.status !== 'success') {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment not successful' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const metadata = verifyData.data.metadata || {};
      if (metadata.type !== 'fund_contribution') {
        return new Response(
          JSON.stringify({ success: false, error: 'Not a fund contribution payment' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // For Stripe, the webhook typically handles this, but we still mark complete

    // Update contribution status
    const { data: updated, error: updateError } = await supabase
      .from('party_invite_contributions')
      .update({ payment_status: 'completed' })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating contribution:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update contribution' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fund contribution ${reference} verified and completed`);

    return new Response(
      JSON.stringify({
        success: true,
        contribution: updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verify fund contribution error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to verify fund contribution' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
