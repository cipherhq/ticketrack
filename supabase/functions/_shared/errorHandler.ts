/**
 * Production-safe error handling for Edge Functions
 * 
 * NEVER expose internal error messages to clients in production.
 * Log full errors server-side, return generic messages to clients.
 */

// Check if running in production
const IS_PRODUCTION = Deno.env.get("ENVIRONMENT") === "production" || 
                       !Deno.env.get("ENVIRONMENT");

// Error codes for client-facing messages
export const ERROR_CODES = {
  // Auth errors
  AUTH_REQUIRED: "AUTH_001",
  AUTH_INVALID: "AUTH_002",
  AUTH_EXPIRED: "AUTH_003",
  PERMISSION_DENIED: "AUTH_004",
  
  // Validation errors
  INVALID_REQUEST: "VAL_001",
  MISSING_FIELDS: "VAL_002",
  INVALID_FORMAT: "VAL_003",
  
  // Payment errors
  PAYMENT_FAILED: "PAY_001",
  PAYOUT_FAILED: "PAY_002",
  INSUFFICIENT_FUNDS: "PAY_003",
  INVALID_ACCOUNT: "PAY_004",
  
  // Resource errors
  NOT_FOUND: "RES_001",
  ALREADY_EXISTS: "RES_002",
  
  // Rate limiting
  RATE_LIMITED: "RATE_001",
  
  // Server errors
  INTERNAL_ERROR: "SRV_001",
  SERVICE_UNAVAILABLE: "SRV_002",
  CONFIGURATION_ERROR: "SRV_003",
} as const;

// User-friendly messages (shown to clients)
const CLIENT_MESSAGES: Record<string, string> = {
  [ERROR_CODES.AUTH_REQUIRED]: "Authentication required. Please log in.",
  [ERROR_CODES.AUTH_INVALID]: "Invalid credentials.",
  [ERROR_CODES.AUTH_EXPIRED]: "Session expired. Please log in again.",
  [ERROR_CODES.PERMISSION_DENIED]: "You don't have permission to perform this action.",
  
  [ERROR_CODES.INVALID_REQUEST]: "Invalid request.",
  [ERROR_CODES.MISSING_FIELDS]: "Required fields are missing.",
  [ERROR_CODES.INVALID_FORMAT]: "Invalid data format.",
  
  [ERROR_CODES.PAYMENT_FAILED]: "Payment could not be processed. Please try again.",
  [ERROR_CODES.PAYOUT_FAILED]: "Payout could not be initiated. Please contact support.",
  [ERROR_CODES.INSUFFICIENT_FUNDS]: "Insufficient funds for this transaction.",
  [ERROR_CODES.INVALID_ACCOUNT]: "Invalid account details.",
  
  [ERROR_CODES.NOT_FOUND]: "The requested resource was not found.",
  [ERROR_CODES.ALREADY_EXISTS]: "This resource already exists.",
  
  [ERROR_CODES.RATE_LIMITED]: "Too many requests. Please try again later.",
  
  [ERROR_CODES.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
  [ERROR_CODES.SERVICE_UNAVAILABLE]: "Service temporarily unavailable. Please try again.",
  [ERROR_CODES.CONFIGURATION_ERROR]: "Service configuration error. Please contact support.",
};

export interface SafeError {
  success: false;
  error: {
    code: string;
    message: string;
    // Only included in development
    details?: string;
    stack?: string;
  };
}

/**
 * Log error server-side (always logs full details)
 */
export function logError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
  const errorDetails = {
    context,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    metadata,
  };
  
  console.error(JSON.stringify(errorDetails));
}

/**
 * Create a safe error response for clients
 * - In production: Returns generic message
 * - In development: Returns full error details
 */
export function createSafeError(
  errorCode: string,
  internalError?: unknown,
  customMessage?: string
): SafeError {
  const message = customMessage || CLIENT_MESSAGES[errorCode] || CLIENT_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
  
  const safeError: SafeError = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };
  
  // Only include error details in development
  if (!IS_PRODUCTION && internalError) {
    if (internalError instanceof Error) {
      safeError.error.details = internalError.message;
      safeError.error.stack = internalError.stack;
    } else if (typeof internalError === "string") {
      safeError.error.details = internalError;
    }
  }
  
  return safeError;
}

/**
 * Create a safe HTTP error response
 */
export function errorResponse(
  errorCode: string,
  statusCode: number = 500,
  internalError?: unknown,
  customMessage?: string,
  headers: Record<string, string> = {}
): Response {
  // Always log the full error server-side
  if (internalError) {
    logError(errorCode, internalError);
  }
  
  const safeError = createSafeError(errorCode, internalError, customMessage);
  
  return new Response(JSON.stringify(safeError), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/**
 * Success response helper
 */
export function successResponse(
  data: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }
  );
}

/**
 * Wrap an async handler with error catching
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>,
  corsHeaders: Record<string, string> = {}
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      logError("unhandled_exception", error, { 
        url: req.url,
        method: req.method 
      });
      
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        500,
        error,
        undefined,
        corsHeaders
      );
    }
  };
}

/**
 * Safe console logging - only logs in development
 */
export const safeLog = {
  debug: (...args: unknown[]) => {
    if (!IS_PRODUCTION) {
      console.log("[DEBUG]", ...args);
    }
  },
  info: (...args: unknown[]) => {
    console.log("[INFO]", ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn("[WARN]", ...args);
  },
  error: (...args: unknown[]) => {
    console.error("[ERROR]", ...args);
  },
};
