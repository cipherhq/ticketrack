// SMS Inbound Webhook - Handle incoming SMS from Termii and Twilio

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse the incoming payload
    const contentType = req.headers.get('content-type') || '';
    let payload: any;
    
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio sends form-encoded data
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = await req.json().catch(() => ({}));
    }

    console.log('SMS Inbound webhook received:', JSON.stringify(payload));

    // Log the raw message first
    const { data: logEntry, error: logError } = await supabase
      .from('inbound_message_log')
      .insert({
        channel: 'sms',
        provider: detectProvider(payload),
        raw_payload: payload,
        from_number: extractFromNumber(payload),
        to_number: extractToNumber(payload),
        message_content: extractMessageContent(payload),
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log inbound message:', logError);
    }

    // Process the message
    const result = await processInboundSMS(supabase, payload, logEntry?.id);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('SMS inbound webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

function detectProvider(payload: any): string {
  // Twilio has specific fields
  if (payload.AccountSid || payload.From || payload.MessageSid) {
    return 'twilio';
  }
  // Termii webhook format
  if (payload.sms || payload.sender || payload.message_id) {
    return 'termii';
  }
  return 'unknown';
}

// ============================================================================
// PAYLOAD EXTRACTION
// ============================================================================

function extractFromNumber(payload: any): string | null {
  // Twilio format
  if (payload.From) {
    return normalizePhoneNumber(payload.From);
  }
  // Termii format
  if (payload.sender || payload.from) {
    return normalizePhoneNumber(payload.sender || payload.from);
  }
  return null;
}

function extractToNumber(payload: any): string | null {
  // Twilio format
  if (payload.To) {
    return normalizePhoneNumber(payload.To);
  }
  // Termii format
  if (payload.receiver || payload.to) {
    return normalizePhoneNumber(payload.receiver || payload.to);
  }
  return null;
}

function extractMessageContent(payload: any): string | null {
  // Twilio format
  if (payload.Body) {
    return payload.Body;
  }
  // Termii format
  if (payload.sms || payload.message) {
    return payload.sms || payload.message;
  }
  return null;
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Handle Nigerian numbers
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '234' + cleaned.substring(1);
  }
  
  return cleaned;
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processInboundSMS(
  supabase: any, 
  payload: any,
  logId?: string
): Promise<{ conversationId?: string; messageId?: string; autoResponse?: boolean }> {
  const fromNumber = extractFromNumber(payload);
  const toNumber = extractToNumber(payload);
  const messageContent = extractMessageContent(payload);

  if (!fromNumber || !messageContent) {
    console.log('Missing from number or message content');
    return {};
  }

  // Find the organizer by their SMS number
  // First, check platform_sms_config for the "to" number
  let organizerId: string | null = null;
  
  const { data: smsConfig } = await supabase
    .from('platform_sms_config')
    .select('organizer_id')
    .eq('phone_number', toNumber)
    .eq('is_active', true)
    .single();

  if (smsConfig) {
    organizerId = smsConfig.organizer_id;
  } else {
    // Try to find by contact's phone number
    const { data: contacts } = await supabase
      .from('contacts')
      .select('organizer_id')
      .eq('phone', fromNumber)
      .limit(1);

    if (contacts && contacts.length > 0) {
      organizerId = contacts[0].organizer_id;
    }
  }

  if (!organizerId) {
    console.log('Could not determine organizer for inbound SMS');
    // Update log with error
    if (logId) {
      await supabase
        .from('inbound_message_log')
        .update({ error_message: 'Could not determine organizer' })
        .eq('id', logId);
    }
    return {};
  }

  // Find or create conversation
  const { data: conversationId } = await supabase
    .rpc('find_or_create_conversation', {
      p_organizer_id: organizerId,
      p_channel: 'sms',
      p_contact_phone: fromNumber,
    });

  if (!conversationId) {
    console.error('Failed to find or create conversation');
    return {};
  }

  // Get contact name if available
  const { data: contact } = await supabase
    .from('contacts')
    .select('full_name, id')
    .eq('organizer_id', organizerId)
    .eq('phone', fromNumber)
    .single();

  // Update conversation with contact info
  if (contact) {
    await supabase
      .from('conversations')
      .update({ 
        contact_id: contact.id,
        contact_name: contact.full_name,
      })
      .eq('id', conversationId);
  }

  // Insert the message
  const { data: message, error: msgError } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      organizer_id: organizerId,
      direction: 'inbound',
      sender_type: 'contact',
      channel: 'sms',
      content: messageContent,
      external_id: payload.MessageSid || payload.message_id || null,
      metadata: {
        provider: detectProvider(payload),
        from: fromNumber,
        to: toNumber,
      },
    })
    .select()
    .single();

  if (msgError) {
    console.error('Failed to save message:', msgError);
  }

  // Update log as processed
  if (logId) {
    await supabase
      .from('inbound_message_log')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        conversation_id: conversationId,
      })
      .eq('id', logId);
  }

  // Check for auto-responses
  const autoResponse = await checkAutoResponses(supabase, organizerId, 'sms', messageContent, fromNumber);

  return {
    conversationId,
    messageId: message?.id,
    autoResponse: !!autoResponse,
  };
}

