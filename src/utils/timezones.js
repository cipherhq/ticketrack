/**
 * Timezone utilities for event creation
 * Uses IANA timezone format with friendly city/country labels
 */

// Comprehensive timezone list with city/country format
export const timezones = [
  // Nigeria
  { value: 'Africa/Lagos', label: 'Lagos, Nigeria (WAT)', region: 'Nigeria' },

  // Ghana
  { value: 'Africa/Accra', label: 'Accra, Ghana (GMT)', region: 'Ghana' },

  // United States
  { value: 'America/New_York', label: 'Eastern Time (ET)', region: 'United States' },
  { value: 'America/Chicago', label: 'Central Time (CT)', region: 'United States' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', region: 'United States' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', region: 'United States' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', region: 'United States' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', region: 'United States' },

  // United Kingdom
  { value: 'Europe/London', label: 'London, UK (GMT/BST)', region: 'United Kingdom' },

  // Canada
  { value: 'America/Toronto', label: 'Eastern Time (ET)', region: 'Canada' },
  { value: 'America/Winnipeg', label: 'Central Time (CT)', region: 'Canada' },
  { value: 'America/Edmonton', label: 'Mountain Time (MT)', region: 'Canada' },
  { value: 'America/Vancouver', label: 'Pacific Time (PT)', region: 'Canada' },
  { value: 'America/Halifax', label: 'Atlantic Time (AT)', region: 'Canada' },
  { value: 'America/St_Johns', label: "Newfoundland Time (NT)", region: 'Canada' },
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
