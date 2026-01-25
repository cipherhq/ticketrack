// WhatsApp Inbound Webhook - Handle incoming messages from Meta/Facebook

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'ticketrack_verify';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('WhatsApp webhook verification:', { mode, token, challenge });

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      return new Response(challenge, { status: 200 });
    } else {
      console.log('Webhook verification failed');
      return new Response('Forbidden', { status: 403 });
    }
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();
    console.log('WhatsApp webhook received:', JSON.stringify(payload));

    // Meta sends webhooks in a specific format
    const entry = payload.entry?.[0];
    if (!entry) {
      return new Response(JSON.stringify({ status: 'no entry' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const changes = entry.changes?.[0];
    if (!changes) {
      return new Response(JSON.stringify({ status: 'no changes' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const value = changes.value;
    
    // Handle different webhook types
    if (value.messages) {
      // Incoming message
      for (const message of value.messages) {
        await processInboundMessage(supabase, message, value);
      }
    }
    
    if (value.statuses) {
      // Message status update (delivered, read, etc.)
      for (const status of value.statuses) {
        await processStatusUpdate(supabase, status);
      }
    }

    // Always return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ status: 'ok' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processInboundMessage(supabase: any, message: any, value: any): Promise<void> {
  const fromPhone = message.from; // Phone number without +
  const messageId = message.id;
  const timestamp = message.timestamp;
  const businessPhoneId = value.metadata?.phone_number_id;
  
  // Get message content based on type
  let messageContent = '';
  let contentType = 'text';
  let mediaUrls: string[] = [];
  let mediaTypes: string[] = [];

  switch (message.type) {
    case 'text':
      messageContent = message.text?.body || '';
      break;
    case 'image':
      contentType = 'image';
      messageContent = message.image?.caption || '[Image]';
      if (message.image?.id) {
        mediaUrls.push(message.image.id); // Would need to fetch actual URL
      }
      mediaTypes.push('image');
      break;
    case 'audio':
      contentType = 'audio';
      messageContent = '[Voice message]';
      if (message.audio?.id) {
        mediaUrls.push(message.audio.id);
      }
      mediaTypes.push('audio');
      break;
    case 'video':
      contentType = 'video';
      messageContent = message.video?.caption || '[Video]';
      if (message.video?.id) {
        mediaUrls.push(message.video.id);
      }
      mediaTypes.push('video');
      break;
    case 'document':
      contentType = 'document';
      messageContent = message.document?.filename || '[Document]';
      if (message.document?.id) {
        mediaUrls.push(message.document.id);
      }
      mediaTypes.push('document');
      break;
    case 'sticker':
      contentType = 'sticker';
      messageContent = '[Sticker]';
      break;
    case 'location':
      contentType = 'location';
      const loc = message.location;
      messageContent = `[Location: ${loc?.latitude}, ${loc?.longitude}]`;
      break;
    case 'button':
      messageContent = message.button?.text || '[Button response]';
      break;
    case 'interactive':
      const interactive = message.interactive;
      if (interactive?.button_reply) {
        messageContent = interactive.button_reply.title || '[Button response]';
      } else if (interactive?.list_reply) {
        messageContent = interactive.list_reply.title || '[List selection]';
      }
      break;
    default:
      messageContent = `[${message.type || 'Unknown'} message]`;
  }

  // Log raw message
  await supabase
    .from('inbound_message_log')
    .insert({
      channel: 'whatsapp',
      provider: 'meta',
      raw_payload: message,
      from_number: fromPhone,
      to_number: businessPhoneId,
      message_content: messageContent,
    });

  // Find organizer by WhatsApp phone ID
  let organizerId: string | null = null;

  // Check if this business phone is associated with an organizer
  const { data: orgConfig } = await supabase
    .from('organizers')
    .select('id')
    .or(`whatsapp_phone_id.eq.${businessPhoneId},phone.ilike.%${fromPhone.slice(-10)}%`)
    .limit(1);

  if (orgConfig && orgConfig.length > 0) {
    organizerId = orgConfig[0].id;
  } else {
    // Try to find by contact phone
    const { data: contacts } = await supabase
      .from('contacts')
      .select('organizer_id')
      .eq('phone', fromPhone)
      .limit(1);

    if (contacts && contacts.length > 0) {
      organizerId = contacts[0].organizer_id;
    }
  }

  if (!organizerId) {
    console.log('Could not determine organizer for WhatsApp message from:', fromPhone);
    return;
  }

  // Find or create conversation
  const { data: conversationId } = await supabase
    .rpc('find_or_create_conversation', {
      p_organizer_id: organizerId,
      p_channel: 'whatsapp',
      p_contact_phone: fromPhone,
      p_contact_name: value.contacts?.[0]?.profile?.name || null,
    });

  if (!conversationId) {
    console.error('Failed to create conversation');
    return;
  }

  // Update contact info from WhatsApp profile
  if (value.contacts?.[0]?.profile?.name) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('organizer_id', organizerId)
      .eq('phone', fromPhone)
      .single();

    if (contact) {
      await supabase
        .from('contacts')
        .update({ 
          full_name: value.contacts[0].profile.name,
          whatsapp_opt_in: true, // They're messaging us, so they're opted in
        })
        .eq('id', contact.id);

      await supabase
        .from('conversations')
        .update({ 
          contact_id: contact.id,
          contact_name: value.contacts[0].profile.name,
        })
        .eq('id', conversationId);
    }
  }

  // Save the message
  await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      organizer_id: organizerId,
      direction: 'inbound',
      sender_type: 'contact',
      channel: 'whatsapp',
      content: messageContent,
      content_type: contentType,
      external_id: messageId,
      media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      media_types: mediaTypes.length > 0 ? mediaTypes : null,
      metadata: {
        timestamp,
        message_type: message.type,
        wa_id: fromPhone,
        profile_name: value.contacts?.[0]?.profile?.name,
      },
    });

  // Check for auto-responses
  await checkAutoResponses(supabase, organizerId, 'whatsapp', messageContent, fromPhone);
}

// ============================================================================
// STATUS UPDATES
// ============================================================================

async function processStatusUpdate(supabase: any, status: any): Promise<void> {
  const messageId = status.id;
  const statusValue = status.status; // sent, delivered, read, failed
  const recipientPhone = status.recipient_id;
  const timestamp = status.timestamp;

  console.log(`WhatsApp status update: ${messageId} -> ${statusValue}`);

  // Update the message status in our database
  const { error } = await supabase
    .from('conversation_messages')
    .update({
      external_status: statusValue,
      metadata: supabase.sql`metadata || ${JSON.stringify({ 
        status_updated_at: new Date(parseInt(timestamp) * 1000).toISOString(),
        status_history: [{ status: statusValue, timestamp }]
      })}`,
    })
    .eq('external_id', messageId);

  if (error) {
    console.error('Failed to update message status:', error);
  }

  // Also update communication_messages if exists
  await supabase
    .from('communication_messages')
    .update({ 
      status: statusValue === 'read' || statusValue === 'delivered' ? 'delivered' : 
              statusValue === 'failed' ? 'failed' : 'sent',
      delivered_at: statusValue === 'delivered' || statusValue === 'read' 
        ? new Date(parseInt(timestamp) * 1000).toISOString() 
        : null,
    })
    .eq('external_id', messageId);
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
): Promise<void> {
  // Get active auto-responses for this organizer
  const { data: autoResponses } = await supabase
    .from('auto_responses')
    .select('*')
    .eq('organizer_id', organizerId)
    .eq('is_active', true)
    .or(`channel.eq.${channel},channel.is.null`);

  if (!autoResponses || autoResponses.length === 0) {
    return;
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
        const { count } = await supabase
          .from('conversation_messages')
          .select('id', { count: 'exact', head: true })
          .eq('organizer_id', organizerId)
          .eq('direction', 'inbound')
          .eq('channel', 'whatsapp');
        
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
        if (autoResp.active_hours_start && autoResp.active_hours_end) {
          const isOutsideHours = 
            currentTimeStr < autoResp.active_hours_start || 
            currentTimeStr > autoResp.active_hours_end;
          
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
      const delay = (autoResp.response_delay_seconds || 0) * 1000;
      
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 5000)));
      }

      // Send WhatsApp response
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: recipientPhone,
            message: autoResp.response_message,
            type: 'text',
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

      } catch (error) {
        console.error('Failed to send WhatsApp auto-response:', error);
      }

      break; // Only send one auto-response
    }
  }
}
