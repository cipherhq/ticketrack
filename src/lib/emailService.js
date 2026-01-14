/**
 * Ticketrack Email Service
 * 
 * Complete email service with 55+ email types
 * Security: JWT auth, rate limiting, permission matrix
 */

import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ============================================================================
// CORE EMAIL FUNCTION
// ============================================================================

/**
 * Send an email via the secured Edge Function
 * 
 * @param {string} type - Email template type
 * @param {string|string[]} to - Recipient email(s)
 * @param {object} data - Template data
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail(type, to, data, options = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
      },
      body: JSON.stringify({ type, to, data, ...options }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Email send failed:', result);
      return { success: false, error: result.error || 'Failed to send email' };
    }
    return result;
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AUTH & SECURITY EMAILS
// ============================================================================

export const sendWelcomeEmail = (email, data) => 
  sendEmail('welcome', email, { firstName: data.firstName });

export const sendEmailVerification = (email, data) => 
  sendEmail('email_verification', email, { firstName: data.firstName, verificationUrl: data.verificationUrl });

export const sendPasswordResetEmail = (email, data) => 
  sendEmail('password_reset', email, { firstName: data.firstName, resetUrl: data.resetUrl });

export const sendPasswordChangedEmail = (email, data) => 
  sendEmail('password_changed', email, {
    userName: data.userName,
    changedAt: data.changedAt || new Date().toISOString(),
    ipAddress: data.ipAddress,
    device: data.device,
  });

export const sendNewDeviceLoginEmail = (email, data) => 
  sendEmail('login_new_device', email, {
    userName: data.userName,
    loginAt: data.loginAt || new Date().toISOString(),
    location: data.location,
    ipAddress: data.ipAddress,
    device: data.device,
    browser: data.browser,
  });

export const sendProfileUpdatedEmail = (email, data) => 
  sendEmail('profile_updated', email, {
    userName: data.userName,
    updatedAt: data.updatedAt || new Date().toISOString(),
    changedFields: data.changedFields,
  });

export const sendSuspiciousActivityEmail = (email, data) => 
  sendEmail('suspicious_activity', email, {
    userName: data.userName,
    activityDescription: data.activityDescription,
    detectedAt: data.detectedAt || new Date().toISOString(),
    ipAddress: data.ipAddress,
    actionTaken: data.actionTaken,
  });

// ============================================================================
// BANK ACCOUNT SECURITY EMAILS
// ============================================================================

export const sendBankAccountAddedEmail = (email, data, organizerId) => 
  sendEmail('bank_account_added', email, {
    organizerName: data.organizerName,
    bankName: data.bankName,
    accountName: data.accountName,
    accountNumber: data.accountNumber,
    addedAt: data.addedAt || new Date().toISOString(),
    activeAfter: data.activeAfter,
    confirmationRequired: data.confirmationRequired,
    confirmationUrl: data.confirmationUrl,
  }, { organizerId });

export const sendBankAccountUpdatedEmail = (email, data, organizerId) => 
  sendEmail('bank_account_updated', email, {
    organizerName: data.organizerName,
    bankName: data.bankName,
    accountName: data.accountName,
    accountNumber: data.accountNumber,
    updatedAt: data.updatedAt || new Date().toISOString(),
    activeAfter: data.activeAfter,
  }, { organizerId });

export const sendBankAccountRemovedEmail = (email, data, organizerId) => 
  sendEmail('bank_account_removed', email, {
    organizerName: data.organizerName,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    removedAt: data.removedAt || new Date().toISOString(),
  }, { organizerId });

export const sendBankAccountVerifiedEmail = (email, data, organizerId) => 
  sendEmail('bank_account_verified', email, {
    organizerName: data.organizerName,
    bankName: data.bankName,
    accountName: data.accountName,
    accountNumber: data.accountNumber,
  }, { organizerId });

export const sendBankChangeConfirmationEmail = (email, data, organizerId) => 
  sendEmail('bank_change_confirmation', email, {
    organizerName: data.organizerName,
    changeType: data.changeType,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    requestedAt: data.requestedAt || new Date().toISOString(),
    confirmationUrl: data.confirmationUrl,
    cancelUrl: data.cancelUrl,
  }, { organizerId });

// ============================================================================
// TICKET EMAILS
// ============================================================================

export const sendTicketPurchaseEmail = (email, data, options = {}) => 
  sendEmail('ticket_purchase', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    city: data.city,
    ticketType: data.ticketType,
    quantity: data.quantity,
    orderNumber: data.orderNumber,
    totalAmount: data.totalAmount,
    currency: data.currency,
    isFree: data.isFree,
  }, options);

export const sendTicketCancelledEmail = (email, data) => 
  sendEmail('ticket_cancelled', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    ticketCode: data.ticketCode,
    refundAmount: data.refundAmount,
    currency: data.currency,
  });

export const sendTicketRefundedEmail = (email, data) => 
  sendEmail('ticket_refunded', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    refundAmount: data.refundAmount,
    orderNumber: data.orderNumber,
    currency: data.currency,
  });

export const sendTicketTransferSentEmail = (email, data) => 
  sendEmail('ticket_transfer_sent', email, {
    senderName: data.senderName,
    recipientName: data.recipientName,
    recipientEmail: data.recipientEmail,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    ticketType: data.ticketType,
    transferId: data.transferId,
  });

export const sendTicketTransferReceivedEmail = (email, data) => 
  sendEmail('ticket_transfer_received', email, {
    recipientName: data.recipientName,
    senderName: data.senderName,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    city: data.city,
    ticketType: data.ticketType,
  });

// ============================================================================
// EVENT REMINDER EMAILS
// ============================================================================

export const sendEventReminderEmail = (email, data) => 
  sendEmail('event_reminder', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    city: data.city,
    timeUntil: data.timeUntil,
  });

export const sendEventReminder24hEmail = (email, data) => 
  sendEmail('event_reminder_24h', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    ticketType: data.ticketType,
    ticketCode: data.ticketCode,
  });

export const sendEventReminder1hEmail = (email, data) => 
  sendEmail('event_reminder_1h', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    ticketCode: data.ticketCode,
  });

export const sendEventCancelledEmail = (email, data) => 
  sendEmail('event_cancelled', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    reason: data.reason,
    refundAmount: data.refundAmount,
    currency: data.currency,
  });

export const sendEventUpdatedEmail = (email, data) => 
  sendEmail('event_updated', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    city: data.city,
    changes: data.changes,
  });

// ============================================================================
// REFUND EMAILS
// ============================================================================

export const sendRefundRequestSubmittedEmail = (email, data) => 
  sendEmail('refund_request_submitted', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    ticketType: data.ticketType,
    amount: data.amount,
    currency: data.currency,
    requestId: data.requestId,
  });

export const sendRefundApprovedEmail = (email, data) => 
  sendEmail('refund_approved', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    refundAmount: data.refundAmount,
    currency: data.currency,
    organizerNotes: data.organizerNotes,
  });

export const sendRefundRejectedEmail = (email, data) => 
  sendEmail('refund_rejected', email, {
    attendeeName: data.attendeeName,
    eventTitle: data.eventTitle,
    refundAmount: data.refundAmount,
    currency: data.currency,
    organizerNotes: data.organizerNotes,
  });

export const sendRefundProcessedEmail = (email, data) => 
  sendEmail('refund_processed', email, {
    attendeeName: data.attendeeName,
    refundAmount: data.refundAmount,
    currency: data.currency,
    paymentMethod: data.paymentMethod,
  });

// ============================================================================
// WAITLIST EMAILS
// ============================================================================

export const sendWaitlistJoinedEmail = (email, data) => 
  sendEmail('waitlist_joined', email, {
    name: data.name,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    quantity: data.quantity,
    position: data.position,
  }, { eventId: data.eventId });

export const sendWaitlistAvailableEmail = (email, data) => 
  sendEmail('waitlist_available', email, {
    name: data.name,
    eventTitle: data.eventTitle,
    eventDate: data.eventDate,
    venueName: data.venueName,
    quantity: data.quantity,
    expiresAt: data.expiresAt,
    purchaseToken: data.purchaseToken,
  }, { eventId: data.eventId });

// ============================================================================
// SOCIAL EMAILS
// ============================================================================

export const sendNewFollowerEmail = (email, data, organizerId) => 
  sendEmail('new_follower', email, {
    organizerName: data.organizerName,
    followerName: data.followerName,
    totalFollowers: data.totalFollowers,
  }, { organizerId });

export const sendFollowingOrganizerEmail = (email, data) => 
  sendEmail('following_organizer', email, {
    userName: data.userName,
    organizerName: data.organizerName,
    organizerSlug: data.organizerSlug,
  });

// ============================================================================
// ORGANIZER ONBOARDING EMAILS
// ============================================================================

export const sendOrganizerWelcomeEmail = (email, data, organizerId) => 
  sendEmail('organizer_welcome', email, { businessName: data.businessName }, { organizerId });

export const sendKYCVerifiedEmail = (email, data, organizerId) => 
  sendEmail('kyc_verified', email, { organizerName: data.organizerName }, { organizerId });

export const sendKYCActionRequiredEmail = (email, data, organizerId) => 
  sendEmail('kyc_action_required', email, { organizerName: data.organizerName, message: data.message }, { organizerId });

export const sendKYCRejectedEmail = (email, data, organizerId) => 
  sendEmail('kyc_rejected', email, { organizerName: data.organizerName, reason: data.reason }, { organizerId });

export const sendStripeConnectActivatedEmail = (email, data, organizerId) => 
  sendEmail('stripe_connect_activated', email, {
    organizerName: data.organizerName,
    platformFeePercent: data.platformFeePercent,
  }, { organizerId });

// ============================================================================
// ORGANIZER OPERATIONS EMAILS
// ============================================================================

export const sendNewTicketSaleEmail = (email, data, organizerId) => 
  sendEmail('new_ticket_sale', email, {
    eventTitle: data.eventTitle,
    eventId: data.eventId,
    ticketType: data.ticketType,
    quantity: data.quantity,
    buyerName: data.buyerName,
    amount: data.amount,
    currency: data.currency,
    isFree: data.isFree,
    totalSold: data.totalSold,
    totalCapacity: data.totalCapacity,
  }, { organizerId, eventId: data.eventId });

export const sendDailySalesSummaryEmail = (email, data, organizerId) => 
  sendEmail('daily_sales_summary', email, {
    date: data.date,
    totalRevenue: data.totalRevenue,
    ticketsSold: data.ticketsSold,
    ordersCount: data.ordersCount,
    currency: data.currency,
  }, { organizerId });

export const sendLowTicketAlertEmail = (email, data, organizerId) => 
  sendEmail('low_ticket_alert', email, {
    eventTitle: data.eventTitle,
    eventId: data.eventId,
    ticketType: data.ticketType,
    remaining: data.remaining,
    sold: data.sold,
    total: data.total,
  }, { organizerId, eventId: data.eventId });

export const sendEventPublishedEmail = (email, data, organizerId) => 
  sendEmail('event_published', email, {
    eventTitle: data.eventTitle,
    eventId: data.eventId,
    eventDate: data.eventDate,
    venueName: data.venueName,
    eventUrl: data.eventUrl,
  }, { organizerId, eventId: data.eventId });

export const sendEventCancelledOrganizerEmail = (email, data, organizerId) => 
  sendEmail('event_cancelled_organizer', email, {
    eventTitle: data.eventTitle,
    ticketsSold: data.ticketsSold,
    refundTotal: data.refundTotal,
    currency: data.currency,
  }, { organizerId });

export const sendEventReminderOrganizerEmail = (email, data, organizerId) => 
  sendEmail('event_reminder_organizer', email, {
    eventTitle: data.eventTitle,
    eventId: data.eventId,
    eventDate: data.eventDate,
    venueName: data.venueName,
    ticketsSold: data.ticketsSold,
    revenue: data.revenue,
    currency: data.currency,
    timeUntil: data.timeUntil,
  }, { organizerId, eventId: data.eventId });

export const sendRefundRequestEmail = (email, data, organizerId) => 
  sendEmail('refund_request', email, {
    eventTitle: data.eventTitle,
    attendeeName: data.attendeeName,
    ticketType: data.ticketType,
    amount: data.amount,
    currency: data.currency,
    reason: data.reason,
    refundId: data.refundId,
  }, { organizerId, eventId: data.eventId });

export const sendPostEventSummaryEmail = (email, data, organizerId) => 
  sendEmail('post_event_summary', email, {
    eventTitle: data.eventTitle,
    eventId: data.eventId,
    totalRevenue: data.totalRevenue,
    ticketsSold: data.ticketsSold,
    checkedIn: data.checkedIn,
    checkInRate: data.checkInRate,
    payoutAmount: data.payoutAmount,
    currency: data.currency,
  }, { organizerId, eventId: data.eventId });

export const sendPayoutProcessedEmail = (email, data, organizerId) => 
  sendEmail('payout_processed', email, {
    amount: data.amount,
    currency: data.currency,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    reference: data.reference,
  }, { organizerId });

export const sendSMSCreditsPurchasedEmail = (email, data, organizerId) => 
  sendEmail('sms_units_purchased', email, {
    units: data.units,
    amount: data.amount,
    currency: data.currency,
    newBalance: data.newBalance,
  }, { organizerId });

export const sendWhatsAppCreditsPurchasedEmail = (email, data, organizerId) => 
  sendEmail('whatsapp_credits_purchased', email, {
    units: data.units,
    amount: data.amount,
    currency: data.currency,
    newBalance: data.newBalance,
  }, { organizerId });

export const sendLowSMSBalanceEmail = (email, data, organizerId) => 
  sendEmail('low_sms_balance', email, {
    organizerName: data.organizerName,
    balance: data.balance,
  }, { organizerId });

export const sendEventDraftReminderEmail = (email, data, organizerId) => 
  sendEmail('event_draft_reminder', email, {
    organizerName: data.organizerName,
    eventTitle: data.eventTitle,
    eventId: data.eventId,
  }, { organizerId, eventId: data.eventId });

// ============================================================================
// TEAM EMAILS
// ============================================================================

export const sendTeamInvitationEmail = (email, data, organizerId) => 
  sendEmail('team_invitation', email, {
    firstName: data.firstName || email.split('@')[0],
    organizerName: data.organizerName,
    roleName: data.roleName,
    inviteLink: data.inviteLink,
  }, { organizerId });

export const sendTeamMemberRemovedEmail = (email, data, organizerId) => 
  sendEmail('team_member_removed', email, {
    memberName: data.memberName,
    organizerName: data.organizerName,
  }, { organizerId });

export const sendTaskAssignedEmail = (email, data, organizerId) => 
  sendEmail('task_assigned', email, {
    assigneeName: data.assigneeName,
    assignerName: data.assignerName,
    taskTitle: data.taskTitle,
    description: data.description,
    eventTitle: data.eventTitle,
    priority: data.priority,
    dueDate: data.dueDate,
  }, { organizerId, eventId: data.eventId });
// ============================================================================
// PROMOTER EMAILS
// ============================================================================

export const sendPromoterInviteEmail = (email, data, organizerId) => 
  sendEmail('promoter_invite', email, {
    organizerName: data.organizerName,
    eventTitle: data.eventTitle,
    commissionValue: data.commissionValue,
    commissionType: data.commissionType,
    promoCode: data.promoCode,
    isNewUser: data.isNewUser,
    currency: data.currency,
  }, { organizerId, eventId: data.eventId });

export const sendPromoterAcceptedEmail = (email, data, organizerId) => 
  sendEmail('promoter_accepted', email, {
    promoterName: data.promoterName,
    eventTitle: data.eventTitle,
    promoCode: data.promoCode,
    commissionValue: data.commissionValue,
    commissionType: data.commissionType,
    currency: data.currency,
  }, { organizerId });

export const sendPromoterCommissionEmail = (email, data) => 
  sendEmail('promoter_commission', email, {
    eventTitle: data.eventTitle,
    promoCode: data.promoCode,
    saleAmount: data.saleAmount,
    amount: data.amount,
    currency: data.currency,
    pendingTotal: data.pendingTotal,
  });

export const sendPromoterPayoutEmail = (email, data) => 
  sendEmail('promoter_payout', email, {
    amount: data.amount,
    currency: data.currency,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
  });

export const sendPromoCodeUsedEmail = (email, data, organizerId) => 
  sendEmail('promo_code_used', email, {
    eventTitle: data.eventTitle,
    promoCode: data.promoCode,
    totalUses: data.totalUses,
  }, { organizerId });

export const sendPromoCodeCreatedEmail = (email, data, organizerId) => 
  sendEmail('promo_code_created', email, {
    organizerName: data.organizerName,
    promoCode: data.promoCode,
    discountValue: data.discountValue,
    discountType: data.discountType,
    eventTitle: data.eventTitle,
    maxUses: data.maxUses,
    expiresAt: data.expiresAt,
    currency: data.currency,
  }, { organizerId });

// ============================================================================
// AFFILIATE EMAILS
// ============================================================================

export const sendAffiliateCommissionEmail = (email, data) => 
  sendEmail('affiliate_commission_earned', email, {
    affiliateName: data.affiliateName,
    purchaseAmount: data.purchaseAmount,
    amount: data.amount,
    currency: data.currency,
    referralCode: data.referralCode,
    pendingTotal: data.pendingTotal,
  });

export const sendAffiliatePayoutEmail = (email, data) => 
  sendEmail('affiliate_payout_processed', email, {
    affiliateName: data.affiliateName,
    amount: data.amount,
    currency: data.currency,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    reference: data.reference,
  });

// ============================================================================
// SUPPORT EMAILS
// ============================================================================

export const sendSupportTicketCreatedEmail = (email, data) => 
  sendEmail('support_ticket_created', email, {
    userName: data.userName,
    ticketId: data.ticketId,
    category: data.category,
    subject: data.subject,
  });

export const sendSupportTicketReplyEmail = (email, data) => 
  sendEmail('support_ticket_reply', email, {
    userName: data.userName,
    ticketId: data.ticketId,
    subject: data.subject,
    reply: data.reply,
  });

export const sendSupportTicketResolvedEmail = (email, data) => 
  sendEmail('support_ticket_resolved', email, {
    userName: data.userName,
    ticketId: data.ticketId,
    subject: data.subject,
  });

// ============================================================================
// POST-EVENT EMAILS
// ============================================================================

export const sendPostEventThankYouEmail = (emails, data, organizerId) => 
  sendEmail('post_event_thank_you', emails, {
    attendeeName: data.attendeeName || 'there',
    eventTitle: data.eventTitle,
    organizerName: data.organizerName,
    organizerSlug: data.organizerSlug,
    message: data.message,
  }, { organizerId, eventId: data.eventId });

export const sendPostEventFeedbackEmail = (emails, data, organizerId) => 
  sendEmail('post_event_feedback', emails, {
    attendeeName: data.attendeeName || 'there',
    eventTitle: data.eventTitle,
    feedbackUrl: data.feedbackUrl,
  }, { organizerId, eventId: data.eventId });

export const sendPostEventNextEventEmail = (emails, data, organizerId) => 
  sendEmail('post_event_next_event', emails, {
    attendeeName: data.attendeeName || 'there',
    previousEventTitle: data.previousEventTitle,
    nextEventTitle: data.nextEventTitle,
    nextEventDate: data.nextEventDate,
    nextEventVenue: data.nextEventVenue,
    nextEventSlug: data.nextEventSlug,
  }, { organizerId, eventId: data.eventId });

// ============================================================================
// BULK CAMPAIGN EMAILS
// ============================================================================

export const sendBulkCampaignEmail = (emails, data, organizerId) => 
  sendEmail('bulk_campaign', emails, {
    subject: data.subject,
    title: data.title,
    body: data.body,
    ctaText: data.ctaText,
    ctaUrl: data.ctaUrl,
    preheader: data.preheader,
  }, { organizerId, eventId: data.eventId });

export const sendAdminBroadcastEmail = (emails, data) => 
  sendEmail('admin_broadcast', emails, {
    subject: data.subject,
    title: data.title,
    body: data.body,
    ctaText: data.ctaText,
    ctaUrl: data.ctaUrl,
    preheader: data.preheader,
  });

// ============================================================================
// ADMIN EMAILS
// ============================================================================

export const sendAdminNewOrganizerEmail = (email, data) => 
  sendEmail('admin_new_organizer', email, {
    businessName: data.businessName,
    email: data.email,
    createdAt: data.createdAt,
    organizerId: data.organizerId,
  });

export const sendAdminNewEventEmail = (email, data) => 
  sendEmail('admin_new_event', email, {
    eventTitle: data.eventTitle,
    organizerName: data.organizerName,
    eventDate: data.eventDate,
    eventId: data.eventId,
  });

export const sendAdminFlaggedContentEmail = (email, data) => 
  sendEmail('admin_flagged_content', email, {
    contentType: data.contentType,
    reason: data.reason,
    reportedBy: data.reportedBy,
    flagId: data.flagId,
  });

export const sendAdminDailyStatsEmail = (email, data) => 
  sendEmail('admin_daily_stats', email, {
    date: data.date,
    totalRevenue: data.totalRevenue,
    ticketsSold: data.ticketsSold,
    newUsers: data.newUsers,
    newOrganizers: data.newOrganizers,
    platformFees: data.platformFees,
    currency: data.currency,
  });

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  sendEmail,
  // Auth & Security
  sendWelcomeEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendNewDeviceLoginEmail,
  sendProfileUpdatedEmail,
  sendSuspiciousActivityEmail,
  // Bank Security
  sendBankAccountAddedEmail,
  sendBankAccountUpdatedEmail,
  sendBankAccountRemovedEmail,
  sendBankAccountVerifiedEmail,
  sendBankChangeConfirmationEmail,
  // Tickets
  sendTicketPurchaseEmail,
  sendTicketCancelledEmail,
  sendTicketRefundedEmail,
  sendTicketTransferSentEmail,
  sendTicketTransferReceivedEmail,
  // Event Reminders
  sendEventReminderEmail,
  sendEventReminder24hEmail,
  sendEventReminder1hEmail,
  sendEventCancelledEmail,
  sendEventUpdatedEmail,
  // Refunds
  sendRefundRequestSubmittedEmail,
  sendRefundApprovedEmail,
  sendRefundRejectedEmail,
  sendRefundProcessedEmail,
  // Waitlist
  sendWaitlistJoinedEmail,
  sendWaitlistAvailableEmail,
  // Social
  sendNewFollowerEmail,
  sendFollowingOrganizerEmail,
  // Organizer Onboarding
  sendOrganizerWelcomeEmail,
  sendKYCVerifiedEmail,
  sendKYCActionRequiredEmail,
  sendKYCRejectedEmail,
  sendStripeConnectActivatedEmail,
  // Organizer Operations
  sendNewTicketSaleEmail,
  sendDailySalesSummaryEmail,
  sendLowTicketAlertEmail,
  sendEventPublishedEmail,
  sendEventCancelledOrganizerEmail,
  sendEventReminderOrganizerEmail,
  sendRefundRequestEmail,
  sendPostEventSummaryEmail,
  sendPayoutProcessedEmail,
  sendSMSCreditsPurchasedEmail,
  sendWhatsAppCreditsPurchasedEmail,
  sendLowSMSBalanceEmail,
  sendEventDraftReminderEmail,
  // Team
  sendTeamInvitationEmail,
  sendTeamMemberRemovedEmail,
  sendTaskAssignedEmail,
  // Promoter
  sendPromoterInviteEmail,
  sendPromoterAcceptedEmail,
  sendPromoterCommissionEmail,
  sendPromoterPayoutEmail,
  sendPromoCodeUsedEmail,
  sendPromoCodeCreatedEmail,
  // Affiliate
  sendAffiliateCommissionEmail,
  sendAffiliatePayoutEmail,
  // Support
  sendSupportTicketCreatedEmail,
  sendSupportTicketReplyEmail,
  sendSupportTicketResolvedEmail,
  // Post-Event
  sendPostEventThankYouEmail,
  sendPostEventFeedbackEmail,
  sendPostEventNextEventEmail,
  // Bulk
  sendBulkCampaignEmail,
  sendAdminBroadcastEmail,
  // Admin
  sendAdminNewOrganizerEmail,
  sendAdminNewEventEmail,
  sendAdminFlaggedContentEmail,
  sendAdminDailyStatsEmail,
};
