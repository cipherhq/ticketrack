// Send Communication Campaign - Unified multi-channel campaign sender

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      campaignId,
      organizerId,
      channels,
      audienceType,
      eventId,
      segmentId,
      content,
      sendNow = true,
      scheduledFor,
    } = await req.json();

    // Validation
    if (!organizerId || !channels || channels.length === 0 || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organizer
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('id, business_name')
      .eq('id', organizerId)
      .single();

    if (orgError || !organizer) {
      return new Response(
        JSON.stringify({ error: 'Organizer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipients based on audience type
    let recipients: { email?: string; phone?: string; name: string }[] = [];

    if (audienceType === 'event_attendees' && eventId) {
      // Get tickets for the event
      const { data: tickets } = await supabase
        .from('tickets')
        .select('attendee_email, attendee_phone, attendee_name')
        .eq('event_id', eventId)
        .eq('payment_status', 'completed');

      recipients = (tickets || []).map(t => ({
        email: t.attendee_email,
        phone: t.attendee_phone,
        name: t.attendee_name || 'Attendee',
      }));
    } else if (audienceType === 'segment' && segmentId) {
      // Get contacts in segment
      const { data: segment } = await supabase
        .from('contact_segments')
        .select('criteria')
        .eq('id', segmentId)
        .single();

      if (segment) {
        let query = supabase
          .from('contacts')
          .select('email, phone, full_name')
          .eq('organizer_id', organizerId)
          .eq('is_active', true);

        // Apply segment criteria
        const criteria = segment.criteria || {};
        for (const [field, value] of Object.entries(criteria)) {
          if (typeof value === 'object' && value !== null) {
            if ('min' in value) query = query.gte(field, value.min);
            if ('max' in value) query = query.lte(field, value.max);
          } else {
            query = query.eq(field, value);
          }
        }

        const { data: contacts } = await query;
        recipients = (contacts || []).map(c => ({
          email: c.email,
          phone: c.phone,
          name: c.full_name || 'Contact',
        }));
      }
    } else if (audienceType === 'followers') {
      // Get followers
      const { data: followers } = await supabase
        .from('followers')
        .select('profiles:user_id (email, phone, full_name)')
        .eq('organizer_id', organizerId);

      recipients = (followers || [])
        .filter(f => f.profiles)
        .map(f => ({
          email: f.profiles?.email,
          phone: f.profiles?.phone,
          name: f.profiles?.full_name || 'Follower',
        }));
    } else if (audienceType === 'all_contacts') {
      // Get all contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('email, phone, full_name')
        .eq('organizer_id', organizerId)
        .eq('is_active', true);

      recipients = (contacts || []).map(c => ({
        email: c.email,
        phone: c.phone,
        name: c.full_name || 'Contact',
      }));
    }

    // Deduplicate
    const uniqueRecipients = deduplicateRecipients(recipients);

    if (uniqueRecipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate credits needed
    const { data: pricing } = await supabase
      .from('communication_channel_pricing')
      .select('channel, credits_per_message')
      .in('channel', channels);

    const pricingMap: Record<string, number> = {};
    for (const p of pricing || []) {
      pricingMap[p.channel] = p.credits_per_message;
    }

    let totalCreditsNeeded = 0;
    for (const channel of channels) {
      const creditsPerMsg = pricingMap[channel] || 0;
      const recipientCount = channel === 'email' 
        ? uniqueRecipients.filter(r => r.email).length
        : uniqueRecipients.filter(r => r.phone).length;
      totalCreditsNeeded += creditsPerMsg * recipientCount;
    }

    // Check credit balance
    const { data: balance } = await supabase
      .from('communication_credit_balances')
      .select('balance, bonus_balance')
      .eq('organizer_id', organizerId)
      .single();

    const availableCredits = (balance?.balance || 0) + (balance?.bonus_balance || 0);

    if (totalCreditsNeeded > availableCredits) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          credits_needed: totalCreditsNeeded,
          credits_available: availableCredits,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update campaign record
    let campaign;
    if (campaignId) {
      const { data, error } = await supabase
        .from('communication_campaigns')
        .update({
          status: sendNow ? 'sending' : 'scheduled',
          scheduled_at: scheduledFor || null,
          recipient_count: uniqueRecipients.length,
        })
        .eq('id', campaignId)
        .select()
        .single();
      campaign = data;
    } else {
      const { data, error } = await supabase
        .from('communication_campaigns')
        .insert({
          organizer_id: organizerId,
          name: content.email?.subject || content.sms?.message?.substring(0, 50) || 'Campaign',
          channels,
          audience_type: audienceType,
          audience_config: { eventId, segmentId },
          content,
          status: sendNow ? 'sending' : 'scheduled',
          scheduled_at: scheduledFor || null,
          recipient_count: uniqueRecipients.length,
        })
        .select()
        .single();
      campaign = data;
    }

    if (!sendNow) {
      return new Response(
        JSON.stringify({
          success: true,
          campaign_id: campaign?.id,
          status: 'scheduled',
          scheduled_for: scheduledFor,
          recipients: uniqueRecipients.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send messages
    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      whatsapp: { sent: 0, failed: 0 },
    };

    // Send emails
    if (channels.includes('email') && content.email) {
      const emailRecipients = uniqueRecipients.filter(r => r.email);
      
      for (const recipient of emailRecipients) {
        try {
          const personalizedContent = replaceVariables(content.email, {
            attendee_name: recipient.name,
            organizer_name: organizer.business_name,
          });

          // Insert message record
          await supabase.from('communication_messages').insert({
            campaign_id: campaign?.id,
            organizer_id: organizerId,
            channel: 'email',
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            content: personalizedContent,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          // Actually send via email function
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'bulk_campaign',
              to: recipient.email,
              data: {
                subject: personalizedContent.subject,
                title: personalizedContent.subject,
                body: personalizedContent.body,
              },
              organizerId,
            },
          });

          results.email.sent++;
        } catch (error) {
          console.error('Email send error:', error);
          results.email.failed++;
        }
      }

      // Deduct email credits
      const emailCredits = (pricingMap['email'] || 1) * emailRecipients.length;
      if (emailCredits > 0) {
        await supabase.rpc('deduct_communication_credits', {
          p_organizer_id: organizerId,
          p_amount: emailCredits,
          p_channel: 'email',
          p_campaign_id: campaign?.id,
          p_message_count: emailRecipients.length,
        });
      }
    }

    // Send SMS
    if (channels.includes('sms') && content.sms) {
      const smsRecipients = uniqueRecipients.filter(r => r.phone);

      for (const recipient of smsRecipients) {
        try {
          const personalizedMessage = replaceVariables(content.sms.message, {
            attendee_name: recipient.name,
            organizer_name: organizer.business_name,
          });

          await supabase.from('communication_messages').insert({
            campaign_id: campaign?.id,
            organizer_id: organizerId,
            channel: 'sms',
            recipient_phone: recipient.phone,
            recipient_name: recipient.name,
            content: { message: personalizedMessage },
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          results.sms.sent++;
        } catch (error) {
          console.error('SMS send error:', error);
          results.sms.failed++;
        }
      }

      // Deduct SMS credits
      const smsCredits = (pricingMap['sms'] || 5) * smsRecipients.length;
      if (smsCredits > 0) {
        await supabase.rpc('deduct_communication_credits', {
          p_organizer_id: organizerId,
          p_amount: smsCredits,
          p_channel: 'sms',
          p_campaign_id: campaign?.id,
          p_message_count: smsRecipients.length,
        });
      }
    }

    // Send WhatsApp
    if (channels.includes('whatsapp') && content.whatsapp) {
      const waRecipients = uniqueRecipients.filter(r => r.phone);

      for (const recipient of waRecipients) {
        try {
          const personalizedMessage = replaceVariables(content.whatsapp.message, {
            attendee_name: recipient.name,
            organizer_name: organizer.business_name,
          });

          await supabase.from('communication_messages').insert({
            campaign_id: campaign?.id,
            organizer_id: organizerId,
            channel: 'whatsapp',
            recipient_phone: recipient.phone,
            recipient_name: recipient.name,
            content: { message: personalizedMessage },
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

          await supabase.functions.invoke('send-whatsapp', {
            body: { to: recipient.phone, message: personalizedMessage },
          });

          results.whatsapp.sent++;
        } catch (error) {
          console.error('WhatsApp send error:', error);
          results.whatsapp.failed++;
        }
      }

      // Deduct WhatsApp credits
      const waCredits = (pricingMap['whatsapp_marketing'] || 100) * waRecipients.length;
      if (waCredits > 0) {
        await supabase.rpc('deduct_communication_credits', {
          p_organizer_id: organizerId,
          p_amount: waCredits,
          p_channel: 'whatsapp_marketing',
          p_campaign_id: campaign?.id,
          p_message_count: waRecipients.length,
        });
      }
    }

    // Update campaign with results
    const totalSent = results.email.sent + results.sms.sent + results.whatsapp.sent;
    const totalFailed = results.email.failed + results.sms.failed + results.whatsapp.failed;

    await supabase
      .from('communication_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: totalSent,
        failed_count: totalFailed,
      })
      .eq('id', campaign?.id);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign?.id,
        results,
        total_sent: totalSent,
        total_failed: totalFailed,
        credits_used: totalCreditsNeeded,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Campaign send error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function deduplicateRecipients(
  recipients: { email?: string; phone?: string; name: string }[]
): { email?: string; phone?: string; name: string }[] {
  const seen = new Set<string>();
  return recipients.filter(r => {
    const key = `${r.email || ''}-${r.phone || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function replaceVariables(content: any, variables: Record<string, string>): any {
  if (typeof content === 'string') {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return variables[key.trim()] || match;
    });
  }

  if (typeof content === 'object' && content !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(content)) {
      result[key] = replaceVariables(value, variables);
    }
    return result;
  }

  return content;
}
