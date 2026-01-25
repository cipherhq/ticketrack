// Send Telegram Message - Telegram Bot integration

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API_URL = 'https://api.telegram.org';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Telegram bot not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      chatId,
      userId,
      organizerId,
      message,
      parseMode = 'Markdown', // 'Markdown' or 'HTML'
      replyMarkup,
      photo,
      document,
      disableNotification = false,
    } = await req.json();

    // Get chat ID from user if not provided directly
    let targetChatId = chatId;
    
    if (!targetChatId && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', userId)
        .single();
      
      targetChatId = profile?.telegram_chat_id;
    }

    if (!targetChatId) {
      return new Response(
        JSON.stringify({ error: 'No Telegram chat ID found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message && !photo && !document) {
      return new Response(
        JSON.stringify({ error: 'Message, photo, or document is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    if (photo) {
      // Send photo with caption
      result = await sendTelegramRequest('sendPhoto', {
        chat_id: targetChatId,
        photo,
        caption: message,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
        disable_notification: disableNotification,
      });
    } else if (document) {
      // Send document
      result = await sendTelegramRequest('sendDocument', {
        chat_id: targetChatId,
        document,
        caption: message,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
        disable_notification: disableNotification,
      });
    } else {
      // Send text message
      result = await sendTelegramRequest('sendMessage', {
        chat_id: targetChatId,
        text: message,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
        disable_notification: disableNotification,
        disable_web_page_preview: false,
      });
    }

    if (!result.ok) {
      console.error('Telegram API error:', result);

      // Log failed message
      await supabase.from('communication_messages').insert({
        organizer_id: organizerId || null,
        channel: 'telegram',
        recipient_metadata: { chat_id: targetChatId, user_id: userId },
        content: { message, photo, document },
        status: 'failed',
        error_message: result.description || 'Unknown error',
        metadata: { telegram_error: result },
      });

      return new Response(
        JSON.stringify({ error: result.description || 'Failed to send Telegram message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful message
    await supabase.from('communication_messages').insert({
      organizer_id: organizerId || null,
      channel: 'telegram',
      recipient_metadata: { chat_id: targetChatId, user_id: userId },
      content: { message, photo, document },
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: result.result?.message_id?.toString(),
    });

    // Deduct credits if organizerId provided
    if (organizerId) {
      const telegramCredits = 2; // Credits per Telegram message

      await supabase.rpc('deduct_communication_credits', {
        p_organizer_id: organizerId,
        p_amount: telegramCredits,
        p_channel: 'telegram',
        p_message_count: 1,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.result?.message_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Telegram send error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// TELEGRAM API HELPER
// ============================================================================

async function sendTelegramRequest(method: string, params: Record<string, any>): Promise<any> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    return await response.json();
  } catch (error) {
    console.error('Telegram request error:', error);
    return { ok: false, description: error.message };
  }
}
