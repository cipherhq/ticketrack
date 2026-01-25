import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      to, 
      message, 
      type = 'text', 
      template,
      organizer_id, // Optional: if provided, will deduct credits
      campaign_id,  // Optional: for logging
      deduct_credits = false // Whether to deduct credits on this call
    } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove spaces, dashes, plus signs)
    let formattedPhone = to.replace(/[\s+\-\(\)\.]/g, '');
    
    // Handle Nigerian numbers
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '234' + formattedPhone.substring(1);
    }

    // Initialize Supabase client if credit deduction is needed
    let supabase: any = null;
    if (deduct_credits && organizer_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get channel pricing
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
            error: 'Insufficient message credits for WhatsApp', 
            credits_needed: creditsPerMessage, 
            credits_available: totalCredits 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let body: any;

    if (type === 'template' && template) {
      // Template message
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language || 'en' },
          components: template.components || []
        }
      };
    } else {
      // Text message
      if (!message) {
        return new Response(
          JSON.stringify({ error: 'Message is required for text messages' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { preview_url: false, body: message }
      };
    }

    console.log('Sending WhatsApp message to:', formattedPhone);

    const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Failed to send WhatsApp message' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        p_description: `WhatsApp message to ${formattedPhone}`
      });
    }

    console.log('WhatsApp message sent successfully:', data.messages?.[0]?.id);

    return new Response(
      JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WhatsApp send error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
