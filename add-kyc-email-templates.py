#!/usr/bin/env python3
"""
Add KYC and Connect email templates to send-email function
"""

file_path = '/Users/bajideace/Desktop/ticketrack/supabase/functions/send-email/index.ts'

with open(file_path, 'r') as f:
    content = f.read()

# New templates to add
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
        <div class="info-row"><span class="info-label">Payment Processing</span><span class="info-value">Direct to your Stripe</span></div>
        <div class="info-row"><span class="info-label">Payout Speed</span><span class="info-value">2-3 business days after event</span></div>
        <div class="info-row"><span class="info-label">Platform Fee</span><span class="info-value">${data.platformFeePercent || '5'}%</span></div>
        <div class="info-row" style="border-bottom:none;"><span class="info-label">Refund Control</span><span class="info-value">Process refunds yourself</span></div>
      </div>
      <p>When customers purchase tickets to your events, the funds (minus our platform fee) will be deposited directly into your connected Stripe account.</p>
      <div class="button-wrapper"><a href="${data.appUrl}/organizer/stripe-connect" class="button">View Your Connect Dashboard</a></div>
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
      <p>We've initiated a payout for your recent event earnings.</p>
      <div class="ticket-card">
        <h3>Payout Details</h3>
        <div class="info-row"><span class="info-label">Amount</span><span class="info-value" style="color:#2969FF;font-size:24px;font-weight:bold;">${formatCurrency(data.amount, data.currency)}</span></div>
        <div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="color:#10b981;">Processing</span></div>
        <div class="info-row" style="border-bottom:none;"><span class="info-label">Expected Arrival</span><span class="info-value">2-3 business days</span></div>
      </div>
      <div class="button-wrapper"><a href="${data.appUrl}/organizer/stripe-connect" class="button">View Payout History</a></div>
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
        <div class="info-row"><span class="info-label">Refund Amount</span><span class="info-value" style="color:#10b981;font-size:20px;font-weight:bold;">${formatCurrency(data.refundAmount, data.currency)}</span></div>
        <div class="info-row"><span class="info-label">Event</span><span class="info-value">${data.eventTitle}</span></div>
        <div class="info-row"><span class="info-label">Original Payment</span><span class="info-value">${data.paymentMethod || 'Card'}</span></div>
        <div class="info-row" style="border-bottom:none;"><span class="info-label">Expected Arrival</span><span class="info-value">5-10 business days</span></div>
      </div>
      <p>The refund will be credited back to your original payment method.</p>
      <div class="button-wrapper"><a href="${data.appUrl}/tickets" class="button">View My Tickets</a></div>
    `, `Your refund has been processed`)
  }),

  kyc_verified: (data) => ({
    subject: `Identity Verified - You're All Set!`,
    html: baseTemplate(`
      <div class="success">
        <strong>Identity Verification Complete</strong>
        <p>Your identity has been successfully verified.</p>
      </div>
      <h2>You're Verified!</h2>
      <p>Hi ${data.organizerName},</p>
      <p>Great news! Your identity verification is complete. You can now:</p>
      <div class="ticket-card">
        <div class="info-row"><span class="info-label">Create Events</span><span class="info-value" style="color:#10b981;">Enabled</span></div>
        <div class="info-row"><span class="info-label">Receive Payouts</span><span class="info-value" style="color:#10b981;">Enabled</span></div>
        <div class="info-row" style="border-bottom:none;"><span class="info-label">Verification Level</span><span class="info-value">Level 1 - Verified</span></div>
      </div>
      <p>Thank you for completing the verification process. You're all set to start selling tickets!</p>
      <div class="button-wrapper"><a href="${data.appUrl}/organizer" class="button">Go to Dashboard</a></div>
    `, `Your identity has been verified`)
  }),

  kyc_action_required: (data) => ({
    subject: `Action Required - Complete Your Verification`,
    html: baseTemplate(`
      <div class="highlight">
        <strong>Action Required</strong>
        <p>We need additional information to complete your verification.</p>
      </div>
      <h2>Verification Needs Attention</h2>
      <p>Hi ${data.organizerName},</p>
      <p>${data.message || 'We need additional information to verify your identity.'}</p>
      <p>Please visit your KYC page to provide the required information and complete the verification process.</p>
      <div class="button-wrapper"><a href="${data.appUrl}/organizer/kyc" class="button">Complete Verification</a></div>
      <p style="color:#6b7280;font-size:14px;">If you have questions, please contact our support team.</p>
    `, `Action required for your verification`)
  }),

  kyc_rejected: (data) => ({
    subject: `Verification Update - Action Needed`,
    html: baseTemplate(`
      <div class="warning">
        <strong>Verification Could Not Be Completed</strong>
        <p>We were unable to verify your identity with the information provided.</p>
      </div>
      <h2>Verification Update</h2>
      <p>Hi ${data.organizerName},</p>
      <p>Unfortunately, we were unable to verify your identity. ${data.reason || 'Please try again with a clear photo of a valid government ID.'}</p>
      <p>You can upload your documents manually for review by our team.</p>
      <div class="button-wrapper"><a href="${data.appUrl}/organizer/kyc" class="button">Try Again</a></div>
      <p style="color:#6b7280;font-size:14px;">Need help? Contact support for assistance.</p>
    `, `Your verification needs attention`)
  }),
'''

# Find the closing brace before sendEmail function and insert templates
old_end = '''  }),
}

async function sendEmail'''

new_end = '''  }),
''' + new_templates + '''}

async function sendEmail'''

content = content.replace(old_end, new_end)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ Email templates added:")
print("   - stripe_connect_activated")
print("   - stripe_connect_payout_initiated")
print("   - refund_processed")
print("   - kyc_verified")
print("   - kyc_action_required")
print("   - kyc_rejected")
