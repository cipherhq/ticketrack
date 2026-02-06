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
 * - APPLE_WWDR_CERTIFICATE: Base64 encoded Apple WWDR certificate (optional, uses default)
 * - GOOGLE_SERVICE_ACCOUNT_KEY: Base64 encoded Google service account JSON
 * - GOOGLE_ISSUER_ID: Your Google Wallet Issuer ID
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
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

// Simple ZIP implementation for Deno
class SimpleZip {
  private files: Map<string, Uint8Array> = new Map()
  
  addFile(name: string, content: Uint8Array | string) {
    if (typeof content === 'string') {
      content = new TextEncoder().encode(content)
    }
    this.files.set(name, content)
  }
  
  async generate(): Promise<Uint8Array> {
    const parts: Uint8Array[] = []
    const centralDirectory: Uint8Array[] = []
    let offset = 0
    
    for (const [name, content] of this.files) {
      const nameBytes = new TextEncoder().encode(name)
      
      // Local file header
      const localHeader = new Uint8Array(30 + nameBytes.length)
      const view = new DataView(localHeader.buffer)
      
      view.setUint32(0, 0x04034b50, true) // Local file header signature
      view.setUint16(4, 20, true) // Version needed
      view.setUint16(6, 0, true) // General purpose flag
      view.setUint16(8, 0, true) // Compression method (store)
      view.setUint16(10, 0, true) // Last mod time
      view.setUint16(12, 0, true) // Last mod date
      view.setUint32(14, await this.crc32(content), true) // CRC-32
      view.setUint32(18, content.length, true) // Compressed size
      view.setUint32(22, content.length, true) // Uncompressed size
      view.setUint16(26, nameBytes.length, true) // File name length
      view.setUint16(28, 0, true) // Extra field length
      localHeader.set(nameBytes, 30)
      
      // Central directory entry
      const centralEntry = new Uint8Array(46 + nameBytes.length)
      const centralView = new DataView(centralEntry.buffer)
      
      centralView.setUint32(0, 0x02014b50, true) // Central directory signature
      centralView.setUint16(4, 20, true) // Version made by
      centralView.setUint16(6, 20, true) // Version needed
      centralView.setUint16(8, 0, true) // General purpose flag
      centralView.setUint16(10, 0, true) // Compression method
      centralView.setUint16(12, 0, true) // Last mod time
      centralView.setUint16(14, 0, true) // Last mod date
      centralView.setUint32(16, await this.crc32(content), true) // CRC-32
      centralView.setUint32(20, content.length, true) // Compressed size
      centralView.setUint32(24, content.length, true) // Uncompressed size
      centralView.setUint16(28, nameBytes.length, true) // File name length
      centralView.setUint16(30, 0, true) // Extra field length
      centralView.setUint16(32, 0, true) // File comment length
      centralView.setUint16(34, 0, true) // Disk number start
      centralView.setUint16(36, 0, true) // Internal file attributes
      centralView.setUint32(38, 0, true) // External file attributes
      centralView.setUint32(42, offset, true) // Relative offset of local header
      centralEntry.set(nameBytes, 46)
      
      centralDirectory.push(centralEntry)
      parts.push(localHeader)
      parts.push(content)
      offset += localHeader.length + content.length
    }
    
    // Add central directory
    const centralDirOffset = offset
    let centralDirSize = 0
    for (const entry of centralDirectory) {
      parts.push(entry)
      centralDirSize += entry.length
    }
    
    // End of central directory
    const eocd = new Uint8Array(22)
    const eocdView = new DataView(eocd.buffer)
    eocdView.setUint32(0, 0x06054b50, true) // End of central directory signature
    eocdView.setUint16(4, 0, true) // Disk number
    eocdView.setUint16(6, 0, true) // Disk number with central directory
    eocdView.setUint16(8, this.files.size, true) // Number of entries on this disk
    eocdView.setUint16(10, this.files.size, true) // Total number of entries
    eocdView.setUint32(12, centralDirSize, true) // Size of central directory
    eocdView.setUint32(16, centralDirOffset, true) // Offset of central directory
    eocdView.setUint16(20, 0, true) // Comment length
    parts.push(eocd)
    
    // Combine all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalLength)
    let pos = 0
    for (const part of parts) {
      result.set(part, pos)
      pos += part.length
    }
    
    return result
  }
  
  private async crc32(data: Uint8Array): Promise<number> {
    // CRC32 lookup table
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      }
      table[i] = c
    }
    
    let crc = 0xFFFFFFFF
    for (const byte of data) {
      crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
    }
    return (crc ^ 0xFFFFFFFF) >>> 0
  }
}

