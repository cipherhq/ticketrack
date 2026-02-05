/**
 * Centralized Minimum Payout Thresholds
 *
 * These thresholds define the minimum amount required to process a payout
 * for each supported currency. Payouts below these amounts will be held
 * until they reach the minimum threshold.
 */

export const MINIMUM_PAYOUTS = {
  NGN: 1000,   // Nigerian Naira
  GHS: 10,     // Ghanaian Cedi
  USD: 5,      // US Dollar
  GBP: 5,      // British Pound
  EUR: 5,      // Euro
  KES: 500,    // Kenyan Shilling
  ZAR: 50,     // South African Rand
  CAD: 5,      // Canadian Dollar
  AUD: 5,      // Australian Dollar
};

/**
 * Get the minimum payout threshold for a currency
 * @param {string} currency - The currency code (e.g., 'USD', 'NGN')
 * @returns {number} The minimum payout amount for the currency
 */
export const getMinimumPayout = (currency) => {
  return MINIMUM_PAYOUTS[currency?.toUpperCase()] || 5;
};

/**
 * Check if an amount meets the minimum payout threshold
 * @param {number} amount - The payout amount
 * @param {string} currency - The currency code
 * @returns {boolean} True if amount meets minimum threshold
 */
export const meetsMinimumPayout = (amount, currency) => {
  return amount >= getMinimumPayout(currency);
};

/**
 * Get formatted error message for below-threshold payouts
 * @param {number} amount - The payout amount
 * @param {string} currency - The currency code
 * @returns {string} Formatted error message
 */
export const getBelowThresholdMessage = (amount, currency) => {
  const minimum = getMinimumPayout(currency);
  return `Payout amount (${amount} ${currency}) is below minimum threshold (${minimum} ${currency})`;
};

/**
 * Payout delay days by event type
 * Mirrors the delay logic from auto-trigger-payouts/index.ts
 */
export const PAYOUT_DELAY_DAYS = {
  concert: 7,
  conference: 5,
  workshop: 1,
  webinar: 0,
  sports: 3,
  theater: 2,
  party: 1,
  other: 3,
};

/**
 * Get the payout delay in days based on event type and attendee count
 * @param {string} eventType - The event type (e.g., 'concert', 'webinar')
 * @param {number} attendeeCount - Number of attendees/orders
 * @returns {number} Delay in days after event ends
 */
export const getPayoutDelayDays = (eventType, attendeeCount = 0) => {
  const baseDelay = PAYOUT_DELAY_DAYS[eventType?.toLowerCase()] ?? PAYOUT_DELAY_DAYS['other'];
  let sizeAdjustment = 0;
  if (attendeeCount > 1000) sizeAdjustment = 2;
  else if (attendeeCount > 500) sizeAdjustment = 1;
  else if (attendeeCount < 50) sizeAdjustment = -1;
  return Math.max(0, baseDelay + sizeAdjustment);
};

/**
 * Calculate the expected payout date for an event
 * @param {string} eventEndDate - The event end date
 * @param {string} eventType - The event type
 * @param {number} attendeeCount - Number of attendees/orders
 * @returns {Date} The expected payout date
 */
export const calculatePayoutDate = (eventEndDate, eventType, attendeeCount = 0) => {
  const endDate = new Date(eventEndDate);
  const delayDays = getPayoutDelayDays(eventType, attendeeCount);
  return new Date(endDate.getTime() + delayDays * 24 * 60 * 60 * 1000);
};

/**
 * Get a human-readable label for the payout delay
 * @param {string} eventType - The event type
 * @param {number} attendeeCount - Number of attendees/orders
 * @returns {string} Human-readable delay label
 */
export const formatPayoutDelayLabel = (eventType, attendeeCount = 0) => {
  const days = getPayoutDelayDays(eventType, attendeeCount);
  if (days === 0) return 'Same day as event ends';
  if (days === 1) return '1 day after event ends';
  return `${days} days after event ends`;
};
