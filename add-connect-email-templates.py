#!/usr/bin/env python3
"""
Script to add Stripe Connect email templates to send-email function
"""

file_path = '/Users/bajideace/Desktop/ticketrack/supabase/functions/send-email/index.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add new email types
old_types = "| 'event_reminder_24h' | 'event_reminder_1h'"
new_types = """| 'event_reminder_24h' | 'event_reminder_1h'
  | 'stripe_connect_activated' | 'stripe_connect_payout_initiated' | 'refund_processed'"""

content = content.replace(old_types, new_types)

# 2. Add the new templates before the closing of templates object
# Find the admin_daily_stats template end and add after it

new_templates = '''
  stripe_connect_activated: (data) => ({
    subject: `Stripe Connect Activated - Start Receiving Direct Payouts`,
    html: baseTemplate(`
      <div class="success">
        <strong>Your Stripe Connect Account is Active</strong>
        <p>You can now receive payouts directly to your bank account.</p>
      </div>
      
      <h2>Welcome to Direct Payouts</h2>
      <p>Hi ${data.organizerName},</p>
      <p>Great news! Your Stripe Connect account has been successfully activated. This means:</p>
      
      <div class="ticket-card">
        <h3>What's Changed</h3>
        <div class="info-row">
          <span class="info-label">Payment Processing</span>
          <span class="info-value">Direct to your Stripe</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payout Speed</span>
          <span class="info-value">2-3 business days after event</span>
        </div>
        <div class="info-row">
          <span class="info-label">Platform Fee</span>
          <span class="info-value">${data.platformFeePercent || '5'}%</span>
        </div>
        <div class="info-row" style="border-bottom:none;">
          <span class="info-label">Refund Control</span>
          <span class="info-value">Process refunds yourself</span>
        </div>
      </div>
      
      <p>When customers purchase tickets to your events, the funds (minus our platform fee) will be deposited directly into your connected Stripe account. Payouts to your bank will be initiated automatically 3 days after each event ends.</p>
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/organizer/stripe-connect" class="button">View Your Connect Dashboard</a>
      </div>
      
      <p style="color:#6b7280;font-size:14px;">Questions about payouts? Visit our Help Center or contact support.</p>
    `, `Your Stripe Connect account is now active`)
  }),

  stripe_connect_payout_initiated: (data) => ({
    subject: `Payout Initiated - ${formatCurrency(data.amount, data.currency)} on the way`,
    html: baseTemplate(`
      <div class="success">
        <strong>Payout Initiated</strong>
        <p>Your earnings are being transferred to your bank account.</p>
      </div>
      
      <h2>Your Payout is Processing</h2>
      <p>Hi ${data.organizerName},</p>
      <p>We've initiated a payout for your recent event earnings. Here are the details:</p>
      
      <div class="ticket-card">
        <h3>Payout Details</h3>
        <div class="info-row">
          <span class="info-label">Amount</span>
          <span class="info-value" style="color:${BRAND_COLOR};font-size:24px;font-weight:bold;">${formatCurrency(data.amount, data.currency)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Event</span>
          <span class="info-value">${data.eventTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="info-value" style="color:#10b981;">Processing</span>
        </div>
        <div class="info-row" style="border-bottom:none;">
          <span class="info-label">Expected Arrival</span>
          <span class="info-value">2-3 business days</span>
        </div>
      </div>
      
      <p>The funds will appear in your bank account within 2-3 business days, depending on your bank's processing time.</p>
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/organizer/stripe-connect" class="button">View Payout History</a>
      </div>
      
      <div class="highlight">
        <strong>Tip</strong>
        <p>You can view all your payouts and their status in your Stripe Connect dashboard.</p>
      </div>
    `, `Payout of ${formatCurrency(data.amount, data.currency)} initiated`)
  }),

  refund_processed: (data) => ({
    subject: `Refund Processed - ${formatCurrency(data.refundAmount, data.currency)} for ${data.eventTitle}`,
    html: baseTemplate(`
      <div class="success">
        <strong>Refund Processed Successfully</strong>
        <p>Your refund has been initiated and is on its way.</p>
      </div>
      
      <h2>Your Refund Has Been Processed</h2>
      <p>Hi ${data.attendeeName},</p>
      <p>Your refund request for <strong>${data.eventTitle}</strong> has been approved and processed.</p>
      
      <div class="ticket-card">
        <h3>Refund Details</h3>
        <div class="info-row">
          <span class="info-label">Refund Amount</span>
          <span class="info-value" style="color:#10b981;font-size:20px;font-weight:bold;">${formatCurrency(data.refundAmount, data.currency)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Event</span>
          <span class="info-value">${data.eventTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Original Payment</span>
          <span class="info-value">${data.paymentMethod || 'Card'}</span>
        </div>
        <div class="info-row" style="border-bottom:none;">
          <span class="info-label">Expected Arrival</span>
          <span class="info-value">5-10 business days</span>
        </div>
      </div>
      
      <p>The refund will be credited back to your original payment method. Please note that it may take 5-10 business days for the refund to appear on your statement, depending on your bank or card issuer.</p>
      
      <div class="button-wrapper">
        <a href="${data.appUrl}/tickets" class="button">View My Tickets</a>
      </div>
      
      <p style="color:#6b7280;font-size:14px;">We're sorry this event didn't work out. We hope to see you at another event soon!</p>
    `, `Your refund of ${formatCurrency(data.refundAmount, data.currency)} has been processed`)
  }),
'''

