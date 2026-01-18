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
export function generateApplePassData(ticket, event, includeWebService = false) {
  const eventDate = new Date(event.start_date)
  
  const passData = {
    ...APPLE_PASS_TEMPLATE,
    serialNumber: ticket.ticket_code,
    
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
  
  // Only include web service URL if we have a proper backend setup
  if (includeWebService) {
    passData.webServiceURL = `${window.location.origin}/api/passes`
    passData.authenticationToken = ticket.id
  }
  
  return passData
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
 * Load JSZip from CDN
 */
function loadJSZip() {
  return new Promise((resolve, reject) => {
    if (window.JSZip) {
      resolve(window.JSZip)
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = () => {
      if (window.JSZip) {
        resolve(window.JSZip)
      } else {
        reject(new Error('JSZip failed to load'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load JSZip library'))
    document.head.appendChild(script)
  })
}

/**
 * Generate client-side Apple Wallet .pkpass file
 * Creates a downloadable .pkpass file without server-side certificates
 */
async function generateClientSideApplePass(ticket, event) {
  try {
    // Load JSZip from CDN
    const JSZip = await loadJSZip()

    // Generate pass.json (without webServiceURL for client-side generation)
    const passData = generateApplePassData(ticket, event, false)
    const passJson = JSON.stringify(passData, null, 2)

    // Create simple images as base64 (required by Apple Wallet)
    // Icon: 29x29, 58x58, 87x87, 60x60, 120x120, 180x180
    // Logo: 27x27, 54x54, 81x81
    // We'll create simple colored squares as placeholders
    
    const createImageDataURL = (size, color = '#2969FF') => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = color
      ctx.fillRect(0, 0, size, size)
      // Add white "TR" text
      ctx.fillStyle = '#FFFFFF'
      ctx.font = `bold ${size * 0.4}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('TR', size / 2, size / 2)
      return canvas.toDataURL('image/png')
    }

    // Note: QR code is already in pass.json barcode field, so we don't need to generate it separately

    // Create zip file
    const zip = new JSZip()
    
    // Add pass.json
    zip.file('pass.json', passJson)
    
    // Add required images (using simple generated images)
    zip.file('icon.png', createImageDataURL(29).split(',')[1], { base64: true })
    zip.file('icon@2x.png', createImageDataURL(58).split(',')[1], { base64: true })
    zip.file('icon@3x.png', createImageDataURL(87).split(',')[1], { base64: true })
    
    zip.file('logo.png', createImageDataURL(27).split(',')[1], { base64: true })
    zip.file('logo@2x.png', createImageDataURL(54).split(',')[1], { base64: true })
    zip.file('logo@3x.png', createImageDataURL(81).split(',')[1], { base64: true })
    
    // Strip image (320x84 or 640x168) - use event image if available
    if (event.image_url) {
      try {
        const response = await fetch(event.image_url)
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        zip.file('strip.png', arrayBuffer)
        zip.file('strip@2x.png', arrayBuffer)
      } catch (e) {
        // Fallback to generated image
        const stripData = createImageDataURL(320, '#1a4fd8').split(',')[1]
        zip.file('strip.png', stripData, { base64: true })
        zip.file('strip@2x.png', stripData, { base64: true })
      }
    } else {
      const stripData = createImageDataURL(320, '#1a4fd8').split(',')[1]
      zip.file('strip.png', stripData, { base64: true })
      zip.file('strip@2x.png', stripData, { base64: true })
    }

    // Generate manifest.json with SHA1 hashes
    const crypto = window.crypto || window.msCrypto
    const manifest = {}
    
    const files = ['pass.json', 'icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png', 'strip.png', 'strip@2x.png']
    
    for (const filename of files) {
      const fileData = await zip.file(filename).async('uint8array')
      const hashBuffer = await crypto.subtle.digest('SHA-1', fileData)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      manifest[filename] = hashHex
    }
    
    zip.file('manifest.json', JSON.stringify(manifest))

    // Generate the .pkpass file
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob)
    
    // Trigger download
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_${ticket.ticket_code}.pkpass`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    return { success: true }
  } catch (error) {
    console.error('Client-side Apple Pass generation error:', error)
    throw error
  }
}

/**
 * Request Apple Wallet pass from backend
 * Falls back to client-side generation if backend is not configured
 */
export async function getAppleWalletPass(ticketId) {
  try {
    // First, fetch ticket and event data
    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        event:events(
          id, title, slug, start_date, end_date, 
          venue_name, venue_address, city, 
          image_url, venue_lat, venue_lng,
          organizers(business_name, logo_url)
        ),
        ticket_type:ticket_types(name, price)
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticketData) {
      throw new Error('Ticket not found')
    }

    // Try backend first
    try {
      const { data, error } = await supabase.functions.invoke('generate-wallet-pass', {
        body: {
          ticketId,
          platform: 'apple'
        }
      })
      
      if (!error && data?.passUrl) {
        // Backend generated pass successfully
        window.location.href = data.passUrl
        return { success: true }
      }
    } catch (backendError) {
      console.log('Backend pass generation not available, using client-side generation')
    }

    // Fallback to client-side generation
    return await generateClientSideApplePass(ticketData, ticketData.event)
    
  } catch (error) {
    console.error('Apple Wallet pass error:', error)
    return { 
      success: false, 
      error: error.message,
      fallback: true
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
