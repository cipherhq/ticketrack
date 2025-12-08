import { supabase } from './supabase';

// Email templates
const TEMPLATES = {
  // SMS Credits
  SMS_CREDITS_PURCHASED: {
    subject: 'SMS Credits Purchase Confirmation - Ticketrack',
    getHtml: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2969FF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ticketrack</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #0F0F0F;">SMS Credits Purchase Confirmed!</h2>
          <p>Hi ${data.organizerName},</p>
          <p>Your SMS credits purchase was successful. Here are the details:</p>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Package:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.packageName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Credits:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.credits}</td>
              </tr>
              ${data.bonusCredits > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Bonus Credits:</td>
                <td style="padding: 8px 0; font-weight: bold; color: green; text-align: right;">+${data.bonusCredits}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #666;">Total Credits:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.credits + data.bonusCredits}</td>
              </tr>
              <tr style="border-top: 1px solid #eee;">
                <td style="padding: 12px 0; color: #666;">Amount Paid:</td>
                <td style="padding: 12px 0; font-weight: bold; font-size: 18px; text-align: right;">₦${data.amount.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Reference: ${data.reference}<br>
            Date: ${new Date().toLocaleString()}
          </p>
          
          <p>Your new balance: <strong>${data.newBalance} credits</strong></p>
          
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #2969FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Go to Dashboard</a>
        </div>
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Ticketrack. All rights reserved.</p>
        </div>
      </div>
    `,
  },

  LOW_SMS_BALANCE: {
    subject: 'Low SMS Credits Alert - Ticketrack',
    getHtml: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2969FF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ticketrack</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #f59e0b;">⚠️ Low SMS Credits</h2>
          <p>Hi ${data.organizerName},</p>
          <p>Your SMS credit balance is running low.</p>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #856404; font-size: 24px; font-weight: bold;">${data.balance} credits remaining</p>
          </div>
          
          <p>Top up now to continue sending SMS to your attendees.</p>
          
          <a href="${data.topUpUrl}" style="display: inline-block; background: #2969FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Buy More Credits</a>
        </div>
      </div>
    `,
  },

  TICKET_PURCHASE: {
    subject: 'Your Tickets for {{eventName}} - Ticketrack',
    getHtml: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2969FF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ticketrack</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #0F0F0F;">🎉 Ticket Purchase Confirmed!</h2>
          <p>Hi ${data.attendeeName},</p>
          <p>Thank you for your purchase! Here are your ticket details:</p>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2969FF;">${data.eventName}</h3>
            <p style="color: #666;">
              📅 ${data.eventDate}<br>
              📍 ${data.eventVenue}
            </p>
            
            <table style="width: 100%; margin-top: 15px;">
              ${data.tickets.map(t => `
              <tr>
                <td style="padding: 8px 0;">${t.name} x ${t.quantity}</td>
                <td style="padding: 8px 0; text-align: right;">₦${t.subtotal.toLocaleString()}</td>
              </tr>
              `).join('')}
              <tr style="border-top: 2px solid #eee;">
                <td style="padding: 12px 0; font-weight: bold;">Total</td>
                <td style="padding: 12px 0; font-weight: bold; text-align: right;">₦${data.total.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666; font-size: 14px;">Order Reference: ${data.reference}</p>
          
          <a href="${data.ticketsUrl}" style="display: inline-block; background: #2969FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px;">View My Tickets</a>
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Show your ticket QR code at the venue for entry.
          </p>
        </div>
      </div>
    `,
  },

  PAYOUT_PROCESSED: {
    subject: 'Payout Processed - Ticketrack',
    getHtml: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2969FF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ticketrack</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #10b981;">✅ Payout Processed!</h2>
          <p>Hi ${data.organizerName},</p>
          <p>Great news! Your payout has been processed.</p>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Amount:</td>
                <td style="padding: 8px 0; font-weight: bold; font-size: 20px; text-align: right;">₦${data.amount.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Bank:</td>
                <td style="padding: 8px 0; text-align: right;">${data.bankName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Account:</td>
                <td style="padding: 8px 0; text-align: right;">****${data.accountNumber.slice(-4)}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #666;">The funds should reflect in your account within 24 hours.</p>
          
          <p style="color: #666; font-size: 14px;">Reference: ${data.reference}</p>
        </div>
      </div>
    `,
  },

  KYC_STATUS_CHANGE: {
    subject: 'KYC Verification Update - Ticketrack',
    getHtml: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2969FF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ticketrack</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: ${data.status === 'approved' ? '#10b981' : data.status === 'rejected' ? '#ef4444' : '#f59e0b'};">
            ${data.status === 'approved' ? '✅ KYC Approved!' : data.status === 'rejected' ? '❌ KYC Rejected' : '⏳ KYC Under Review'}
          </h2>
          <p>Hi ${data.organizerName},</p>
          
          ${data.status === 'approved' ? `
            <p>Congratulations! Your KYC verification has been approved. You now have full access to all organizer features including payouts.</p>
          ` : data.status === 'rejected' ? `
            <p>Unfortunately, your KYC verification was not approved.</p>
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${data.reason || 'Documents could not be verified'}</p>
            </div>
            <p>Please update your documents and resubmit.</p>
          ` : `
            <p>Your KYC documents are currently under review. We'll notify you once the review is complete.</p>
          `}
          
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #2969FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Go to Dashboard</a>
        </div>
      </div>
    `,
  },

  NEW_TICKET_SALE: {
    subject: 'New Ticket Sale for {{eventName}}! - Ticketrack',
    getHtml: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2969FF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Ticketrack</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #10b981;">💰 New Ticket Sale!</h2>
          <p>Hi ${data.organizerName},</p>
          <p>Great news! Someone just purchased tickets for your event.</p>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${data.eventName}</h3>
            <p><strong>Buyer:</strong> ${data.buyerName}</p>
            <p><strong>Tickets:</strong> ${data.ticketCount} x ${data.ticketType}</p>
            <p style="font-size: 20px; font-weight: bold; color: #10b981;">₦${data.amount.toLocaleString()}</p>
          </div>
          
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #2969FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px;">View Sales</a>
        </div>
      </div>
    `,
  },
};

// Send email function (uses Supabase Edge Function or direct API)
export async function sendEmail(to, templateKey, data) {
  const template = TEMPLATES[templateKey];
  if (!template) {
    console.error('Unknown email template:', templateKey);
    return { success: false, error: 'Unknown template' };
  }

  const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
  const html = template.getHtml(data);

  try {
    // Log email to audit table
    await supabase.from('email_audit').insert({
      recipient_email: to,
      subject: subject,
      template_key: templateKey,
      template_data: data,
      status: 'pending',
    });

    // TODO: Integrate with actual email provider (Resend, SendGrid, etc.)
    // For now, just log
    console.log('Email queued:', { to, subject, templateKey });

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Convenience functions
export async function sendSMSCreditsPurchaseReceipt(organizer, purchaseData) {
  return sendEmail(organizer.email || organizer.business_email, 'SMS_CREDITS_PURCHASED', {
    organizerName: organizer.business_name,
    packageName: purchaseData.packageName,
    credits: purchaseData.credits,
    bonusCredits: purchaseData.bonusCredits || 0,
    amount: purchaseData.amount,
    reference: purchaseData.reference,
    newBalance: purchaseData.newBalance,
    dashboardUrl: `${window.location.origin}/organizer/sms-credits`,
  });
}

export async function sendLowBalanceAlert(organizer, balance) {
  return sendEmail(organizer.email || organizer.business_email, 'LOW_SMS_BALANCE', {
    organizerName: organizer.business_name,
    balance: balance,
    topUpUrl: `${window.location.origin}/organizer/sms-credits`,
  });
}

export async function sendTicketPurchaseConfirmation(attendee, orderData) {
  return sendEmail(attendee.email, 'TICKET_PURCHASE', {
    attendeeName: attendee.full_name || attendee.email.split('@')[0],
    eventName: orderData.eventName,
    eventDate: orderData.eventDate,
    eventVenue: orderData.eventVenue,
    tickets: orderData.tickets,
    total: orderData.total,
    reference: orderData.reference,
    ticketsUrl: `${window.location.origin}/tickets`,
  });
}

export async function sendPayoutProcessedNotification(organizer, payoutData) {
  return sendEmail(organizer.email || organizer.business_email, 'PAYOUT_PROCESSED', {
    organizerName: organizer.business_name,
    amount: payoutData.amount,
    bankName: payoutData.bankName,
    accountNumber: payoutData.accountNumber,
    reference: payoutData.reference,
  });
}

export async function sendKYCStatusNotification(organizer, status, reason = null) {
  return sendEmail(organizer.email || organizer.business_email, 'KYC_STATUS_CHANGE', {
    organizerName: organizer.business_name,
    status: status,
    reason: reason,
    dashboardUrl: `${window.location.origin}/organizer/kyc`,
  });
}

export async function sendNewTicketSaleNotification(organizer, saleData) {
  return sendEmail(organizer.email || organizer.business_email, 'NEW_TICKET_SALE', {
    organizerName: organizer.business_name,
    eventName: saleData.eventName,
    buyerName: saleData.buyerName,
    ticketCount: saleData.ticketCount,
    ticketType: saleData.ticketType,
    amount: saleData.amount,
    dashboardUrl: `${window.location.origin}/organizer/events`,
  });
}
