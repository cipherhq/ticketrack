// Email Inbound Webhook - Handle incoming email replies

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
    // Parse incoming email
    // This webhook can receive from various providers:
    // - Resend (via webhook)
    // - SendGrid Inbound Parse
    // - Mailgun
    // - AWS SES
    const contentType = req.headers.get('content-type') || '';
    let payload: any;

    if (contentType.includes('multipart/form-data')) {
      // Handle form-encoded data (SendGrid, Mailgun)
      const formData = await req.formData();
      payload = {
        from: formData.get('from') || formData.get('sender'),
        to: formData.get('to') || formData.get('recipient'),
        subject: formData.get('subject'),
        text: formData.get('text') || formData.get('body-plain'),
        html: formData.get('html') || formData.get('body-html'),
        headers: formData.get('headers'),
        attachments: formData.get('attachments'),
        message_id: formData.get('Message-Id') || formData.get('message-id'),
      };
    } else {
      payload = await req.json();
    }

    console.log('Email inbound webhook received:', JSON.stringify(payload));

    // Log the raw email
    const { data: logEntry } = await supabase
      .from('inbound_message_log')
      .insert({
        channel: 'email',
        provider: detectEmailProvider(payload, req.headers),
        raw_payload: payload,
        from_email: extractFromEmail(payload),
        to_email: extractToEmail(payload),
        message_content: extractEmailContent(payload),
      })
      .select()
      .single();

    // Process the email
    const result = await processInboundEmail(supabase, payload, logEntry?.id);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email inbound webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

function detectEmailProvider(payload: any, headers: Headers): string {
  const userAgent = headers.get('user-agent') || '';
  
  if (userAgent.includes('Resend') || payload.type === 'email.received') {
    return 'resend';
  }
  if (userAgent.includes('SendGrid') || payload.headers?.includes('x-sg-')) {
    return 'sendgrid';
  }
  if (userAgent.includes('Mailgun') || payload.recipient) {
    return 'mailgun';
  }
  if (payload.notificationType || payload.mail?.source) {
    return 'aws_ses';
  }
  return 'unknown';
}

// ============================================================================
// EMAIL PARSING
// ============================================================================

function extractFromEmail(payload: any): string | null {
  // Try various payload formats
  if (payload.from) {
    return parseEmailAddress(payload.from);
  }
  if (payload.sender) {
    return parseEmailAddress(payload.sender);
  }
  if (payload.envelope?.from) {
    return payload.envelope.from;
  }
  if (payload.mail?.source) {
    return payload.mail.source;
  }
  return null;
}

function extractToEmail(payload: any): string | null {
  if (payload.to) {
    return parseEmailAddress(payload.to);
  }
  if (payload.recipient) {
    return parseEmailAddress(payload.recipient);
  }
  if (payload.envelope?.to?.[0]) {
    return payload.envelope.to[0];
  }
  return null;
}

function extractEmailContent(payload: any): string | null {
  // Prefer plain text, fall back to HTML
  return payload.text || payload['body-plain'] || 
         stripHtml(payload.html || payload['body-html'] || '');
}

function extractSubject(payload: any): string | null {
  return payload.subject || '';
}

function parseEmailAddress(str: string): string {
  if (!str) return '';
  // Extract email from format like "Name <email@example.com>"
  const match = str.match(/<([^>]+)>/);
  return match ? match[1] : str.trim();
}

