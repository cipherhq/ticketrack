import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'

/**
 * Ticketrack PDF Ticket Generator
 * Standard ticket size: 6" x 2.25" (432 x 162 points)
 * 
 * Features:
 * - Ticketrack Blue (#0066FF) default background
 * - Optional event background image (organizer uploads)
 * - Optional sponsors section (only shows if sponsors exist)
 * - Powered by Ticketrack with white logo
 * - System-generated barcode
 */

// Ticketrack logo as base64 (white version for dark/blue backgrounds)
const TICKETRACK_LOGO_WHITE = 'data:image/png;base64,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'

// Ticketrack brand colors
const TICKETRACK_BLUE = { r: 0, g: 102, b: 255 }       // #0066FF - Main blue
const TICKETRACK_BLUE_DARK = { r: 0, g: 74, b: 204 }   // #004ACC - Darker blue for stub

export async function generateTicketPDF(ticket, event) {
  // Ticket dimensions in points (72 points = 1 inch)
  // 6" x 2.25" = 432 x 162 points
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

  // Add event background image if available (OPTIONAL)
  if (event.image_url) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = event.image_url
        setTimeout(reject, 3000) // 3 second timeout
      })
      
      // Add image covering main section
      pdf.addImage(img, 'JPEG', 0, 0, width - 100, height, undefined, 'FAST')
      
      // Add blue overlay for readability
      pdf.setFillColor(TICKETRACK_BLUE.r, TICKETRACK_BLUE.g, TICKETRACK_BLUE.b)
      pdf.setGState(new pdf.GState({ opacity: 0.7 }))
      pdf.rect(0, 0, width - 100, height, 'F')
      pdf.setGState(new pdf.GState({ opacity: 1 }))
    } catch (e) {
      // No image or failed to load - just use solid blue background
      console.log('Event image loading skipped, using solid blue:', e)
    }
  }

  // Right stub background - DARKER TICKETRACK BLUE
  pdf.setFillColor(TICKETRACK_BLUE_DARK.r, TICKETRACK_BLUE_DARK.g, TICKETRACK_BLUE_DARK.b)
  pdf.rect(width - 100, 0, 100, height, 'F')

  // Perforated line - dashed
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineDashPattern([4, 4], 0)
  pdf.setLineWidth(0.5)
  pdf.line(width - 100, 0, width - 100, height)
  pdf.setLineDashPattern([], 0)

  // TICKET NUMBER (vertical on left edge)
  const ticketNum = ticket.ticket_number || `TKT${Date.now().toString(36).toUpperCase()}`
  
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Ticket:', 8, height - 15, { angle: 90 })
  
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(255, 255, 255)
  pdf.text(ticketNum, 18, height - 15, { angle: 90 })

  // MAIN CONTENT
  const contentX = 35
  let currentY = 22

  // Event Title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(255, 255, 255)
  const title = event.title || 'Event Name'
  const maxTitleLength = 24
  const displayTitle = title.length > maxTitleLength ? title.substring(0, maxTitleLength) + '...' : title
  pdf.text(displayTitle, contentX, currentY)
  currentY += 14

  // Venue with location marker
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(230, 230, 230)
  const venue = `📍 ${event.venue_name || 'Venue'}, ${event.city || 'City'}`
  pdf.text(venue, contentX, currentY)
  currentY += 16

  // Info columns - Date, Time, Attendee
  const col1X = contentX
  const col2X = 180

  // Date
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('DATE', col1X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  pdf.text(formatDate(event.start_date), col1X, currentY + 10)

  // Attendee
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('ATTENDEE', col2X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  const attendeeName = ticket.attendee_name || 'Guest'
  const maxNameLength = 18
  const displayName = attendeeName.length > maxNameLength ? attendeeName.substring(0, maxNameLength) + '...' : attendeeName
  pdf.text(displayName, col2X, currentY + 10)

  currentY += 22

  // Time
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('TIME', col1X, currentY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  pdf.text(formatTime(event.start_date), col1X, currentY + 10)

  currentY += 18

  // SPONSORS SECTION - ONLY IF SPONSORS EXIST
  const sponsors = event.sponsors || []
  if (sponsors.length > 0) {
    // White background bar for sponsor visibility
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(contentX, currentY, 250, 20, 3, 3, 'F')
    
    // "Sponsors:" label
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6)
    pdf.setTextColor(0, 102, 255) // Ticketrack blue
    pdf.text('SPONSORS:', contentX + 5, currentY + 12)

    // Add sponsor logos
    let sponsorX = contentX + 45
    const sponsorY = currentY + 3
    const maxSponsorWidth = 38
    const sponsorHeight = 14

    for (let i = 0; i < Math.min(sponsors.length, 5); i++) {
      try {
        const sponsorImg = new Image()
        sponsorImg.crossOrigin = 'anonymous'
        await new Promise((resolve, reject) => {
          sponsorImg.onload = resolve
          sponsorImg.onerror = reject
          sponsorImg.src = sponsors[i]
          setTimeout(reject, 2000)
        })
        pdf.addImage(sponsorImg, 'PNG', sponsorX, sponsorY, maxSponsorWidth, sponsorHeight, undefined, 'FAST')
        sponsorX += maxSponsorWidth + 5
      } catch (e) {
        // Skip failed sponsor logos silently
        sponsorX += maxSponsorWidth + 5
      }
    }

    currentY += 24
  }

  // POWERED BY TICKETRACK (always shown)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(200, 200, 200)
  pdf.text('Powered by', contentX, height - 8)

  // Add Ticketrack logo (white version)
  try {
    pdf.addImage(TICKETRACK_LOGO_WHITE, 'PNG', contentX + 42, height - 18, 55, 12)
  } catch (e) {
    // Fallback to text
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(255, 255, 255)
    pdf.text('Ticketrack', contentX + 45, height - 8)
  }

  // RIGHT STUB
  const stubCenterX = width - 50

  // "ADMIT ONE" vertical
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor(100, 130, 180)
  pdf.text('ADMIT ONE', width - 97, height / 2, { angle: 90 })

  // Type
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(180, 200, 230)
  pdf.text('Type', stubCenterX, 18, { align: 'center' })
  
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(255, 255, 255)
  const ticketType = ticket.ticket_type?.name || 'General'
  pdf.text(ticketType, stubCenterX, 32, { align: 'center' })

  // Qty
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(180, 200, 230)
  pdf.text('Qty', stubCenterX, 48, { align: 'center' })
  
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(255, 255, 255)
  const qty = String(ticket.quantity || 1).padStart(2, '0')
  pdf.text(qty, stubCenterX, 62, { align: 'center' })

  // BARCODE
  try {
    const barcodeCanvas = document.createElement('canvas')
    JsBarcode(barcodeCanvas, ticketNum, {
      format: 'CODE128',
      width: 1,
      height: 35,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000'
    })
    
    // White background for barcode
    pdf.setFillColor(255, 255, 255)
    pdf.roundedRect(width - 95, 75, 85, 50, 3, 3, 'F')
    
    const barcodeDataUrl = barcodeCanvas.toDataURL('image/png')
    pdf.addImage(barcodeDataUrl, 'PNG', width - 90, 80, 75, 30)
  } catch (e) {
    console.log('Barcode generation skipped:', e)
  }

  // Barcode number
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(5)
  pdf.setTextColor(0, 0, 0)
  pdf.text(ticketNum, stubCenterX, 120, { align: 'center' })

  // Save PDF
  const filename = `ticket-${ticketNum}.pdf`
  pdf.save(filename)
  
  return filename
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

export default generateTicketPDF

// Wrapper function for compatibility
export async function downloadTicketPDF(ticket, event, ticketType) {
  return generateTicketPDF(ticket, event)
}

// Wrapper function for compatibility
