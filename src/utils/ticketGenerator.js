import jsPDF from 'jspdf'
import QRCode from 'qrcode'

/**
 * Ticketrack PDF Ticket Generator
 * Standard ticket size: 6" x 2.25" (432 x 162 points)
 * 
 * Features:
 * - Event background image with overlay
 * - QR code for easy scanning
 * - Sponsor logos section
 * - Powered by Ticketrack branding
 */

// Ticketrack logo as base64 (white version for dark/blue backgrounds)
const TICKETRACK_LOGO_WHITE = 'data:image/png;base64,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'

// Ticketrack brand colors
const TICKETRACK_BLUE = { r: 0, g: 102, b: 255 }
const TICKETRACK_BLUE_DARK = { r: 0, g: 74, b: 204 }

// Helper to load image as base64
async function loadImageAsBase64(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => reject(new Error('Image load timeout')), timeout)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

// Generate QR code as data URL
async function generateQRCode(data) {
  try {
    return await QRCode.toDataURL(data, {
      width: 80,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    })
  } catch (e) { console.log("Logo error:", e.message);
    console.error('QR code generation failed:', e)
    return null
  }
}

// Format date helper
function formatDate(dateString) {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
}

// Format time helper
function formatTime(dateString) {
  if (!dateString) return 'TBD'
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

export async function generateTicketPDF(ticket, event) {
  const width = 432
  const height = 162
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [width, height]
  })

  // Main ticket background - TICKETRACK BLUE
  pdf.setFillColor(TICKETRACK_BLUE.r, TICKETRACK_BLUE.g, TICKETRACK_BLUE.b)
  pdf.rect(0, 0, width, height, 'F')

  // Add event background image if available
  if (event.image_url) {
    try {
      const img = await loadImageAsBase64(event.image_url, 5000)
      pdf.addImage(img, 'JPEG', 0, 0, width - 100, height, undefined, 'FAST')
      
      // Add semi-transparent overlay for readability
      pdf.setFillColor(0, 0, 0)
      pdf.setGState(new pdf.GState({ opacity: 0.7 }))
      pdf.rect(0, 0, width - 100, height, 'F')
      pdf.setGState(new pdf.GState({ opacity: 1 }))
    } catch (e) { console.log("Logo error:", e.message);
      console.log('Event image not loaded, using solid background')
    }
  }

  // Right stub background - DARKER TICKETRACK BLUE
  pdf.setFillColor(TICKETRACK_BLUE_DARK.r, TICKETRACK_BLUE_DARK.g, TICKETRACK_BLUE_DARK.b)
  pdf.rect(width - 100, 0, 100, height, 'F')

  // Perforated line
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineDashPattern([4, 4], 0)
  pdf.setLineWidth(0.5)
  pdf.line(width - 100, 0, width - 100, height)
  pdf.setLineDashPattern([], 0)

  const ticketNum = ticket.ticket_code || `TKT${Date.now().toString(36).toUpperCase()}`
  
  // Ticket number vertical
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Ticket:', 8, height - 15, { angle: 90 })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(ticketNum, 18, height - 15, { angle: 90 })

  // MAIN CONTENT
  const contentX = 35
  let currentY = 22

  // Event Title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(255, 255, 255)
  const title = event.title || 'Event Name'
  const displayTitle = title.length > 26 ? title.substring(0, 26) + '...' : title
  pdf.text(displayTitle, contentX, currentY)
  currentY += 14

  // Venue
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(230, 230, 230)
  const venue = `${event.venue_name || 'Venue'}, ${event.city || 'City'}`
  const displayVenue = venue.length > 35 ? venue.substring(0, 35) + '...' : venue
  pdf.text(displayVenue, contentX, currentY)
  currentY += 14

  // Date & Attendee columns
  const col1X = contentX
  const col2X = 170

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('DATE', col1X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  pdf.text(formatDate(event.start_date), col1X, currentY + 10)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('ATTENDEE', col2X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  const attendeeName = ticket.attendee_name || 'Guest'
  const displayName = attendeeName.length > 20 ? attendeeName.substring(0, 20) + '...' : attendeeName
  pdf.text(displayName, col2X, currentY + 10)

  currentY += 22

  // Time
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('TIME', col1X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  pdf.text(formatTime(event.start_date), col1X, currentY + 10)

  // Ticket Type
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('TICKET TYPE', col2X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  const ticketType = ticket.ticket_type?.name || ticket.ticket_type_name || 'General'
  pdf.text(ticketType, col2X, currentY + 10)

  currentY += 24

  // SPONSORS SECTION
  const sponsors = (event.event_sponsors || []).map(s => s.logo_url).filter(Boolean)
  if (sponsors.length > 0) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(contentX, currentY, 240, 18, 2, 2, 'F')
    
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6)
    pdf.setTextColor(0, 102, 255)
    pdf.text('SPONSORS:', contentX + 4, currentY + 11)

    let sponsorX = contentX + 42
    for (let i = 0; i < Math.min(sponsors.length, 5); i++) {
      try {
        const sponsorImg = await loadImageAsBase64(sponsors[i], 2000)
        pdf.addImage(sponsorImg, 'PNG', sponsorX, currentY + 2, 35, 14, undefined, 'FAST')
        sponsorX += 40
      } catch (e) { console.log("Logo error:", e.message);
        sponsorX += 40
      }
    }
  }

  // POWERED BY TICKETRACK
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('Powered by', contentX, height - 8)
  try {
    pdf.addImage(TICKETRACK_LOGO_WHITE, 'PNG', contentX + 42, height - 18, 55, 12)
  } catch (e) { console.log("Logo error:", e.message);
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text('Ticketrack', contentX + 45, height - 8)
  }

  // RIGHT STUB
  const stubCenterX = width - 50

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 130, 180)
  pdf.text('ADMIT ONE', width - 97, height / 2, { angle: 90 })

  // QR CODE
  const qrData = await generateQRCode(ticketNum)
  if (qrData) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(width - 92, 15, 75, 75, 3, 3, 'F')
    pdf.addImage(qrData, 'PNG', width - 88, 19, 67, 67)
  }

  // Ticket code below QR
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6)
  pdf.setTextColor(255, 255, 255)
  pdf.text(ticketNum, stubCenterX, 100, { align: 'center' })

  // Ticket type on stub
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  pdf.setTextColor(180, 200, 230)
  pdf.text(ticketType, stubCenterX, 115, { align: 'center' })

  // SCAN TO CHECK-IN
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(5)
  pdf.setTextColor(200, 200, 200)
  pdf.text('SCAN TO CHECK-IN', stubCenterX, height - 10, { align: 'center' })

  const filename = `ticket-${ticketNum}.pdf`
  pdf.save(filename)
  return filename
}

