import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Meta WhatsApp Cloud API (legacy)
const META_WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';
const META_WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');
const META_WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN');

// Africa's Talking WhatsApp (primary)
const AT_API_KEY = Deno.env.get('AFRICASTALKING_API_KEY');
const AT_USERNAME = Deno.env.get('AFRICASTALKING_USERNAME');
const AT_WHATSAPP_PRODUCT_ID = Deno.env.get('AFRICASTALKING_WHATSAPP_PRODUCT_ID');

// Determine which provider to use (prefer Africa's Talking)
const USE_AFRICASTALKING = AT_API_KEY && AT_USERNAME;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check if any WhatsApp provider is configured
    if (!USE_AFRICASTALKING && (!META_WHATSAPP_PHONE_ID || !META_WHATSAPP_TOKEN)) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured. Set Africa\'s Talking or Meta WhatsApp credentials.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      to,
      message,
      type = 'text',
      template,
      media,
      organizer_id,
      campaign_id,
      deduct_credits = false,
      force_provider, // Optional: 'africastalking' or 'meta' to force a specific provider
    } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: 'Recipient phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
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

    let result: { success: boolean; messageId?: string; error?: string; provider: string };

    // Determine which provider to use
    const useAT = force_provider === 'africastalking' || (USE_AFRICASTALKING && force_provider !== 'meta');

    if (useAT) {
      result = await sendViaAfricasTalking(formattedPhone, message, type, template, media);
    } else {
      result = await sendViaMeta(formattedPhone, message, type, template);
    }

    if (!result.success) {
      // Log failed message
      if (supabase && organizer_id) {
        await supabase.from('communication_messages').insert({
          organizer_id,
          campaign_id: campaign_id || null,
          channel: 'whatsapp',
          recipient_phone: formattedPhone,
          content: message || template?.name || media?.url,
          status: 'failed',
          error_message: result.error,
          provider: result.provider,
        });
      }

      return new Response(
        JSON.stringify({ error: result.error }),
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
        p_description: `WhatsApp message to ${formattedPhone} via ${result.provider}`
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
        provider: result.provider,
        provider_message_id: result.messageId,
        delivered_at: new Date().toISOString(),
      });
    }

    console.log(`WhatsApp message sent successfully via ${result.provider}: ${result.messageId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId, provider: result.provider }),
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

// ============================================================================
// AFRICA'S TALKING WHATSAPP
// ============================================================================

async function sendViaAfricasTalking(
  to: string,
  message: string,
  type: string,
  template?: any,
  media?: any
): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
  const provider = 'africastalking';

  try {
    // Ensure phone number has + prefix for Africa's Talking
    let phone = to;
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    const requestBody: any = {
      username: AT_USERNAME,
      productId: AT_WHATSAPP_PRODUCT_ID,
      to: phone,
    };

    if (type === 'template' && template) {
      requestBody.templateName = template.name;
      requestBody.templateData = template.data || {};
      requestBody.templateLanguage = template.language || 'en';
    } else if (type === 'media' && media) {
      requestBody.mediaUrl = media.url;
      requestBody.mediaType = media.type || 'image';
      if (media.caption) {
        requestBody.caption = media.caption;
      }
    } else {
      if (!message) {
        return { success: false, error: 'Message is required', provider };
      }
      requestBody.message = message;
    }

    console.log(`Sending WhatsApp via Africa's Talking to: ${phone}`);

    const response = await fetch('https://api.africastalking.com/version1/whatsapp/send', {
      method: 'POST',
      headers: {
        'apiKey': AT_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log("Africa's Talking WhatsApp response:", JSON.stringify(data));

    if (!response.ok || data.status === 'failed' || data.errorMessage) {
      return {
        success: false,
        error: data.errorMessage || data.message || 'Failed to send WhatsApp',
        provider,
      };
    }

    return {
      success: true,
      messageId: data.messageId || data.id,
      provider,
    };
  } catch (error) {
    console.error("Africa's Talking WhatsApp error:", error);
    return { success: false, error: error.message, provider };
  }
}

// ============================================================================
// META WHATSAPP CLOUD API (FALLBACK)
// ============================================================================

async function sendViaMeta(
  to: string,
  message: string,
  type: string,
  template?: any
): Promise<{ success: boolean; messageId?: string; error?: string; provider: string }> {
  const provider = 'meta';

  try {
    let body: any;

    if (type === 'template' && template) {
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language || 'en' },
          components: template.components || []
        }
      };
    } else {
      if (!message) {
        return { success: false, error: 'Message is required', provider };
      }
      body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { preview_url: false, body: message }
      };
    }

    console.log('Sending WhatsApp via Meta to:', to);

    const response = await fetch(`${META_WHATSAPP_API_URL}/${META_WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('Meta WhatsApp response:', JSON.stringify(data));

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message',
        provider,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      provider,
    };
  } catch (error) {
    console.error('Meta WhatsApp error:', error);
    return { success: false, error: error.message, provider };
  }
}
