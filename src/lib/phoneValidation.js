/**
 * Phone Number Validation Utilities
 * 
 * Handles phone uniqueness checks for:
 * - Registration (phone must not exist)
 * - Profile update (phone must not exist for OTHER users)
 * - Phone login (find user by phone)
 */

import { supabase } from './supabase'

/**
 * Normalize phone number to consistent format
 * Removes spaces, dashes, and standardizes country code
 */
export function normalizePhone(phone) {
  if (!phone) return null
  
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '')
  
  // Handle Nigerian numbers
  if (normalized.startsWith('0') && normalized.length === 11) {
    // Convert 08012345678 to +2348012345678
    normalized = '+234' + normalized.substring(1)
  } else if (normalized.startsWith('234') && !normalized.startsWith('+')) {
    normalized = '+' + normalized
  } else if (!normalized.startsWith('+') && normalized.length === 10) {
    // Assume Nigerian without leading 0
    normalized = '+234' + normalized
  }
  
  return normalized || null
}

/**
 * Check if a phone number is already registered
 * 
 * @param {string} phone - Phone number to check
 * @param {string|null} excludeUserId - User ID to exclude (for profile updates)
 * @returns {Promise<{exists: boolean, userId?: string, error?: string}>}
 */
export async function checkPhoneExists(phone, excludeUserId = null) {
  if (!phone) {
    return { exists: false }
  }

  const normalized = normalizePhone(phone)
  if (!normalized) {
    return { exists: false }
  }

  try {
    let query = supabase
      .from('profiles')
      .select('id, phone')
      .eq('phone', normalized)
    
    // If updating, exclude current user
    if (excludeUserId) {
      query = query.neq('id', excludeUserId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('Phone check error:', error)
      return { exists: false, error: error.message }
    }

    if (data) {
      return { 
        exists: true, 
        userId: data.id,
        message: 'This phone number is already registered to another account'
      }
    }

    return { exists: false }
  } catch (error) {
    console.error('Phone check exception:', error)
    return { exists: false, error: error.message }
  }
}

/**
 * Validate phone number for registration
 * Returns error message if phone is already taken
 */
export async function validatePhoneForRegistration(phone) {
  const result = await checkPhoneExists(phone)
  
  if (result.exists) {
    return {
      valid: false,
      phoneExists: true,
      error: 'This phone number is already registered.',
      suggestion: 'login', // Suggest user to login instead
      message: 'An account with this phone number already exists. Would you like to login instead?'
    }
  }
  
  return { valid: true }
}

/**
 * Validate phone number for profile update
 * Allows the same phone if it belongs to the current user
 */
export async function validatePhoneForUpdate(phone, currentUserId) {
  if (!phone) {
    return { valid: true } // Allow clearing phone
  }

  const result = await checkPhoneExists(phone, currentUserId)
  
  if (result.exists) {
    return {
      valid: false,
      error: 'This phone number is already registered to another account.'
    }
  }
  
  return { valid: true }
}

/**
 * Find user by phone number (for phone login)
 */
export async function findUserByPhone(phone) {
  const normalized = normalizePhone(phone)
  if (!normalized) {
    return { user: null, error: 'Invalid phone number' }
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, phone, full_name')
      .eq('phone', normalized)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return { user: null, error: 'No account found with this phone number' }
      }
      return { user: null, error: error.message }
    }

    return { user: data }
  } catch (error) {
    return { user: null, error: error.message }
  }
}

/**
 * Check if phone exists in organizers table
 */
export async function checkOrganizerPhoneExists(phone, excludeOrganizerId = null) {
  if (!phone) {
    return { exists: false }
  }

  const normalized = normalizePhone(phone)
  if (!normalized) {
    return { exists: false }
  }

  try {
    let query = supabase
      .from('organizers')
      .select('id, phone')
      .eq('phone', normalized)
    
    if (excludeOrganizerId) {
      query = query.neq('id', excludeOrganizerId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return { exists: false, error: error.message }
    }

    if (data) {
      return { 
        exists: true, 
        organizerId: data.id,
        message: 'This phone number is already registered to another organizer'
      }
    }

    return { exists: false }
  } catch (error) {
    return { exists: false, error: error.message }
  }
}

/**
 * Validate phone for organizer profile update
 */
export async function validateOrganizerPhoneForUpdate(phone, currentOrganizerId) {
  if (!phone) {
    return { valid: true }
  }

  const result = await checkOrganizerPhoneExists(phone, currentOrganizerId)
  
  if (result.exists) {
    return {
      valid: false,
      error: 'This phone number is already registered to another organizer.'
    }
  }
  
  return { valid: true }
}

export default {
  normalizePhone,
  checkPhoneExists,
  validatePhoneForRegistration,
  validatePhoneForUpdate,
  findUserByPhone,
  checkOrganizerPhoneExists,
  validateOrganizerPhoneForUpdate,
}
