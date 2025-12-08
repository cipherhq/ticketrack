// Ticketrack Email Service - Supabase Edge Function
// Handles all platform email notifications via Resend

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'Ticketrack <tickets@ticketrack.com>'
const BRAND_COLOR = '#2969FF'
const BRAND_NAME = 'Ticketrack'

// Email Types
type EmailType = 
  | 'welcome' | 'email_verification' | 'password_reset' | 'ticket_purchase'
  | 'ticket_cancelled' | 'ticket_refunded' | 'event_reminder' | 'event_cancelled'
  | 'event_updated' | 'ticket_transfer' | 'organizer_welcome' | 'new_ticket_sale'
  | 'daily_sales_summary' | 'event_published' | 'event_cancelled_organizer'
  | 'payout_processed' | 'sms_units_purchased' | 'low_ticket_alert'
  | 'event_reminder_organizer' | 'refund_request' | 'post_event_summary'
  | 'promoter_commission' | 'promoter_payout' | 'promo_code_used'
  | 'admin_new_organizer' | 'admin_new_event' | 'admin_flagged_content' | 'admin_daily_stats'

interface EmailRequest {
  type: EmailType
  to: string
  data: Record<string, any>
  attachments?: Array<{ filename: string; content: string; type: string }>
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${BRAND_NAME}</title><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f6fa}.container{max-width:600px;margin:0 auto;background:#fff}.header{background:${BRAND_COLOR};padding:24px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px;font-weight:700}.content{padding:32px 24px}.footer{background:#f4f6fa;padding:24px;text-align:center;font-size:12px;color:#666}.button{display:inline-block;background:${BRAND_COLOR};color:#fff!important;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;margin:16px 0}.ticket-card{background:#f4f6fa;border-radius:12px;padding:20px;margin:16px 0}.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e0e0}.info-label{color:#666;font-size:14px}.info-value{color:#0f0f0f;font-weight:600;font-size:14px}.highlight{background:#fff3cd;padding:16px;border-radius:8px;margin:16px 0}.success{background:#d4edda;padding:16px;border-radius:8px;margin:16px 0}.warning{background:#f8d7da;padding:16px;border-radius:8px;margin:16px 0}h2{color:#0f0f0f;margin-top:0}p{color:#333;line-height:1.6}.preheader{display:none;max-height:0;overflow:hidden}</style></head><body><div class="preheader">${preheader}</div><div class="container"><div class="header"><h1>🎫 ${BRAND_NAME}</h1></div><div class="content">${content}</div><div class="footer"><p>© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p><p>The best platform for discovering and booking events across Africa.</p></div></div></body></html>`
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

  admin_daily_stats: (data) => ({
    subject: `📊 Daily Platform Stats - ${data.date}`,
    html: baseTemplate(`<h2>Daily Platform Summary</h2><p>Performance on ${data.date}:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Revenue</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.totalRevenue)}</span></div><div class="info-row"><span class="info-label">Tickets</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row"><span class="info-label">New Users</span><span class="info-value">${data.newUsers}</span></div><div class="info-row"><span class="info-label">New Organizers</span><span class="info-value">${data.newOrganizers}</span></div><div class="info-row"><span class="info-label">New Events</span><span class="info-value">${data.newEvents}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Platform Fees</span><span class="info-value">${formatCurrency(data.platformFees)}</span></div></div><a href="${data.appUrl}/admin/analytics" class="button">View Dashboard</a>`)
  }),
}

async function sendEmail(request: EmailRequest): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!RESEND_API_KEY) return { success: false, error: 'RESEND_API_KEY not configured' }
  
  const template = templates[request.type]
  if (!template) return { success: false, error: `Unknown email type: ${request.type}` }

  const { subject, html } = template(request.data)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: request.to, subject, html, attachments: request.attachments }),
    })

    const result = await response.json()
    if (!response.ok) {
      console.error('Resend API error:', result)
      return { success: false, error: result.message || 'Failed to send email' }
    }
    return { success: true, messageId: result.id }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: error.message }
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