export default generateTicketPDF

export async function downloadTicketPDF(ticket, event, ticketType) {
  return generateTicketPDF(ticket, event)
}

// Generate ticket PDF as base64 for email attachment
export async function generateTicketPDFBase64(ticket, event) {
  const width = 432
  const height = 162
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [width, height]
  })

  // Main ticket background - TICKETRACK BLUE
  pdf.setFillColor(TICKETRACK_BLUE.r, TICKETRACK_BLUE.g, TICKETRACK_BLUE.b)
  pdf.rect(0, 0, width, height, 'F')

  // Add event background image if available
  if (event.image_url) {
    try {
      const img = await loadImageAsBase64(event.image_url, 5000)
      pdf.addImage(img, 'JPEG', 0, 0, width - 100, height, undefined, 'FAST')
      
      // Add semi-transparent overlay for readability
      pdf.setFillColor(0, 0, 0)
      pdf.setGState(new pdf.GState({ opacity: 0.7 }))
      pdf.rect(0, 0, width - 100, height, 'F')
      pdf.setGState(new pdf.GState({ opacity: 1 }))
    } catch (e) { console.log("Logo error:", e.message);
      console.log('Event image not loaded, using solid background')
    }
  }

  // Right stub background - DARKER TICKETRACK BLUE
  pdf.setFillColor(TICKETRACK_BLUE_DARK.r, TICKETRACK_BLUE_DARK.g, TICKETRACK_BLUE_DARK.b)
  pdf.rect(width - 100, 0, 100, height, 'F')

  // Perforated line
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineDashPattern([4, 4], 0)
  pdf.setLineWidth(0.5)
  pdf.line(width - 100, 0, width - 100, height)
  pdf.setLineDashPattern([], 0)

  const ticketNum = ticket.ticket_code || `TKT${Date.now().toString(36).toUpperCase()}`
  
  // Ticket number vertical
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Ticket:', 8, height - 15, { angle: 90 })
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(ticketNum, 18, height - 15, { angle: 90 })

  // MAIN CONTENT
  const contentX = 35
  let currentY = 22

  // Event Title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(255, 255, 255)
  const title = event.title || 'Event Name'
  const displayTitle = title.length > 26 ? title.substring(0, 26) + '...' : title
  pdf.text(displayTitle, contentX, currentY)
  currentY += 14

  // Venue
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(230, 230, 230)
  const venue = `${event.venue_name || 'Venue'}, ${event.city || 'City'}`
  const displayVenue = venue.length > 35 ? venue.substring(0, 35) + '...' : venue
  pdf.text(displayVenue, contentX, currentY)
  currentY += 14

  // Date & Attendee columns
  const col1X = contentX
  const col2X = 170

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('DATE', col1X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  pdf.text(formatDate(event.start_date), col1X, currentY + 10)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('ATTENDEE', col2X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  const attendeeName = ticket.attendee_name || 'Guest'
  const displayName = attendeeName.length > 20 ? attendeeName.substring(0, 20) + '...' : attendeeName
  pdf.text(displayName, col2X, currentY + 10)

  currentY += 22

  // Time
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('TIME', col1X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  pdf.text(formatTime(event.start_date), col1X, currentY + 10)

  // Ticket Type
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('TICKET TYPE', col2X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(255, 255, 255)
  const ticketType = ticket.ticket_type?.name || ticket.ticket_type_name || 'General'
  pdf.text(ticketType, col2X, currentY + 10)

  currentY += 24

  // SPONSORS SECTION
  const sponsors = (event.event_sponsors || []).map(s => s.logo_url).filter(Boolean)
  if (sponsors.length > 0) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(contentX, currentY, 240, 18, 2, 2, 'F')
    
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6)
    pdf.setTextColor(0, 102, 255)
    pdf.text('SPONSORS:', contentX + 4, currentY + 11)

    let sponsorX = contentX + 42
    for (let i = 0; i < Math.min(sponsors.length, 5); i++) {
      try {
        const sponsorImg = await loadImageAsBase64(sponsors[i], 2000)
        pdf.addImage(sponsorImg, 'PNG', sponsorX, currentY + 2, 35, 14, undefined, 'FAST')
        sponsorX += 40
      } catch (e) { console.log("Logo error:", e.message);
        sponsorX += 40
      }
    }
  }

  // POWERED BY TICKETRACK
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('Powered by', contentX, height - 8)
  try {
    pdf.addImage(TICKETRACK_LOGO_WHITE, 'PNG', contentX + 42, height - 18, 55, 12)
  } catch (e) { console.log("Logo error:", e.message);
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text('Ticketrack', contentX + 45, height - 8)
  }

  // RIGHT STUB
  const stubCenterX = width - 50

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 130, 180)
  pdf.text('ADMIT ONE', width - 97, height / 2, { angle: 90 })

  // QR CODE
  const qrData = await generateQRCode(ticketNum)
  if (qrData) {
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(width - 92, 15, 75, 75, 3, 3, 'F')
    pdf.addImage(qrData, 'PNG', width - 88, 19, 67, 67)
  }

  // Ticket code below QR
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6)
  pdf.setTextColor(255, 255, 255)
  pdf.text(ticketNum, stubCenterX, 100, { align: 'center' })

  // Ticket type on stub
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  pdf.setTextColor(180, 200, 230)
  pdf.text(ticketType, stubCenterX, 115, { align: 'center' })

  // SCAN TO CHECK-IN
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(5)
  pdf.setTextColor(200, 200, 200)
  pdf.text('SCAN TO CHECK-IN', stubCenterX, height - 10, { align: 'center' })

  // Return as base64
  const pdfBase64 = pdf.output('datauristring').split(',')[1]
  
  return {
    base64: pdfBase64,
    filename: `ticket-${ticketNum}.pdf`
  }
}

