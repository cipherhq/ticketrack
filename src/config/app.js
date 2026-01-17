// Central application configuration
// These values can be overridden via environment variables

export const APP_CONFIG = {
  // Session Management
  SESSION_TIMEOUT_MS: parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MS) || 30 * 60 * 1000, // 30 minutes
  SESSION_WARNING_MS: parseInt(import.meta.env.VITE_SESSION_WARNING_MS) || 5 * 60 * 1000, // 5 minutes
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Image Loading
  IMAGE_LOAD_TIMEOUT_MS: 5000,
  
  // Security
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 10,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
  
  // Rate Limiting
  MAX_OTP_REQUESTS_PER_HOUR: 3,
  MAX_OTP_ATTEMPTS: 5,
};

// Export individual constants for convenience
export const SESSION_TIMEOUT_MS = APP_CONFIG.SESSION_TIMEOUT_MS;
export const SESSION_WARNING_MS = APP_CONFIG.SESSION_WARNING_MS;
export const DEFAULT_PAGE_SIZE = APP_CONFIG.DEFAULT_PAGE_SIZE;
export const OTP_LENGTH = APP_CONFIG.OTP_LENGTH;
