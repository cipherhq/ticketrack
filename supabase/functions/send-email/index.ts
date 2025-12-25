// Ticketrack Email Service - Supabase Edge Function
// Handles all platform email notifications via Resend

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'Ticketrack <tickets@ticketrack.com>'
const BRAND_COLOR = '#2969FF'
const BRAND_NAME = 'Ticketrack'

// Supabase client for logging communications
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Email Types
type EmailType = 
  | 'welcome' | 'email_verification' | 'password_reset' | 'ticket_purchase'
  | 'ticket_cancelled' | 'ticket_refunded' | 'event_reminder' | 'event_cancelled'
  | 'event_updated' | 'ticket_transfer' | 'organizer_welcome' | 'new_ticket_sale'
  | 'daily_sales_summary' | 'event_published' | 'event_cancelled_organizer'
  | 'payout_processed' | 'sms_units_purchased' | 'low_ticket_alert'
  | 'event_reminder_organizer' | 'refund_request' | 'post_event_summary'
  | 'promoter_commission' | 'promoter_payout' | 'promo_code_used' | 'promoter_invite' | 'promoter_accepted'
  | 'admin_new_organizer' | 'admin_new_event' | 'admin_flagged_content' | 'admin_daily_stats'
  | 'waitlist_joined' | 'waitlist_available' | 'refund_approved' | 'refund_rejected'
  | 'event_reminder_24h' | 'event_reminder_1h'

interface EmailRequest {
  type: EmailType
  to: string
  data: Record<string, any>
  attachments?: Array<{ filename: string; content: string; type: string }>
  // Optional tracking fields for communication_logs
  userId?: string
  eventId?: string
  ticketId?: string
  orderId?: string
  waitlistId?: string
  skipLogging?: boolean  // Set true to skip logging (for internal/test emails)
}

