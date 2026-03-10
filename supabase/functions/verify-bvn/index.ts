import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth, AuthError, authErrorResponse } from "../_shared/auth.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Paystack not configured for BVN verification' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated using shared auth module
    const { user, supabase: supabaseClient } = await requireAuth(req);

    const { bvn, firstName, lastName, accountNumber, bankCode } = await req.json();

    if (!bvn || !firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'BVN, first name, and last name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Paystack BVN Match API
    const response = await fetch('https://api.paystack.co/bvn/match', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bvn,
        account_number: accountNumber || '',
        bank_code: bankCode || '',
        first_name: firstName,
        last_name: lastName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Paystack BVN error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.message || 'BVN verification failed',
          data: result.data 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data,
        message: result.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('BVN verification error:', error);
    return new Response(
      JSON.stringify({ error: 'BVN verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
