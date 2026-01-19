import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TERMII_API_URL = 'https://api.ng.termii.com/api';
const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';

// Map phone prefixes to country codes
const PHONE_PREFIX_TO_COUNTRY: Record<string, string> = {
  '234': 'NG', '233': 'GH', '254': 'KE', '27': 'ZA',  // Nigeria, Ghana, Kenya, South Africa
  '1': 'US', '44': 'GB', '1242': 'BS', '1246': 'BB',  // US/UK/Caribbean
};

function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '•••••••••';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return '•••••••••';
  return `+${cleaned.slice(0, 3)}•••••${cleaned.slice(-4)}`;
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Handle Nigerian numbers specifically
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);  // Convert 0xxx to 234xxx
  } else if (cleaned.startsWith('+234')) {
    cleaned = cleaned.substring(1);  // Remove + prefix
  } else if (cleaned.startsWith('234') && cleaned.length === 13) {
    // Already in correct format
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.match(/^[789]/)) {
    // Nigerian mobile number without prefix
    cleaned = '234' + cleaned;
  }
  
  // Validate Nigerian mobile numbers
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    const localPart = cleaned.substring(3);
    if (!localPart.match(/^[789]/)) {
      console.warn('Invalid Nigerian mobile number format:', phone);
    }
  }
  
  return cleaned;
}

function detectCountryFromPhone(phone: string): string {
  const cleaned = formatPhoneNumber(phone);
  // Check longer prefixes first (4 digits, then 3, then 2, then 1)
  for (let len = 4; len >= 1; len--) {
    const prefix = cleaned.substring(0, len);
    if (PHONE_PREFIX_TO_COUNTRY[prefix]) {
      return PHONE_PREFIX_TO_COUNTRY[prefix];
    }
  }
  return 'NG'; // Default to Nigeria
}