function stripHtml(html: string): string {
  if (!html) return '';
  // Basic HTML stripping
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove quoted reply content (e.g., "On Jan 1, 2024, at 10:00 AM, John wrote:")
function stripQuotedContent(text: string): string {
  if (!text) return '';
  
  // Common reply patterns
  const patterns = [
    /On .+wrote:[\s\S]*/i,
    /On .+, .+ wrote:[\s\S]*/i,
    /-----Original Message-----[\s\S]*/i,
    /From:.+Sent:.+To:.+Subject:[\s\S]*/is,
    /_{10,}[\s\S]*/,  // Long underscores
    /\n>.*/g,  // Quoted lines starting with >
  ];

  let cleaned = text;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

// ============================================================================
// EMAIL PROCESSING
// ============================================================================

async function processInboundEmail(
  supabase: any,
  payload: any,
  logId?: string
): Promise<{ conversationId?: string; messageId?: string }> {
  const fromEmail = extractFromEmail(payload);
  const toEmail = extractToEmail(payload);
  const subject = extractSubject(payload);
  const rawContent = extractEmailContent(payload);
  const messageContent = stripQuotedContent(rawContent || '');

  if (!fromEmail || !messageContent) {
    console.log('Missing from email or content');
    return {};
  }

  // Find organizer by the "to" email address
  // The "to" should be something like reply-{organizer_id}@yourdomain.com
  // or the organizer's actual email
  let organizerId: string | null = null;

  // Check if this is a reply address
  const replyMatch = toEmail?.match(/reply-([a-f0-9-]+)@/i);
  if (replyMatch) {
    organizerId = replyMatch[1];
  } else {
    // Try to find by organizer email
    const { data: organizer } = await supabase
      .from('organizers')
      .select('id')
      .eq('email', toEmail)
      .single();

    if (organizer) {
      organizerId = organizer.id;
    } else {
      // Try to find by contact email
      const { data: contacts } = await supabase
        .from('contacts')
        .select('organizer_id')
        .eq('email', fromEmail)
        .limit(1);

      if (contacts && contacts.length > 0) {
        organizerId = contacts[0].organizer_id;
      }
    }
  }

  if (!organizerId) {
    console.log('Could not determine organizer for email from:', fromEmail);
    if (logId) {
      await supabase
        .from('inbound_message_log')
        .update({ error_message: 'Could not determine organizer' })
        .eq('id', logId);
    }
    return {};
  }

  // Extract sender name from "From" field
  const fromMatch = (payload.from || '').match(/^(.+?)\s*</);
  const senderName = fromMatch ? fromMatch[1].trim() : null;

  // Find or create conversation
  const { data: conversationId } = await supabase
    .rpc('find_or_create_conversation', {
      p_organizer_id: organizerId,
      p_channel: 'email',
      p_contact_email: fromEmail,
      p_contact_name: senderName,
      p_subject: subject,
    });

  if (!conversationId) {
    console.error('Failed to create conversation');
    return {};
  }

  // Get or create contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, full_name')
    .eq('organizer_id', organizerId)
    .eq('email', fromEmail)
    .single();

  if (contact) {
    await supabase
      .from('conversations')
      .update({ 
        contact_id: contact.id,
        contact_name: contact.full_name || senderName,
        subject: subject || undefined,
      })
      .eq('id', conversationId);
  }

  // Save the message
  const { data: message, error: msgError } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      organizer_id: organizerId,
      direction: 'inbound',
      sender_type: 'contact',
      channel: 'email',
      subject: subject,
      content: messageContent,
      content_type: 'text',
      external_id: payload.message_id || payload['Message-Id'] || null,
      metadata: {
        from_raw: payload.from,
        to_raw: payload.to,
        has_attachments: !!(payload.attachments || payload['attachment-count']),
        full_content: rawContent,
      },
    })
    .select()
    .single();

  if (msgError) {
    console.error('Failed to save email message:', msgError);
  }

  // Update log
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
  await checkAutoResponses(supabase, organizerId, 'email', messageContent, fromEmail, subject);

  return {
    conversationId,
    messageId: message?.id,
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
  recipientEmail: string,
  subject?: string | null
): Promise<void> {
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
          .eq('channel', 'email');
        
        shouldTrigger = (count || 0) <= 1;
        break;

      case 'keyword':
        if (autoResp.trigger_keywords && autoResp.trigger_keywords.length > 0) {
          const lowerContent = (messageContent + ' ' + (subject || '')).toLowerCase();
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

      // Send email response
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject: `Re: ${subject || 'Your message'}`,
            body: autoResp.response_message,
            type: 'auto_response',
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
        console.error('Failed to send email auto-response:', error);
      }

      break;
    }
  }
}
