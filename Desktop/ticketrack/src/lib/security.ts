// =====================================================
// SECURITY UTILITIES FOR TICKETRACK
// Implements XSS prevention, CSRF protection, rate limiting
// =====================================================

// Sanitize HTML to prevent XSS
export function sanitizeHTML(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
}

// Sanitize input for database queries
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>'"`;]/g, '')
    .trim();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

// Validate phone number (Nigerian format)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Validate password strength
export function isStrongPassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Generate CSRF token
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Store and validate CSRF token
const CSRF_KEY = 'tt_csrf_token';

export function setCSRFToken(): string {
  const token = generateCSRFToken();
  sessionStorage.setItem(CSRF_KEY, token);
  return token;
}

export function getCSRFToken(): string | null {
  return sessionStorage.getItem(CSRF_KEY);
}

export function validateCSRFToken(token: string): boolean {
  const storedToken = getCSRFToken();
  return storedToken === token && token.length > 0;
}

// Rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function isRateLimited(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  entry.count++;
  
  if (entry.count > maxAttempts) {
    return true;
  }
  
  return false;
}

export function resetRateLimit(key: string): void {
  rateLimitMap.delete(key);
}

// Session management
const SESSION_KEY = 'tt_session_activity';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function updateSessionActivity(): void {
  localStorage.setItem(SESSION_KEY, Date.now().toString());
}

export function isSessionActive(): boolean {
  const lastActivity = localStorage.getItem(SESSION_KEY);
  if (!lastActivity) return false;
  
  const elapsed = Date.now() - parseInt(lastActivity, 10);
  return elapsed < SESSION_TIMEOUT_MS;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.clear();
}

// Secure storage with basic encoding
const STORAGE_PREFIX = 'tt_';

export const secureStore = {
  set(key: string, value: unknown): void {
    try {
      const encoded = btoa(JSON.stringify(value));
      localStorage.setItem(STORAGE_PREFIX + key, encoded);
    } catch {
      console.error('Failed to store data securely');
    }
  },
  
  get<T>(key: string): T | null {
    try {
      const encoded = localStorage.getItem(STORAGE_PREFIX + key);
      if (!encoded) return null;
      return JSON.parse(atob(encoded)) as T;
    } catch {
      return null;
    }
  },
  
  remove(key: string): void {
    localStorage.removeItem(STORAGE_PREFIX + key);
  },
  
  clear(): void {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  },
};

// Validate URL to prevent open redirects
export function isSafeURL(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow same-origin or specific trusted domains
    const trustedDomains = [
      window.location.hostname,
      'ticketrack.com',
      'admin.ticketrack.com',
    ];
    return trustedDomains.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// Sanitize URL parameters
export function sanitizeURLParams(url: string): string {
  try {
    const parsed = new URL(url);
    const sanitizedParams = new URLSearchParams();
    
    parsed.searchParams.forEach((value, key) => {
      sanitizedParams.set(sanitizeInput(key), sanitizeInput(value));
    });
    
    parsed.search = sanitizedParams.toString();
    return parsed.toString();
  } catch {
    return '';
  }
}

// Log security events (in production, send to backend)
export function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>
): void {
  const event = {
    type: eventType,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...details,
  };
  
  // In production, send this to your backend
  if (import.meta.env.DEV) {
    console.log('[Security Event]', event);
  }
}

// Validate file upload
export function isValidFileUpload(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number = 5
): { isValid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: `File type ${file.type} is not allowed` };
  }
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { isValid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }
  
  return { isValid: true };
}