// Generate SHA1 hash
async function sha1(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Create a simple branded icon
function createIconPng(size: number): Uint8Array {
  // Create a minimal valid PNG with Ticketrack blue background
  // This is a simplified 8-bit indexed PNG
  const width = size
  const height = size
  
  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  
  // IHDR chunk
  const ihdrData = new Uint8Array(13)
  const ihdrView = new DataView(ihdrData.buffer)
  ihdrView.setUint32(0, width, false)
  ihdrView.setUint32(4, height, false)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 2  // color type (RGB)
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  
  // Create raw image data (RGB)
  const rawData: number[] = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // filter byte
    for (let x = 0; x < width; x++) {
      // Ticketrack blue: #2969FF
      rawData.push(41)  // R
      rawData.push(105) // G
      rawData.push(255) // B
    }
  }
  
  // Simple uncompressed deflate (store blocks)
  const imageData = new Uint8Array(rawData)
  const deflated = deflateStore(imageData)
  
  // Build PNG
  const chunks: Uint8Array[] = [signature]
  chunks.push(createPngChunk('IHDR', ihdrData))
  chunks.push(createPngChunk('IDAT', deflated))
  chunks.push(createPngChunk('IEND', new Uint8Array(0)))
  
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  
  return result
}

function deflateStore(data: Uint8Array): Uint8Array {
  // Zlib header + uncompressed deflate blocks
  const maxBlockSize = 65535
  const blocks: Uint8Array[] = []
  
  // Zlib header (no compression)
  blocks.push(new Uint8Array([0x78, 0x01]))
  
  for (let i = 0; i < data.length; i += maxBlockSize) {
    const isLast = i + maxBlockSize >= data.length
    const blockData = data.slice(i, Math.min(i + maxBlockSize, data.length))
    const blockSize = blockData.length
    
    const blockHeader = new Uint8Array(5)
    blockHeader[0] = isLast ? 1 : 0
    blockHeader[1] = blockSize & 0xFF
    blockHeader[2] = (blockSize >> 8) & 0xFF
    blockHeader[3] = ~blockSize & 0xFF
    blockHeader[4] = (~blockSize >> 8) & 0xFF
    
    blocks.push(blockHeader)
    blocks.push(blockData)
  }
  
  // Adler-32 checksum
  let a = 1, b = 0
  for (const byte of data) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  const adler = new Uint8Array(4)
  adler[0] = (b >> 8) & 0xFF
  adler[1] = b & 0xFF
  adler[2] = (a >> 8) & 0xFF
  adler[3] = a & 0xFF
  blocks.push(adler)
  
  const totalLength = blocks.reduce((sum, b) => sum + b.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const block of blocks) {
    result.set(block, offset)
    offset += block.length
  }
  
  return result
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const chunk = new Uint8Array(4 + 4 + data.length + 4)
  const view = new DataView(chunk.buffer)
  
  view.setUint32(0, data.length, false)
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)
  
  // CRC32 of type + data
  const crcData = new Uint8Array(4 + data.length)
  crcData.set(typeBytes, 0)
  crcData.set(data, 4)
  const crc = crc32Sync(crcData)
  view.setUint32(8 + data.length, crc, false)
  
  return chunk
}

function crc32Sync(data: Uint8Array): number {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  
  let crc = 0xFFFFFFFF
  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
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
          organizer:organizers(business_name, logo_url)
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
      'Failed to generate wallet pass. Please try downloading the PDF ticket instead.',
      corsHeaders
    )
  }
})

