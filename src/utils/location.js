/**
 * Location utilities for calculating distances and managing geolocation
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c
  
  return distance
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180)
}

/**
 * Get user's current location using browser Geolocation API
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (error) => {
        // User denied permission or location unavailable
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // Cache for 5 minutes
      }
    )
  })
}

/**
 * Sort events by distance from user location
 * @param {Array} events - Array of events with venue_lat and venue_lng
 * @param {number} userLat - User's latitude
 * @param {number} userLng - User's longitude
 * @returns {Array} Sorted events with distance property added
 */
export function sortEventsByDistance(events, userLat, userLng) {
  return events
    .map(event => {
      if (event.venue_lat && event.venue_lng) {
        const distance = calculateDistance(
          userLat,
          userLng,
          parseFloat(event.venue_lat),
          parseFloat(event.venue_lng)
        )
        return {
          ...event,
          distance
        }
      }
      // Events without coordinates go to the end
      return {
        ...event,
        distance: Infinity
      }
    })
    .sort((a, b) => a.distance - b.distance)
}

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance (e.g., "5.2 km" or "2.1 mi")
 */
export function formatDistance(distance, useMiles = false) {
  if (distance === Infinity || !distance) {
    return 'Unknown'
  }
  
  if (useMiles) {
    const miles = distance * 0.621371
    return miles < 1 
      ? `${Math.round(miles * 10) / 10} mi`
      : `${Math.round(miles)} mi`
  }
  
  return distance < 1 
    ? `${Math.round(distance * 10) / 10} km`
    : `${Math.round(distance)} km`
}

/**
 * Get user's country code from coordinates using reverse geocoding
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string|null>} Country code (e.g., 'US', 'NG', 'GB') or null if unavailable
 */
export async function getCountryFromCoordinates(lat, lng) {
  try {
    // Use Google Maps Geocoding API if available
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder()
      
      return new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            // Find country in address components
            const countryComponent = results[0].address_components?.find(
              component => component.types.includes('country')
            )
            
            if (countryComponent) {
              resolve(countryComponent.short_name) // Returns ISO 3166-1 alpha-2 code (e.g., 'US')
            } else {
              resolve(null)
            }
          } else {
            resolve(null)
          }
        })
      })
    }
    
    // Fallback: Use a free reverse geocoding service (OpenStreetMap Nominatim)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'User-Agent': 'Ticketrack'
        }
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      return data.address?.country_code?.toUpperCase() || null
    }
    
    return null
  } catch (error) {
    console.error('Error getting country from coordinates:', error)
    return null
  }
}

/**
 * Get user's country code from their current location
 * @returns {Promise<{countryCode: string, lat: number, lng: number} | null>}
 */
export async function getUserCountry() {
  try {
    const location = await getUserLocation()
    const countryCode = await getCountryFromCoordinates(location.lat, location.lng)
    
    if (countryCode) {
      return {
        countryCode,
        lat: location.lat,
        lng: location.lng
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting user country:', error)
    return null
  }
}

// Cache for IP-based country detection
let cachedCountryCode = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Get user's country code from IP address (no permission needed)
 * Uses multiple free APIs with fallbacks
 * @returns {Promise<string>} Country code (e.g., 'US', 'NG', 'GB') - defaults to 'GB' if detection fails
 */
export async function getCountryFromIP() {
  // Check cache first
  if (cachedCountryCode && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedCountryCode
  }

  // Check localStorage cache
  try {
    const stored = localStorage.getItem('user_country_code')
    const storedTime = localStorage.getItem('user_country_code_time')
    if (stored && storedTime && (Date.now() - parseInt(storedTime) < CACHE_DURATION)) {
      cachedCountryCode = stored
      cacheTimestamp = parseInt(storedTime)
      return stored
    }
  } catch (e) {
    // localStorage not available
  }

  // Supported countries mapping
  const supportedCountries = ['NG', 'GH', 'US', 'GB', 'CA', 'KE', 'ZA']
  
  try {
    // Try ip-api.com first (free, no key needed, 45 req/min)
    const response = await fetch('http://ip-api.com/json/?fields=countryCode', {
      signal: AbortSignal.timeout(3000) // 3 second timeout
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.countryCode && supportedCountries.includes(data.countryCode)) {
        cacheCountry(data.countryCode)
        return data.countryCode
      }
    }
  } catch (e) {
    // Try fallback
  }

  try {
    // Fallback: ipapi.co (free tier: 1000/day)
    const response = await fetch('https://ipapi.co/country/', {
      signal: AbortSignal.timeout(3000)
    })
    
    if (response.ok) {
      const countryCode = (await response.text()).trim().toUpperCase()
      if (supportedCountries.includes(countryCode)) {
        cacheCountry(countryCode)
        return countryCode
      }
    }
  } catch (e) {
    // Both failed
  }

  // Try browser language/timezone as last resort
  const browserCountry = getCountryFromBrowser()
  if (browserCountry && supportedCountries.includes(browserCountry)) {
    cacheCountry(browserCountry)
    return browserCountry
  }

  // Default to GB (most neutral for international platform)
  return 'GB'
}

/**
 * Cache the detected country
 */
function cacheCountry(countryCode) {
  cachedCountryCode = countryCode
  cacheTimestamp = Date.now()
  try {
    localStorage.setItem('user_country_code', countryCode)
    localStorage.setItem('user_country_code_time', cacheTimestamp.toString())
  } catch (e) {
    // localStorage not available
  }
}

/**
 * Get country from browser language/timezone
 * @returns {string|null}
 */
function getCountryFromBrowser() {
  // Try navigator.language
  const lang = navigator.language || navigator.userLanguage
  if (lang) {
    const langCountry = lang.split('-')[1]?.toUpperCase()
    if (langCountry) return langCountry
  }

  // Try timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (timezone) {
    const tzCountryMap = {
      'Africa/Lagos': 'NG',
      'Africa/Accra': 'GH',
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'Europe/London': 'GB',
      'Africa/Nairobi': 'KE',
      'Africa/Johannesburg': 'ZA',
    }
    return tzCountryMap[timezone] || null
  }

  return null
}
