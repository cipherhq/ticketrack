import { supabase } from '@/lib/supabase'
import { brand } from '@/config/brand'

// In-memory cache for settings
let settingsCache = null
let cacheTimestamp = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch all platform settings from database
 * Uses in-memory cache to reduce DB calls
 */
export async function getPlatformSettings() {
  // Check cache validity
  if (settingsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return settingsCache
  }

  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value, category')

    if (error) {
      // Silently use defaults - table may not exist or RLS may block
      console.warn('Platform settings unavailable, using defaults')
      settingsCache = getDefaultSettings()
      cacheTimestamp = Date.now()
      return settingsCache
    }

    // Transform array to object for easy access
    const settings = { ...getDefaultSettings() } // Start with defaults
    if (data && data.length > 0) {
      for (const row of data) {
        settings[row.key] = parseSettingValue(row.value)
      }
    }

    // Update cache
    settingsCache = settings
    cacheTimestamp = Date.now()

    return settings
  } catch (err) {
    // Catch any unexpected errors
    console.warn('Settings fetch exception, using defaults')
    settingsCache = getDefaultSettings()
    cacheTimestamp = Date.now()
    return settingsCache
  }
}

/**
 * Get a single setting by key
 */
export async function getSetting(key, defaultValue = null) {
  const settings = await getPlatformSettings()
  return settings[key] ?? defaultValue
}

/**
 * Get multiple settings by keys
 */
export async function getSettings(keys) {
  const settings = await getPlatformSettings()
  const result = {}
  for (const key of keys) {
    result[key] = settings[key]
  }
  return result
}

/**
 * Get all RSVP-related settings
 */
export async function getRSVPSettings() {
  const settings = await getPlatformSettings()
  return {
    maxTicketsPerEmail: settings.rsvp_max_tickets_per_email ?? 10,
    maxTicketsPerOrder: settings.rsvp_max_tickets_per_order ?? 10,
    requirePhone: settings.rsvp_require_phone ?? true,
    freeEventOrderStatus: settings.free_event_order_status ?? 'completed',
    donationFailedStillRsvp: settings.donation_failed_still_rsvp ?? true
  }
}

/**
 * Parse setting value (stored as text in DB)
 */
function parseSettingValue(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (!isNaN(value) && value !== '') return Number(value)
  return value
}

/**
 * Default settings fallback
 */
function getDefaultSettings() {
  return {
    rsvp_max_tickets_per_email: 10,
    rsvp_max_tickets_per_order: 10,
    rsvp_require_phone: true,
    free_event_order_status: 'completed',
    donation_failed_still_rsvp: true,
    // Contact info (from brand config, can be overridden from DB)
    contact_email: brand.emails.support,
    contact_phone: brand.contact.phone,
    // Social links (from brand config, can be overridden from DB)
    social_twitter: brand.social.twitter,
    social_instagram: brand.social.instagram,
    social_facebook: brand.social.facebook,
    social_linkedin: 'https://linkedin.com/company/ticketrack'
  }
}

/**
 * Get contact information
 */
export async function getContactInfo() {
  const settings = await getPlatformSettings()
  return {
    email: settings.contact_email || brand.emails.support,
    phone: settings.contact_phone || brand.contact.phone
  }
}

/**
 * Get social media links
 */
export async function getSocialLinks() {
  const settings = await getPlatformSettings()
  return {
    twitter: settings.social_twitter || 'https://twitter.com/ticketrack',
    instagram: settings.social_instagram || 'https://instagram.com/ticketrack',
    facebook: settings.social_facebook || 'https://facebook.com/ticketrack',
    linkedin: settings.social_linkedin || 'https://linkedin.com/company/ticketrack'
  }
}

/**
 * Get currency for a country code
 * Multi-currency platform - currency is determined by country, not a global default
 */
export async function getCurrencyForCountry(countryCode) {
  const currencyMap = {
    'NG': 'NGN',  // Nigeria
    'GH': 'GHS',  // Ghana
    'US': 'USD',  // United States
    'GB': 'GBP',  // United Kingdom
    'CA': 'CAD',  // Canada
    'KE': 'KES',  // Kenya
    'ZA': 'ZAR',  // South Africa
  }
  return currencyMap[countryCode] || 'USD' // USD as neutral fallback
}

/**
 * Clear settings cache (call after admin updates settings)
 */
export function clearSettingsCache() {
  settingsCache = null
  cacheTimestamp = null
}

/**
 * Get platform statistics (cached)
 * Returns real counts from database with fallbacks
 */
let statsCache = null
let statsCacheTimestamp = null
const STATS_CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export async function getPlatformStats() {
  // Check cache
  if (statsCache && statsCacheTimestamp && (Date.now() - statsCacheTimestamp < STATS_CACHE_TTL)) {
    return statsCache
  }

  try {
    // Get counts in parallel
    const [eventsResult, ticketsResult, organizersResult, countriesResult] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organizers').select('id', { count: 'exact', head: true }),
      supabase.from('countries').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ])

    const eventsCount = eventsResult.count || 0
    const ticketsCount = ticketsResult.count || 0
    const organizersCount = organizersResult.count || 0
    const countriesCount = countriesResult.count || 0

    // Format stats with friendly suffixes
    const formatCount = (count) => {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M+`
      if (count >= 1000) return `${(count / 1000).toFixed(0)}K+`
      if (count >= 100) return `${count}+`
      return count.toString()
    }

    const stats = {
      eventsHosted: formatCount(eventsCount),
      eventsHostedRaw: eventsCount,
      ticketsSold: formatCount(ticketsCount),
      ticketsSoldRaw: ticketsCount,
      organizers: formatCount(organizersCount),
      organizersRaw: organizersCount,
      countries: countriesCount.toString(),
      countriesRaw: countriesCount
    }

    // Cache results
    statsCache = stats
    statsCacheTimestamp = Date.now()

    return stats
  } catch (err) {
    console.warn('Error fetching platform stats, using defaults:', err.message)
    // Return fallback values
    return {
      eventsHosted: '100+',
      eventsHostedRaw: 100,
      ticketsSold: '1K+',
      ticketsSoldRaw: 1000,
      organizers: '50+',
      organizersRaw: 50,
      countries: '6',
      countriesRaw: 6
    }
  }
}

/**
 * Clear stats cache (call after significant data changes)
 */
export function clearStatsCache() {
  statsCache = null
  statsCacheTimestamp = null
}

/**
 * Check if user has reached RSVP limit for an event
 */
export async function checkRSVPLimit(eventId, email) {
  if (!eventId || !email) {
    // Return default allowed if missing params
    return { allowed: true, current: 0, max: 10, remaining: 10 }
  }

  try {
    const settings = await getRSVPSettings()
    
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('attendee_email', email)
      .eq('status', 'active')

    if (error) {
      // Silently fail and allow the RSVP - don't block users due to DB issues
      console.warn('RSVP limit check failed, defaulting to allowed:', error.message)
      return { allowed: true, current: 0, max: settings.maxTicketsPerEmail, remaining: settings.maxTicketsPerEmail }
    }

    return {
      allowed: count < settings.maxTicketsPerEmail,
      current: count || 0,
      max: settings.maxTicketsPerEmail,
      remaining: Math.max(0, settings.maxTicketsPerEmail - (count || 0))
    }
  } catch (err) {
    // Catch any unexpected errors and default to allowing
    console.warn('RSVP limit check exception, defaulting to allowed:', err.message)
    return { allowed: true, current: 0, max: 10, remaining: 10 }
  }
}
