/**
 * Timezone utilities for event creation
 * Uses IANA timezone format with friendly city/country labels
 */

// Comprehensive timezone list with city/country format
export const timezones = [
  // Africa
  { value: 'Africa/Lagos', label: 'Lagos, Nigeria', region: 'Africa' },
  { value: 'Africa/Accra', label: 'Accra, Ghana', region: 'Africa' },
  { value: 'Africa/Nairobi', label: 'Nairobi, Kenya', region: 'Africa' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg, South Africa', region: 'Africa' },
  { value: 'Africa/Cairo', label: 'Cairo, Egypt', region: 'Africa' },
  { value: 'Africa/Casablanca', label: 'Casablanca, Morocco', region: 'Africa' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam, Tanzania', region: 'Africa' },
  { value: 'Africa/Kampala', label: 'Kampala, Uganda', region: 'Africa' },
  { value: 'Africa/Kigali', label: 'Kigali, Rwanda', region: 'Africa' },
  { value: 'Africa/Addis_Ababa', label: 'Addis Ababa, Ethiopia', region: 'Africa' },
  { value: 'Africa/Dakar', label: 'Dakar, Senegal', region: 'Africa' },
  { value: 'Africa/Abidjan', label: 'Abidjan, Ivory Coast', region: 'Africa' },
  { value: 'Africa/Douala', label: 'Douala, Cameroon', region: 'Africa' },
  
  // Americas
  { value: 'America/New_York', label: 'New York, USA', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago, USA', region: 'Americas' },
  { value: 'America/Denver', label: 'Denver, USA', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, USA', region: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto, Canada', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Vancouver, Canada', region: 'Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City, Mexico', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo, Brazil', region: 'Americas' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires, Argentina', region: 'Americas' },
  { value: 'America/Bogota', label: 'Bogotá, Colombia', region: 'Americas' },
  { value: 'America/Lima', label: 'Lima, Peru', region: 'Americas' },
  
  // Europe
  { value: 'Europe/London', label: 'London, UK', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris, France', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin, Germany', region: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid, Spain', region: 'Europe' },
  { value: 'Europe/Rome', label: 'Rome, Italy', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam, Netherlands', region: 'Europe' },
  { value: 'Europe/Brussels', label: 'Brussels, Belgium', region: 'Europe' },
  { value: 'Europe/Dublin', label: 'Dublin, Ireland', region: 'Europe' },
  { value: 'Europe/Zurich', label: 'Zurich, Switzerland', region: 'Europe' },
  { value: 'Europe/Stockholm', label: 'Stockholm, Sweden', region: 'Europe' },
  { value: 'Europe/Warsaw', label: 'Warsaw, Poland', region: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscow, Russia', region: 'Europe' },
  
  // Asia
  { value: 'Asia/Dubai', label: 'Dubai, UAE', region: 'Asia' },
  { value: 'Asia/Riyadh', label: 'Riyadh, Saudi Arabia', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Mumbai, India', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore', region: 'Asia' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Japan', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul, South Korea', region: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Shanghai, China', region: 'Asia' },
  { value: 'Asia/Jakarta', label: 'Jakarta, Indonesia', region: 'Asia' },
  { value: 'Asia/Bangkok', label: 'Bangkok, Thailand', region: 'Asia' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur, Malaysia', region: 'Asia' },
  
  // Oceania
  { value: 'Australia/Sydney', label: 'Sydney, Australia', region: 'Oceania' },
  { value: 'Australia/Melbourne', label: 'Melbourne, Australia', region: 'Oceania' },
  { value: 'Australia/Perth', label: 'Perth, Australia', region: 'Oceania' },
  { value: 'Pacific/Auckland', label: 'Auckland, New Zealand', region: 'Oceania' },
];

/**
 * Get user's timezone from browser
 * @returns {string} IANA timezone string (e.g., 'America/New_York')
 */
export function detectUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    console.warn('Could not detect timezone:', e);
    return 'Africa/Lagos'; // Default fallback
  }
}

/**
 * Find the best matching timezone from our list
 * @param {string} detectedTimezone - The detected IANA timezone
 * @returns {string} The matching timezone value or a default
 */
export function findMatchingTimezone(detectedTimezone) {
  // Direct match
  const directMatch = timezones.find(tz => tz.value === detectedTimezone);
  if (directMatch) {
    return directMatch.value;
  }

  // Try to match by region (e.g., America/Detroit -> America/New_York)
  const region = detectedTimezone.split('/')[0];
  const regionMatch = timezones.find(tz => tz.value.startsWith(region));
  if (regionMatch) {
    return regionMatch.value;
  }

  // Default to Lagos for Africa-focused platform
  return 'Africa/Lagos';
}

/**
 * Get user's timezone, with smart fallback
 * @returns {string} Best matching timezone value
 */
export function getUserTimezone() {
  const detected = detectUserTimezone();
  return findMatchingTimezone(detected);
}

/**
 * Format timezone for display with current offset
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted string (e.g., "New York, USA (UTC-5)")
 */
export function formatTimezoneWithOffset(timezone) {
  const tz = timezones.find(t => t.value === timezone);
  if (!tz) return timezone;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    const offset = offsetPart ? offsetPart.value : '';
    
    return `${tz.label} (${offset})`;
  } catch (e) {
    return tz.label;
  }
}

/**
 * Get timezones grouped by region for better UX
 * @returns {Object} Timezones grouped by region
 */
export function getTimezonesByRegion() {
  return timezones.reduce((acc, tz) => {
    if (!acc[tz.region]) {
      acc[tz.region] = [];
    }
    acc[tz.region].push(tz);
    return acc;
  }, {});
}
