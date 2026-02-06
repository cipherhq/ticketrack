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
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"
import {
  errorResponse,
  logError,
  safeLog,
  ERROR_CODES
} from "../_shared/errorHandler.ts";

// Import node-forge - use esm.sh with deno target for better compatibility
import forge from 'https://esm.sh/node-forge@1.3.1?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Apple WWDR Certificate (G4) - required for pass signing
// This is Apple's public intermediate certificate
const APPLE_WWDR_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztMwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tZTuXu2hPXowAyJ1bET4gYUMhb/vLt7JvKtKI7k/a
xnBwYBpBsLknwvDxfLC4gqb5sHJq4s+k8F2XplH6G+ZPvn2kJWJpJTDqFDl/Hdeg
Z5duS9re1JwfPaZI8rLY0VSThQ0LmUJqW1k2Ri+HXJuuGXpLHH7ys8Y3t/APdPT0
kLWLqQFhlHYmuoQlSHIoThNLLJMM6RyCn5pzJE8/bTEMNzZPOrDQYWfedKmeP9H/
Oih0g5gnR0V/lLVp+1XdIGNkBsgRczR7hnqkQPjq7dkPXXVbqYdLd6MJPSZ7Vxw1
aCA+x5+H+RcQO0MD3ssCAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY79qPqn1IwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQB09+Vf7Y7Y
q3rtAUZXI9l4HTbS1K2hnpFelT/btXC9JuPbNhJT6hXWQ06pLiEl+NjhFSN+m1m8
pvCeCyrASTb1llJ+cW2VjvrdwtweI3U3cghFzfKu0uaW1sH+UmYpC9rJQfGHCnkt
KcN0Q3chH7T7K88Z8BuLOhf5754qZpI2d8e4OlSs4sTH3z+rhsn3JDz2U3VRkXB5
Q67kNbQ1LxnP8X0w8Wo9W/NXFF8lGGGhHZbLqzT0sLLqP5Xq/pW3bkLLhLqn5mIo
BhhZ7Sggz5P9Hb5z10Ct7CDB39eGlev/9sHNqtFCvy1lH2Q0Gj73RrZeFepnH2+n
P/VlOHQvgK0j
-----END CERTIFICATE-----`

// Simple ZIP implementation for Deno
class SimpleZip {
  private files: Map<string, Uint8Array> = new Map()

  addFile(name: string, content: Uint8Array | string) {
    if (typeof content === 'string') {
      content = new TextEncoder().encode(content)
    }
    this.files.set(name, content)
  }

  getFile(name: string): Uint8Array | undefined {
    return this.files.get(name)
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

// Create a simple branded icon PNG
function createIconPng(size: number): Uint8Array {
  const width = size
  const height = size

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = new Uint8Array(13)
  const ihdrView = new DataView(ihdrData.buffer)
  ihdrView.setUint32(0, width, false)
  ihdrView.setUint32(4, height, false)
  ihdrData[8] = 8
  ihdrData[9] = 2
  ihdrData[10] = 0
  ihdrData[11] = 0
  ihdrData[12] = 0

  const rawData: number[] = []
  for (let y = 0; y < height; y++) {
    rawData.push(0)
    for (let x = 0; x < width; x++) {
      rawData.push(41)
      rawData.push(105)
      rawData.push(255)
    }
  }

  const imageData = new Uint8Array(rawData)
  const deflated = deflateStore(imageData)

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
  const maxBlockSize = 65535
  const blocks: Uint8Array[] = []

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

/**
 * Sign the manifest using PKCS#7 with node-forge
 */
function signManifest(manifestData: string, p12Base64: string, password: string): Uint8Array {
  safeLog.info('Starting manifest signing...')

  try {
    // Validate inputs
    if (!p12Base64 || p12Base64.length < 100) {
      throw new Error('Invalid P12 certificate - too short or empty')
    }

    safeLog.info('Decoding P12 certificate...')

    // Decode the P12 certificate
    let p12Der: string
    try {
      p12Der = forge.util.decode64(p12Base64)
    } catch (decodeError) {
      safeLog.error('Failed to decode base64 P12:', decodeError)
      throw new Error('Failed to decode P12 certificate from base64')
    }

    safeLog.info('P12 decoded, length:', p12Der.length)

    let p12Asn1
    try {
      p12Asn1 = forge.asn1.fromDer(p12Der)
    } catch (asn1Error) {
      safeLog.error('Failed to parse P12 ASN1:', asn1Error)
      throw new Error('Failed to parse P12 certificate structure')
    }

    safeLog.info('Parsing PKCS12 structure...')

    let p12
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '')
    } catch (pkcs12Error) {
      safeLog.error('Failed to parse PKCS12:', pkcs12Error)
      throw new Error('Failed to parse P12 - check certificate password')
    }

    safeLog.info('Extracting certificate and private key...')

    // Extract certificate and private key
    let certificate: any = null
    let privateKey: any = null

    for (const safeContents of p12.safeContents) {
      for (const safeBag of safeContents.safeBags) {
        if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
          certificate = safeBag.cert
          safeLog.info('Found certificate')
        } else if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
          privateKey = safeBag.key
          safeLog.info('Found private key')
        }
      }
    }

    if (!certificate) {
      throw new Error('Could not extract certificate from P12')
    }
    if (!privateKey) {
      throw new Error('Could not extract private key from P12')
    }

    safeLog.info('Parsing WWDR certificate...')

    // Parse WWDR certificate
    let wwdrCert
    try {
      wwdrCert = forge.pki.certificateFromPem(APPLE_WWDR_CERT_PEM)
    } catch (wwdrError) {
      safeLog.error('Failed to parse WWDR cert:', wwdrError)
      throw new Error('Failed to parse Apple WWDR certificate')
    }

    safeLog.info('Creating PKCS7 signed data...')

    // Create PKCS#7 signed data
    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer(manifestData, 'utf8')
    p7.addCertificate(certificate)
    p7.addCertificate(wwdrCert)

    p7.addSigner({
      key: privateKey,
      certificate: certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date()
        }
      ]
    })

    safeLog.info('Signing...')
    p7.sign({ detached: true })

    safeLog.info('Converting to DER...')

    // Convert to DER
    const asn1 = p7.toAsn1()
    const der = forge.asn1.toDer(asn1)
    const bytes = der.getBytes()

    // Convert to Uint8Array
    const result = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) {
      result[i] = bytes.charCodeAt(i)
    }

    safeLog.info('Signing complete, signature length:', result.length)
    return result
  } catch (error) {
    safeLog.error('Signing error:', error instanceof Error ? error.message : error)
    throw error
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Safely parse the request body
    let body: any = {}
    try {
      const text = await req.text()
      safeLog.info('Raw request body length:', text.length)
      if (text && text.length > 0) {
        body = JSON.parse(text)
      }
    } catch (parseError) {
      safeLog.error('Failed to parse request body:', parseError)
      return new Response(JSON.stringify({
        success: false,
        error: 'invalid_request',
        message: 'Invalid or empty request body',
        debug: parseError instanceof Error ? parseError.message : String(parseError)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const { ticketId, platform, testCert } = body

    // Test mode - just test certificate loading
    if (testCert) {
      safeLog.info('=== CERTIFICATE TEST MODE ===')
      const APPLE_CERTIFICATE = Deno.env.get('APPLE_PASS_CERTIFICATE')
      const APPLE_CERT_PASSWORD = Deno.env.get('APPLE_PASS_CERTIFICATE_PASSWORD') || ''

      if (!APPLE_CERTIFICATE) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No certificate configured',
          step: 'env_check'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      safeLog.info('Certificate length:', APPLE_CERTIFICATE.length)
      safeLog.info('Password length:', APPLE_CERT_PASSWORD.length)

      try {
        // Test decode base64
        const p12Der = forge.util.decode64(APPLE_CERTIFICATE)
        safeLog.info('Base64 decode OK, DER length:', p12Der.length)

        // Test parse ASN1
        const p12Asn1 = forge.asn1.fromDer(p12Der)
        safeLog.info('ASN1 parse OK')

        // Test parse PKCS12 with password
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, APPLE_CERT_PASSWORD)
        safeLog.info('PKCS12 parse OK')

        // Extract cert and key
        let hasCert = false, hasKey = false
        for (const safeContents of p12.safeContents) {
          for (const safeBag of safeContents.safeBags) {
            if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) hasCert = true
            if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) hasKey = true
          }
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Certificate test passed!',
          hasCertificate: hasCert,
          hasPrivateKey: hasKey,
          certLength: APPLE_CERTIFICATE.length,
          derLength: p12Der.length
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      } catch (certError) {
        const errMsg = certError instanceof Error ? certError.message : String(certError)
        safeLog.error('Certificate test failed:', errMsg)
        return new Response(JSON.stringify({
          success: false,
          error: errMsg,
          step: 'cert_parse'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'wallet_pass_generation_failed',
        message: 'Failed to generate wallet pass.',
        debug: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
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
    safeLog.info('APPLE_PASS_TYPE_ID:', !!APPLE_PASS_TYPE_ID)
    safeLog.info('APPLE_TEAM_ID:', !!APPLE_TEAM_ID)
    safeLog.info('APPLE_PASS_CERTIFICATE:', !!APPLE_CERTIFICATE)
    return new Response(
      JSON.stringify({
        error: 'Apple Wallet not configured',
        fallback: true,
        message: 'Apple Wallet passes are coming soon! For now, please use "Add to Calendar".'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  // Validate certificate format (should be base64 encoded P12)
  safeLog.info('Certificate length:', APPLE_CERTIFICATE.length)
  safeLog.info('Certificate starts with:', APPLE_CERTIFICATE.substring(0, 20))

  // Check if the certificate looks like it might be a file path or raw binary
  if (APPLE_CERTIFICATE.startsWith('/') || APPLE_CERTIFICATE.startsWith('./')) {
    safeLog.error('Certificate appears to be a file path, not base64 content')
    return new Response(
      JSON.stringify({
        error: 'Certificate configuration error',
        fallback: true,
        message: 'Apple Wallet certificate must be base64 encoded. Please contact support.',
        details: 'Certificate appears to be a file path'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  // Check if certificate is valid base64
  const base64Regex = /^[A-Za-z0-9+/=]+$/
  if (!base64Regex.test(APPLE_CERTIFICATE.replace(/\s/g, ''))) {
    safeLog.error('Certificate does not appear to be valid base64')
    return new Response(
      JSON.stringify({
        error: 'Certificate configuration error',
        fallback: true,
        message: 'Apple Wallet certificate format is invalid. Please contact support.',
        details: 'Certificate is not valid base64'
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

    // Sign the manifest with PKCS#7
    safeLog.info('Signing Apple Wallet pass...')
    const signature = signManifest(manifestJson, APPLE_CERTIFICATE, APPLE_CERT_PASSWORD)
    zip.addFile('signature', signature)
    safeLog.info('Pass signed successfully')

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
      // Return the pass directly
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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    safeLog.error('Apple pass generation error:', errorMessage)

    // Provide specific error messages based on the error
    let userMessage = 'Unable to generate Apple Wallet pass. Please use "Add to Calendar" instead.'
    if (errorMessage.includes('P12') || errorMessage.includes('certificate') || errorMessage.includes('password')) {
      userMessage = 'Apple Wallet certificate configuration issue. Please contact support or use "Add to Calendar".'
    } else if (errorMessage.includes('private key')) {
      userMessage = 'Apple Wallet signing key issue. Please contact support or use "Add to Calendar".'
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to generate Apple Wallet pass',
        fallback: true,
        message: userMessage,
        details: errorMessage
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
        message: 'Google Wallet passes are coming soon! For now, please use "Add to Calendar".'
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
        message: 'Unable to generate Google Wallet pass. Please use "Add to Calendar" instead.',
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