// Generate multi-ticket PDF (one page per ticket) with organizer logo support
export async function generateMultiTicketPDFBase64(tickets, event) {
  if (!tickets || tickets.length === 0) {
    throw new Error('No tickets provided')
  }

  const width = 432
  const height = 162
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [width, height]
  })

  // Pre-load images once for efficiency
  let eventImg = null
  let organizerLogo = null

  // Load event background image
  if (event.image_url) {
    try {
      eventImg = await loadImageAsBase64(event.image_url, 5000)
    } catch (e) { console.log("Logo error:", e.message);
      console.log('Event image not loaded')
    }
  }

  // Load organizer logo
  const organizerLogoUrl = event.organizer?.logo_url
  if (organizerLogoUrl) {
    try {
      organizerLogo = await loadImageAsBase64(organizerLogoUrl, 3000)
    } catch (e) { console.log("Logo error:", e.message);
      console.log('Organizer logo not loaded')
    }
  }

  // Pre-load sponsor images
  const sponsors = (event.event_sponsors || []).map(s => s.logo_url).filter(Boolean)
  const sponsorImages = []
  for (const sponsorUrl of sponsors.slice(0, 5)) {
    try {
      const img = await loadImageAsBase64(sponsorUrl, 2000)
      sponsorImages.push(img)
    } catch (e) { console.log("Logo error:", e.message);
      sponsorImages.push(null)
    }
  }

  // Generate each ticket page
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]
    
    // Add new page for tickets after the first one
    if (i > 0) {
      pdf.addPage([width, height], 'landscape')
    }

    // Main ticket background - TICKETRACK BLUE
    pdf.setFillColor(TICKETRACK_BLUE.r, TICKETRACK_BLUE.g, TICKETRACK_BLUE.b)
    pdf.rect(0, 0, width, height, 'F')

    // Add event background image if available
    if (eventImg) {
      try {
        pdf.addImage(eventImg, 'JPEG', 0, 0, width - 100, height, undefined, 'FAST')
        
        // Add semi-transparent overlay for readability
        pdf.setFillColor(0, 0, 0)
        pdf.setGState(new pdf.GState({ opacity: 0.7 }))
        pdf.rect(0, 0, width - 100, height, 'F')
        pdf.setGState(new pdf.GState({ opacity: 1 }))
      } catch (e) { console.log("Logo error:", e.message);
        console.log('Error adding event image')
      }
    }

    // Right stub background - DARKER TICKETRACK BLUE
    pdf.setFillColor(TICKETRACK_BLUE_DARK.r, TICKETRACK_BLUE_DARK.g, TICKETRACK_BLUE_DARK.b)
    pdf.rect(width - 100, 0, 100, height, 'F')

    // Perforated line
    pdf.setDrawColor(255, 255, 255)
    pdf.setLineDashPattern([4, 4], 0)
    pdf.setLineWidth(0.5)
    pdf.line(width - 100, 0, width - 100, height)
    pdf.setLineDashPattern([], 0)

    const ticketNum = ticket.ticket_code || `TKT${Date.now().toString(36).toUpperCase()}`
    
    // Ticket number vertical
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(255, 255, 255)
    pdf.text('Ticket:', 8, height - 15, { angle: 90 })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(ticketNum, 18, height - 15, { angle: 90 })

    // ORGANIZER LOGO - Top right of main content area
    if (organizerLogo) {
      try {
        // White background for logo
        pdf.setFillColor(255, 255, 255)
        pdf.roundedRect(width - 155, 8, 48, 24, 3, 3, 'F')
        pdf.addImage(organizerLogo, 'PNG', width - 153, 10, 44, 20, undefined, 'FAST')
      } catch (e) { console.log("Logo error:", e.message);
        console.log('Error adding organizer logo')
      }
    }

    // MAIN CONTENT
    const contentX = 35
    let currentY = 22

    // Event Title
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.setTextColor(255, 255, 255)
    const title = event.title || 'Event Name'
    const displayTitle = title.length > 26 ? title.substring(0, 26) + '...' : title
    pdf.text(displayTitle, contentX, currentY)
    currentY += 14

    // Venue
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(230, 230, 230)
    const venue = `${event.venue_name || 'Venue'}, ${event.city || 'City'}`
    const displayVenue = venue.length > 35 ? venue.substring(0, 35) + '...' : venue
    pdf.text(displayVenue, contentX, currentY)
    currentY += 14

    // Date & Attendee columns
    const col1X = contentX
    const col2X = 170

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(200, 200, 200)
    pdf.text('DATE', col1X, currentY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(255, 255, 255)
    pdf.text(formatDate(event.start_date), col1X, currentY + 10)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(200, 200, 200)
    pdf.text('ATTENDEE', col2X, currentY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(255, 255, 255)
    const attendeeName = ticket.attendee_name || 'Guest'
    const displayName = attendeeName.length > 20 ? attendeeName.substring(0, 20) + '...' : attendeeName
    pdf.text(displayName, col2X, currentY + 10)

    currentY += 22

    // Time
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(200, 200, 200)
    pdf.text('TIME', col1X, currentY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(255, 255, 255)
    pdf.text(formatTime(event.start_date), col1X, currentY + 10)

    // Ticket Type
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(200, 200, 200)
    pdf.text('TICKET TYPE', col2X, currentY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(255, 255, 255)
    const ticketType = ticket.ticket_type?.name || ticket.ticket_type_name || 'General'
    pdf.text(ticketType, col2X, currentY + 10)

    currentY += 24

    // SPONSORS SECTION
    if (sponsorImages.some(img => img !== null)) {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(contentX, currentY, 240, 18, 2, 2, 'F')
      
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6)
      pdf.setTextColor(0, 102, 255)
      pdf.text('SPONSORS:', contentX + 4, currentY + 11)

      let sponsorX = contentX + 42
      for (const sponsorImg of sponsorImages) {
        if (sponsorImg) {
          try {
            pdf.addImage(sponsorImg, 'PNG', sponsorX, currentY + 2, 35, 14, undefined, 'FAST')
          } catch (e) { console.log("Logo error:", e.message);}
        }
        sponsorX += 40
      }
    }

    // POWERED BY TICKETRACK
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(200, 200, 200)
    pdf.text('Powered by', contentX, height - 8)
    try {
      pdf.addImage(TICKETRACK_LOGO_WHITE, 'PNG', contentX + 42, height - 18, 55, 12)
    } catch (e) { console.log("Logo error:", e.message);
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)
      pdf.text('Ticketrack', contentX + 45, height - 8)
    }

    // RIGHT STUB
    const stubCenterX = width - 50

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 130, 180)
    pdf.text('ADMIT ONE', width - 97, height / 2, { angle: 90 })

    // QR CODE
    const qrData = await generateQRCode(ticketNum)
    if (qrData) {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(width - 92, 15, 75, 75, 3, 3, 'F')
      pdf.addImage(qrData, 'PNG', width - 88, 19, 67, 67)
    }

    // Ticket code below QR
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6)
    pdf.setTextColor(255, 255, 255)
    pdf.text(ticketNum, stubCenterX, 100, { align: 'center' })

    // Ticket type on stub
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6)
    pdf.setTextColor(180, 200, 230)
    pdf.text(ticketType, stubCenterX, 115, { align: 'center' })

    // Ticket number (e.g., "2 of 10")
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(5)
    pdf.setTextColor(150, 170, 200)
    pdf.text(`${i + 1} of ${tickets.length}`, stubCenterX, 125, { align: 'center' })

    // SCAN TO CHECK-IN
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(5)
    pdf.setTextColor(200, 200, 200)
    pdf.text('SCAN TO CHECK-IN', stubCenterX, height - 10, { align: 'center' })
  }

  // Return as base64
  const pdfBase64 = pdf.output('datauristring').split(',')[1]
  const firstTicketCode = tickets[0]?.ticket_code || `TKT${Date.now().toString(36).toUpperCase()}`
  
  return {
    base64: pdfBase64,
    filename: `tickets-${firstTicketCode}.pdf`
  }
}