// ============================================================================
// AUTO RESPONSES
// ============================================================================

async function checkAutoResponses(
  supabase: any,
  organizerId: string,
  channel: string,
  messageContent: string,
  recipientPhone: string
): Promise<boolean> {
  // Get active auto-responses for this organizer
  const { data: autoResponses } = await supabase
    .from('auto_responses')
    .select('*')
    .eq('organizer_id', organizerId)
    .eq('is_active', true)
    .or(`channel.eq.${channel},channel.is.null`);

  if (!autoResponses || autoResponses.length === 0) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentDay = now.getDay();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

  for (const autoResp of autoResponses) {
    let shouldTrigger = false;

    switch (autoResp.trigger_type) {
      case 'always':
        shouldTrigger = true;
        break;

      case 'first_message':
        // Check if this is the first message in the conversation
        const { count } = await supabase
          .from('conversation_messages')
          .select('id', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .eq('direction', 'inbound');
        
        shouldTrigger = (count || 0) <= 1;
        break;

      case 'keyword':
        if (autoResp.trigger_keywords && autoResp.trigger_keywords.length > 0) {
          const lowerContent = messageContent.toLowerCase();
          shouldTrigger = autoResp.trigger_keywords.some((kw: string) => 
            lowerContent.includes(kw.toLowerCase())
          );
        }
        break;

      case 'after_hours':
        // Check if current time is outside business hours
        if (autoResp.active_hours_start && autoResp.active_hours_end) {
          const isOutsideHours = 
            currentTimeStr < autoResp.active_hours_start || 
            currentTimeStr > autoResp.active_hours_end;
          
          // Also check active days if specified
          if (autoResp.active_days && autoResp.active_days.length > 0) {
            const isActiveDay = autoResp.active_days.includes(currentDay);
            shouldTrigger = !isActiveDay || isOutsideHours;
          } else {
            shouldTrigger = isOutsideHours;
          }
        }
        break;
    }

    if (shouldTrigger) {
      // Send the auto-response
      const delay = (autoResp.response_delay_seconds || 0) * 1000;
      
      if (delay > 0) {
        // Schedule delayed response (would need a queue system for production)
        // For now, just wait
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 5000)));
      }

      // Call send-sms function to send the response
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: recipientPhone,
            message: autoResp.response_message,
            organizer_id: organizerId,
          }),
        });

        // Update auto-response stats
        await supabase
          .from('auto_responses')
          .update({
            times_triggered: (autoResp.times_triggered || 0) + 1,
            last_triggered_at: new Date().toISOString(),
          })
          .eq('id', autoResp.id);

        return true;
      } catch (error) {
        console.error('Failed to send auto-response:', error);
      }
    }
  }

  return false;
}
