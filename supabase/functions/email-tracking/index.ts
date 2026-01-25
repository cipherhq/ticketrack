// Email Tracking Endpoint
// Handles: Tracking pixel (opens) and click redirects

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get tracking parameters
    const trackingId = url.searchParams.get('t');
    const linkCode = url.searchParams.get('l');
    const redirectUrl = url.searchParams.get('r');

    // Get client info
    const userAgent = req.headers.get('user-agent') || '';
    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip');
    const ipAddress = ipHeader?.split(',')[0]?.trim() || null;

    // ========================================
    // OPEN TRACKING (Pixel)
    // ========================================
    // URL format: /email-tracking?t=TRACKING_ID
    if (trackingId && !linkCode && !redirectUrl) {
      console.log(`Email open tracked: ${trackingId}`);

      // Record the open event asynchronously
      recordOpenEvent(supabase, trackingId, userAgent, ipAddress);

      // Return 1x1 transparent GIF
      return new Response(TRACKING_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...corsHeaders,
        },
      });
    }

    // ========================================
    // CLICK TRACKING (Redirect)
    // ========================================
    // URL format: /email-tracking?t=TRACKING_ID&l=LINK_CODE&r=ENCODED_URL
    if (trackingId && (linkCode || redirectUrl)) {
      console.log(`Email click tracked: ${trackingId}, link: ${linkCode || redirectUrl}`);

      let finalUrl = redirectUrl ? decodeURIComponent(redirectUrl) : null;

      // If using short code, look up the original URL
      if (linkCode && !finalUrl) {
        const { data: link } = await supabase
          .from('email_tracked_links')
          .select('original_url')
          .eq('short_code', linkCode)
          .single();

        if (link) {
          finalUrl = link.original_url;

          // Update click count
          await supabase
            .from('email_tracked_links')
            .update({ 
              total_clicks: supabase.sql`total_clicks + 1`,
            })
            .eq('short_code', linkCode);
        }
      }

      // Record the click event
      if (trackingId) {
        recordClickEvent(supabase, trackingId, finalUrl || redirectUrl || linkCode, userAgent, ipAddress);
      }

      // Redirect to original URL
      if (finalUrl) {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': finalUrl,
            'Cache-Control': 'no-store',
            ...corsHeaders,
          },
        });
      }

      // Fallback to home page if URL not found
      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://ticketrack.com',
          ...corsHeaders,
        },
      });
    }

    // ========================================
    // API: Get tracking stats
    // ========================================
    if (req.method === 'GET' && url.searchParams.get('stats') === 'true') {
      const campaignId = url.searchParams.get('campaign_id');
      
      if (!campaignId) {
        return new Response(
          JSON.stringify({ error: 'campaign_id required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get analytics
      const { data: analytics } = await supabase
        .from('email_campaign_analytics')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();

      // Get recent events
      const { data: recentEvents } = await supabase
        .from('email_tracking_events')
        .select('event_type, first_event_at, device_type, email_client')
        .eq('campaign_id', campaignId)
        .order('first_event_at', { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({ 
          analytics: analytics || {},
          recentEvents: recentEvents || [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Default response
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Email tracking error:', error);
    
    // For tracking pixel requests, still return the pixel even on error
    if (url.searchParams.get('t') && !url.searchParams.get('l')) {
      return new Response(TRACKING_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function recordOpenEvent(
  supabase: any,
  trackingId: string,
  userAgent: string,
  ipAddress: string | null
): Promise<void> {
  try {
    // Parse tracking ID: format is "campaignId_messageId_recipientHash" or "messageId_recipientHash"
    const parts = trackingId.split('_');
    const campaignId = parts.length >= 2 ? parts[0] : null;
    const messageId = parts.length >= 2 ? parts[1] : parts[0];

    // Detect device type
    let deviceType = 'desktop';
    if (userAgent.match(/mobile|android|iphone/i)) {
      deviceType = 'mobile';
    } else if (userAgent.match(/tablet|ipad/i)) {
      deviceType = 'tablet';
    }

    // Detect email client
    let emailClient = 'other';
    if (userAgent.match(/gmail|googleimageproxy/i)) {
      emailClient = 'gmail';
    } else if (userAgent.match(/outlook|microsoft/i)) {
      emailClient = 'outlook';
    } else if (userAgent.match(/applemail|apple.*mail/i)) {
      emailClient = 'apple_mail';
    } else if (userAgent.match(/yahoo/i)) {
      emailClient = 'yahoo';
    }

    // Check for existing open event
    const { data: existing } = await supabase
      .from('email_tracking_events')
      .select('id, event_count')
      .eq('tracking_id', trackingId)
      .eq('event_type', 'open')
      .single();

    if (existing) {
      // Update count
      await supabase
        .from('email_tracking_events')
        .update({
          event_count: existing.event_count + 1,
          last_event_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Get campaign and message info
      let organizerId = null;
      let recipientEmail = null;

      if (campaignId) {
        const { data: campaign } = await supabase
          .from('communication_campaigns')
          .select('organizer_id')
          .eq('id', campaignId)
          .single();
        
        organizerId = campaign?.organizer_id;
      }

      if (messageId) {
        const { data: message } = await supabase
          .from('communication_messages')
          .select('organizer_id, recipient_email')
          .eq('id', messageId)
          .single();
        
        if (message) {
          organizerId = organizerId || message.organizer_id;
          recipientEmail = message.recipient_email;
        }
      }

      // Insert new event
      await supabase
        .from('email_tracking_events')
        .insert({
          tracking_id: trackingId,
          event_type: 'open',
          campaign_id: campaignId,
          message_id: messageId,
          organizer_id: organizerId,
          recipient_email: recipientEmail,
          user_agent: userAgent,
          ip_address: ipAddress,
          device_type: deviceType,
          email_client: emailClient,
        });
    }

    // Update campaign analytics if we have campaign_id
    if (campaignId) {
      await supabase.rpc('update_campaign_analytics', { p_campaign_id: campaignId });
    }

  } catch (error) {
    console.error('Error recording open event:', error);
  }
}

async function recordClickEvent(
  supabase: any,
  trackingId: string,
  linkUrl: string,
  userAgent: string,
  ipAddress: string | null
): Promise<void> {
  try {
    const parts = trackingId.split('_');
    const campaignId = parts.length >= 2 ? parts[0] : null;
    const messageId = parts.length >= 2 ? parts[1] : parts[0];

    // Detect device type
    let deviceType = 'desktop';
    if (userAgent.match(/mobile|android|iphone/i)) {
      deviceType = 'mobile';
    } else if (userAgent.match(/tablet|ipad/i)) {
      deviceType = 'tablet';
    }

    // Check for existing click on this link by this recipient
    const clickTrackingId = `${trackingId}_${hashString(linkUrl)}`;
    
    const { data: existing } = await supabase
      .from('email_tracking_events')
      .select('id, event_count')
      .eq('tracking_id', clickTrackingId)
      .eq('event_type', 'click')
      .single();

    if (existing) {
      await supabase
        .from('email_tracking_events')
        .update({
          event_count: existing.event_count + 1,
          last_event_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Get campaign/message info
      let organizerId = null;
      let recipientEmail = null;

      if (campaignId) {
        const { data: campaign } = await supabase
          .from('communication_campaigns')
          .select('organizer_id')
          .eq('id', campaignId)
          .single();
        
        organizerId = campaign?.organizer_id;
      }

      if (messageId) {
        const { data: message } = await supabase
          .from('communication_messages')
          .select('organizer_id, recipient_email')
          .eq('id', messageId)
          .single();
        
        if (message) {
          organizerId = organizerId || message.organizer_id;
          recipientEmail = message.recipient_email;
        }
      }

      // Insert click event
      await supabase
        .from('email_tracking_events')
        .insert({
          tracking_id: clickTrackingId,
          event_type: 'click',
          campaign_id: campaignId,
          message_id: messageId,
          organizer_id: organizerId,
          recipient_email: recipientEmail,
          link_url: linkUrl,
          user_agent: userAgent,
          ip_address: ipAddress,
          device_type: deviceType,
        });
    }

    // Update campaign analytics
    if (campaignId) {
      await supabase.rpc('update_campaign_analytics', { p_campaign_id: campaignId });
    }

  } catch (error) {
    console.error('Error recording click event:', error);
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
