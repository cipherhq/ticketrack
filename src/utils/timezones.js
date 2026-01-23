/**
 * Timezone utilities for event creation
 * Uses IANA timezone format with friendly city/country labels
 */

// Timezone list for supported countries: UK, US, Canada, Nigeria, Ghana
export const timezones = [
  // Africa
  { value: 'Africa/Lagos', label: 'Lagos, Nigeria', region: 'Africa' },
  { value: 'Africa/Accra', label: 'Accra, Ghana', region: 'Africa' },
  
  // UK
  { value: 'Europe/London', label: 'London, UK', region: 'Europe' },
  
  // USA
  { value: 'America/New_York', label: 'New York, USA (Eastern)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago, USA (Central)', region: 'Americas' },
  { value: 'America/Denver', label: 'Denver, USA (Mountain)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, USA (Pacific)', region: 'Americas' },
  { value: 'America/Anchorage', label: 'Anchorage, USA (Alaska)', region: 'Americas' },
  { value: 'Pacific/Honolulu', label: 'Honolulu, USA (Hawaii)', region: 'Americas' },
  
  // Canada
  { value: 'America/Toronto', label: 'Toronto, Canada (Eastern)', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Vancouver, Canada (Pacific)', region: 'Americas' },
  { value: 'America/Edmonton', label: 'Edmonton, Canada (Mountain)', region: 'Americas' },
  { value: 'America/Winnipeg', label: 'Winnipeg, Canada (Central)', region: 'Americas' },
  { value: 'America/Halifax', label: 'Halifax, Canada (Atlantic)', region: 'Americas' },
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

  // Map common timezones to our supported list
  const timezoneMapping = {
    // US timezone aliases
    'America/Detroit': 'America/New_York',
    'America/Indiana/Indianapolis': 'America/New_York',
    'America/Phoenix': 'America/Denver',
    'America/Boise': 'America/Denver',
    // Canada timezone aliases
    'America/Montreal': 'America/Toronto',
    'America/Calgary': 'America/Edmonton',
    // UK aliases
    'Europe/Belfast': 'Europe/London',
    'Europe/Dublin': 'Europe/London',
    // Africa aliases
    'Africa/Abidjan': 'Africa/Accra',
    'Africa/Bamako': 'Africa/Accra',
    'Africa/Banjul': 'Africa/Accra',
    'Africa/Conakry': 'Africa/Accra',
    'Africa/Dakar': 'Africa/Accra',
    'Africa/Freetown': 'Africa/Accra',
    'Africa/Lome': 'Africa/Accra',
    'Africa/Nouakchott': 'Africa/Accra',
    'Africa/Ouagadougou': 'Africa/Accra',
  };

  if (timezoneMapping[detectedTimezone]) {
    return timezoneMapping[detectedTimezone];
  }

  // Try to match by region (e.g., America/Detroit -> America/New_York)
  const region = detectedTimezone.split('/')[0];
  if (region === 'America') {
    return 'America/New_York'; // Default US timezone
  }
  if (region === 'Europe') {
    return 'Europe/London'; // Default UK timezone
  }
  if (region === 'Africa') {
    return 'Africa/Lagos'; // Default Nigeria timezone
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
