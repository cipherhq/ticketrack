export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }
  
  const trimmed = email.trim().toLowerCase()
  
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' }
  }
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' }
  }
  
  return { valid: true, value: trimmed }
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }
  
  const errors = []
  
  if (password.length < 8) {
    errors.push('at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('one number')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('one special character (!@#$%^&*)')
  }
  
  if (errors.length > 0) {
    return { 
      valid: false, 
      error: `Password must contain ${errors.join(', ')}` 
    }
  }
  
  return { valid: true }
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' }
  }
  
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  const phoneRegex = /^\+[1-9]\d{7,14}$/
  
  if (!phoneRegex.test(cleaned)) {
    return { 
      valid: false, 
      error: 'Enter a valid phone number'
    }
  }
  
  return { valid: true, value: cleaned }
}

export function validateFirstName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'First name is required' }
  }
  
  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'First name must be at least 2 characters' }
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'First name is too long' }
  }
  
  const nameRegex = /^[a-zA-Z\s\-']+$/
  
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'First name contains invalid characters' }
  }
  
  return { valid: true, value: trimmed }
}

export function validateLastName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Last name is required' }
  }
  
  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Last name must be at least 2 characters' }
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: 'Last name is too long' }
  }
  
  const nameRegex = /^[a-zA-Z\s\-']+$/
  
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'Last name contains invalid characters' }
  }
  
  return { valid: true, value: trimmed }
}

// Keep for backward compatibility
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' }
  }
  
  const trimmed = name.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' }
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Name is too long' }
  }
  
  const nameRegex = /^[a-zA-Z\s\-']+$/
  
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters' }
  }
  
  return { valid: true, value: trimmed }
}

export function validateOTP(otp) {
  if (!otp || typeof otp !== 'string') {
    return { valid: false, error: 'OTP is required' }
  }
  
  const cleaned = otp.replace(/\s/g, '')
  
  if (!/^\d{6}$/.test(cleaned)) {
    return { valid: false, error: 'OTP must be 6 digits' }
  }
  
  return { valid: true, value: cleaned }
}

export function sanitizeInput(input) {
  if (typeof input !== 'string') return ''
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}
