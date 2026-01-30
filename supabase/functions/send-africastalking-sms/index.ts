// Africa's Talking SMS Integration
// Handles SMS for Nigeria (NG) and Ghana (GH)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const AT_API_KEY = Deno.env.get('AFRICASTALKING_API_KEY');
const AT_USERNAME = Deno.env.get('AFRICASTALKING_USERNAME');
const AT_SENDER_ID = Deno.env.get('AFRICASTALKING_SENDER_ID') || 'Ticketrack';
const AT_ENVIRONMENT = Deno.env.get('AFRICASTALKING_ENVIRONMENT') || 'production'; // 'sandbox' or 'production'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API URLs
const SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';
const PRODUCTION_URL = 'https://api.africastalking.com/version1/messaging';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!AT_API_KEY || !AT_USERNAME) {
      return new Response(
        JSON.stringify({ error: "Africa's Talking not configured" }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      to,
      message,
      organizer_id,
      campaign_id,
      deduct_credits = false,
      sender_id,
    } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    let formattedPhone = to.replace(/[\s+\-\(\)\.]/g, '');

    // Ensure country code prefix
    if (formattedPhone.startsWith('0')) {
      // Detect country based on pattern (Nigeria numbers start with 0, 8xx, 9xx, 7xx)
      // Ghana numbers start with 0, 2xx, 5xx
      // Default to Nigeria if unclear
      formattedPhone = '+234' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Validate supported countries (Nigeria: +234, Ghana: +233)
    const isNigeria = formattedPhone.startsWith('+234');
    const isGhana = formattedPhone.startsWith('+233');

    if (!isNigeria && !isGhana) {
      return new Response(
        JSON.stringify({
          error: "Africa's Talking SMS only supports Nigeria (+234) and Ghana (+233)",
          phone: formattedPhone
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase for credit handling
    let supabase: any = null;
    if (deduct_credits && organizer_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get channel pricing
      const { data: pricing } = await supabase
        .from('communication_channel_pricing')
        .select('credits_per_message')
        .eq('channel', 'sms')
        .single();

      const creditsPerMessage = pricing?.credits_per_message || 50;

      // Check balance
      const { data: creditBalance } = await supabase
        .from('communication_credit_balances')
        .select('balance, bonus_balance')
        .eq('organizer_id', organizer_id)
        .single();

      const totalCredits = (creditBalance?.balance || 0) + (creditBalance?.bonus_balance || 0);

      if (totalCredits < creditsPerMessage) {
        return new Response(
          JSON.stringify({
            error: 'Insufficient SMS credits',
            credits_needed: creditsPerMessage,
            credits_available: totalCredits
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prepare request to Africa's Talking
    const apiUrl = AT_ENVIRONMENT === 'sandbox' ? SANDBOX_URL : PRODUCTION_URL;

    const formData = new URLSearchParams();
    formData.append('username', AT_USERNAME);
    formData.append('to', formattedPhone);
    formData.append('message', message);

    // Use custom sender ID if provided, otherwise default
    const effectiveSenderId = sender_id || AT_SENDER_ID;
    if (effectiveSenderId && effectiveSenderId !== 'default') {
      formData.append('from', effectiveSenderId);
    }

    console.log(`Sending SMS via Africa's Talking to: ${formattedPhone}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'apiKey': AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    const data = await response.json();
    console.log("Africa's Talking response:", JSON.stringify(data));

    // Check for success
    const messageData = data.SMSMessageData;
    const recipients = messageData?.Recipients || [];
    const firstRecipient = recipients[0];

    if (!response.ok || (firstRecipient && firstRecipient.status === 'Failed')) {
      const errorMessage = firstRecipient?.status || messageData?.Message || 'Failed to send SMS';
      console.error("Africa's Talking error:", errorMessage);

      // Log failed message
      if (supabase && organizer_id) {
        await supabase.from('communication_messages').insert({
          organizer_id,
          campaign_id: campaign_id || null,
          channel: 'sms',
          recipient_phone: formattedPhone,
          content: message,
          status: 'failed',
          error_message: errorMessage,
          provider: 'africastalking',
        });
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits after successful send
    if (deduct_credits && organizer_id && supabase) {
      const { data: pricing } = await supabase
        .from('communication_channel_pricing')
        .select('credits_per_message')
        .eq('channel', 'sms')
        .single();

      const creditsPerMessage = pricing?.credits_per_message || 50;

      await supabase.rpc('deduct_communication_credits', {
        p_organizer_id: organizer_id,
        p_amount: creditsPerMessage,
        p_channel: 'sms',
        p_campaign_id: campaign_id || null,
        p_message_count: 1,
        p_description: `SMS to ${formattedPhone} via Africa's Talking`
      });
    }

    // Log successful message
    if (supabase && organizer_id) {
      await supabase.from('communication_messages').insert({
        organizer_id,
        campaign_id: campaign_id || null,
        channel: 'sms',
        recipient_phone: formattedPhone,
        content: message,
        status: 'sent',
        provider: 'africastalking',
        provider_message_id: firstRecipient?.messageId,
        delivered_at: new Date().toISOString(),
        metadata: { cost: firstRecipient?.cost },
      });
    }

    console.log(`SMS sent successfully via Africa's Talking: ${firstRecipient?.messageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: firstRecipient?.messageId,
        cost: firstRecipient?.cost,
        status: firstRecipient?.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Africa's Talking SMS error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
