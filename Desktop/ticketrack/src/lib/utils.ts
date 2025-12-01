import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency based on country
export function formatCurrency(amount: number, currency: string = 'NGN'): string {
  const symbols: Record<string, string> = {
    NGN: '₦',
    GHS: '₵',
    KES: 'KSh',
    RWF: 'FRw',
    ZAR: 'R',
    XAF: 'FCFA',
  };
  
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString()}`;
}

// Format date
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return new Date(date).toLocaleDateString('en-US', options || defaultOptions);
}

// Format time
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Format date and time together
export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

// Generate slug from string
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Validate UUID
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Calculate platform fee
export function calculatePlatformFee(subtotal: number, feePercent: number = 10): number {
  return Math.round(subtotal * (feePercent / 100) * 100) / 100;
}

// Calculate tax
export function calculateTax(subtotal: number, taxPercent: number): number {
  return Math.round(subtotal * (taxPercent / 100) * 100) / 100;
}

// Calculate total with fees
export function calculateTotal(
  subtotal: number,
  platformFeePercent: number = 10,
  taxPercent: number = 7.5,
  feeHandling: 'pass_to_attendee' | 'absorb' = 'pass_to_attendee'
): {
  subtotal: number;
  platformFee: number;
  tax: number;
  total: number;
  organizerRevenue: number;
} {
  const platformFee = calculatePlatformFee(subtotal, platformFeePercent);
  const tax = calculateTax(subtotal, taxPercent);
  
  if (feeHandling === 'pass_to_attendee') {
    return {
      subtotal,
      platformFee,
      tax,
      total: subtotal + platformFee + tax,
      organizerRevenue: subtotal - platformFee,
    };
  } else {
    return {
      subtotal,
      platformFee,
      tax,
      total: subtotal,
      organizerRevenue: subtotal - platformFee - tax,
    };
  }
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Check if event has ended
export function hasEventEnded(endDate: string | Date): boolean {
  return new Date(endDate) < new Date();
}

// Check if event is upcoming
export function isEventUpcoming(startDate: string | Date): boolean {
  return new Date(startDate) > new Date();
}

// Get time until event
export function getTimeUntilEvent(startDate: string | Date): string {
  const now = new Date();
  const event = new Date(startDate);
  const diff = event.getTime() - now.getTime();
  
  if (diff < 0) return 'Event has started';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} away`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} away`;
  return 'Starting soon';
}
