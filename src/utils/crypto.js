// Cryptographically secure random number generation utilities
// Use these instead of Math.random() for security-sensitive operations

/**
 * Generate a cryptographically secure random number between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer between min and max
 */
export function secureRandomInt(min, max) {
  if (min > max) {
    throw new Error('min must be less than or equal to max');
  }
  
  // Use crypto.getRandomValues for secure random numbers
  const range = max - min + 1;
  const maxValid = Math.floor(256 / range) * range - 1;
  
  let randomValue;
  do {
    // Generate random bytes
    const randomBytes = new Uint8Array(1);
    crypto.getRandomValues(randomBytes);
    randomValue = randomBytes[0];
  } while (randomValue > maxValid);
  
  return min + (randomValue % range);
}

/**
 * Generate a cryptographically secure OTP (One-Time Password)
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} OTP string
 */
export function generateSecureOTP(length = 6) {
  if (length < 4 || length > 10) {
    throw new Error('OTP length must be between 4 and 10');
  }
  
  // Generate OTP using secure random numbers
  const min = Math.pow(10, length - 1); // e.g., 100000 for 6 digits
  const max = Math.pow(10, length) - 1; // e.g., 999999 for 6 digits
  
  return secureRandomInt(min, max).toString();
}

/**
 * Generate a secure random string (for IDs, tokens, etc.)
 * @param {number} length - Length of string
 * @param {string} charset - Character set (default: alphanumeric)
 * @returns {string} Random string
 */
export function generateSecureRandomString(length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  if (length < 1 || length > 256) {
    throw new Error('String length must be between 1 and 256');
  }
  
  const charsetLength = charset.length;
  const maxValid = Math.floor(256 / charsetLength) * charsetLength - 1;
  
  let result = '';
  for (let i = 0; i < length; i++) {
    let randomValue;
    do {
      const randomBytes = new Uint8Array(1);
      crypto.getRandomValues(randomBytes);
      randomValue = randomBytes[0];
    } while (randomValue > maxValid);
    
    result += charset[randomValue % charsetLength];
  }
  
  return result;
}
