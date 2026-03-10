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
