/**
 * Generate Wallet Pass - Supabase Edge Function
 * 
 * Generates Apple Wallet (.pkpass) and Google Wallet passes for tickets
 * 
 * Environment Variables Required:
 * - APPLE_PASS_TYPE_ID: Your Apple Pass Type ID (e.g., pass.com.ticketrack.event)
 * - APPLE_TEAM_ID: Your Apple Developer Team ID
 * - APPLE_PASS_CERTIFICATE: Base64 encoded .p12 certificate
 * - APPLE_PASS_CERTIFICATE_PASSWORD: Certificate password
 * - GOOGLE_SERVICE_ACCOUNT_KEY: Base64 encoded Google service account JSON
 * - GOOGLE_ISSUER_ID: Your Google Wallet Issuer ID
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  errorResponse, 
  logError, 
  safeLog,
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Apple Wallet pass structure
interface ApplePassData {
  formatVersion: number
  passTypeIdentifier: string
  serialNumber: string
  teamIdentifier: string
  organizationName: string
  description: string
  logoText: string
  foregroundColor: string
  backgroundColor: string
  labelColor: string
  eventTicket: {
    primaryFields: Array<{ key: string; label: string; value: string }>
    secondaryFields: Array<{ key: string; label: string; value: string }>
    auxiliaryFields: Array<{ key: string; label: string; value: string }>
    backFields: Array<{ key: string; label: string; value: string }>
  }
  barcode: {
    format: string
    message: string
    messageEncoding: string
  }
  relevantDate?: string
  locations?: Array<{ latitude: number; longitude: number; relevantText: string }>
}

// Google Wallet event ticket object
interface GoogleWalletObject {
  id: string
  classId: string
  state: string
  eventName: { defaultValue: { language: string; value: string } }
  venue: {
    name: { defaultValue: { language: string; value: string } }
    address: { defaultValue: { language: string; value: string } }
  }
  dateTime: { start: string; end: string }
  ticketHolder: { name: string }
  ticketNumber: string
  ticketType: { defaultValue: { language: string; value: string } }
  barcode: { type: string; value: string; alternateText: string }
  hexBackgroundColor: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { ticketId, platform } = await req.json()

    if (!ticketId || !platform) {
      throw new Error('Missing ticketId or platform')
    }

    // Fetch ticket with event details
    const { data: ticket, error: ticketError } = await supabaseClient
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

    if (ticketError || !ticket) {
      throw new Error('Ticket not found')
    }

    const event = ticket.event

    if (platform === 'apple') {
      return await generateApplePass(ticket, event, supabaseClient)
    } else if (platform === 'google') {
      return await generateGooglePass(ticket, event)
    } else {
      throw new Error('Invalid platform. Use "apple" or "google"')
    }

  } catch (error) {
    logError('wallet_pass_generation', error)
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      400,
      error,
      'Wallet pass generation is not yet configured. Please use the PDF ticket or Add to Calendar option.',
      corsHeaders
    )
  }
})

async function generateApplePass(ticket: any, event: any, supabaseClient: any): Promise<Response> {
  const APPLE_PASS_TYPE_ID = Deno.env.get('APPLE_PASS_TYPE_ID')
  const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID')
  const APPLE_CERTIFICATE = Deno.env.get('APPLE_PASS_CERTIFICATE')

  // Check if Apple Wallet is configured
  if (!APPLE_PASS_TYPE_ID || !APPLE_TEAM_ID || !APPLE_CERTIFICATE) {
    safeLog.info('Apple Wallet not configured - returning fallback message')
    return new Response(
      JSON.stringify({ 
        error: 'Apple Wallet not configured',
        fallback: true,
        message: 'Apple Wallet passes are coming soon! For now, please download your PDF ticket or add to calendar.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  // Generate pass data
  const eventDate = new Date(event.start_date)
  
  const passData: ApplePassData = {
    formatVersion: 1,
    passTypeIdentifier: APPLE_PASS_TYPE_ID,
    serialNumber: ticket.ticket_code,
    teamIdentifier: APPLE_TEAM_ID,
    organizationName: event.organizers?.business_name || 'Ticketrack',
    description: `Ticket for ${event.title}`,
    logoText: 'Ticketrack',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(41, 105, 255)',
    labelColor: 'rgb(255, 255, 255)',
    
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
          key: 'organizer',
          label: 'Organizer',
          value: event.organizers?.business_name || 'Ticketrack'
        },
        {
          key: 'terms',
          label: 'Terms & Conditions',
          value: 'This ticket is valid for one person only. Present this pass at the venue entrance for admission. Powered by Ticketrack.'
        }
      ]
    },
    
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: ticket.ticket_code,
      messageEncoding: 'iso-8859-1'
    },
    
    relevantDate: event.start_date,
  }

  // Add location if available
  if (event.venue_lat && event.venue_lng) {
    passData.locations = [{
      latitude: parseFloat(event.venue_lat),
      longitude: parseFloat(event.venue_lng),
      relevantText: `You're near ${event.venue_name}!`
    }]
  }

  // In a full implementation, you would:
  // 1. Create the pass.json file
  // 2. Add icon.png, logo.png, strip.png images
  // 3. Create manifest.json with SHA1 hashes
  // 4. Sign with Apple certificate to create signature
  // 5. Package as .pkpass (zip file)
  // 6. Upload to storage and return URL

  // For now, return a message that full implementation is pending
  return new Response(
    JSON.stringify({ 
      message: 'Apple Wallet pass generation requires certificate setup',
      passData: passData, // Return the data structure for debugging
      instructions: 'To enable Apple Wallet passes, configure APPLE_PASS_CERTIFICATE in environment variables'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

async function generateGooglePass(ticket: any, event: any): Promise<Response> {
  const GOOGLE_SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  const GOOGLE_ISSUER_ID = Deno.env.get('GOOGLE_ISSUER_ID')

  // Check if Google Wallet is configured
  if (!GOOGLE_SERVICE_ACCOUNT || !GOOGLE_ISSUER_ID) {
    safeLog.info('Google Wallet not configured - returning fallback message')
    return new Response(
      JSON.stringify({ 
        error: 'Google Wallet not configured',
        fallback: true,
        message: 'Google Wallet passes are coming soon! For now, please download your PDF ticket or add to calendar.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  const eventDate = new Date(event.start_date)
  const endDate = event.end_date ? new Date(event.end_date) : new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)

  const walletObject: GoogleWalletObject = {
    id: `${GOOGLE_ISSUER_ID}.${ticket.ticket_code}`,
    classId: `${GOOGLE_ISSUER_ID}.ticketrack_event`,
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
      end: endDate.toISOString()
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
    
    hexBackgroundColor: '#2969FF'
  }

  // In a full implementation, you would:
  // 1. Use Google Wallet API to create/update the event ticket class
  // 2. Create a signed JWT with the wallet object
  // 3. Return the "Save to Google Wallet" URL

  // For now, return a message that full implementation is pending
  return new Response(
    JSON.stringify({ 
      message: 'Google Wallet pass generation requires API setup',
      walletObject: walletObject, // Return the data structure for debugging
      instructions: 'To enable Google Wallet passes, configure GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_ISSUER_ID in environment variables'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}
