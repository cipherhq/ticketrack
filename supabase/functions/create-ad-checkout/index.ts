// Create Ad Checkout - Payment session for ad purchases (Paystack + Stripe)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON: ' + e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { packageId, adId, email, provider = 'paystack', callbackUrl } = body;

  if (!packageId || !adId || !email || !callbackUrl) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required fields' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch the package
    const { data: pkg, error: pkgError } = await supabase
      .from('ad_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) {
      return new Response(
        JSON.stringify({ success: false, error: 'Package not found or inactive' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ad record exists and belongs to the requesting user
    const { data: ad, error: adError } = await supabase
      .from('platform_adverts')
      .select('id, advertiser_email')
      .eq('id', adId)
      .single();

    if (adError || !ad) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ad record not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the email matches the ad's advertiser
    if (ad.advertiser_email && ad.advertiser_email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: email does not match ad owner' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reference = `AD-${adId.substring(0, 8)}-${Date.now()}`;

    if (provider === 'stripe') {
      // Get Stripe key from payment_gateway_config (same pattern as create-stripe-checkout)
      const { data: gatewayConfig } = await supabase
        .from('payment_gateway_config')
        .select('*')
        .eq('provider', 'stripe')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!gatewayConfig?.secret_key_encrypted) {
        return new Response(
          JSON.stringify({ success: false, error: 'Stripe not configured' }),
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
              currency: pkg.currency.toLowerCase(),
              product_data: {
                name: pkg.name,
                description: `${pkg.duration_days}-day ad placement on Ticketrack`,
              },
              unit_amount: Math.round(Number(pkg.price) * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: callbackUrl,
        cancel_url: callbackUrl.replace('payment=success', 'payment=cancelled'),
        customer_email: email,
        metadata: {
          type: 'ad_purchase',
          ad_id: adId,
          package_id: packageId,
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
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Paystack - get key from payment_gateway_config
      const currencyToCountry: Record<string, string> = { NGN: 'NG', GHS: 'GH', KES: 'KE', ZAR: 'ZA' };
      const countryCode = currencyToCountry[pkg.currency] || 'NG';
      const { data: gatewayConfig } = await supabase
        .from('payment_gateway_config')
        .select('secret_key_encrypted')
        .eq('provider', 'paystack')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .single();

      if (!gatewayConfig?.secret_key_encrypted) {
        return new Response(
          JSON.stringify({ success: false, error: 'Paystack not configured for ' + countryCode }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayConfig.secret_key_encrypted}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: Math.round(Number(pkg.price) * 100),
          currency: pkg.currency,
          reference,
          callback_url: callbackUrl,
          metadata: {
            type: 'ad_purchase',
            ad_id: adId,
            package_id: packageId,
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
