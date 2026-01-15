/**
 * Wallet Pass Generator for Ticketrack
 * 
 * Generates passes for:
 * - Apple Wallet (.pkpass)
 * - Google Wallet (JWT link)
 * 
 * Note: Full implementation requires:
 * - Apple Developer Account with Pass Type ID certificate
 * - Google Wallet API credentials
 * 
 * This module provides the frontend interface and fallback solutions.
 */

import { supabase } from '@/lib/supabase'

// Apple Wallet pass template (for server-side generation)
export const APPLE_PASS_TEMPLATE = {
  formatVersion: 1,
  passTypeIdentifier: 'pass.com.ticketrack.tickets',
  teamIdentifier: '2968MARM74',
  organizationName: 'Ticketrack',
  description: 'Event Ticket',
  logoText: 'Ticketrack',
  foregroundColor: 'rgb(255, 255, 255)',
  backgroundColor: 'rgb(41, 105, 255)',
  labelColor: 'rgb(255, 255, 255)',
}

// Google Wallet class template
export const GOOGLE_WALLET_CLASS = {
  id: 'ticketrack.event_ticket',
  issuerName: 'Ticketrack',
  reviewStatus: 'UNDER_REVIEW',
  textModulesData: [],
  linksModuleData: {
    uris: [{
      uri: 'https://ticketrack.com',
      description: 'Ticketrack Website',
      id: 'official_site'
    }]
  }
}

/**
 * Generate Apple Wallet pass data
 * This creates the pass.json structure for .pkpass file
 */
export function generateApplePassData(ticket, event) {
  const eventDate = new Date(event.start_date)
  
  return {
    ...APPLE_PASS_TEMPLATE,
    serialNumber: ticket.ticket_code,
    webServiceURL: `${window.location.origin}/api/passes`,
    authenticationToken: ticket.id,
    
    eventTicket: {
      primaryFields: [{
        key: 'event',
        label: 'EVENT',
        value: event.title
      }],
      secondaryFields: [
        {
          key: 'date',
          label: 'DATE',
          value: eventDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })
        },
        {
          key: 'time',
          label: 'TIME',
          value: eventDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          })
        }
      ],
      auxiliaryFields: [
        {
          key: 'location',
          label: 'VENUE',
          value: event.venue_name || 'TBA'
        },
        {
          key: 'ticket_type',
          label: 'TYPE',
          value: ticket.ticket_type?.name || 'General Admission'
        }
      ],
      backFields: [
        {
          key: 'attendee',
          label: 'Attendee',
          value: ticket.attendee_name
        },
        {
          key: 'ticket_code',
          label: 'Ticket Code',
          value: ticket.ticket_code
        },
        {
          key: 'terms',
          label: 'Terms & Conditions',
          value: 'This ticket is valid for one person only. No refunds or exchanges. Present this pass at the venue entrance for admission.'
        }
      ]
    },
    
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: ticket.ticket_code,
      messageEncoding: 'iso-8859-1'
    },
    
    relevantDate: event.start_date,
    
    locations: event.venue_lat && event.venue_lng ? [{
      latitude: event.venue_lat,
      longitude: event.venue_lng,
      relevantText: `You're near ${event.venue_name}!`
    }] : []
  }
}

/**
 * Generate Google Wallet pass object
 */
export function generateGoogleWalletObject(ticket, event) {
  const eventDate = new Date(event.start_date)
  
  return {
    id: `ticketrack.${ticket.ticket_code}`,
    classId: 'ticketrack.event_ticket',
    state: 'ACTIVE',
    
    eventName: {
      defaultValue: {
        language: 'en-US',
        value: event.title
      }
    },
    
    venue: {
      name: {
        defaultValue: {
          language: 'en-US',
          value: event.venue_name || 'TBA'
        }
      },
      address: {
        defaultValue: {
          language: 'en-US',
          value: event.venue_address || event.city || ''
        }
      }
    },
    
    dateTime: {
      start: event.start_date,
      end: event.end_date || event.start_date
    },
    
    ticketHolder: {
      name: ticket.attendee_name
    },
    
    ticketNumber: ticket.ticket_code,
    
    ticketType: {
      defaultValue: {
        language: 'en-US',
        value: ticket.ticket_type?.name || 'General Admission'
      }
    },
    
    barcode: {
      type: 'QR_CODE',
      value: ticket.ticket_code,
      alternateText: ticket.ticket_code
    },
    
    hexBackgroundColor: '#2969FF',
    
    logo: {
      sourceUri: {
        uri: `${window.location.origin}/ticketrackLogo.png`
      }
    },
    
    heroImage: event.image_url ? {
      sourceUri: {
        uri: event.image_url
      }
    } : undefined
  }
}