async function sendTermiiSMS(
  to: string, 
  message: string, 
  apiKey: string, 
  senderId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const formattedPhone = formatPhoneNumber(to);
    
    // Enhanced payload for better delivery in Nigeria
    const payload = {
      api_key: apiKey,
      to: formattedPhone,
      from: senderId || 'Ticketrack',
      sms: message,
      type: 'plain',
      channel: 'dnd', // Use DND channel for better delivery rates in Nigeria
    };

    console.log('Sending SMS via Termii:', { to: formattedPhone, from: payload.from, length: message.length });

    const response = await fetch(`${TERMII_API_URL}/sms/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    console.log('Termii response:', data);
    
    // Termii success indicators
    if (data.code === 'ok' || (response.ok && data.message_id)) {
      return { 
        success: true, 
        messageId: data.message_id || data.smsId 
      };
    }
    
    // Enhanced error handling for common Termii errors
    let errorMessage = data.message || 'Failed to send SMS';
    if (data.code === 'InvalidPhoneNumber') {
      errorMessage = 'Invalid phone number format';
    } else if (data.code === 'InsufficientBalance') {
      errorMessage = 'Insufficient Termii balance';
    } else if (data.code === 'InvalidSenderId') {
      errorMessage = 'Invalid sender ID';
    }
    
    return { success: false, error: errorMessage };
  } catch (error) {
    console.error('Termii error:', error);
    return { success: false, error: `Network error: ${error.message}` };
  }
}

async function sendTwilioSMS(
  to: string, 
  message: string, 
  accountSid: string, 
  authToken: string, 
  fromNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const formattedTo = '+' + formatPhoneNumber(to);
    const credentials = btoa(`${accountSid}:${authToken}`);
    
    const formData = new URLSearchParams();
    formData.append('To', formattedTo);
    formData.append('From', fromNumber);
    formData.append('Body', message);

    const response = await fetch(
      `${TWILIO_API_URL}/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );
    
    const data = await response.json();
    console.log('Twilio response:', data);
    
    if (response.ok && data.sid) {
      return { success: true, messageId: data.sid };
    }
    return { success: false, error: data.message || 'Failed to send SMS via Twilio' };
  } catch (error) {
    console.error('Twilio error:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organizer_id, audience_type, event_id, message, campaign_name } = await req.json();

    // Validation
    if (!organizer_id || !audience_type || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizer_id, audience_type, message' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (audience_type === 'event_attendees' && !event_id) {
      return new Response(
        JSON.stringify({ error: 'event_id required for event_attendees audience' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organizer
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('id, business_name')
      .eq('id', organizer_id)
      .single();
    
    if (orgError || !organizer) {
      return new Response(
        JSON.stringify({ error: 'Organizer not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify event ownership if event_id provided
    if (event_id) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, organizer_id')
        .eq('id', event_id)
        .single();
      
      if (eventError || !event) {
        return new Response(
          JSON.stringify({ error: 'Event not found' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (event.organizer_id !== organizer_id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Event does not belong to this organizer' }), 
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get ALL SMS providers
    const { data: smsConfigs, error: configError } = await supabase
      .from('platform_sms_config')
      .select('*')
      .eq('is_active', true);
    
    if (configError || !smsConfigs || smsConfigs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build provider lookup by country
    const providerByCountry: Record<string, any> = {};
    for (const config of smsConfigs) {
      const countries = config.supported_countries || [];
      for (const country of countries) {
        providerByCountry[country] = config;
      }
    }
    // Default provider (Termii for Nigeria, Ghana, Kenya, South Africa, etc.)
    const defaultProvider = smsConfigs.find(c => c.provider === 'termii') || smsConfigs[0];

    // Gather recipients
    let recipients: { phone: string; name: string }[] = [];

    if (audience_type === 'event_attendees') {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('attendee_phone, attendee_name')
        .eq('event_id', event_id)
        .eq('payment_status', 'completed')
        .not('attendee_phone', 'is', null);
      
      if (ticketsError) throw ticketsError;
      recipients = (tickets || [])
        .filter(t => t.attendee_phone)
        .map(t => ({ phone: t.attendee_phone, name: t.attendee_name }));
    } else if (audience_type === 'followers') {
      const { data: followers, error: followersError } = await supabase
        .from('followers')
        .select('profiles:user_id (phone, full_name)')
        .eq('organizer_id', organizer_id);
      
      if (followersError) throw followersError;
      recipients = (followers || [])
        .filter(f => f.profiles?.phone)
        .map(f => ({ phone: f.profiles.phone, name: f.profiles.full_name || 'Follower' }));
    } else if (audience_type === 'all_contacts') {
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', organizer_id);
      
      const eventIds = (events || []).map(e => e.id);
      
      if (eventIds.length > 0) {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('attendee_phone, attendee_name')
          .in('event_id', eventIds)
          .eq('payment_status', 'completed')
          .not('attendee_phone', 'is', null);
        
        (tickets || []).forEach(t => {
          if (t.attendee_phone) recipients.push({ phone: t.attendee_phone, name: t.attendee_name });
        });
      }

      const { data: followers } = await supabase
        .from('followers')
        .select('profiles:user_id (phone, full_name)')
        .eq('organizer_id', organizer_id);
      
      (followers || []).forEach(f => {
        if (f.profiles?.phone) recipients.push({ phone: f.profiles.phone, name: f.profiles.full_name || 'Follower' });
      });
    }

    // Deduplicate by phone number
    const uniquePhones = new Map<string, { phone: string; name: string }>();
    recipients.forEach(r => {
      const formatted = formatPhoneNumber(r.phone);
      if (formatted && !uniquePhones.has(formatted)) {
        uniquePhones.set(formatted, r);
      }
    });
    recipients = Array.from(uniquePhones.values());

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients with phone numbers found' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate credits needed
    const messageLength = message.length;
    const smsSegments = Math.ceil(messageLength / 160) || 1;
    const creditsNeeded = recipients.length * smsSegments;

    // Check wallet balance
    const { data: wallet } = await supabase
      .from('organizer_sms_wallet')
      .select('balance, total_used')
      .eq('organizer_id', organizer_id)
      .single();
    
    const currentBalance = wallet?.balance || 0;

    if (currentBalance < creditsNeeded) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient SMS credits', 
          credits_needed: creditsNeeded, 
          credits_available: currentBalance 
        }), 
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from('sms_campaigns')
      .insert({
        organizer_id,
        event_id: event_id || null,
        campaign_name: campaign_name || `SMS Campaign ${new Date().toISOString()}`,
        message,
        audience_type,
        recipient_count: recipients.length,
        sms_segments: smsSegments,
        credits_used: creditsNeeded,
        status: 'sending',
      })
      .select()
      .single();

    if (campaignError) console.error('Failed to create campaign:', campaignError);

    // Send messages
    const results = { total: recipients.length, sent: 0, failed: 0, logs: [] as any[] };

    for (const recipient of recipients) {
      const country = detectCountryFromPhone(recipient.phone);
      const provider = providerByCountry[country] || defaultProvider;
      
      let result: { success: boolean; messageId?: string; error?: string };

      if (provider.provider === 'twilio') {
        result = await sendTwilioSMS(
          recipient.phone, 
          message, 
          provider.api_key,      // Account SID
          provider.secret_key,   // Auth Token
          provider.sender_id     // From number
        );
      } else {
        // Default to Termii
        result = await sendTermiiSMS(
          recipient.phone, 
          message, 
          provider.api_key, 
          provider.sender_id || 'Ticketrack'
        );
      }

      if (result.success) results.sent++;
      else results.failed++;

      results.logs.push({
        organizer_id,
        campaign_id: campaign?.id,
        masked_phone: maskPhone(recipient.phone),
        recipient_name: recipient.name,
        status: result.success ? 'delivered' : 'failed',
        error_message: result.error || null,
        message_id: result.messageId || null,
        provider: provider.provider,
        created_at: new Date().toISOString(),
      });

      // Rate limiting - slight delay between messages
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Save logs
    if (results.logs.length > 0) {
      await supabase.from('sms_logs').insert(results.logs);
    }

    // Deduct credits
    const newBalance = currentBalance - creditsNeeded;
    await supabase
      .from('organizer_sms_wallet')
      .update({ 
        balance: newBalance, 
        total_used: (wallet?.total_used || 0) + creditsNeeded, 
        updated_at: new Date().toISOString() 
      })
      .eq('organizer_id', organizer_id);

    // Log credit usage
    await supabase.from('sms_credit_usage').insert({
      organizer_id,
      credits_used: creditsNeeded,
      sms_count: recipients.length * smsSegments,
      recipient_count: recipients.length,
      event_id: event_id || null,
      balance_before: currentBalance,
      balance_after: newBalance,
    });

    // Update campaign status
    if (campaign) {
      await supabase
        .from('sms_campaigns')
        .update({ 
          status: results.failed === 0 ? 'completed' : 'partial', 
          sent_count: results.sent, 
          failed_count: results.failed, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', campaign.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaign_id: campaign?.id, 
        recipients: results.total, 
        sent: results.sent, 
        failed: results.failed, 
        credits_used: creditsNeeded, 
        new_balance: newBalance 
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SMS Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
