// Africa's Talking WhatsApp Integration
// Handles WhatsApp messaging for all countries

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const AT_API_KEY = Deno.env.get('AFRICASTALKING_API_KEY');
const AT_USERNAME = Deno.env.get('AFRICASTALKING_USERNAME');
const AT_WHATSAPP_PRODUCT_ID = Deno.env.get('AFRICASTALKING_WHATSAPP_PRODUCT_ID');
const AT_ENVIRONMENT = Deno.env.get('AFRICASTALKING_ENVIRONMENT') || 'production';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WhatsApp API URL
const WHATSAPP_URL = 'https://api.africastalking.com/version1/whatsapp/send';

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
      type = 'text', // 'text', 'template', 'media'
      template,      // For template messages
      media,         // For media messages { url, caption, type }
      organizer_id,
      campaign_id,
      deduct_credits = false,
    } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    let formattedPhone = to.replace(/[\s+\-\(\)\.]/g, '');

    // Handle Nigerian numbers (starts with 0)
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '234' + formattedPhone.substring(1);
    }

    // Ensure no + prefix for Africa's Talking
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    // Initialize Supabase for credit handling
    let supabase: any = null;
    if (deduct_credits && organizer_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get channel pricing for WhatsApp
      const { data: pricing } = await supabase
        .from('communication_channel_pricing')
        .select('credits_per_message')
        .eq('channel', 'whatsapp_marketing')
        .single();

      const creditsPerMessage = pricing?.credits_per_message || 100;

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
            error: 'Insufficient WhatsApp credits',
            credits_needed: creditsPerMessage,
            credits_available: totalCredits
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build request body based on message type
    let requestBody: any = {
      username: AT_USERNAME,
      productId: AT_WHATSAPP_PRODUCT_ID,
      to: formattedPhone,
    };

    if (type === 'template' && template) {
      // Template message
      requestBody.templateName = template.name;
      requestBody.templateData = template.data || {};
      requestBody.templateLanguage = template.language || 'en';
    } else if (type === 'media' && media) {
      // Media message (image, video, document, audio)
      requestBody.mediaUrl = media.url;
      requestBody.mediaType = media.type || 'image'; // image, video, document, audio
      if (media.caption) {
        requestBody.caption = media.caption;
      }
    } else {
      // Text message
      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Message is required for text messages' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      requestBody.message = message;
    }

    console.log(`Sending WhatsApp via Africa's Talking to: ${formattedPhone}`);

    const response = await fetch(WHATSAPP_URL, {
      method: 'POST',
      headers: {
        'apiKey': AT_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log("Africa's Talking WhatsApp response:", JSON.stringify(data));

    // Check for errors
    if (!response.ok || data.status === 'failed' || data.errorMessage) {
      const errorMessage = data.errorMessage || data.message || 'Failed to send WhatsApp message';
      console.error("Africa's Talking WhatsApp error:", errorMessage);

      // Log failed message
      if (supabase && organizer_id) {
        await supabase.from('communication_messages').insert({
          organizer_id,
          campaign_id: campaign_id || null,
          channel: 'whatsapp',
          recipient_phone: formattedPhone,
          content: message || template?.name || media?.url,
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
        .eq('channel', 'whatsapp_marketing')
        .single();

      const creditsPerMessage = pricing?.credits_per_message || 100;

      await supabase.rpc('deduct_communication_credits', {
        p_organizer_id: organizer_id,
        p_amount: creditsPerMessage,
        p_channel: 'whatsapp_marketing',
        p_campaign_id: campaign_id || null,
        p_message_count: 1,
        p_description: `WhatsApp to ${formattedPhone} via Africa's Talking`
      });
    }

    // Log successful message
    if (supabase && organizer_id) {
      await supabase.from('communication_messages').insert({
        organizer_id,
        campaign_id: campaign_id || null,
        channel: 'whatsapp',
        recipient_phone: formattedPhone,
        content: message || template?.name || media?.url,
        status: 'sent',
        provider: 'africastalking',
        provider_message_id: data.messageId || data.id,
        delivered_at: new Date().toISOString(),
      });
    }

    console.log(`WhatsApp sent successfully via Africa's Talking: ${data.messageId || data.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: data.messageId || data.id,
        status: data.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Africa's Talking WhatsApp error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
