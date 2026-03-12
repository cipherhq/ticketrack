import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize a value for use in Supabase PostgREST .or() / .filter() strings.
 * Strips commas and parentheses that could inject additional filter conditions.
 */
export function sanitizeFilterValue(value) {
  if (value == null) return ''
  return String(value).replace(/[,()]/g, '')
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/**
 * Validate a file before uploading to storage.
 * Returns null if valid, or an error string if invalid.
 */
export function validateImageUpload(file, { maxSize = MAX_UPLOAD_SIZE, allowedTypes = ALLOWED_IMAGE_TYPES } = {}) {
  if (!file) return 'No file selected'
  if (!allowedTypes.includes(file.type)) {
    return `Invalid file type "${file.type}". Allowed: JPG, PNG, GIF, WebP`
  }
  if (file.size > maxSize) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum ${(maxSize / 1024 / 1024).toFixed(0)}MB`
  }
  return null
}

/**
 * Get safe file extension from MIME type (not from filename, which can be spoofed).
 */
export function safeImageExt(file) {
  return MIME_TO_EXT[file.type] || 'jpg'
}

export function formatCurrency(amount, symbol = '₦') {
  return `${symbol}${amount.toLocaleString()}`
}

export function formatDate(date, options = {}) {
  const defaultOptions = {
    weekday: undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  }
  return new Date(date).toLocaleDateString('en-US', defaultOptions)
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}
