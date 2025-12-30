import { supabase } from '@/lib/supabase'

// Fetch all published events with optional filters
export async function getEvents({ 
  category = null, 
  city = null, 
  search = null,
  featured = null,
  organizerId = null,
  limit = 20,
  offset = 0 
} = {}) {
  let query = supabase
    .from('events')
    .select(`
      *,
      category:categories(id, name, slug, icon),
      organizer:organizers(id, business_name, logo_url, is_verified)
    `)
    .eq('status', 'published')
    .order('start_date', { ascending: true })

  if (category) {
    query = query.eq('category_id', category)
  }

  if (city) {
    query = query.ilike('city', `%${city}%`)
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,venue_name.ilike.%${search}%`)
  }

  if (featured === true) {
    query = query.eq('is_featured', true)
  }

  if (organizerId) {
    query = query.eq('organizer_id', organizerId)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching events:', error)
    throw error
  }

  return data
}

// Fetch single event by ID or slug
export async function getEvent(idOrSlug) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)
  
  let query = supabase
    .from('events')
    .select(`
      *,
      category:categories(id, name, slug, icon),
      organizer:organizers(id, business_name, logo_url, description, is_verified, verification_level, social_twitter, social_facebook, social_instagram, total_events),
      event_days(*, event_day_activities(*)),
      event_sponsors(*)
    `)
  
  if (isUUID) {
    query = query.eq('id', idOrSlug)
  } else {
    query = query.or(`slug.eq.${idOrSlug},custom_url.eq.${idOrSlug}`)
  }
  
  const { data, error } = await query.single()

  if (error) {
    console.error('Error fetching event:', error)
    throw error
  }

  // Increment view count
  await supabase
    .from('events')
    .update({ views_count: (data.views_count || 0) + 1 })
    .eq('id', data.id)

  return data

}

// Fetch featured events
export async function getFeaturedEvents(limit = 6) {
  return getEvents({ featured: true, limit })
}

// Fetch events by category
export async function getEventsByCategory(categorySlug, limit = 20) {
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single()

  if (!category) return []

  return getEvents({ category: category.id, limit })
}

// Fetch all categories
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching categories:', error)
    throw error
  }

  return data
}

// Search events
export async function searchEvents(query, limit = 20) {
  return getEvents({ search: query, limit })
}

// Get unique cities from events
export async function getCities() {
  const { data, error } = await supabase
    .from('events')
    .select('city')
    .eq('status', 'published')

  if (error) {
    console.error('Error fetching cities:', error)
    throw error
  }

  // Get unique cities
  const cities = [...new Set(data.map(e => e.city))].filter(Boolean).sort()
  return cities
}

// Look up promoter by promo code and track click
export async function getPromoterByCode(promoCode) {
  const { data, error } = await supabase
    .from('promoters')
    .select('id, organizer_id, referral_code')
    .or(`referral_code.eq.${promoCode},short_code.eq.${promoCode}`)
    .single()

  if (error) {
    console.error('Error fetching promoter:', error)
    return null
  }

  return data
}

// Track promoter click
export async function trackPromoterClick(promoterId) {
  // Increment total_clicks on the promoter
  const { error } = await supabase.rpc('increment_promoter_clicks', { 
    promoter_id: promoterId 
  })

  // If RPC doesn't exist, fall back to manual update
  if (error) {
    await supabase
      .from('promoters')
      .update({ total_clicks: supabase.raw('total_clicks + 1') })
      .eq('id', promoterId)
  }
}