function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function baseTemplate(content: string, preheader = ''): string {
  const LOGO_URL = 'https://ticketrack.com/logo.png'
  const SOCIAL_TWITTER = 'https://twitter.com/ticketrack'
  const SOCIAL_INSTAGRAM = 'https://instagram.com/ticketrack'
  const SOCIAL_FACEBOOK = 'https://facebook.com/ticketrack'
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${BRAND_NAME}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Base */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f4f6fa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    /* Container */
    .email-wrapper { width: 100%; background-color: #f4f6fa; padding: 40px 0; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); }
    
    /* Header */
    .header { 
      background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #1a4fd8 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo { max-width: 180px; height: auto; margin-bottom: 8px; }
    .header-tagline { color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; }
    
    /* Content */
    .content { padding: 40px 32px; }
    .content h2 { color: #0f0f0f; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; }
    .content p { color: #4a4a4a; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0; }
    .content ul { color: #4a4a4a; font-size: 16px; line-height: 1.8; padding-left: 24px; }
    .content li { margin-bottom: 8px; }
    
    /* Button */
    .button-wrapper { text-align: center; margin: 32px 0; }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #1a4fd8 100%);
      color: #ffffff !important;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 14px rgba(41, 105, 255, 0.4);
      transition: all 0.2s;
    }
    .button:hover { box-shadow: 0 6px 20px rgba(41, 105, 255, 0.5); }
    
    /* Card */
    .ticket-card {
      background: linear-gradient(135deg, #f8f9fc 0%, #f4f6fa 100%);
      border-radius: 16px;
      padding: 24px;
      margin: 24px 0;
      border: 1px solid #e8eaf0;
    }
    .ticket-card h3 { color: ${BRAND_COLOR}; margin: 0 0 16px 0; font-size: 18px; }
    .info-row { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      padding: 12px 0; 
      border-bottom: 1px solid #e8eaf0; 
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; font-size: 14px; }
    .info-value { color: #0f0f0f; font-weight: 600; font-size: 14px; text-align: right; }
    
    /* Alert Boxes */
    .highlight {
      background: linear-gradient(135deg, #fef9e7 0%, #fef3c7 100%);
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #f59e0b;
    }
    .highlight strong { color: #92400e; }
    .highlight p { color: #92400e; margin: 8px 0 0 0; font-size: 14px; }
    
    .success {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #10b981;
    }
    .success strong { color: #065f46; }
    .success p { color: #065f46; margin: 8px 0 0 0; font-size: 14px; }
    
    .warning {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #ef4444;
    }
    .warning strong { color: #991b1b; }
    .warning p { color: #991b1b; margin: 8px 0 0 0; font-size: 14px; }
    
    /* Divider */
    .divider { height: 1px; background: #e8eaf0; margin: 32px 0; }
    
    /* Footer */
    .footer {
      background: #f8f9fc;
      padding: 32px;
      text-align: center;
      border-top: 1px solid #e8eaf0;
    }
    .footer-logo { max-width: 120px; margin-bottom: 16px; opacity: 0.8; }
    .social-links { margin: 20px 0; }
    .social-link {
      display: inline-block;
      width: 36px;
      height: 36px;
      background: #e8eaf0;
      border-radius: 50%;
      margin: 0 6px;
      line-height: 36px;
      text-decoration: none;
    }
    .footer-text { color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0; }
    .footer-links { margin-top: 16px; }
    .footer-links a { color: #6b7280; text-decoration: none; font-size: 12px; margin: 0 12px; }
    .footer-links a:hover { color: ${BRAND_COLOR}; }
    
    /* Position Badge */
    .position-badge {
      text-align: center;
      padding: 24px 0;
    }
    .position-number {
      font-size: 56px;
      font-weight: 800;
      color: ${BRAND_COLOR};
      line-height: 1;
    }
    .position-label {
      color: #6b7280;
      font-size: 14px;
      margin-top: 8px;
    }
    
    /* Preheader */
    .preheader {
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { margin: 0 16px; border-radius: 12px; }
      .content { padding: 24px 20px; }
      .button { padding: 14px 32px; font-size: 15px; }
      .ticket-card { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="email-wrapper">
    <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0">
      <!-- Header -->
      <tr>
        <td class="header">
          <img src="${LOGO_URL}" alt="${BRAND_NAME}" class="logo" onerror="this.style.display='none'">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">🎫 ${BRAND_NAME}</h1>
          <p class="header-tagline">Your Gateway to Amazing Events</p>
        </td>
      </tr>
      
      <!-- Content -->
      <tr>
        <td class="content">
          ${content}
        </td>
      </tr>
      
      <!-- Footer -->
      <tr>
        <td class="footer">
          <div class="social-links">
            <a href="${SOCIAL_TWITTER}" class="social-link" style="color:#1da1f2;">𝕏</a>
            <a href="${SOCIAL_INSTAGRAM}" class="social-link" style="color:#e4405f;">📷</a>
            <a href="${SOCIAL_FACEBOOK}" class="social-link" style="color:#1877f2;">f</a>
          </div>
          <p class="footer-text">
            © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.<br>
            Africa's premier event discovery and ticketing platform.
          </p>
          <div class="footer-links">
            <a href="https://ticketrack.com/help">Help Center</a>
            <a href="https://ticketrack.com/privacy">Privacy</a>
            <a href="https://ticketrack.com/terms">Terms</a>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`
}

const templates: Record<EmailType, (data: Record<string, any>) => { subject: string; html: string }> = {
  welcome: (data) => ({
    subject: `Welcome to ${BRAND_NAME}! 🎉`,
    html: baseTemplate(`<h2>Welcome, ${data.firstName}! 👋</h2><p>We're thrilled to have you join ${BRAND_NAME} - Africa's premier event discovery and ticketing platform.</p><ul><li>🔍 Discover amazing events near you</li><li>🎫 Book tickets in seconds</li><li>❤️ Save events you're interested in</li><li>📱 Access your tickets anytime, anywhere</li></ul><a href="${data.appUrl}/events" class="button">Explore Events</a>`)
  }),

  email_verification: (data) => ({
    subject: `Verify your ${BRAND_NAME} email`,
    html: baseTemplate(`<h2>Verify Your Email</h2><p>Hi ${data.firstName},</p><p>Please verify your email address to complete your ${BRAND_NAME} registration.</p><a href="${data.verificationUrl}" class="button">Verify Email</a><p style="font-size:12px;color:#666;">This link expires in 24 hours.</p>`)
  }),

  password_reset: (data) => ({
    subject: `Reset your ${BRAND_NAME} password`,
    html: baseTemplate(`<h2>Password Reset Request</h2><p>Hi ${data.firstName},</p><p>Click below to reset your password:</p><a href="${data.resetUrl}" class="button">Reset Password</a><p style="font-size:12px;color:#666;">This link expires in 1 hour.</p>`)
  }),

  ticket_purchase: (data) => ({
    subject: `🎫 Your tickets for ${data.eventTitle}`,
    html: baseTemplate(`<div class="success"><strong>✅ Booking Confirmed!</strong></div><h2>You're going to ${data.eventTitle}!</h2><p>Hi ${data.attendeeName},</p><p>Your ticket purchase was successful!</p><div class="ticket-card"><h3 style="margin-top:0;color:${BRAND_COLOR};">${data.eventTitle}</h3><div class="info-row"><span class="info-label">📅 Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row"><span class="info-label">⏰ Time</span><span class="info-value">${formatTime(data.eventDate)}</span></div><div class="info-row"><span class="info-label">📍 Venue</span><span class="info-value">${data.venueName}, ${data.city}</span></div><div class="info-row"><span class="info-label">🎫 Ticket</span><span class="info-value">${data.ticketType} × ${data.quantity}</span></div><div class="info-row"><span class="info-label">💳 Order</span><span class="info-value">${data.orderNumber}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">💰 Total</span><span class="info-value">${data.isFree ? 'FREE' : formatCurrency(data.totalAmount)}</span></div></div><p><strong>Your ticket is attached as a PDF.</strong></p><a href="${data.appUrl}/tickets" class="button">View My Tickets</a><div class="highlight"><strong>📱 Pro Tip:</strong> Download your ticket before the event!</div>`, `Your tickets for ${data.eventTitle} are confirmed!`)
  }),

  ticket_cancelled: (data) => ({
    subject: `Ticket Cancelled - ${data.eventTitle}`,
    html: baseTemplate(`<h2>Ticket Cancellation Confirmed</h2><p>Hi ${data.attendeeName},</p><p>Your ticket for <strong>${data.eventTitle}</strong> has been cancelled.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Ticket Code</span><span class="info-value">${data.ticketCode}</span></div></div>${data.refundAmount ? `<div class="success"><strong>💰 Refund of ${formatCurrency(data.refundAmount)} is being processed.</strong></div>` : ''}<a href="${data.appUrl}/events" class="button">Browse Events</a>`)
  }),

  ticket_refunded: (data) => ({
    subject: `Refund Processed - ${data.eventTitle}`,
    html: baseTemplate(`<div class="success"><strong>💰 Refund Processed!</strong></div><h2>Your Refund is Complete</h2><p>Hi ${data.attendeeName},</p><p>Your refund for <strong>${data.eventTitle}</strong> has been processed.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Amount</span><span class="info-value">${formatCurrency(data.refundAmount)}</span></div><div class="info-row"><span class="info-label">Order</span><span class="info-value">${data.orderNumber}</span></div></div><p style="font-size:14px;color:#666;">Allow 5-10 business days for funds to appear.</p>`)
  }),

  event_reminder: (data) => ({
    subject: `⏰ Reminder: ${data.eventTitle} is ${data.timeUntil}!`,
    html: baseTemplate(`<h2>Your Event is Coming Up! 🎉</h2><p>Hi ${data.attendeeName},</p><p><strong>${data.eventTitle}</strong> is happening ${data.timeUntil}!</p><div class="ticket-card"><div class="info-row"><span class="info-label">📅 Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row"><span class="info-label">⏰ Time</span><span class="info-value">${formatTime(data.eventDate)}</span></div><div class="info-row"><span class="info-label">📍 Venue</span><span class="info-value">${data.venueName}, ${data.city}</span></div></div><a href="${data.appUrl}/tickets" class="button">View Your Ticket</a>`)
  }),

  event_cancelled: (data) => ({
    subject: `❌ Event Cancelled: ${data.eventTitle}`,
    html: baseTemplate(`<div class="warning"><strong>⚠️ Event Cancelled</strong></div><h2>We're Sorry</h2><p>Hi ${data.attendeeName},</p><p><strong>${data.eventTitle}</strong> has been cancelled.</p>${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}<div class="success"><strong>💰 Full refund of ${formatCurrency(data.refundAmount)} will be processed automatically.</strong></div><a href="${data.appUrl}/events" class="button">Find Similar Events</a>`)
  }),

  event_updated: (data) => ({
    subject: `📢 Update: ${data.eventTitle}`,
    html: baseTemplate(`<h2>Event Update</h2><p>Hi ${data.attendeeName},</p><p>Changes to <strong>${data.eventTitle}</strong>:</p><div class="highlight"><strong>What's Changed:</strong><ul>${data.changes.map((c: string) => `<li>${c}</li>`).join('')}</ul></div><div class="ticket-card"><div class="info-row"><span class="info-label">📅 Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row"><span class="info-label">📍 Venue</span><span class="info-value">${data.venueName}, ${data.city}</span></div></div><p>Your ticket remains valid!</p><a href="${data.appUrl}/tickets" class="button">View Your Ticket</a>`)
  }),

  ticket_transfer: (data) => ({
    subject: `🎫 Ticket Transferred: ${data.eventTitle}`,
    html: baseTemplate(`<h2>Ticket Transfer ${data.direction === 'sent' ? 'Sent' : 'Received'}</h2><p>Hi ${data.userName},</p>${data.direction === 'sent' ? `<p>Transferred to <strong>${data.recipientName}</strong>.</p>` : `<p><strong>${data.senderName}</strong> sent you a ticket!</p>`}<div class="ticket-card"><h3 style="margin-top:0;color:${BRAND_COLOR};">${data.eventTitle}</h3><div class="info-row"><span class="info-label">📅 Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row"><span class="info-label">🎫 Type</span><span class="info-value">${data.ticketType}</span></div></div>${data.direction === 'received' ? `<a href="${data.appUrl}/tickets" class="button">View Your Ticket</a>` : ''}`)
  }),

  organizer_welcome: (data) => ({
    subject: `Welcome to ${BRAND_NAME} Organizers! 🎪`,
    html: baseTemplate(`<h2>Welcome, ${data.businessName}! 🎉</h2><p>Your organizer account is active!</p><ul><li>🎪 Create and manage events</li><li>🎫 Sell tickets with multiple tiers</li><li>📊 Track sales in real-time</li><li>💰 Receive fast payouts</li></ul><a href="${data.appUrl}/organizer" class="button">Go to Dashboard</a>`)
  }),

  new_ticket_sale: (data) => ({
    subject: `🎉 New Sale: ${data.ticketType} for ${data.eventTitle}`,
    html: baseTemplate(`<div class="success"><strong>💰 New ticket sale!</strong></div><h2>You Made a Sale!</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Ticket</span><span class="info-value">${data.ticketType} × ${data.quantity}</span></div><div class="info-row"><span class="info-label">Buyer</span><span class="info-value">${data.buyerName}</span></div><div class="info-row"><span class="info-label">Email</span><span class="info-value">${data.buyerEmail}</span></div>${data.buyerPhone ? `<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${data.buyerPhone}</span></div>` : ''}<div class="info-row" style="border-bottom:none;"><span class="info-label">Amount</span><span class="info-value" style="color:${BRAND_COLOR};font-size:18px;">${data.isFree ? 'FREE' : formatCurrency(data.amount)}</span></div></div><p><strong>Total sold:</strong> ${data.totalSold} / ${data.totalCapacity}</p><a href="${data.appUrl}/organizer/events/${data.eventId}" class="button">View Dashboard</a>`)
  }),

  daily_sales_summary: (data) => ({
    subject: `📊 Daily Sales Summary - ${data.date}`,
    html: baseTemplate(`<h2>Daily Sales Summary</h2><p>Performance on ${data.date}:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Total Sales</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.totalRevenue)}</span></div><div class="info-row"><span class="info-label">Tickets Sold</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Orders</span><span class="info-value">${data.ordersCount}</span></div></div><a href="${data.appUrl}/organizer/analytics" class="button">View Analytics</a>`)
  }),

  event_published: (data) => ({
    subject: `✅ Event Published: ${data.eventTitle}`,
    html: baseTemplate(`<div class="success"><strong>🎉 Your event is live!</strong></div><h2>${data.eventTitle}</h2><p>Your event is now visible to attendees.</p><div class="ticket-card"><div class="info-row"><span class="info-label">📅 Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row"><span class="info-label">📍 Venue</span><span class="info-value">${data.venueName}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">🔗 Link</span><span class="info-value"><a href="${data.eventUrl}">${data.eventUrl}</a></span></div></div><a href="${data.appUrl}/organizer/events/${data.eventId}" class="button">Manage Event</a>`)
  }),

  event_cancelled_organizer: (data) => ({
    subject: `Event Cancelled: ${data.eventTitle}`,
    html: baseTemplate(`<h2>Event Cancellation Confirmed</h2><p><strong>${data.eventTitle}</strong> has been cancelled.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Tickets Sold</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Refunds</span><span class="info-value">${formatCurrency(data.refundTotal)}</span></div></div><p>All attendees notified. Refunds processing automatically.</p>`)
  }),

  payout_processed: (data) => ({
    subject: `💰 Payout Processed - ${formatCurrency(data.amount)}`,
    html: baseTemplate(`<div class="success"><strong>💰 Money on the way!</strong></div><h2>Payout Processed</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Amount</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.amount)}</span></div><div class="info-row"><span class="info-label">Bank</span><span class="info-value">${data.bankName}</span></div><div class="info-row"><span class="info-label">Account</span><span class="info-value">****${data.accountLast4}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Reference</span><span class="info-value">${data.reference}</span></div></div><p>Funds arrive within 24-48 hours.</p><a href="${data.appUrl}/organizer/payouts" class="button">View Payouts</a>`)
  }),

  sms_units_purchased: (data) => ({
    subject: `✅ SMS Units Purchased - ${data.units} units`,
    html: baseTemplate(`<div class="success"><strong>✅ Purchase Successful!</strong></div><h2>SMS Units Added</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Units</span><span class="info-value">${data.units}</span></div><div class="info-row"><span class="info-label">Amount</span><span class="info-value">${formatCurrency(data.amount)}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Balance</span><span class="info-value" style="color:${BRAND_COLOR};">${data.newBalance} units</span></div></div><a href="${data.appUrl}/organizer/settings/sms" class="button">Manage SMS</a>`)
  }),

  low_ticket_alert: (data) => ({
    subject: `⚠️ Low Tickets: ${data.eventTitle}`,
    html: baseTemplate(`<div class="highlight"><strong>⚠️ Running Low!</strong></div><h2>${data.eventTitle}</h2><p>Almost sold out!</p><div class="ticket-card"><div class="info-row"><span class="info-label">${data.ticketType}</span><span class="info-value" style="color:#dc3545;">${data.remaining} remaining</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Sold</span><span class="info-value">${data.sold} / ${data.total}</span></div></div><a href="${data.appUrl}/organizer/events/${data.eventId}/tickets" class="button">Manage Tickets</a>`)
  }),

  event_reminder_organizer: (data) => ({
    subject: `📅 Your event is ${data.timeUntil}: ${data.eventTitle}`,
    html: baseTemplate(`<h2>Your Event is ${data.timeUntil}!</h2><p>Prepare for <strong>${data.eventTitle}</strong>!</p><div class="ticket-card"><div class="info-row"><span class="info-label">📅 Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row"><span class="info-label">📍 Venue</span><span class="info-value">${data.venueName}</span></div><div class="info-row"><span class="info-label">🎫 Sold</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">💰 Revenue</span><span class="info-value">${formatCurrency(data.revenue)}</span></div></div><h3>Checklist:</h3><ul><li>✅ Download attendee list</li><li>✅ Set up check-in devices</li><li>✅ Brief team on scanner app</li></ul><a href="${data.appUrl}/organizer/events/${data.eventId}/check-in" class="button">Open Check-In</a>`)
  }),

  refund_approved: (data) => ({
    subject: `✅ Refund Approved: ${data.eventTitle}`,
    html: baseTemplate`<div class="success"><strong>✅ Refund Approved!</strong></div><h2>Your Refund Has Been Approved</h2><p>Hi ${data.attendeeName},</p><p>Good news! Your refund request for <strong>${data.eventTitle}</strong> has been approved.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Refund Amount</span><span class="info-value" style="color:#16a34a;font-weight:bold;">${formatCurrency(data.refundAmount)}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Processing Time</span><span class="info-value">5-7 business days</span></div></div>${data.organizerNotes ? `<p><strong>Note from organizer:</strong> ${data.organizerNotes}</p>` : ''}<p style="font-size:14px;color:#666;">The refund will be credited to your original payment method.</p><a href="${data.appUrl}/tickets" class="button">View My Tickets</a>`
  }),

  refund_rejected: (data) => ({
    subject: `❌ Refund Request Update: ${data.eventTitle}`,
    html: baseTemplate`<h2>Refund Request Update</h2><p>Hi ${data.attendeeName},</p><p>We regret to inform you that your refund request for <strong>${data.eventTitle}</strong> could not be approved at this time.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Requested Amount</span><span class="info-value">${formatCurrency(data.refundAmount)}</span></div></div>${data.organizerNotes ? `<div class="warning"><strong>Reason:</strong> ${data.organizerNotes}</div>` : ''}<p>If you believe this decision was made in error, you can escalate this to our support team.</p><a href="${data.appUrl}/support" class="button">Contact Support</a>`
  }),

  refund_request: (data) => ({
    subject: `🔔 Refund Request: ${data.eventTitle}`,
    html: baseTemplate(`<h2>New Refund Request</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Attendee</span><span class="info-value">${data.attendeeName}</span></div><div class="info-row"><span class="info-label">Ticket</span><span class="info-value">${data.ticketType}</span></div><div class="info-row"><span class="info-label">Amount</span><span class="info-value">${formatCurrency(data.amount)}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Reason</span><span class="info-value">${data.reason || 'Not specified'}</span></div></div><a href="${data.appUrl}/organizer/refunds/${data.refundId}" class="button">Review Request</a>`)
  }),

  post_event_summary: (data) => ({
    subject: `📊 Event Summary: ${data.eventTitle}`,
    html: baseTemplate(`<h2>Event Wrap-Up</h2><p><strong>${data.eventTitle}</strong> performance:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Revenue</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.totalRevenue)}</span></div><div class="info-row"><span class="info-label">Tickets</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row"><span class="info-label">Checked In</span><span class="info-value">${data.checkedIn} (${data.checkInRate}%)</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Payout</span><span class="info-value">${formatCurrency(data.payoutAmount)}</span></div></div><p>Payout processing within 2-3 business days.</p><a href="${data.appUrl}/organizer/events/${data.eventId}/analytics" class="button">View Report</a>`)
  }),

  promoter_commission: (data) => ({
    subject: `💰 Commission Earned: ${formatCurrency(data.amount)}`,
    html: baseTemplate(`<div class="success"><strong>💰 Commission earned!</strong></div><h2>Commission Earned</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Promo Code</span><span class="info-value">${data.promoCode}</span></div><div class="info-row"><span class="info-label">Sale</span><span class="info-value">${formatCurrency(data.saleAmount)}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Commission</span><span class="info-value" style="color:${BRAND_COLOR};font-size:18px;">${formatCurrency(data.amount)}</span></div></div><p><strong>Pending:</strong> ${formatCurrency(data.pendingTotal)}</p><a href="${data.appUrl}/promoter/earnings" class="button">View Earnings</a>`)
  }),

  promoter_payout: (data) => ({
    subject: `💰 Payout Processed - ${formatCurrency(data.amount)}`,
    html: baseTemplate(`<div class="success"><strong>💰 Payout on the way!</strong></div><h2>Promoter Payout</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Amount</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.amount)}</span></div><div class="info-row"><span class="info-label">Bank</span><span class="info-value">${data.bankName}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Account</span><span class="info-value">****${data.accountLast4}</span></div></div><a href="${data.appUrl}/promoter/payouts" class="button">View Payouts</a>`)
  }),

  promo_code_used: (data) => ({
    subject: `🎫 Your promo code was used!`,
    html: baseTemplate(`<h2>Promo Code Used!</h2><p>Someone used your code:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Code</span><span class="info-value">${data.promoCode}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Total Uses</span><span class="info-value">${data.totalUses}</span></div></div><a href="${data.appUrl}/promoter" class="button">View Dashboard</a>`)
  }),


  promoter_invite: (data) => ({
    subject: `🎉 You've been invited to promote ${data.eventTitle || 'events'} on Ticketrack!`,
    html: baseTemplate(`<h2>You're Invited to Promote!</h2><p><strong>${data.organizerName}</strong> has invited you to become a promoter on Ticketrack.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Organizer</span><span class="info-value">${data.organizerName}</span></div><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle || 'All Events'}</span></div><div class="info-row"><span class="info-label">Commission</span><span class="info-value">${data.commissionValue}${data.commissionType === 'percentage' ? '%' : ' NGN'} per ticket</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Your Promo Code</span><span class="info-value" style="color:#2969FF;font-weight:bold;">${data.promoCode}</span></div></div><p>Share your unique link and earn commission on every ticket sold!</p><a href="${data.appUrl}/promoter/accept?code=${data.promoCode}" class="button">${data.isNewUser ? 'Sign Up to Accept' : 'Accept Invitation'}</a><p style="color:#666;font-size:14px;margin-top:24px;">${data.isNewUser ? 'You will need to create a Ticketrack account to start promoting.' : 'Click above to view your promoter dashboard.'}</p>`)
  }),

  promoter_accepted: (data) => ({
    subject: `✅ ${data.promoterName} accepted your promoter invitation!`,
    html: baseTemplate(`<div class="success"><strong>✅ Invitation Accepted!</strong></div><h2>New Promoter Joined</h2><p><strong>${data.promoterName}</strong> has accepted your invitation to promote ${data.eventTitle || 'your events'}.</p><div class="ticket-card"><div class="info-row"><span class="info-label">Promoter</span><span class="info-value">${data.promoterName}</span></div><div class="info-row"><span class="info-label">Email</span><span class="info-value">${data.promoterEmail}</span></div><div class="info-row"><span class="info-label">Promo Code</span><span class="info-value" style="color:#2969FF;font-weight:bold;">${data.promoCode}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Commission Rate</span><span class="info-value">${data.commissionValue}${data.commissionType === 'percentage' ? '%' : ' NGN'}</span></div></div><a href="${data.appUrl}/organizer/promoters" class="button">View Promoters</a>`)
  }),

  admin_new_organizer: (data) => ({
    subject: `🆕 New Organizer: ${data.businessName}`,
    html: baseTemplate(`<h2>New Organizer Signup</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Business</span><span class="info-value">${data.businessName}</span></div><div class="info-row"><span class="info-label">Email</span><span class="info-value">${data.email}</span></div><div class="info-row"><span class="info-label">Phone</span><span class="info-value">${data.phone || 'N/A'}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Signed Up</span><span class="info-value">${formatDate(data.createdAt)}</span></div></div><a href="${data.appUrl}/admin/organizers/${data.organizerId}" class="button">View Details</a>`)
  }),

  admin_new_event: (data) => ({
    subject: `🎪 New Event: ${data.eventTitle}`,
    html: baseTemplate(`<h2>New Event Created</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div><div class="info-row"><span class="info-label">Organizer</span><span class="info-value">${data.organizerName}</span></div><div class="info-row"><span class="info-label">Date</span><span class="info-value">${formatDate(data.eventDate)}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Venue</span><span class="info-value">${data.venueName}, ${data.city}</span></div></div><a href="${data.appUrl}/admin/events/${data.eventId}" class="button">Review Event</a>`)
  }),

  admin_flagged_content: (data) => ({
    subject: `🚨 Flagged Content: ${data.contentType}`,
    html: baseTemplate(`<div class="warning"><strong>🚨 Review Required</strong></div><h2>Flagged Content</h2><div class="ticket-card"><div class="info-row"><span class="info-label">Type</span><span class="info-value">${data.contentType}</span></div><div class="info-row"><span class="info-label">Reason</span><span class="info-value">${data.reason}</span></div><div class="info-row"><span class="info-label">Reported By</span><span class="info-value">${data.reportedBy || 'System'}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Time</span><span class="info-value">${formatDate(data.flaggedAt)}</span></div></div><a href="${data.appUrl}/admin/moderation/${data.flagId}" class="button">Review Now</a>`)
  }),


  waitlist_joined: (data) => ({
    subject: `🎫 You're #${data.position} on the waitlist for ${data.eventTitle}`,
    html: baseTemplate(`
      <h2>You're on the Waitlist! 🎉</h2>
      <p>Hi ${data.name},</p>
      <p>Great news! You've been added to the waitlist for <strong>${data.eventTitle}</strong>.</p>
      
      <div class="ticket-card">
        <div class="position-badge">
          <div class="position-number">#${data.position}</div>
          <div class="position-label">Your position in queue</div>
        </div>
        <div class="divider" style="margin:16px 0;"></div>
        <div class="info-row">
          <span class="info-label">📅 Event Date</span>
          <span class="info-value">${formatDate(data.eventDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">📍 Venue</span>
          <span class="info-value">${data.venueName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">🎫 Tickets Requested</span>
          <span class="info-value">${data.quantity}</span>
        </div>
      </div>
      
      <div class="highlight">
        <strong>📬 What happens next?</strong>
        <p>We'll email you immediately when tickets become available. You'll have <strong>24 hours</strong> to complete your purchase before the offer moves to the next person.</p>
      </div>
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/e/${data.eventSlug}" class="button">View Event Details</a>
      </div>
    `, `You're #${data.position} on the waitlist for ${data.eventTitle}`)
  }),

  waitlist_available: (data) => ({
    subject: `🎉 Tickets Available! Your turn for ${data.eventTitle}`,
    html: baseTemplate(`
      <div class="success">
        <strong>🎉 Great news!</strong>
        <p>Tickets are now available for you to purchase!</p>
      </div>
      
      <h2>It's Your Turn!</h2>
      <p>Hi ${data.name},</p>
      <p>You've been waiting patiently, and now tickets for <strong>${data.eventTitle}</strong> are available just for you!</p>
      
      <div class="ticket-card">
        <div class="info-row">
          <span class="info-label">📅 Event Date</span>
          <span class="info-value">${formatDate(data.eventDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">📍 Venue</span>
          <span class="info-value">${data.venueName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">🎫 Tickets Reserved</span>
          <span class="info-value">${data.quantity}</span>
        </div>
      </div>
      
      <div class="warning">
        <strong>⏰ Act Fast!</strong>
        <p>This exclusive offer expires on <strong>${formatDate(data.expiresAt)}</strong> at <strong>${formatTime(data.expiresAt)}</strong>. After that, your spot goes to the next person in line.</p>
      </div>
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/waitlist/purchase?token=${data.purchaseToken}" class="button">🎫 Buy Tickets Now</a>
      </div>
      
      <p style="font-size:13px;color:#6b7280;text-align:center;margin-top:24px;">
        If you no longer need tickets, simply ignore this email and the next person in queue will get the opportunity.
      </p>
    `, `Tickets available for ${data.eventTitle}! You have 24 hours to purchase.`)
  }),


  event_reminder_24h: (data) => ({
    subject: `📅 Tomorrow: ${data.eventTitle} - Don't Forget!`,
    html: baseTemplate(`
      <h2>Your Event is Tomorrow! 🎉</h2>
      <p>Hi ${data.attendeeName},</p>
      <p>Just a friendly reminder that <strong>${data.eventTitle}</strong> is happening <strong>tomorrow</strong>!</p>
      
      <div class="ticket-card">
        <h3 style="margin-top:0;color:${BRAND_COLOR};">${data.eventTitle}</h3>
        <div class="info-row">
          <span class="info-label">📅 Date</span>
          <span class="info-value">${formatDate(data.eventDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">⏰ Time</span>
          <span class="info-value">${formatTime(data.eventDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">📍 Venue</span>
          <span class="info-value">${data.venueName}${data.city ? ', ' + data.city : ''}</span>
        </div>
        <div class="info-row">
          <span class="info-label">🎫 Ticket</span>
          <span class="info-value">${data.ticketType}</span>
        </div>
        <div class="info-row" style="border-bottom:none;">
          <span class="info-label">🔢 Code</span>
          <span class="info-value" style="font-family:monospace;">${data.ticketCode}</span>
        </div>
      </div>
      
      <div class="highlight">
        <strong>📝 Quick Checklist:</strong>
        <ul style="margin:8px 0 0 0;padding-left:20px;">
          <li>Save/screenshot your ticket QR code</li>
          <li>Check the venue location</li>
          <li>Plan your travel time</li>
        </ul>
      </div>
      
      ${data.venueAddress ? `
      <div class="button-wrapper">
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.venueAddress)}" class="button" style="background:#34a853;">📍 Get Directions</a>
      </div>
      ` : ''}
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/tickets" class="button">View Your Ticket</a>
      </div>
      
      <p style="text-align:center;color:#6b7280;font-size:14px;">See you there! 🎊</p>
    `, `Reminder: ${data.eventTitle} is tomorrow!`)
  }),

  event_reminder_1h: (data) => ({
    subject: `⏰ Starting Soon: ${data.eventTitle} in 1 Hour!`,
    html: baseTemplate(`
      <div class="warning" style="background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);border-left-color:#f59e0b;">
        <strong>⏰ Starting in 1 Hour!</strong>
      </div>
      
      <h2>It's Almost Time! 🚀</h2>
      <p>Hi ${data.attendeeName},</p>
      <p><strong>${data.eventTitle}</strong> starts in about <strong>1 hour</strong>!</p>
      
      <div class="ticket-card">
        <div class="info-row">
          <span class="info-label">📍 Venue</span>
          <span class="info-value">${data.venueName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">⏰ Starts At</span>
          <span class="info-value" style="color:${BRAND_COLOR};font-weight:bold;">${formatTime(data.eventDate)}</span>
        </div>
        <div class="info-row" style="border-bottom:none;">
          <span class="info-label">🎫 Your Code</span>
          <span class="info-value" style="font-family:monospace;font-size:16px;">${data.ticketCode}</span>
        </div>
      </div>
      
      <div class="success">
        <strong>📱 Show your QR code at the entrance</strong>
        <p>Have your ticket ready on your phone for quick check-in!</p>
      </div>
      
      ${data.venueAddress ? `
      <div class="button-wrapper">
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.venueAddress)}" class="button" style="background:#34a853;">📍 Navigate to Venue</a>
      </div>
      ` : ''}
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/tickets" class="button">Open My Ticket</a>
      </div>
      
      <p style="text-align:center;color:#6b7280;font-size:14px;">Have an amazing time! 🎉</p>
    `, `${data.eventTitle} starts in 1 hour!`)
  }),

  admin_daily_stats: (data) => ({
    subject: `📊 Daily Platform Stats - ${data.date}`,
    html: baseTemplate(`<h2>Daily Platform Summary</h2><p>Performance on ${data.date}:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Revenue</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.totalRevenue)}</span></div><div class="info-row"><span class="info-label">Tickets</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row"><span class="info-label">New Users</span><span class="info-value">${data.newUsers}</span></div><div class="info-row"><span class="info-label">New Organizers</span><span class="info-value">${data.newOrganizers}</span></div><div class="info-row"><span class="info-label">New Events</span><span class="info-value">${data.newEvents}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Platform Fees</span><span class="info-value">${formatCurrency(data.platformFees)}</span></div></div><a href="${data.appUrl}/admin/analytics" class="button">View Dashboard</a>`)
  }),
}

async function sendEmail(request: EmailRequest): Promise<{ success: boolean; messageId?: string; error?: string; logId?: string }> {
  if (!RESEND_API_KEY) return { success: false, error: 'RESEND_API_KEY not configured' }
  
  const template = templates[request.type]
  if (!template) return { success: false, error: `Unknown email type: ${request.type}` }

  const { subject, html } = template(request.data)

  // Create communication log entry (status: queued)
  let logId: string | undefined
  if (!request.skipLogging) {
    try {
      const { data: logEntry, error: logError } = await supabase
        .from('communication_logs')
        .insert({
          channel: 'email',
          template_key: request.type,
          recipient_email: request.to,
          recipient_user_id: request.userId || null,
          event_id: request.eventId || null,
          ticket_id: request.ticketId || null,
          order_id: request.orderId || null,
          waitlist_id: request.waitlistId || null,
          subject: subject,
          status: 'queued',
          provider: 'resend',
          metadata: { templateData: request.data }
        })
        .select('id')
        .single()
      
      if (logEntry) logId = logEntry.id
      if (logError) console.error('Failed to create communication log:', logError)
    } catch (err) {
      console.error('Communication log error:', err)
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: request.to, subject, html, attachments: request.attachments }),
    })

    const result = await response.json()
    
    if (!response.ok) {
      console.error('Resend API error:', result)
      
      // Update log with failure
      if (logId) {
        await supabase
          .from('communication_logs')
          .update({ 
            status: 'failed', 
            error_message: result.message || 'Failed to send email',
            updated_at: new Date().toISOString()
          })
          .eq('id', logId)
      }
      
      return { success: false, error: result.message || 'Failed to send email', logId }
    }
    
    // Update log with success
    if (logId) {
      await supabase
        .from('communication_logs')
        .update({ 
          status: 'sent', 
          provider_message_id: result.id,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', logId)
    }
    
    return { success: true, messageId: result.id, logId }
  } catch (error) {
    console.error('Email send error:', error)
    
    // Update log with failure
    if (logId) {
      await supabase
        .from('communication_logs')
        .update({ 
          status: 'failed', 
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', logId)
    }
    
    return { success: false, error: error.message, logId }
  }
}

Deno.serve(async (req) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const request: EmailRequest = await req.json()
    if (!request.type || !request.to || !request.data) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: type, to, data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const result = await sendEmail(request)
    return new Response(JSON.stringify(result), { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Handler error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
