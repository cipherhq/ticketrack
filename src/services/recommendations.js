import { supabase } from '@/lib/supabase';

/**
 * Recommendations Service
 * Personalized event discovery based on user behavior
 */

// Record a user interaction with an event
export async function recordInteraction(eventId, interactionType, source = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // Only track for logged-in users

  try {
    await supabase.rpc('record_event_interaction', {
      p_user_id: user.id,
      p_event_id: eventId,
      p_interaction_type: interactionType,
      p_source: source
    });
  } catch (err) {
    // Silently fail - don't interrupt user experience for tracking
    console.debug('Interaction tracking failed:', err);
  }
}

// Record event view
export async function recordEventView(eventId, source = 'direct') {
  await recordInteraction(eventId, 'view', source);
}

// Record event share
export async function recordEventShare(eventId) {
  await recordInteraction(eventId, 'share', 'direct');
}

// Record cart add
export async function recordCartAdd(eventId) {
  await recordInteraction(eventId, 'cart_add', 'checkout');
}

// Record purchase
export async function recordPurchase(eventId) {
  await recordInteraction(eventId, 'purchase', 'checkout');
}

// Toggle saved event (like/unlike)
export async function toggleSavedEvent(eventId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to save events');

  const { data, error } = await supabase.rpc('toggle_saved_event', {
    p_user_id: user.id,
    p_event_id: eventId
  });

  if (error) throw error;
  return data; // Returns true if now saved, false if unsaved
}

// Check if event is saved
export async function isEventSaved(eventId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('saved_events')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// Get user's saved events
export async function getSavedEvents(limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('saved_events')
    .select(`
      id,
      created_at,
      event:events(
        id, title, slug, image_url, start_date, end_date,
        venue_name, city, currency, event_type, category,
        ticket_types(price)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Filter out events that have passed
  const now = new Date();
  return (data || [])
    .filter(item => item.event && new Date(item.event.start_date) > now)
    .map(item => ({
      ...item.event,
      saved_at: item.created_at,
      min_price: ((prices) => prices.length ? Math.min(...prices) : 0)((item.event.ticket_types || []).map(t => t.price).filter(p => p > 0))
    }));
}

// Get personalized recommendations
export async function getPersonalizedRecommendations(limit = 20, offset = 0) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Logged in user - get personalized recommendations
    const { data, error } = await supabase.rpc('get_personalized_recommendations', {
      p_user_id: user.id,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error('Error fetching recommendations:', error);
      return getTrendingEvents(limit, offset);
    }

    return data || [];
  } else {
    // Anonymous user - return trending events
    return getTrendingEvents(limit, offset);
  }
}

// Get trending events (fallback for anonymous users)
export async function getTrendingEvents(limit = 20, offset = 0) {
  const { data, error } = await supabase
    .from('events')
    .select(`
      id, title, slug, image_url, start_date, end_date,
      venue_name, city, currency, event_type, category,
      ticket_types(price)
    `)
    .eq('status', 'published')
    .gt('start_date', new Date().toISOString())
    .order('start_date', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data || []).map(event => ({
    ...event,
    min_price: ((prices) => prices.length ? Math.min(...prices) : 0)((event.ticket_types || []).map(t => t.price).filter(p => p > 0)),
    recommendation_score: 0.5,
    recommendation_reasons: ['Upcoming event', 'Don\'t miss out!']
  }));
}

// Get events by category with personalization boost
export async function getEventsByCategory(category, limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('events')
    .select(`
      id, title, slug, image_url, start_date, end_date,
      venue_name, city, currency, event_type, category,
      ticket_types(price)
    `)
    .eq('status', 'published')
    .eq('category', category)
    .gt('start_date', new Date().toISOString())
    .order('start_date', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(event => ({
    ...event,
    min_price: ((prices) => prices.length ? Math.min(...prices) : 0)((event.ticket_types || []).map(t => t.price).filter(p => p > 0))
  }));
}

// Get similar events
export async function getSimilarEvents(eventId, limit = 6) {
  // Get the event details first
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('category, event_type, city')
    .eq('id', eventId)
    .single();

  if (eventError || !event) return [];

  // Find similar events based on category, event type, or city
  const { data, error } = await supabase
    .from('events')
    .select(`
      id, title, slug, image_url, start_date, end_date,
      venue_name, city, currency, event_type, category,
      ticket_types(price)
    `)
    .eq('status', 'published')
    .neq('id', eventId)
    .gt('start_date', new Date().toISOString())
    .or(`category.eq.${event.category},event_type.eq.${event.event_type},city.eq.${event.city}`)
    .order('start_date', { ascending: true })
    .limit(limit);

  if (error) return [];

  return (data || []).map(e => ({
    ...e,
    min_price: Math.min(...(e.ticket_types || []).map(t => t.price).filter(p => p > 0)) || 0
  }));
}

// Get user preferences
export async function getUserPreferences() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return null;
  return data;
}

// Update user preferences
export async function updateUserPreferences(preferences) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in');

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      ...preferences,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get inferred preferences from purchase history
export async function getInferredPreferences() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_inferred_preferences', {
    p_user_id: user.id
  });

  if (error) return null;
  return data;
}

// Get "For You" feed with mixed content
export async function getForYouFeed(limit = 30) {
  const recommendations = await getPersonalizedRecommendations(limit);
  
  // Add variety by mixing in some random upcoming events
  const trending = await getTrendingEvents(10);
  
  // Merge and dedupe
  const seen = new Set();
  const feed = [];
  
  // Add recommendations first (they're scored)
  for (const event of recommendations) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      feed.push({ ...event, source: 'recommended' });
    }
  }
  
  // Add some trending events
  for (const event of trending) {
    if (!seen.has(event.id) && feed.length < limit) {
      seen.add(event.id);
      feed.push({ ...event, source: 'trending' });
    }
  }
  
  // Sort by score, then by date
  return feed.sort((a, b) => {
    // Recommendations first
    if (a.source === 'recommended' && b.source !== 'recommended') return -1;
    if (b.source === 'recommended' && a.source !== 'recommended') return 1;
    // Then by score
    const scoreDiff = (b.recommendation_score || 0) - (a.recommendation_score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    // Then by date
    return new Date(a.start_date) - new Date(b.start_date);
  });
}
