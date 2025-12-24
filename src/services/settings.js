import { supabase } from '@/lib/supabase'

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
      console.error('Error fetching platform settings:', error)
      // Return defaults if DB fails
      return getDefaultSettings()
    }

    // Transform array to object for easy access
    const settings = {}
    for (const row of data) {
      settings[row.key] = parseSettingValue(row.value)
    }

    // Update cache
    settingsCache = settings
    cacheTimestamp = Date.now()

    return settings
  } catch (err) {
    console.error('Settings fetch error:', err)
    return getDefaultSettings()
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
    donation_failed_still_rsvp: true
  }
}

/**
 * Clear settings cache (call after admin updates settings)
 */
export function clearSettingsCache() {
  settingsCache = null
  cacheTimestamp = null
}

/**
 * Check if user has reached RSVP limit for an event
 */
export async function checkRSVPLimit(eventId, email) {
  const settings = await getRSVPSettings()
  
  const { count, error } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('attendee_email', email)
    .eq('status', 'active')

  if (error) {
    console.error('Error checking RSVP limit:', error)
    return { allowed: true, current: 0, max: settings.maxTicketsPerEmail }
  }

  return {
    allowed: count < settings.maxTicketsPerEmail,
    current: count,
    max: settings.maxTicketsPerEmail,
    remaining: Math.max(0, settings.maxTicketsPerEmail - count)
  }
}