# Find the position to insert (after admin_daily_stats closing)
old_admin_end = '''  admin_daily_stats: (data) => ({
    subject: `📊 Daily Platform Stats - ${data.date}`,
    html: baseTemplate`<h2>Daily Platform Summary</h2><p>Performance on ${data.date}:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Revenue</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.totalRevenue)}</span></div><div class="info-row"><span class="info-label">Tickets</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row"><span class="info-label">New Users</span><span class="info-value">${data.newUsers}</span></div><div class="info-row"><span class="info-label">New Organizers</span><span class="info-value">${data.newOrganizers}</span></div><div class="info-row"><span class="info-label">New Events</span><span class="info-value">${data.newEvents}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Platform Fees</span><span class="info-value">${formatCurrency(data.platformFees)}</span></div></div><a href="${data.appUrl}/admin/analytics" class="button">View Dashboard</a>`)
  }),
}'''

new_admin_end = '''  admin_daily_stats: (data) => ({
    subject: `Daily Platform Stats - ${data.date}`,
    html: baseTemplate`<h2>Daily Platform Summary</h2><p>Performance on ${data.date}:</p><div class="ticket-card"><div class="info-row"><span class="info-label">Revenue</span><span class="info-value" style="color:${BRAND_COLOR};font-size:24px;">${formatCurrency(data.totalRevenue)}</span></div><div class="info-row"><span class="info-label">Tickets</span><span class="info-value">${data.ticketsSold}</span></div><div class="info-row"><span class="info-label">New Users</span><span class="info-value">${data.newUsers}</span></div><div class="info-row"><span class="info-label">New Organizers</span><span class="info-value">${data.newOrganizers}</span></div><div class="info-row"><span class="info-label">New Events</span><span class="info-value">${data.newEvents}</span></div><div class="info-row" style="border-bottom:none;"><span class="info-label">Platform Fees</span><span class="info-value">${formatCurrency(data.platformFees)}</span></div></div><a href="${data.appUrl}/admin/analytics" class="button">View Dashboard</a>`)
  }),
''' + new_templates + '}'

content = content.replace(old_admin_end, new_admin_end)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ Email templates added successfully!")
print("   - stripe_connect_activated")
print("   - stripe_connect_payout_initiated")
print("   - refund_processed")
print("")
print("Next: Deploy with 'supabase functions deploy send-email'")