/**
 * Request Apple Wallet pass from backend
 * The backend handles certificate signing
 */
export async function getAppleWalletPass(ticketId) {
  try {
    const { data, error } = await supabase.functions.invoke('generate-wallet-pass', {
      body: {
        ticketId,
        platform: 'apple'
      }
    })
    
    if (error) throw error
    
    if (data?.passUrl) {
      // Open the .pkpass file URL
      window.location.href = data.passUrl
      return { success: true }
    }
    
    throw new Error('Failed to generate pass')
  } catch (error) {
    console.error('Apple Wallet pass error:', error)
    return { 
      success: false, 
      error: error.message,
      fallback: true // Use fallback method
    }
  }
}

/**
 * Request Google Wallet pass from backend
 * Returns a "Save to Google Wallet" link
 */
export async function getGoogleWalletPass(ticketId) {
  try {
    const { data, error } = await supabase.functions.invoke('generate-wallet-pass', {
      body: {
        ticketId,
        platform: 'google'
      }
    })
    
    if (error) throw error
    
    if (data?.saveUrl) {
      // Open Google Wallet save URL
      window.open(data.saveUrl, '_blank')
      return { success: true }
    }
    
    throw new Error('Failed to generate pass')
  } catch (error) {
    console.error('Google Wallet pass error:', error)
    return { 
      success: false, 
      error: error.message,
      fallback: true
    }
  }
}

/**
 * Add to Calendar fallback (works on all platforms)
 * Generates .ics file for calendar apps
 */
export function generateCalendarFile(ticket, event) {
  const startDate = new Date(event.start_date)
  const endDate = event.end_date ? new Date(event.end_date) : new Date(startDate.getTime() + 3 * 60 * 60 * 1000) // Default 3 hours
  
  const formatICSDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Ticketrack//Event Ticket//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:Ticket Code: ${ticket.ticket_code}\\nAttendee: ${ticket.attendee_name}\\nType: ${ticket.ticket_type?.name || 'General Admission'}\\n\\nPresent your ticket QR code at the entrance.
LOCATION:${event.venue_name || 'TBA'}${event.venue_address ? ', ' + event.venue_address : ''}
URL:${window.location.origin}/tickets
STATUS:CONFIRMED
UID:${ticket.ticket_code}@ticketrack.com
END:VEVENT
END:VCALENDAR`

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_ticket.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  return { success: true }
}

/**
 * Detect if user is on iOS (for Apple Wallet)
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Detect if user is on Android (for Google Wallet)
 */
export function isAndroid() {
  return /Android/.test(navigator.userAgent)
}

/**
 * Get the appropriate wallet option for the current device
 */
export function getWalletOptions() {
  const options = []
  
  if (isIOS()) {
    options.push({
      id: 'apple',
      name: 'Apple Wallet',
      icon: 'apple',
      primary: true
    })
  }
  
  if (isAndroid()) {
    options.push({
      id: 'google',
      name: 'Google Wallet',
      icon: 'google',
      primary: true
    })
  }
  
  // Calendar is always available as fallback
  options.push({
    id: 'calendar',
    name: 'Add to Calendar',
    icon: 'calendar',
    primary: options.length === 0
  })
  
  return options
}

/**
 * Main function to add ticket to wallet
 */
export async function addToWallet(ticket, event, platform = 'auto') {
  // Auto-detect platform if not specified
  if (platform === 'auto') {
    if (isIOS()) platform = 'apple'
    else if (isAndroid()) platform = 'google'
    else platform = 'calendar'
  }
  
  switch (platform) {
    case 'apple':
      const appleResult = await getAppleWalletPass(ticket.id)
      if (appleResult.fallback) {
        // Fall back to calendar if Apple Wallet not configured
        return generateCalendarFile(ticket, event)
      }
      return appleResult
      
    case 'google':
      const googleResult = await getGoogleWalletPass(ticket.id)
      if (googleResult.fallback) {
        // Fall back to calendar if Google Wallet not configured
        return generateCalendarFile(ticket, event)
      }
      return googleResult
      
    case 'calendar':
    default:
      return generateCalendarFile(ticket, event)
  }
}
