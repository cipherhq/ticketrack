/**
 * Production-safe logging utility for frontend
 * 
 * - In development: All logs are output to console
 * - In production: Only errors are logged, and without sensitive details
 */

const IS_DEV = import.meta.env.DEV;
const IS_PROD = import.meta.env.PROD;

// Error codes for user-facing messages
export const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_001',
  AUTH_FAILED: 'AUTH_002',
  NETWORK_ERROR: 'NET_001',
  PAYMENT_FAILED: 'PAY_001',
  NOT_FOUND: 'RES_001',
  VALIDATION_ERROR: 'VAL_001',
  INTERNAL_ERROR: 'SRV_001',
};

// User-friendly error messages
const USER_MESSAGES = {
  [ERROR_CODES.AUTH_REQUIRED]: 'Please log in to continue.',
  [ERROR_CODES.AUTH_FAILED]: 'Authentication failed. Please try again.',
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection.',
  [ERROR_CODES.PAYMENT_FAILED]: 'Payment could not be processed. Please try again.',
  [ERROR_CODES.NOT_FOUND]: 'The requested item was not found.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ERROR_CODES.INTERNAL_ERROR]: 'Something went wrong. Please try again.',
};

/**
 * Get a user-friendly error message
 */
export function getUserMessage(code, fallback = 'Something went wrong. Please try again.') {
  return USER_MESSAGES[code] || fallback;
}

/**
 * Log to console - only in development
 */
export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: (...args) => {
    if (IS_DEV) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logs - only in development
   */
  info: (...args) => {
    if (IS_DEV) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Warning logs - development only
   */
  warn: (...args) => {
    if (IS_DEV) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error logs - always log, but sanitize in production
   */
  error: (message, error, metadata = {}) => {
    if (IS_DEV) {
      console.error('[ERROR]', message, error, metadata);
    } else {
      // In production, log minimal info
      console.error('[ERROR]', message, {
        errorType: error?.name,
        // Don't log stack traces or error messages in production
        timestamp: new Date().toISOString(),
      });
    }
  },
};

/**
 * Sanitize an error for display to users
 * Removes any potentially sensitive information
 */
export function sanitizeErrorForUser(error) {
  // Never show internal error messages to users
  if (IS_PROD) {
    return {
      message: 'Something went wrong. Please try again.',
      code: ERROR_CODES.INTERNAL_ERROR,
    };
  }

  // In development, show more details
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || ERROR_CODES.INTERNAL_ERROR,
    details: error?.details,
  };
}

/**
 * Handle API errors safely
 */
export function handleApiError(error, context = 'API') {
  logger.error(`${context} error`, error);

  // Check for network errors
  if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
    return {
      code: ERROR_CODES.NETWORK_ERROR,
      message: getUserMessage(ERROR_CODES.NETWORK_ERROR),
    };
  }

  // Check for auth errors
  if (error?.status === 401 || error?.status === 403) {
    return {
      code: ERROR_CODES.AUTH_REQUIRED,
      message: getUserMessage(ERROR_CODES.AUTH_REQUIRED),
    };
  }

  // Check for not found
  if (error?.status === 404) {
    return {
      code: ERROR_CODES.NOT_FOUND,
      message: getUserMessage(ERROR_CODES.NOT_FOUND),
    };
  }

  // Default error
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: getUserMessage(ERROR_CODES.INTERNAL_ERROR),
  };
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling(fn, context = 'Operation') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`${context} failed`, error);
      throw handleApiError(error, context);
    }
  };
}

export default logger;
