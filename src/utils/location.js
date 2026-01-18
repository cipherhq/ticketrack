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