async function generateApplePass(ticket: any, event: any, supabaseClient: any): Promise<Response> {
  const APPLE_PASS_TYPE_ID = Deno.env.get('APPLE_PASS_TYPE_ID')
  const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID')
  const APPLE_CERTIFICATE = Deno.env.get('APPLE_PASS_CERTIFICATE')
  const APPLE_CERT_PASSWORD = Deno.env.get('APPLE_PASS_CERTIFICATE_PASSWORD') || ''

  // Check if Apple Wallet is configured
  if (!APPLE_PASS_TYPE_ID || !APPLE_TEAM_ID || !APPLE_CERTIFICATE) {
    safeLog.info('Apple Wallet not configured - missing environment variables')
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

  try {
    // Generate pass data
    const eventDate = new Date(event.start_date)
    
    const passData = {
      formatVersion: 1,
      passTypeIdentifier: APPLE_PASS_TYPE_ID,
      serialNumber: ticket.ticket_code,
      teamIdentifier: APPLE_TEAM_ID,
      organizationName: event.organizer?.business_name || 'Ticketrack',
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
            value: event.organizer?.business_name || 'Ticketrack'
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
      (passData as any).locations = [{
        latitude: parseFloat(event.venue_lat),
        longitude: parseFloat(event.venue_lng),
        relevantText: `You're near ${event.venue_name}!`
      }]
    }

    // Create the .pkpass file
    const zip = new SimpleZip()
    
    // Add pass.json
    const passJson = JSON.stringify(passData, null, 2)
    zip.addFile('pass.json', passJson)
    
    // Add icons (create simple branded icons)
    zip.addFile('icon.png', createIconPng(29))
    zip.addFile('icon@2x.png', createIconPng(58))
    zip.addFile('icon@3x.png', createIconPng(87))
    zip.addFile('logo.png', createIconPng(50))
    zip.addFile('logo@2x.png', createIconPng(100))

    // Create manifest.json with SHA1 hashes
    const manifest: Record<string, string> = {}
    const filesToHash = ['pass.json', 'icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png']
    
    for (const filename of filesToHash) {
      let content: Uint8Array
      if (filename === 'pass.json') {
        content = new TextEncoder().encode(passJson)
      } else {
        const size = filename.includes('@3x') ? 87 : filename.includes('@2x') ? (filename.includes('logo') ? 100 : 58) : (filename.includes('logo') ? 50 : 29)
        content = createIconPng(size)
      }
      manifest[filename] = await sha1(content)
    }
    
    const manifestJson = JSON.stringify(manifest)
    zip.addFile('manifest.json', manifestJson)

    // IMPORTANT: Apple Wallet requires PKCS#7 signing of the manifest
    // Without proper signing, iOS will reject the pass with "The pass cannot be read because it isn't valid"
    //
    // To properly sign the pass, we need:
    // 1. Apple Developer Pass Type ID certificate (.p12 file)
    // 2. WWDR (Apple Worldwide Developer Relations) intermediate certificate
    // 3. PKCS#7 (CMS) signing implementation
    //
    // Since Deno doesn't have native PKCS#7 support and we need the Apple certificates,
    // we return a fallback message until proper signing is implemented.

    safeLog.info('Apple Wallet signing not implemented - returning fallback')
    return new Response(
      JSON.stringify({
        error: 'Apple Wallet signing not configured',
        fallback: true,
        message: 'Apple Wallet passes are coming soon! For now, please use "Add to Calendar" to save your event.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

    // The code below would generate the .pkpass file once signing is implemented:
    /*
    // Generate the .pkpass file
    const pkpassData = await zip.generate()
    
    // Upload to Supabase Storage
    const fileName = `passes/${ticket.ticket_code}.pkpass`
    
    const { error: uploadError } = await supabaseClient.storage
      .from('tickets')
      .upload(fileName, pkpassData, {
        contentType: 'application/vnd.apple.pkpass',
        upsert: true
      })

    if (uploadError) {
      safeLog.error('Failed to upload pkpass:', uploadError)
      // Return the pass directly as download
      return new Response(pkpassData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="${ticket.ticket_code}.pkpass"`
        }
      })
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('tickets')
      .getPublicUrl(fileName)

    return new Response(
      JSON.stringify({
        success: true,
        passUrl: urlData.publicUrl,
        message: 'Apple Wallet pass generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
    */

  } catch (error) {
    safeLog.error('Apple pass generation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate Apple Wallet pass',
        fallback: true,
        message: 'Unable to generate Apple Wallet pass. Please use "Add to Calendar" instead.',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
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

  try {
    // Decode service account
    const serviceAccountJson = atob(GOOGLE_SERVICE_ACCOUNT)
    const serviceAccount = JSON.parse(serviceAccountJson)

    const eventDate = new Date(event.start_date)
    const endDate = event.end_date ? new Date(event.end_date) : new Date(eventDate.getTime() + 3 * 60 * 60 * 1000)

    // Create the event ticket object
    const ticketObject = {
      id: `${GOOGLE_ISSUER_ID}.${ticket.ticket_code}`,
      classId: `${GOOGLE_ISSUER_ID}.ticketrack_event_class`,
      state: 'ACTIVE',
      
      textModulesData: [
        {
          header: 'Ticket Code',
          body: ticket.ticket_code,
          id: 'ticket_code'
        },
        {
          header: 'Attendee',
          body: ticket.attendee_name,
          id: 'attendee'
        }
      ],
      
      barcode: {
        type: 'QR_CODE',
        value: ticket.ticket_code,
        alternateText: ticket.ticket_code
      },
      
      heroImage: event.image_url ? {
        sourceUri: {
          uri: event.image_url
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: event.title
          }
        }
      } : undefined
    }

    // Create JWT for "Save to Google Wallet" link
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: serviceAccount.client_email,
      aud: 'google',
      origins: ['https://ticketrack.com'],
      typ: 'savetowallet',
      iat: now,
      payload: {
        eventTicketObjects: [ticketObject]
      }
    }

    // Sign JWT with service account private key
    const encodedHeader = base64UrlEncode(JSON.stringify(header))
    const encodedPayload = base64UrlEncode(JSON.stringify(payload))
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    
    // Import the private key and sign
    const privateKeyPem = serviceAccount.private_key
    const signature = await signWithRSA(signatureInput, privateKeyPem)
    
    const jwt = `${signatureInput}.${signature}`
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`

    return new Response(
      JSON.stringify({ 
        success: true,
        saveUrl: saveUrl,
        message: 'Google Wallet pass ready'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    safeLog.error('Google Wallet pass error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate Google Wallet pass',
        fallback: true,
        message: 'Unable to generate Google Wallet pass. Please download your PDF ticket instead.',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signWithRSA(data: string, privateKeyPem: string): Promise<string> {
  // Extract the key from PEM format
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(data)
  )
  
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return base64Signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
