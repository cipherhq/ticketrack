// Send Push Notification - Web push notification service

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID keys for web push (generate your own at https://vapidkeys.com/)
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@ticketrack.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      userId,
      organizerId,
      eventId,
      title,
      body,
      icon,
      badge,
      image,
      url,
      data,
      type = 'general', // 'event_reminder', 'ticket_purchase', 'general', 'marketing'
    } = await req.json();

    // Validation
    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions
    let subscriptions = [];

    if (userId) {
      // Send to specific user
      const { data: userSubs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      subscriptions = userSubs || [];
    } else if (organizerId && eventId) {
      // Send to all attendees of an event
      const { data: tickets } = await supabase
        .from('tickets')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('payment_status', 'completed')
        .not('user_id', 'is', null);

      const userIds = [...new Set((tickets || []).map(t => t.user_id))];

      if (userIds.length > 0) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .in('user_id', userIds)
          .eq('is_active', true);
        subscriptions = subs || [];
      }
    } else if (organizerId) {
      // Send to all followers
      const { data: followers } = await supabase
        .from('followers')
        .select('user_id')
        .eq('organizer_id', organizerId);

      const userIds = (followers || []).map(f => f.user_id);

      if (userIds.length > 0) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .in('user_id', userIds)
          .eq('is_active', true);
        subscriptions = subs || [];
      }
    }

    if (subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare notification payload
    const notificationPayload = {
      title,
      body,
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/badge-72x72.png',
      image,
      data: {
        url: url || '/',
        type,
        eventId,
        organizerId,
        ...data,
      },
      actions: getActionsForType(type, data),
      requireInteraction: type === 'event_reminder',
      tag: `${type}-${eventId || organizerId || 'general'}`,
      renotify: true,
    };

    // Send notifications
    const results = { sent: 0, failed: 0, expired: [] as string[] };

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = subscription.subscription;

        if (!pushSubscription?.endpoint) {
          results.failed++;
          continue;
        }

        // Send using Web Push protocol
        const response = await sendWebPush(pushSubscription, notificationPayload);

        if (response.status === 201 || response.status === 200) {
          results.sent++;

          // Update last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', subscription.id);
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired
          results.expired.push(subscription.id);
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id);
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error('Push send error:', error);
        results.failed++;
      }
    }

    // Log notification
    await supabase.from('communication_messages').insert({
      organizer_id: organizerId || null,
      channel: 'push',
      content: notificationPayload,
      status: results.sent > 0 ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
      metadata: {
        user_id: userId,
        event_id: eventId,
        type,
        results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getActionsForType(type: string, data: any): { action: string; title: string }[] {
  switch (type) {
    case 'event_reminder':
      return [
        { action: 'view_ticket', title: 'View Ticket' },
        { action: 'get_directions', title: 'Get Directions' },
      ];
    case 'ticket_purchase':
      return [
        { action: 'view_ticket', title: 'View Ticket' },
      ];
    case 'new_event':
      return [
        { action: 'view_event', title: 'View Event' },
        { action: 'buy_tickets', title: 'Get Tickets' },
      ];
    default:
      return [];
  }
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: any
): Promise<Response> {
  // In production, use a proper web-push library
  // This is a simplified implementation
  
  const endpoint = subscription.endpoint;
  
  // For now, we'll use a simple fetch to the push endpoint
  // A full implementation would use VAPID headers and encryption
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
      },
      body: JSON.stringify(payload),
    });
    
    return response;
  } catch (error) {
    // Return a mock response for error cases
    return new Response(null, { status: 500 });
  }
}
