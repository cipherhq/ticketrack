import { supabase } from '@/lib/supabase';

// Send waitlist email
async function sendWaitlistEmail(type, to, data) {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { type, to, data }
    });
    if (error) console.error('Email error:', error);
  } catch (err) {
    console.error('Failed to send email:', err);
  }
}

// Join waitlist
export async function joinWaitlist(eventId, userId, email, name, phone, quantity = 1) {
  const { data, error } = await supabase.rpc('join_waitlist', {
    p_event_id: eventId,
    p_user_id: userId,
    p_email: email,
    p_name: name,
    p_phone: phone || null,
    p_quantity: quantity
  });
  
  if (error) throw error;
  
  // If successful, fetch event details and send confirmation email
  if (data.success) {
    try {
      const { data: event } = await supabase
        .from('events')
        .select('title, slug, start_date, venue_name')
        .eq('id', eventId)
        .single();
      
      if (event) {
        await sendWaitlistEmail('waitlist_joined', email, {
          name,
          position: data.position,
          eventTitle: event.title,
          eventSlug: event.slug,
          eventDate: event.start_date,
          venueName: event.venue_name || 'TBA',
          quantity,
          appUrl: window.location.origin
        });
      }
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
      // Don't fail the join if email fails
    }
  }
  
  return data;
}

// Get user's position on waitlist
export async function getWaitlistPosition(eventId, email) {
  const { data, error } = await supabase
    .from('waitlist')
    .select('id, position, status, quantity_wanted, created_at')
    .eq('event_id', eventId)
    .eq('email', email)
    .in('status', ['waiting', 'notified'])
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Get waitlist count for event
export async function getWaitlistCount(eventId) {
  const { count, error } = await supabase
    .from('waitlist')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'waiting');
  
  if (error) throw error;
  return count || 0;
}

// Cancel waitlist entry
export async function cancelWaitlist(waitlistId) {
  const { error } = await supabase
    .from('waitlist')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', waitlistId);
  
  if (error) throw error;
  return true;
}

// Get waitlist for event (organizer)
export async function getEventWaitlist(eventId) {
  const { data, error } = await supabase
    .from('waitlist')
    .select('*')
    .eq('event_id', eventId)
    .order('position', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// Notify next person (organizer) - sends email automatically
export async function notifyNextInWaitlist(eventId, hoursValid = 24) {
  const { data, error } = await supabase.rpc('notify_next_waitlist', {
    p_event_id: eventId,
    p_hours_valid: hoursValid
  });
  
  if (error) throw error;
  
  // If someone was notified, send them an email
  if (data.success && data.email) {
    try {
      const { data: event } = await supabase
        .from('events')
        .select('title, slug, start_date, venue_name')
        .eq('id', eventId)
        .single();
      
      if (event) {
        await sendWaitlistEmail('waitlist_available', data.email, {
          name: data.name,
          eventTitle: event.title,
          eventSlug: event.slug,
          eventDate: event.start_date,
          venueName: event.venue_name || 'TBA',
          quantity: data.quantity,
          purchaseToken: data.purchase_token,
          expiresAt: data.expires_at,
          appUrl: window.location.origin
        });
      }
    } catch (emailErr) {
      console.error('Notification email failed:', emailErr);
    }
  }
  
  return data;
}

// Validate purchase token
export async function validatePurchaseToken(token) {
  const { data, error } = await supabase
    .from('waitlist')
    .select('*, event:events(id, title, slug)')
    .eq('purchase_token', token)
    .eq('status', 'notified')
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error) throw error;
  return data;
}

// Mark as purchased
export async function markWaitlistPurchased(waitlistId) {
  const { error } = await supabase
    .from('waitlist')
    .update({ status: 'purchased', updated_at: new Date().toISOString() })
    .eq('id', waitlistId);
  
  if (error) throw error;
  return true;
}

// Check if event is sold out
export async function isEventSoldOut(eventId) {
  const { data, error } = await supabase
    .from('ticket_types')
    .select('quantity_available, quantity_sold')
    .eq('event_id', eventId)
    .eq('is_active', true);
  
  if (error) throw error;
  
  if (!data || data.length === 0) return false;
  
  return data.every(tt => (tt.quantity_sold || 0) >= tt.quantity_available);
}
