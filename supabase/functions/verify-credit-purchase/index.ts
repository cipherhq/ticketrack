/**
 * Verify Credit Purchase - Supabase Edge Function
 *
 * Verifies a Paystack payment and adds credits if not already processed.
 * This acts as a fallback if the webhook didn't process the payment.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { optionalAuth, requireServiceRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ticketrack.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow both authenticated users and service-role callers (webhooks)
    let supabase;
    let authUserId: string | null = null;

    try {
      // Try service role first (for webhook callbacks)
      supabase = requireServiceRole(req);
    } catch {
      // Fall back to user auth
      const auth = await optionalAuth(req);
      if (auth) {
        supabase = auth.supabase;
        authUserId = auth.user.id;
      } else {
        supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
      }
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;

    const { reference, organizerId } = await req.json();

    if (!reference || !organizerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing reference or organizerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying credit purchase: ${reference} for organizer: ${organizerId}`);

    // Check if this transaction was already processed
    const { data: existingTx } = await supabase
      .from('communication_credit_transactions')
      .select('id, credits, status')
      .eq('payment_reference', reference)
      .single();

    if (existingTx?.status === 'completed') {
      console.log('Transaction already processed');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Already processed',
          credits: existingTx.credits,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment not successful' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentData = verifyData.data;
    const metadata = paymentData.metadata || {};

    // Verify this is a credit purchase
    if (metadata.type !== 'credit_purchase') {
      return new Response(
        JSON.stringify({ success: false, error: 'Not a credit purchase' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify organizer matches
    if (metadata.organizer_id !== organizerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organizer mismatch' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credits = parseInt(metadata.credits) || 0;
    const bonusCredits = parseInt(metadata.bonus_credits) || 0;
    const packageId = metadata.package_id || null;
    const amount = paymentData.amount / 100; // Convert from kobo
    const currency = paymentData.currency || 'NGN';

    // Add credits using the database function
    const { data: txId, error: addError } = await supabase.rpc('add_communication_credits', {
      p_organizer_id: organizerId,
      p_credits: credits,
      p_bonus_credits: bonusCredits,
      p_package_id: packageId,
      p_amount_paid: amount,
      p_currency: currency,
      p_payment_provider: 'paystack',
      p_payment_reference: reference,
      p_description: `Credit purchase via Paystack (verified)`,
    });

    if (addError) {
      console.error('Error adding credits:', addError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to add credits' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully added ${credits + bonusCredits} credits for organizer ${organizerId}`);

    return new Response(
      JSON.stringify({
        success: true,
        credits: credits + bonusCredits,
        transactionId: txId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to verify credit purchase' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
