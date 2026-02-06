// Ticketrack Email Service - Secured Edge Function v2
// Full implementation with 55+ email templates
// Security: JWT auth, CORS whitelist, rate limiting, permission matrix

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const FROM_EMAIL = 'Ticketrack <support@ticketrack.com>'
const SECURITY_EMAIL = 'Ticketrack Security <security@ticketrack.com>'
const SUPPORT_EMAIL = 'support@ticketrack.com'
const BRAND_COLOR = '#2969FF'
const BRAND_NAME = 'Ticketrack'
const APP_URL = 'https://ticketrack.com'

// BCC support@ticketrack.com on ALL emails for record-keeping
const BCC_ALL_EMAILS = true

// Production origins - localhost is only added in development
const PRODUCTION_ORIGINS = ['https://ticketrack.com', 'https://ticketrack.vercel.app', 'https://www.ticketrack.com']
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:3000']
const IS_DEVELOPMENT = Deno.env.get('ENVIRONMENT') === 'development' || Deno.env.get('SUPABASE_URL')?.includes('localhost')
const ALLOWED_ORIGINS = IS_DEVELOPMENT ? [...PRODUCTION_ORIGINS, ...DEV_ORIGINS] : PRODUCTION_ORIGINS

// Production logging guard - only log in development, always log errors
const log = {
  info: (...args: unknown[]) => IS_DEVELOPMENT && console.log(...args),
  error: (...args: unknown[]) => console.error(...args), // Always log errors
  debug: (...args: unknown[]) => IS_DEVELOPMENT && console.log(...args),
}
const RATE_LIMITS = { standard: 50, bulk_campaign: 1000, admin_broadcast: 10000, security: 100 }

type AuthLevel = 'SYSTEM_ONLY' | 'USER_AUTH' | 'ORGANIZER_AUTH' | 'ADMIN_AUTH' | 'FINANCE_AUTH'

const EMAIL_PERMISSIONS: Record<string, { auth: AuthLevel; rateKey: string; fromEmail?: string; allowAnon?: boolean }> = {
  // System-only emails
  welcome: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  email_verification: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  password_reset: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  ticket_purchase: { auth: 'USER_AUTH', rateKey: 'standard', allowAnon: true }, // Allow from frontend (triggered by legitimate purchases)
  payment_link: { auth: 'USER_AUTH', rateKey: 'standard', allowAnon: true }, // Payment link sent by organizer
  ticket_cancelled: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  ticket_refunded: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  event_cancelled: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  event_updated: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  ticket_transfer_sent: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  ticket_transfer_received: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  event_reminder: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  event_reminder_24h: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  event_reminder_1h: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  waitlist_joined: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  waitlist_available: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  refund_request_submitted: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  refund_approved: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  refund_rejected: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  refund_processed: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  payout_processed: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  stripe_connect_activated: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  stripe_connect_payout_initiated: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  paystack_subaccount_activated: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  flutterwave_subaccount_activated: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  payment_connection_disconnected: { auth: 'ADMIN_AUTH', rateKey: 'standard' },
  kyc_verified: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  kyc_action_required: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  kyc_rejected: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  promoter_commission: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  promoter_payout: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  affiliate_commission_earned: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  affiliate_payout_processed: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  daily_sales_summary: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  admin_daily_stats: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  // Security emails (system-only, red header)
  password_changed: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  login_new_device: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  profile_updated: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  bank_account_added: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  bank_account_updated: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  bank_account_removed: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  bank_account_verified: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  bank_change_confirmation: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  suspicious_activity: { auth: 'SYSTEM_ONLY', rateKey: 'security', fromEmail: SECURITY_EMAIL },
  // User auth emails
  support_ticket_created: { auth: 'USER_AUTH', rateKey: 'standard' },
  new_follower: { auth: 'USER_AUTH', rateKey: 'standard' },
  following_organizer: { auth: 'USER_AUTH', rateKey: 'standard' },
  birthday_wish: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  group_invite: { auth: 'USER_AUTH', rateKey: 'standard' },
  group_member_joined: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  group_purchase_complete: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  split_payment_complete: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  split_payment_progress: { auth: 'SYSTEM_ONLY', rateKey: 'standard' },
  // Organizer auth emails
  organizer_welcome: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  new_ticket_sale: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  low_ticket_alert: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  event_published: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  event_cancelled_organizer: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  event_reminder_organizer: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  refund_request: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  post_event_summary: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  sms_units_purchased: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  whatsapp_credits_purchased: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  low_sms_balance: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  team_invitation: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  task_assigned: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  team_member_removed: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  promoter_invite: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  promoter_accepted: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  promo_code_used: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  promo_code_created: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  event_invite: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  post_event_thank_you: { auth: 'ORGANIZER_AUTH', rateKey: 'bulk_campaign' },
  post_event_feedback: { auth: 'ORGANIZER_AUTH', rateKey: 'bulk_campaign' },
  post_event_next_event: { auth: 'ORGANIZER_AUTH', rateKey: 'bulk_campaign' },
  bulk_campaign: { auth: 'ORGANIZER_AUTH', rateKey: 'bulk_campaign' },
  event_draft_reminder: { auth: 'ORGANIZER_AUTH', rateKey: 'standard' },
  // Admin auth emails
  admin_new_organizer: { auth: 'ADMIN_AUTH', rateKey: 'standard' },
  admin_new_event: { auth: 'ADMIN_AUTH', rateKey: 'standard' },
  admin_flagged_content: { auth: 'ADMIN_AUTH', rateKey: 'standard' },
  support_ticket_reply: { auth: 'ADMIN_AUTH', rateKey: 'standard' },
  support_ticket_resolved: { auth: 'ADMIN_AUTH', rateKey: 'standard' },
  admin_broadcast: { auth: 'ADMIN_AUTH', rateKey: 'admin_broadcast' },
}

// Helpers
function formatCurrency(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: '₵', KES: 'KSh', ZAR: 'R' }
  return (symbols[currency] || currency + ' ') + new Intl.NumberFormat('en-US').format(amount)
}
function formatDate(d: string): string { return new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
function formatTime(d: string): string { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }
function formatDateTime(d: string): string { return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) }
function maskBank(n: string): string { return n?.length > 4 ? '****' + n.slice(-4) : '****' }
function getCorsHeaders(origin: string | null): Record<string, string> {
  return { 'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
}

// Auth
async function getAuthContext(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { userId: null, isAdmin: false, isFinance: false, organizerIds: [] as string[], isServiceRole: false }

  // Check for service role key
  if (authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return { userId: null, isAdmin: true, isFinance: true, organizerIds: [] as string[], isServiceRole: true }
  }

  // Check for valid Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return { userId: null, isAdmin: false, isFinance: false, organizerIds: [] as string[], isServiceRole: false }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      log.error('Auth error:', error?.message)
      return { userId: null, isAdmin: false, isFinance: false, organizerIds: [] as string[], isServiceRole: false }
    }

    // Get user roles and permissions
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const [{ data: profile, error: profileError }, { data: orgs, error: orgsError }, { data: fin, error: finError }] = await Promise.all([
      svc.from('profiles').select('is_admin').eq('id', user.id).single(),
      svc.from('organizers').select('id').eq('user_id', user.id),
      svc.from('finance_users').select('id').eq('user_id', user.id).eq('is_active', true).single()
    ])

    // Handle potential errors gracefully
    if (profileError && profileError.code !== 'PGRST116') log.error('Profile fetch error:', profileError)
    if (orgsError) log.error('Organizers fetch error:', orgsError)
    if (finError && finError.code !== 'PGRST116') log.error('Finance user fetch error:', finError)

    return {
      userId: user.id,
      isAdmin: profile?.is_admin === true,
      isFinance: !!fin,
      organizerIds: orgs?.map(o => o.id) || [],
      isServiceRole: false
    }
  } catch (error) {
    log.error('Auth context error:', error)
    return { userId: null, isAdmin: false, isFinance: false, organizerIds: [] as string[], isServiceRole: false }
  }
}

async function checkAuth(type: string, auth: any, req: any) {
  const perm = EMAIL_PERMISSIONS[type] as any
  if (!perm) return { ok: false, err: `Unknown email type: ${type}` }
  if (perm.auth === 'SYSTEM_ONLY' && !auth.isServiceRole) return { ok: false, err: 'System only' }
  // Allow anon for specific email types (e.g., ticket_purchase triggered by legitimate payment flow)
  if (perm.auth === 'USER_AUTH' && !auth.userId && !auth.isServiceRole && !perm.allowAnon) return { ok: false, err: 'Auth required' }
  if (perm.auth === 'ORGANIZER_AUTH' && !auth.isServiceRole && !auth.isAdmin) {
    if (!auth.userId) return { ok: false, err: 'Auth required' }
    if (req.organizerId && !auth.organizerIds.includes(req.organizerId)) return { ok: false, err: 'Not your organizer' }
    if (!auth.organizerIds.length) return { ok: false, err: 'Organizer account required' }
  }
  if (perm.auth === 'ADMIN_AUTH' && !auth.isAdmin && !auth.isServiceRole) return { ok: false, err: 'Admin required' }
  return { ok: true }
}

async function checkRateLimit(supabase: any, userId: string | null, type: string, count: number) {
  if (!userId) return { ok: true }
  const perm = EMAIL_PERMISSIONS[type]
  const rateKey = perm?.rateKey || 'standard'
  const limit = RATE_LIMITS[rateKey as keyof typeof RATE_LIMITS] || 50
  const windowMs = rateKey === 'standard' || rateKey === 'security' ? 3600000 : 86400000
  const { data } = await supabase.from('email_rate_limits').select('count').eq('user_id', userId).eq('rate_key', rateKey).gte('window_start', new Date(Date.now() - windowMs).toISOString()).single()
  const current = data?.count || 0
  if (current + count > limit) return { ok: false, err: `Rate limit: ${limit} per ${rateKey === 'standard' ? 'hour' : 'day'}` }
  const ws = new Date(); ws.setMinutes(0, 0, 0)
  await supabase.from('email_rate_limits').upsert({ user_id: userId, rate_key: rateKey, window_start: ws.toISOString(), count: current + count, updated_at: new Date().toISOString() }, { onConflict: 'user_id,rate_key,window_start' })
  return { ok: true }
}

// GDPR: Marketing email types that need unsubscribe link
const MARKETING_EMAIL_TYPES = ['bulk_campaign', 'post_event_thank_you', 'post_event_feedback', 'post_event_next_event', 'event_draft_reminder', 'new_follower', 'following_organizer', 'birthday_wish', 'admin_broadcast']

// Email types that should have open/click tracking
const TRACKABLE_EMAIL_TYPES = ['bulk_campaign', 'post_event_thank_you', 'post_event_feedback', 'post_event_next_event', 'admin_broadcast', 'event_reminder', 'event_reminder_24h', 'event_reminder_1h', 'waitlist_available']

// Tracking endpoint URL
const TRACKING_URL = `${SUPABASE_URL}/functions/v1/email-tracking`

// Templates - Table-based for maximum email client compatibility
function baseTemplate(content: string, preheader = '', isMarketing = false): string {
  const unsubscribeFooter = isMarketing
    ? `<p style="margin-top:16px"><a href="${APP_URL}/profile?tab=settings" style="color:#2969FF;text-decoration:underline">Manage email preferences</a> &middot; <a href="${APP_URL}/profile?tab=settings" style="color:#6b7280;text-decoration:underline">Unsubscribe</a></p>`
    : ''

  const gdprNotice = isMarketing
    ? `<p style="margin-top:16px;font-size:11px;color:#9ca3af">You're receiving this because you opted in to marketing emails. ${BRAND_NAME} Ltd, support@ticketrack.com</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, Helvetica, sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td align="center" style="background-color: #2969FF; padding: 32px 40px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">${BRAND_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 30px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                ${BRAND_NAME} Technologies Ltd | Lagos, Nigeria<br>
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
              ${unsubscribeFooter}
              ${gdprNotice}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function securityTemplate(content: string, preheader = ''): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}.wrap{width:100%;background:#f4f6fa;padding:40px 0}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}.header{background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:32px 24px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px;font-weight:800}.header p{color:rgba(255,255,255,.9);font-size:14px;margin:8px 0 0}.content{padding:40px 32px}.content h2{color:#0f0f0f;font-size:24px;font-weight:700;margin:0 0 16px}.content p{color:#4a4a4a;font-size:16px;line-height:1.7;margin:0 0 16px}.btn-wrap{text-align:center;margin:32px 0}.btn{display:inline-block;background:#dc2626;color:#fff!important;padding:16px 40px;text-decoration:none;border-radius:12px;font-weight:600}.btn-secondary{display:inline-block;background:#f3f4f6;color:#0f0f0f!important;padding:16px 40px;text-decoration:none;border-radius:12px;font-weight:600;margin-left:12px}.box{background:#f8f9fc;border-radius:12px;padding:20px;margin:24px 0;border:1px solid #e8eaf0}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e8eaf0}.row:last-child{border-bottom:none}.warning{background:#fef2f2;padding:20px;border-radius:12px;margin:24px 0;border:2px solid #ef4444}.footer{background:#f8f9fc;padding:32px;text-align:center;border-top:1px solid #e8eaf0}.footer p{color:#6b7280;font-size:12px;margin:0}</style></head><body><div style="display:none">${preheader}</div><div class="wrap"><table class="container" width="100%" cellspacing="0" cellpadding="0"><tr><td class="header"><h1>🔒 ${BRAND_NAME} Security</h1><p>Account Security Alert</p></td></tr><tr><td class="content">${content}</td></tr><tr><td class="footer"><p>If you didn't make this change, <a href="${APP_URL}/support" style="color:#dc2626;font-weight:600">contact support immediately</a>.</p></td></tr></table></div></body></html>`
}

// All 55+ email templates
const templates: Record<string, (d: any) => { subject: string; html: string }> = {
  // AUTH
  welcome: d => ({ subject: `Welcome to ${BRAND_NAME}!`, html: baseTemplate(`<h2>Welcome, ${d.firstName}!</h2><p>We're thrilled to have you join ${BRAND_NAME}.</p><div class="btn-wrap"><a href="${APP_URL}/events" class="btn">Explore Events</a></div>`) }),
  email_verification: d => ({ subject: `Verify your ${BRAND_NAME} email`, html: baseTemplate(`<h2>Verify Your Email</h2><p>Hi ${d.firstName},</p><p>Click below to verify:</p><div class="btn-wrap"><a href="${d.verificationUrl}" class="btn">Verify Email</a></div>`) }),
  password_reset: d => ({ subject: `Reset your ${BRAND_NAME} password`, html: baseTemplate(`<h2>Password Reset</h2><p>Hi ${d.firstName},</p><div class="btn-wrap"><a href="${d.resetUrl}" class="btn">Reset Password</a></div><p style="font-size:12px;color:#666">Link expires in 1 hour.</p>`) }),
  password_changed: d => ({ subject: `⚠️ Your ${BRAND_NAME} password was changed`, html: securityTemplate(`<h2>Password Changed</h2><p>Hi ${d.userName},</p><p>Your password was changed.</p><div class="box"><div class="row"><span>Time</span><span>${formatDateTime(d.changedAt || new Date().toISOString())}</span></div><div class="row"><span>IP</span><span>${d.ipAddress || 'Unknown'}</span></div><div class="row"><span>Device</span><span>${d.device || 'Unknown'}</span></div></div><div class="warning"><strong>Didn't change your password?</strong><p style="margin:8px 0 0">Reset immediately and contact support.</p></div><div class="btn-wrap"><a href="${APP_URL}/forgot-password" class="btn">Reset Password</a></div>`, 'Your password was changed') }),
  login_new_device: d => ({ subject: `⚠️ New login to ${BRAND_NAME}`, html: securityTemplate(`<h2>New Device Login</h2><p>Hi ${d.userName},</p><p>New login detected:</p><div class="box"><div class="row"><span>Time</span><span>${formatDateTime(d.loginAt || new Date().toISOString())}</span></div><div class="row"><span>Location</span><span>${d.location || 'Unknown'}</span></div><div class="row"><span>IP</span><span>${d.ipAddress || 'Unknown'}</span></div><div class="row"><span>Device</span><span>${d.device || 'Unknown'}</span></div></div><div class="warning"><strong>Wasn't you?</strong><p style="margin:8px 0 0">Secure your account now.</p></div><div class="btn-wrap"><a href="${APP_URL}/forgot-password" class="btn">Secure Account</a></div>`, 'New device login detected') }),
  profile_updated: d => ({ subject: `Your ${BRAND_NAME} profile was updated`, html: securityTemplate(`<h2>Profile Updated</h2><p>Hi ${d.userName},</p><p>Your profile was updated.</p><div class="box"><div class="row"><span>Time</span><span>${formatDateTime(d.updatedAt || new Date().toISOString())}</span></div>${d.changedFields?.map((f: string) => `<div class="row"><span>Changed</span><span>${f}</span></div>`).join('') || ''}</div>`, 'Profile updated') }),
  suspicious_activity: d => ({ subject: `🚨 Suspicious activity on ${BRAND_NAME}`, html: securityTemplate(`<h2>⚠️ Suspicious Activity</h2><p>Hi ${d.userName},</p><p>Unusual activity detected.</p><div class="warning"><strong>Activity:</strong><p style="margin:8px 0 0">${d.activityDescription || 'Multiple failed attempts.'}</p></div><div class="btn-wrap"><a href="${APP_URL}/forgot-password" class="btn">Secure Account</a></div>`, 'URGENT: Suspicious activity') }),
  // BANK SECURITY
  bank_account_added: d => ({ subject: `🔒 New bank added to ${BRAND_NAME}`, html: securityTemplate(`<h2>New Bank Account</h2><p>Hi ${d.organizerName},</p><p>A bank account was added:</p><div class="box"><div class="row"><span>Bank</span><span>${d.bankName}</span></div><div class="row"><span>Account Name</span><span>${d.accountName}</span></div><div class="row"><span>Number</span><span>${maskBank(d.accountNumber)}</span></div></div><div class="highlight"><strong>🕐 48-Hour Security Hold</strong><p style="margin:8px 0 0">This bank can't receive payouts for 48 hours.</p><p><strong>Active after:</strong> ${formatDateTime(d.activeAfter)}</p></div>${d.confirmationRequired ? `<div class="btn-wrap"><a href="${d.confirmationUrl}" class="btn">Confirm Bank Account</a></div>` : ''}`, 'New bank account added') }),
  bank_account_updated: d => ({ subject: `🔒 Bank changed on ${BRAND_NAME}`, html: securityTemplate(`<h2>Bank Account Updated</h2><p>Hi ${d.organizerName},</p><div class="box"><div class="row"><span>Bank</span><span>${d.bankName}</span></div><div class="row"><span>Number</span><span>${maskBank(d.accountNumber)}</span></div></div><div class="highlight"><strong>🕐 48-Hour Hold</strong><p style="margin:8px 0 0">Payouts paused for 48h. <strong>Active after:</strong> ${formatDateTime(d.activeAfter)}</p></div><div class="warning"><strong>Didn't make this change?</strong> Contact support immediately.</div>`, 'Bank details changed') }),
  bank_account_removed: d => ({ subject: `🔒 Bank removed from ${BRAND_NAME}`, html: securityTemplate(`<h2>Bank Account Removed</h2><p>Hi ${d.organizerName},</p><div class="box"><div class="row"><span>Bank</span><span>${d.bankName}</span></div><div class="row"><span>Number</span><span>${maskBank(d.accountNumber)}</span></div></div>`, 'Bank account removed') }),
  bank_account_verified: d => ({ subject: `✅ Bank verified on ${BRAND_NAME}`, html: baseTemplate(`<div class="success"><strong>Bank Account Verified!</strong></div><h2>Ready for Payouts</h2><p>Hi ${d.organizerName},</p><p>Your bank is now active.</p><div class="card"><div class="row"><span class="label">Bank</span><span class="value">${d.bankName}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">Active</span></div></div>`) }),
  bank_change_confirmation: d => ({ subject: `⚠️ Confirm bank change - ${BRAND_NAME}`, html: securityTemplate(`<h2>Confirm Bank Change</h2><p>Hi ${d.organizerName},</p><p>Confirm this change:</p><div class="box"><div class="row"><span>Action</span><span>${d.changeType}</span></div><div class="row"><span>Bank</span><span>${d.bankName}</span></div></div><div class="btn-wrap"><a href="${d.confirmationUrl}" class="btn">Confirm</a><a href="${d.cancelUrl}" class="btn-secondary">Cancel</a></div>`, 'Confirm bank change') }),
  // TICKETS
  ticket_purchase: d => ({ subject: `Your Tickets for ${d.eventTitle || 'Your Event'}`, html: baseTemplate(`
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="width: 64px; height: 64px; background-color: #10b981; border-radius: 32px;">
                          <span style="font-size: 28px; color: #ffffff; line-height: 64px;">&#10003;</span>
                        </td>
                      </tr>
                    </table>
                    <h2 style="margin: 24px 0 8px 0; font-size: 24px; font-weight: 700; color: #1a1a2e;">Payment Confirmed</h2>
                    <p style="margin: 0; font-size: 16px; color: #6b7280;">Hi ${d.attendeeName || 'there'}, your tickets have been secured!</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td align="center" style="padding: 20px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Order Reference</p>
                    <p style="margin: 0; font-size: 22px; font-weight: 700; color: #2969FF; font-family: monospace;">${d.orderNumber || 'N/A'}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #faf5ff; border-radius: 8px; border: 1px solid #e9d5ff; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #1a1a2e;">${d.eventTitle || 'Event'}</h3>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Date:</strong> ${d.eventDate ? formatDate(d.eventDate) : 'TBA'}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Time:</strong> ${d.eventDate ? formatTime(d.eventDate) : 'TBA'}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Venue:</strong> ${d.venueName || 'TBA'}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Ticket:</strong> ${d.ticketType || 'General'} x ${d.quantity || 1}</p>
                    <p style="margin: 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Total:</strong> ${d.isFree ? 'FREE' : formatCurrency(d.totalAmount || 0, d.currency || 'NGN')}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef9c3; border-radius: 8px; border: 1px solid #fde047; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #854d0e;">Your PDF ticket is attached to this email. You can also view and download your tickets anytime from the app.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #2969FF; border-radius: 8px;">
                          <a href="${APP_URL}/tickets" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">View My Tickets</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`, `Your tickets for ${d.eventTitle || 'your event'} are confirmed!`) }),
  payment_link: d => ({ subject: `Complete Your Payment - ${d.eventTitle || 'Your Event'}`, html: baseTemplate(`
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="width: 64px; height: 64px; background-color: #2969FF; border-radius: 32px;">
                          <span style="font-size: 28px; color: #ffffff; line-height: 64px;">&#128179;</span>
                        </td>
                      </tr>
                    </table>
                    <h2 style="margin: 24px 0 8px 0; font-size: 24px; font-weight: 700; color: #1a1a2e;">Payment Request</h2>
                    <p style="margin: 0; font-size: 16px; color: #6b7280;">Hi ${d.attendeeName || 'there'}, please complete your payment to secure your ticket.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #faf5ff; border-radius: 8px; border: 1px solid #e9d5ff; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #1a1a2e;">${d.eventTitle || 'Event'}</h3>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Date:</strong> ${d.eventDate ? formatDate(d.eventDate) : 'TBA'}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Venue:</strong> ${d.venueName || 'TBA'}${d.city ? `, ${d.city}` : ''}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151;"><strong style="color: #2969FF;">Ticket:</strong> ${d.ticketType || 'General'} x ${d.quantity || 1}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd; margin-bottom: 20px;">
                <tr>
                  <td align="center" style="padding: 20px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #0369a1; text-transform: uppercase; letter-spacing: 1px;">Amount Due</p>
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #0c4a6e;">${formatCurrency(d.totalAmount || 0, d.currency || 'NGN')}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="background-color: #2969FF; border-radius: 8px;">
                          <a href="${d.paymentLink}" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">Pay Now</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef9c3; border-radius: 8px; border: 1px solid #fde047;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #854d0e;">This payment link was sent by <strong>${d.organizerName || 'the event organizer'}</strong>. Your ticket will be issued immediately after payment is confirmed.</p>
                  </td>
                </tr>
              </table>`, `Complete your payment for ${d.eventTitle || 'your event'}`) }),
  ticket_cancelled: d => ({ subject: `Ticket Cancelled - ${d.eventTitle}`, html: baseTemplate(`<h2>Ticket Cancelled</h2><p>Hi ${d.attendeeName},</p><p>Your ticket for <strong>${d.eventTitle}</strong> was cancelled.</p>${d.refundAmount ? `<div class="success"><strong>Refund of ${formatCurrency(d.refundAmount, d.currency)} processing.</strong></div>` : ''}`) }),
  ticket_refunded: d => ({ subject: `Refund Processed - ${d.eventTitle}`, html: baseTemplate(`<div class="success"><strong>Refund Complete!</strong></div><h2>Your Refund</h2><p>Hi ${d.attendeeName},</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value">${formatCurrency(d.refundAmount, d.currency)}</span></div><div class="row"><span class="label">Order</span><span class="value">${d.orderNumber}</span></div></div><p style="font-size:14px;color:#666">5-10 business days to arrive.</p>`) }),
  ticket_transfer_sent: d => ({ subject: `Ticket Transferred - ${d.eventTitle}`, html: baseTemplate(`<h2>Ticket Transfer Sent</h2><p>Hi ${d.senderName},</p><p>You transferred a ticket to <strong>${d.recipientName}</strong>.</p><div class="card"><h3>${d.eventTitle}</h3><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Ticket</span><span class="value">${d.ticketType}</span></div><div class="row"><span class="label">To</span><span class="value">${d.recipientName} (${d.recipientEmail})</span></div></div>`) }),
  ticket_transfer_received: d => ({ subject: `🎉 You received a ticket for ${d.eventTitle}!`, html: baseTemplate(`<div class="success"><strong>You received a ticket!</strong></div><h2>Ticket Received</h2><p>Hi ${d.recipientName},</p><p><strong>${d.senderName}</strong> sent you a ticket!</p><div class="card"><h3>${d.eventTitle}</h3><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Time</span><span class="value">${formatTime(d.eventDate)}</span></div><div class="row"><span class="label">Ticket</span><span class="value">${d.ticketType}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/tickets" class="btn">View Ticket</a></div>`, `${d.senderName} sent you a ticket!`) }),
  event_reminder: d => ({ subject: `Reminder: ${d.eventTitle} is ${d.timeUntil}!`, html: baseTemplate(`<h2>Event Coming Up!</h2><p>Hi ${d.attendeeName},</p><p><strong>${d.eventTitle}</strong> is ${d.timeUntil}!</p><div class="card"><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Time</span><span class="value">${formatTime(d.eventDate)}</span></div><div class="row"><span class="label">Venue</span><span class="value">${d.venueName}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/tickets" class="btn">View Ticket</a></div>`) }),
  event_reminder_24h: d => ({ subject: `Tomorrow: ${d.eventTitle}!`, html: baseTemplate(`<h2>Your Event is Tomorrow!</h2><p>Hi ${d.attendeeName},</p><p><strong>${d.eventTitle}</strong> is <strong>tomorrow</strong>!</p><div class="card"><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Time</span><span class="value">${formatTime(d.eventDate)}</span></div><div class="row"><span class="label">Code</span><span class="value" style="font-family:monospace">${d.ticketCode}</span></div></div><div class="highlight"><strong>Checklist:</strong><ul style="margin:8px 0 0;padding-left:20px"><li>Save your QR code</li><li>Check venue location</li><li>Plan your travel</li></ul></div><div class="btn-wrap"><a href="${APP_URL}/tickets" class="btn">View Ticket</a></div>`, `${d.eventTitle} is tomorrow!`) }),
  event_reminder_1h: d => ({ subject: `Starting Soon: ${d.eventTitle} in 1 Hour!`, html: baseTemplate(`<div class="highlight"><strong>Starting in 1 Hour!</strong></div><h2>Almost Time!</h2><p>Hi ${d.attendeeName},</p><div class="card"><div class="row"><span class="label">Venue</span><span class="value">${d.venueName}</span></div><div class="row"><span class="label">Starts</span><span class="value" style="color:${BRAND_COLOR};font-weight:bold">${formatTime(d.eventDate)}</span></div><div class="row"><span class="label">Code</span><span class="value" style="font-family:monospace;font-size:16px">${d.ticketCode}</span></div></div><div class="success"><strong>Show QR at entrance!</strong></div><div class="btn-wrap"><a href="${APP_URL}/tickets" class="btn">Open Ticket</a></div>`, `${d.eventTitle} starts in 1 hour!`) }),
  event_cancelled: d => ({ subject: `Event Cancelled: ${d.eventTitle}`, html: baseTemplate(`<div class="warning"><strong>Event Cancelled</strong></div><h2>We're Sorry</h2><p>Hi ${d.attendeeName},</p><p><strong>${d.eventTitle}</strong> has been cancelled.</p>${d.reason ? `<p><strong>Reason:</strong> ${d.reason}</p>` : ''}<div class="success"><strong>Full refund of ${formatCurrency(d.refundAmount, d.currency)} will be processed.</strong></div>`) }),
  event_updated: d => ({ subject: `Update: ${d.eventTitle}`, html: baseTemplate(`<h2>Event Update</h2><p>Hi ${d.attendeeName},</p><p>Changes to <strong>${d.eventTitle}</strong>:</p><div class="highlight"><strong>What Changed:</strong><ul>${d.changes?.map((c: string) => `<li>${c}</li>`).join('') || '<li>Details updated</li>'}</ul></div><p>Your ticket remains valid!</p>`) }),
  refund_request_submitted: d => ({ subject: `Refund Request Received - ${d.eventTitle}`, html: baseTemplate(`<h2>Refund Request Received</h2><p>Hi ${d.attendeeName},</p><p>We received your refund request for <strong>${d.eventTitle}</strong>.</p><div class="card"><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Ticket</span><span class="value">${d.ticketType}</span></div><div class="row"><span class="label">Amount</span><span class="value">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#f59e0b">Pending Review</span></div></div><p style="font-size:14px;color:#666">Typical: 3-5 business days.</p>`) }),
  refund_approved: d => ({ subject: `Refund Approved: ${d.eventTitle}`, html: baseTemplate(`<div class="success"><strong>Refund Approved!</strong></div><h2>Your Refund</h2><p>Hi ${d.attendeeName},</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:#16a34a;font-weight:bold">${formatCurrency(d.refundAmount, d.currency)}</span></div><div class="row"><span class="label">Processing</span><span class="value">5-7 business days</span></div></div>${d.organizerNotes ? `<p><strong>Note:</strong> ${d.organizerNotes}</p>` : ''}`) }),
  refund_rejected: d => ({ subject: `Refund Update: ${d.eventTitle}`, html: baseTemplate(`<h2>Refund Update</h2><p>Hi ${d.attendeeName},</p><p>Your refund for <strong>${d.eventTitle}</strong> could not be approved.</p>${d.organizerNotes ? `<div class="warning"><strong>Reason:</strong> ${d.organizerNotes}</div>` : ''}<div class="btn-wrap"><a href="${APP_URL}/support" class="btn">Contact Support</a></div>`) }),
  refund_processed: d => ({ subject: `Refund Processed - ${formatCurrency(d.refundAmount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Refund Complete!</strong></div><h2>Processed</h2><p>Hi ${d.attendeeName},</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:#10b981;font-size:20px;font-weight:bold">${formatCurrency(d.refundAmount, d.currency)}</span></div><div class="row"><span class="label">Arrival</span><span class="value">5-10 business days</span></div></div>`) }),
  // WAITLIST
  waitlist_joined: d => ({ subject: `You're #${d.position} on waitlist for ${d.eventTitle}`, html: baseTemplate(`<h2>You're on the Waitlist!</h2><p>Hi ${d.name},</p><div class="card"><div style="text-align:center;padding:24px 0"><div style="font-size:56px;font-weight:800;color:${BRAND_COLOR}">#${d.position}</div><div style="color:#6b7280;font-size:14px">Your position</div></div><div class="row"><span class="label">Event</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Tickets</span><span class="value">${d.quantity}</span></div></div><div class="highlight"><strong>What's next?</strong><p style="margin:8px 0 0;font-size:14px">We'll email when tickets are available. You'll have <strong>24 hours</strong> to purchase.</p></div>`, `You're #${d.position} on the waitlist`) }),
  waitlist_available: d => ({ subject: `🎉 Tickets Available for ${d.eventTitle}!`, html: baseTemplate(`<div class="success"><strong>Tickets Available!</strong></div><h2>It's Your Turn!</h2><p>Hi ${d.name},</p><div class="card"><div class="row"><span class="label">Event</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Tickets</span><span class="value">${d.quantity}</span></div></div><div class="warning"><strong>Act Fast!</strong><p style="margin:8px 0 0;font-size:14px">Expires: <strong>${formatDateTime(d.expiresAt)}</strong></p></div><div class="btn-wrap"><a href="${APP_URL}/waitlist/purchase?token=${d.purchaseToken}" class="btn">Buy Now</a></div>`, `Tickets for ${d.eventTitle}!`) }),
  // SOCIAL
  new_follower: d => ({ subject: `${d.followerName} is following you!`, html: baseTemplate(`<h2>New Follower!</h2><p>Hi ${d.organizerName},</p><p><strong>${d.followerName}</strong> is now following you.</p><div class="card"><div class="row"><span class="label">Follower</span><span class="value">${d.followerName}</span></div><div class="row"><span class="label">Total</span><span class="value" style="color:${BRAND_COLOR};font-weight:bold">${d.totalFollowers}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/followers" class="btn">View Followers</a></div>`) }),
  following_organizer: d => ({ subject: `You're following ${d.organizerName}`, html: baseTemplate(`<h2>Following!</h2><p>Hi ${d.userName},</p><p>You're now following <strong>${d.organizerName}</strong>. We'll notify you about new events!</p><div class="btn-wrap"><a href="${APP_URL}/organizer/${d.organizerSlug}" class="btn">View Events</a></div>`) }),
  // ORGANIZER
  organizer_welcome: d => ({ subject: `Welcome to ${BRAND_NAME} Organizers!`, html: baseTemplate(`<h2>Welcome, ${d.businessName}!</h2><p>Your organizer account is active!</p><ul><li>Create events</li><li>Sell tickets</li><li>Track sales</li><li>Fast payouts</li></ul><div class="btn-wrap"><a href="${APP_URL}/organizer" class="btn">Go to Dashboard</a></div>`) }),
  kyc_verified: d => ({ subject: `✅ Identity Verified!`, html: baseTemplate(`<div class="success"><strong>Verified!</strong></div><h2>You're Verified</h2><p>Hi ${d.organizerName},</p><div class="card"><div class="row"><span class="label">Create Events</span><span class="value" style="color:#10b981">✓ Enabled</span></div><div class="row"><span class="label">Receive Payouts</span><span class="value" style="color:#10b981">✓ Enabled</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer" class="btn">Dashboard</a></div>`) }),
  kyc_action_required: d => ({ subject: `Action Required - Verification`, html: baseTemplate(`<div class="highlight"><strong>Action Required</strong></div><h2>Verification Needed</h2><p>Hi ${d.organizerName},</p><p>${d.message || 'We need additional info.'}</p><div class="btn-wrap"><a href="${APP_URL}/organizer/kyc" class="btn">Complete</a></div>`) }),
  kyc_rejected: d => ({ subject: `Verification Update`, html: baseTemplate(`<div class="warning"><strong>Could Not Complete</strong></div><h2>Verification Update</h2><p>Hi ${d.organizerName},</p><p>${d.reason || 'Please try again with valid documents.'}</p><div class="btn-wrap"><a href="${APP_URL}/organizer/kyc" class="btn">Try Again</a></div>`) }),
  stripe_connect_activated: d => ({ subject: `Stripe Connect Activated!`, html: baseTemplate(`<div class="success"><strong>Stripe Connect Active</strong></div><h2>Direct Payouts Ready</h2><p>Hi ${d.organizerName},</p><div class="card"><div class="row"><span class="label">Payout Speed</span><span class="value">2-3 days</span></div><div class="row"><span class="label">Platform Fee</span><span class="value">${d.platformFeePercent || '5'}%</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/stripe-connect" class="btn">Dashboard</a></div>`) }),
  paystack_subaccount_activated: d => ({ subject: `Paystack Direct Payments Activated!`, html: baseTemplate(`<div class="success"><strong>Paystack Connected</strong></div><h2>Direct Payouts Ready</h2><p>Hi ${d.organizerName},</p><p>Your Paystack subaccount is now active. Payment from ticket sales will be deposited directly into your bank account.</p><div class="card"><div class="row"><span class="label">Bank</span><span class="value">${d.bankName || 'Connected'}</span></div><div class="row"><span class="label">Account</span><span class="value">${maskBank(d.accountNumber || '')}</span></div><div class="row"><span class="label">Settlement</span><span class="value">Next-day</span></div><div class="row"><span class="label">Platform Fee</span><span class="value">${d.platformFeePercent || '5'}%</span></div></div><div class="highlight"><strong>How It Works:</strong><ul style="margin:8px 0 0;padding-left:20px"><li>Attendees pay for tickets</li><li>Paystack splits the payment automatically</li><li>Your share goes directly to your bank</li></ul></div><div class="btn-wrap"><a href="${APP_URL}/organizer/paystack-connect" class="btn">View Dashboard</a></div>`) }),
  flutterwave_subaccount_activated: d => ({ subject: `Flutterwave Direct Payments Activated!`, html: baseTemplate(`<div class="success"><strong>Flutterwave Connected</strong></div><h2>Direct Payouts Ready</h2><p>Hi ${d.organizerName},</p><p>Your Flutterwave subaccount is now active. Payment from ticket sales will be deposited directly into your bank account.</p><div class="card"><div class="row"><span class="label">Bank</span><span class="value">${d.bankName || 'Connected'}</span></div><div class="row"><span class="label">Account</span><span class="value">${maskBank(d.accountNumber || '')}</span></div><div class="row"><span class="label">Settlement</span><span class="value">T+1 to T+2</span></div><div class="row"><span class="label">Platform Fee</span><span class="value">${d.platformFeePercent || '5'}%</span></div></div><div class="highlight"><strong>How It Works:</strong><ul style="margin:8px 0 0;padding-left:20px"><li>Attendees pay for tickets</li><li>Flutterwave splits the payment automatically</li><li>Your share goes directly to your bank</li></ul></div><div class="btn-wrap"><a href="${APP_URL}/organizer/flutterwave-connect" class="btn">View Dashboard</a></div>`) }),
  payment_connection_disconnected: d => ({ subject: `Payment Connection Disconnected - Action Required`, html: baseTemplate(`<div class="warning"><strong>Payment Connection Removed</strong></div><h2>Your ${d.provider} Connection Was Disconnected</h2><p>Hi ${d.organizerName},</p><p>Your <strong>${d.provider}</strong> payment connection has been disconnected from your account.</p><div class="card"><div class="row"><span class="label">Provider</span><span class="value">${d.provider}</span></div><div class="row"><span class="label">Disconnected</span><span class="value">${formatDateTime(d.disconnectedAt || new Date().toISOString())}</span></div>${d.reason ? `<div class="row"><span class="label">Reason</span><span class="value">${d.reason}</span></div>` : ''}</div><p>To continue receiving direct payments, you'll need to reconnect your account.</p><div class="btn-wrap"><a href="${APP_URL}/organizer/paystack-connect" class="btn">Reconnect</a></div><p style="font-size:14px;color:#666">If you didn't request this change, please contact support immediately.</p>`) }),
  new_ticket_sale: d => ({ subject: `New Sale: ${d.eventTitle}`, html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td align="center" style="background-color: #10b981; padding: 32px 40px;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">${BRAND_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1a1a2e;">New Ticket Sale</h2>
              <p style="margin: 0; font-size: 16px; color: #6b7280;">Someone just purchased tickets to your event</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ecfdf5; border-radius: 8px; border: 2px solid #10b981;">
                <tr>
                  <td align="center" style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #059669; text-transform: uppercase;">Sale Amount</p>
                    <p style="margin: 0; font-size: 32px; font-weight: 700; color: #047857;">${d.isFree ? 'FREE' : formatCurrency(d.amount || 0, d.currency || 'NGN')}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Event:</strong> ${d.eventTitle || 'Event'}</p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Ticket:</strong> ${d.ticketType || 'General'} x ${d.quantity || 1}</p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Buyer:</strong> ${d.buyerName || 'Guest'}</p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Email:</strong> ${d.buyerEmail || 'N/A'}</p>
                    ${d.buyerPhone ? `<p style="margin: 0; font-size: 14px; color: #374151;"><strong>Phone:</strong> ${d.buyerPhone}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="background-color: #2969FF; border-radius: 8px;">
                    <a href="${APP_URL}/organizer/events/${d.eventId}" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">View Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                ${BRAND_NAME} Technologies Ltd | Lagos, Nigeria<br>
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>` }),
  daily_sales_summary: d => ({ subject: `Daily Sales - ${d.date}`, html: baseTemplate(`<h2>Daily Summary</h2><p>Performance on ${d.date}:</p><div class="card"><div class="row"><span class="label">Revenue</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.totalRevenue, d.currency)}</span></div><div class="row"><span class="label">Tickets</span><span class="value">${d.ticketsSold}</span></div><div class="row"><span class="label">Orders</span><span class="value">${d.ordersCount}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/analytics" class="btn">Analytics</a></div>`) }),
  low_ticket_alert: d => ({ subject: `⚠️ Low Tickets: ${d.eventTitle}`, html: baseTemplate(`<div class="highlight"><strong>Running Low!</strong></div><h2>${d.eventTitle}</h2><div class="card"><div class="row"><span class="label">${d.ticketType}</span><span class="value" style="color:#dc3545">${d.remaining} left</span></div><div class="row"><span class="label">Sold</span><span class="value">${d.sold}/${d.total}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/events/${d.eventId}/tickets" class="btn">Manage</a></div>`) }),
  event_published: d => ({ subject: `✅ Published: ${d.eventTitle}`, html: baseTemplate(`<div class="success"><strong>Live!</strong></div><h2>${d.eventTitle}</h2><p>Your event is visible.</p><div class="card"><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Link</span><span class="value"><a href="${d.eventUrl}">${d.eventUrl}</a></span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/events/${d.eventId}" class="btn">Manage</a></div>`) }),
  event_cancelled_organizer: d => ({ subject: `Cancelled: ${d.eventTitle}`, html: baseTemplate(`<h2>Cancellation Confirmed</h2><p><strong>${d.eventTitle}</strong> cancelled.</p><div class="card"><div class="row"><span class="label">Tickets</span><span class="value">${d.ticketsSold}</span></div><div class="row"><span class="label">Refunds</span><span class="value">${formatCurrency(d.refundTotal, d.currency)}</span></div></div><p>Attendees notified. Refunds processing.</p>`) }),
  event_reminder_organizer: d => ({ subject: `Your event is ${d.timeUntil}: ${d.eventTitle}`, html: baseTemplate(`<h2>Event ${d.timeUntil}!</h2><p>Get ready for <strong>${d.eventTitle}</strong>!</p><div class="card"><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Tickets</span><span class="value">${d.ticketsSold}</span></div><div class="row"><span class="label">Revenue</span><span class="value">${formatCurrency(d.revenue, d.currency)}</span></div></div><h3>Checklist:</h3><ul><li>Download attendee list</li><li>Set up check-in</li><li>Brief team</li></ul><div class="btn-wrap"><a href="${APP_URL}/organizer/events/${d.eventId}/check-in" class="btn">Check-In</a></div>`) }),
  refund_request: d => ({ subject: `Refund Request: ${d.eventTitle}`, html: baseTemplate(`<h2>New Refund Request</h2><div class="card"><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Attendee</span><span class="value">${d.attendeeName}</span></div><div class="row"><span class="label">Ticket</span><span class="value">${d.ticketType}</span></div><div class="row"><span class="label">Amount</span><span class="value">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Reason</span><span class="value">${d.reason || 'Not specified'}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/refunds/${d.refundId}" class="btn">Review</a></div>`) }),
  post_event_summary: d => ({ subject: `Summary: ${d.eventTitle}`, html: baseTemplate(`<h2>Event Wrap-Up</h2><p><strong>${d.eventTitle}</strong></p><div class="card"><div class="row"><span class="label">Revenue</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.totalRevenue, d.currency)}</span></div><div class="row"><span class="label">Tickets</span><span class="value">${d.ticketsSold}</span></div><div class="row"><span class="label">Checked In</span><span class="value">${d.checkedIn} (${d.checkInRate}%)</span></div><div class="row"><span class="label">Payout</span><span class="value">${formatCurrency(d.payoutAmount, d.currency)}</span></div></div><p>Payout in 2-3 business days.</p><div class="btn-wrap"><a href="${APP_URL}/organizer/events/${d.eventId}/analytics" class="btn">Full Report</a></div>`) }),
  payout_processed: d => ({ subject: `💰 Payout - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Money on the way!</strong></div><h2>Payout Processed</h2><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Bank</span><span class="value">${d.bankName}</span></div><div class="row"><span class="label">Account</span><span class="value">${maskBank(d.accountNumber)}</span></div><div class="row"><span class="label">Ref</span><span class="value">${d.reference}</span></div></div><p>Arrives in 24-48 hours.</p>`) }),
  stripe_connect_payout_initiated: d => ({ subject: `Payout Initiated - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Payout Started</strong></div><h2>Processing</h2><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Expected</span><span class="value">2-3 business days</span></div></div>`) }),
  sms_units_purchased: d => ({ subject: `SMS Credits - ${d.units} units`, html: baseTemplate(`<div class="success"><strong>Purchased!</strong></div><h2>SMS Credits Added</h2><div class="card"><div class="row"><span class="label">Units</span><span class="value">${d.units}</span></div><div class="row"><span class="label">Amount</span><span class="value">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Balance</span><span class="value" style="color:${BRAND_COLOR}">${d.newBalance}</span></div></div>`) }),
  whatsapp_credits_purchased: d => ({ subject: `WhatsApp Credits - ${d.units} units`, html: baseTemplate(`<div class="success"><strong>Purchased!</strong></div><h2>WhatsApp Credits</h2><div class="card"><div class="row"><span class="label">Units</span><span class="value">${d.units}</span></div><div class="row"><span class="label">Amount</span><span class="value">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Balance</span><span class="value" style="color:${BRAND_COLOR}">${d.newBalance}</span></div></div>`) }),
  low_sms_balance: d => ({ subject: `⚠️ Low SMS Credits`, html: baseTemplate(`<div class="highlight"><strong>Low Balance</strong></div><h2>SMS Running Low</h2><p>Hi ${d.organizerName},</p><div class="card"><div class="row"><span class="label">Balance</span><span class="value" style="color:#dc3545">${d.balance} credits</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/sms-credits" class="btn">Buy More</a></div>`) }),
  event_draft_reminder: d => ({ subject: `Complete: "${d.eventTitle}"`, html: baseTemplate(`<h2>Your Event is Waiting</h2><p>Hi ${d.organizerName},</p><p>You started <strong>${d.eventTitle}</strong> but haven't published yet.</p><div class="btn-wrap"><a href="${APP_URL}/organizer/events/${d.eventId}/edit" class="btn">Continue</a></div>`) }),
  // TEAM
  team_invitation: d => ({ subject: `Join ${d.organizerName} on Ticketrack`, html: baseTemplate(`<h2>You're Invited!</h2><p>Hi ${d.firstName},</p><p><strong>${d.organizerName}</strong> invited you as <strong>${d.roleName}</strong>.</p><div class="card"><div class="row"><span class="label">Organization</span><span class="value">${d.organizerName}</span></div><div class="row"><span class="label">Role</span><span class="value">${d.roleName}</span></div></div><div class="btn-wrap"><a href="${d.inviteLink}" class="btn">Accept</a></div><p style="font-size:12px;color:#666">Expires in 7 days.</p>`) }),
  task_assigned: d => ({ subject: `Task Assigned: ${d.taskTitle}`, html: baseTemplate(`<h2>You've Been Assigned a Task</h2><p>Hi ${d.assigneeName},</p><p><strong>${d.assignerName}</strong> assigned you a task for <strong>${d.eventTitle}</strong>.</p><div class="card"><h3>${d.taskTitle}</h3>${d.description ? `<p style="color:#666;font-size:14px">${d.description}</p>` : ''}<div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Priority</span><span class="value">${d.priority}</span></div>${d.dueDate ? `<div class="row"><span class="label">Due Date</span><span class="value">${d.dueDate}</span></div>` : ''}</div><div class="btn-wrap"><a href="${APP_URL}/organizer/projects" class="btn">View Task</a></div>`) }),
  team_member_removed: d => ({ subject: `Removed from ${d.organizerName}`, html: baseTemplate(`<h2>Access Removed</h2><p>Hi ${d.memberName},</p><p>Your access to <strong>${d.organizerName}</strong> has been removed.</p>`) }),
  // PROMOTER
  promoter_invite: d => ({ subject: `Promote ${d.eventTitle || 'events'} on Ticketrack!`, html: baseTemplate(`<h2>Become a Promoter!</h2><p><strong>${d.organizerName}</strong> invites you to promote.</p><div class="card"><div class="row"><span class="label">Organizer</span><span class="value">${d.organizerName}</span></div><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle || 'All Events'}</span></div><div class="row"><span class="label">Commission</span><span class="value">${d.commissionValue}${d.commissionType === 'percentage' ? '%' : ' per sale'}</span></div><div class="row"><span class="label">Your Code</span><span class="value" style="color:${BRAND_COLOR};font-weight:bold">${d.promoCode}</span></div></div><div class="btn-wrap"><a href="${d.appUrl || APP_URL}/promoter/accept?code=${d.promoCode}" class="btn">${d.isNewUser ? 'Sign Up & Accept' : 'Accept Invitation'}</a></div>`) }),
  promoter_accepted: d => ({ subject: `${d.promoterName} joined!`, html: baseTemplate(`<div class="success"><strong>Accepted!</strong></div><h2>New Promoter</h2><p><strong>${d.promoterName}</strong> accepted.</p><div class="card"><div class="row"><span class="label">Promoter</span><span class="value">${d.promoterName}</span></div><div class="row"><span class="label">Code</span><span class="value" style="color:${BRAND_COLOR};font-weight:bold">${d.promoCode}</span></div><div class="row"><span class="label">Commission</span><span class="value">${d.commissionValue}${d.commissionType === 'percentage' ? '%' : ''}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/promoters" class="btn">View</a></div>`) }),
  promoter_commission: d => ({ subject: `💰 Commission: ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Earned!</strong></div><h2>Commission</h2><div class="card"><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Sale</span><span class="value">${formatCurrency(d.saleAmount, d.currency)}</span></div><div class="row"><span class="label">Your Cut</span><span class="value" style="color:${BRAND_COLOR};font-size:18px">${formatCurrency(d.amount, d.currency)}</span></div></div><p><strong>Pending:</strong> ${formatCurrency(d.pendingTotal, d.currency)}</p>`) }),
  promoter_payout: d => ({ subject: `💰 Promoter Payout - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Payout!</strong></div><h2>Promoter Payout</h2><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Bank</span><span class="value">${d.bankName}</span></div><div class="row"><span class="label">Account</span><span class="value">${maskBank(d.accountNumber)}</span></div></div>`) }),
  promo_code_used: d => ({ subject: `Code used!`, html: baseTemplate(`<h2>Code Used!</h2><div class="card"><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Code</span><span class="value">${d.promoCode}</span></div><div class="row"><span class="label">Total Uses</span><span class="value">${d.totalUses}</span></div></div>`) }),
  promo_code_created: d => ({ subject: `Promo Code: ${d.promoCode}`, html: baseTemplate(`<div class="success"><strong>Created!</strong></div><h2>New Promo Code</h2><p>Hi ${d.organizerName},</p><div class="card"><div style="text-align:center;padding:20px"><div style="font-size:32px;font-weight:800;color:${BRAND_COLOR};letter-spacing:2px">${d.promoCode}</div></div><div class="row"><span class="label">Discount</span><span class="value">${d.discountValue}${d.discountType === 'percentage' ? '%' : ' ' + (d.currency || 'NGN')} off</span></div><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle || 'All'}</span></div>${d.maxUses ? `<div class="row"><span class="label">Max Uses</span><span class="value">${d.maxUses}</span></div>` : ''}${d.expiresAt ? `<div class="row"><span class="label">Expires</span><span class="value">${formatDate(d.expiresAt)}</span></div>` : ''}</div><div class="btn-wrap"><a href="${APP_URL}/organizer/promo-codes" class="btn">Manage</a></div>`) }),
  // EVENT INVITE
  event_invite: d => ({ subject: `You're Invited: ${d.eventTitle}`, html: baseTemplate(`<h2>You're Invited!</h2><p>${d.organizerName} has invited you to an exclusive event.</p><div class="card"><h3 style="margin:0 0 16px">${d.eventTitle}</h3><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div>${d.eventVenue ? `<div class="row"><span class="label">Venue</span><span class="value">${d.eventVenue}</span></div>` : ''}${d.eventCity ? `<div class="row"><span class="label">City</span><span class="value">${d.eventCity}</span></div>` : ''}</div><div style="text-align:center;padding:24px;background:#f8f9fc;border-radius:12px;margin:24px 0"><p style="margin:0 0 8px;color:#666;font-size:14px">Your exclusive invite code:</p><div style="font-size:28px;font-weight:800;color:${BRAND_COLOR};letter-spacing:3px;font-family:monospace">${d.inviteCode}</div></div><div class="btn-wrap"><a href="${d.eventUrl}" class="btn">View Event & Get Tickets</a></div><p style="font-size:12px;color:#666;text-align:center">Enter this code when prompted to access the event.</p>`) }),
  // AFFILIATE
  affiliate_commission_earned: d => ({ subject: `💰 Referral: ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Earned!</strong></div><h2>Referral Commission</h2><p>Hi ${d.affiliateName},</p><p>Someone you referred purchased!</p><div class="card"><div class="row"><span class="label">Purchase</span><span class="value">${formatCurrency(d.purchaseAmount, d.currency)}</span></div><div class="row"><span class="label">Your Cut</span><span class="value" style="color:${BRAND_COLOR};font-size:18px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Code</span><span class="value">${d.referralCode}</span></div></div><p><strong>Pending:</strong> ${formatCurrency(d.pendingTotal, d.currency)}</p>`) }),
  affiliate_payout_processed: d => ({ subject: `💰 Affiliate Payout - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Payout!</strong></div><h2>Affiliate Payout</h2><p>Hi ${d.affiliateName},</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Bank</span><span class="value">${d.bankName}</span></div><div class="row"><span class="label">Account</span><span class="value">${maskBank(d.accountNumber)}</span></div><div class="row"><span class="label">Ref</span><span class="value">${d.reference}</span></div></div>`) }),
  // SUPPORT
  support_ticket_created: d => ({ subject: `Ticket #${d.ticketId} - Received`, html: baseTemplate(`<h2>Request Received</h2><p>Hi ${d.userName},</p><div class="card"><div class="row"><span class="label">ID</span><span class="value">#${d.ticketId}</span></div><div class="row"><span class="label">Category</span><span class="value">${d.category}</span></div><div class="row"><span class="label">Subject</span><span class="value">${d.subject}</span></div></div><p>We'll get back shortly.</p><div class="btn-wrap"><a href="${APP_URL}/support" class="btn">View</a></div>`) }),
  support_ticket_reply: d => ({ subject: `Reply: Ticket #${d.ticketId}`, html: baseTemplate(`<h2>New Reply</h2><p>Hi ${d.userName},</p><div class="card"><div class="row"><span class="label">ID</span><span class="value">#${d.ticketId}</span></div><div class="row"><span class="label">Subject</span><span class="value">${d.subject}</span></div></div><div style="background:#f8f9fc;padding:20px;border-radius:12px;margin:24px 0"><p style="margin:0;white-space:pre-wrap">${d.reply}</p></div><div class="btn-wrap"><a href="${APP_URL}/support" class="btn">View</a></div>`) }),
  support_ticket_resolved: d => ({ subject: `Resolved: Ticket #${d.ticketId}`, html: baseTemplate(`<div class="success"><strong>Resolved</strong></div><h2>Ticket Resolved</h2><p>Hi ${d.userName},</p><div class="card"><div class="row"><span class="label">ID</span><span class="value">#${d.ticketId}</span></div><div class="row"><span class="label">Subject</span><span class="value">${d.subject}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">Resolved</span></div></div>`) }),
  // POST-EVENT
  post_event_thank_you: d => ({ subject: `Thanks for attending ${d.eventTitle}!`, html: baseTemplate(`<h2>Thank You!</h2><p>Hi ${d.attendeeName},</p><p>Thanks for being part of <strong>${d.eventTitle}</strong>!</p>${d.message ? `<div style="background:#f8f9fc;padding:20px;border-radius:12px;margin:24px 0"><p style="margin:0">${d.message}</p></div>` : ''}<div class="btn-wrap"><a href="${APP_URL}/organizer/${d.organizerSlug}" class="btn">Follow ${d.organizerName}</a></div>`) }),
  post_event_feedback: d => ({ subject: `How was ${d.eventTitle}?`, html: baseTemplate(`<h2>Share Feedback</h2><p>Hi ${d.attendeeName},</p><p>How was <strong>${d.eventTitle}</strong>?</p><div class="btn-wrap"><a href="${d.feedbackUrl}" class="btn">Give Feedback</a></div>`) }),
  post_event_next_event: d => ({ subject: `Next: ${d.nextEventTitle}`, html: baseTemplate(`<h2>Don't Miss This!</h2><p>Hi ${d.attendeeName},</p><p>Since you loved <strong>${d.previousEventTitle}</strong>:</p><div class="card"><h3>${d.nextEventTitle}</h3><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.nextEventDate)}</span></div><div class="row"><span class="label">Venue</span><span class="value">${d.nextEventVenue}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/e/${d.nextEventSlug}" class="btn">Get Tickets</a></div>`) }),
  // BULK
  bulk_campaign: d => ({ subject: d.subject, html: baseTemplate(`<h2>${d.title || d.subject}</h2><div style="white-space:pre-wrap">${d.body}</div>${d.ctaText && d.ctaUrl ? `<div class="btn-wrap"><a href="${d.ctaUrl}" class="btn">${d.ctaText}</a></div>` : ''}`, d.preheader || '') }),
  admin_broadcast: d => ({ subject: `[${BRAND_NAME}] ${d.subject}`, html: baseTemplate(`<h2>${d.title || d.subject}</h2><div style="white-space:pre-wrap">${d.body}</div>${d.ctaText && d.ctaUrl ? `<div class="btn-wrap"><a href="${d.ctaUrl}" class="btn">${d.ctaText}</a></div>` : ''}`, d.preheader || '') }),
  // ADMIN
  admin_new_organizer: d => ({ subject: `New Organizer: ${d.businessName}`, html: baseTemplate(`<h2>New Organizer</h2><div class="card"><div class="row"><span class="label">Business</span><span class="value">${d.businessName}</span></div><div class="row"><span class="label">Email</span><span class="value">${d.email}</span></div><div class="row"><span class="label">Signed Up</span><span class="value">${formatDate(d.createdAt)}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/admin/organizers/${d.organizerId}" class="btn">View</a></div>`) }),
  admin_new_event: d => ({ subject: `New Event: ${d.eventTitle}`, html: baseTemplate(`<h2>New Event</h2><div class="card"><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Organizer</span><span class="value">${d.organizerName}</span></div><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/admin/events/${d.eventId}" class="btn">Review</a></div>`) }),
  admin_flagged_content: d => ({ subject: `Flagged: ${d.contentType}`, html: baseTemplate(`<div class="warning"><strong>Review Required</strong></div><h2>Flagged Content</h2><div class="card"><div class="row"><span class="label">Type</span><span class="value">${d.contentType}</span></div><div class="row"><span class="label">Reason</span><span class="value">${d.reason}</span></div><div class="row"><span class="label">Reporter</span><span class="value">${d.reportedBy || 'System'}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/admin/moderation/${d.flagId}" class="btn">Review</a></div>`) }),
  admin_daily_stats: d => ({ subject: `Daily Stats - ${d.date}`, html: baseTemplate(`<h2>Daily Summary</h2><p>${d.date}:</p><div class="card"><div class="row"><span class="label">Revenue</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.totalRevenue, d.currency)}</span></div><div class="row"><span class="label">Tickets</span><span class="value">${d.ticketsSold}</span></div><div class="row"><span class="label">New Users</span><span class="value">${d.newUsers}</span></div><div class="row"><span class="label">New Organizers</span><span class="value">${d.newOrganizers}</span></div><div class="row"><span class="label">Platform Fees</span><span class="value">${formatCurrency(d.platformFees, d.currency)}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/admin/analytics" class="btn">Dashboard</a></div>`) }),
  // PAYSTACK PAYOUTS
  paystack_payout_initiated: d => ({ subject: `💰 Payout Initiated - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Payout Started</strong></div><h2>Transfer Processing</h2><p>Hi ${d.organizerName},</p><p>Your ${d.isDonation ? 'donation ' : ''}payout is being processed.</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:${BRAND_COLOR};font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Bank</span><span class="value">${d.bankName}</span></div><div class="row"><span class="label">Account</span><span class="value">****${d.accountEnding}</span></div><div class="row"><span class="label">Reference</span><span class="value" style="font-family:monospace">${d.reference}</span></div></div><p style="font-size:14px;color:#666">Funds typically arrive within 24 hours.</p><div class="btn-wrap"><a href="${APP_URL}/organizer/finance" class="btn">View Finance</a></div>`) }),
  paystack_payout_completed: d => ({ subject: `✅ Payout Complete - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Payout Received!</strong></div><h2>Funds Transferred</h2><p>Hi ${d.organizerName},</p><p>Your ${d.isDonation ? 'donation ' : ''}payout has been successfully transferred.</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:#10b981;font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Reference</span><span class="value" style="font-family:monospace">${d.reference}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">Completed</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/finance" class="btn">View Finance</a></div>`) }),
  payout_blocked_kyc: d => ({ subject: `⚠️ Payout Pending - KYC Required`, html: baseTemplate(`<div class="highlight"><strong>Action Required</strong></div><h2>Complete Verification</h2><p>Hi ${d.organizerName},</p><p>${d.message || 'You have pending payouts but KYC verification is required.'}</p><div class="warning"><strong>What to do:</strong><p style="margin:8px 0 0">Complete your identity verification to receive payouts.</p></div><div class="btn-wrap"><a href="${d.appUrl || APP_URL + '/organizer/kyc-verification'}" class="btn">Verify Now</a></div>`) }),
  stripe_connect_payout_completed: d => ({ subject: `✅ Stripe Payout Complete - ${formatCurrency(d.amount, d.currency)}`, html: baseTemplate(`<div class="success"><strong>Payout Received!</strong></div><h2>Funds Transferred</h2><p>Hi ${d.organizerName},</p><p>Your payout has been successfully deposited.</p><div class="card"><div class="row"><span class="label">Amount</span><span class="value" style="color:#10b981;font-size:24px">${formatCurrency(d.amount, d.currency)}</span></div><div class="row"><span class="label">Reference</span><span class="value" style="font-family:monospace">${d.payoutId || d.reference}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#10b981">Completed</span></div></div><div class="btn-wrap"><a href="${APP_URL}/organizer/stripe-connect" class="btn">View Stripe Dashboard</a></div>`) }),
  pre_payout_reminder: d => ({ subject: `📅 Payout Coming Tomorrow - ${d.eventTitle}`, html: baseTemplate(`<h2>Payout Reminder</h2><p>Hi ${d.organizerName},</p><p>Your payout for <strong>${d.eventTitle}</strong> will be processed tomorrow!</p><div class="card"><div class="row"><span class="label">Event</span><span class="value">${d.eventTitle}</span></div><div class="row"><span class="label">Payout Date</span><span class="value">${d.payoutDate}</span></div></div><div class="highlight"><strong>Make sure:</strong><ul style="margin:8px 0 0;padding-left:20px"><li>Bank details are correct</li><li>KYC is verified</li></ul></div><div class="btn-wrap"><a href="${d.appUrl || APP_URL + '/organizer/finance'}" class="btn">Check Finance</a></div>`) }),
  // BIRTHDAY
  birthday_wish: d => ({ 
    subject: `🎂 Happy Birthday, ${d.firstName}!`, 
    html: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; text-align: center; color: #334155; max-width: 500px; margin: 40px auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <h1 style="color: #0f172a; font-size: 20px;">TICKETRACK</h1>
    <h2 style="margin-top: 40px;">Happy Birthday, ${d.firstName}! 🎂</h2>
    <p>We hope your day is as spectacular as the events you design.</p>
    
    <div style="background: #f8fafc; border: 1px dashed #007AFF; padding: 20px; margin: 30px 0; border-radius: 8px;">
        <span style="color: #007AFF; font-weight: bold; font-size: 18px;">A Birthday Gift for You</span>
        <p style="margin: 5px 0 0 0;">Enjoy 20% off your next premium asset pack.</p>
    </div>
    
    <a href="${APP_URL}/dashboard" style="display: inline-block; background: #007AFF; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Claim Gift</a>
    
    <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">Sent with ❤️ from the Ticketrack Team</p>
</body>
</html>`
  }),
  // GROUP BUY
  group_invite: d => ({ subject: `👥 ${d.inviterName} invited you to buy tickets for ${d.eventTitle}!`, html: baseTemplate(`<div class="highlight"><strong>You're Invited!</strong></div><h2>Join the Group</h2><p>${d.inviterName} invited you to join their group to buy tickets for:</p><div class="card"><h3>${d.eventTitle}</h3><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Group</span><span class="value">${d.groupName || 'Group Session'}</span></div><div class="row"><span class="label">Code</span><span class="value" style="font-family:monospace;font-size:18px;color:${BRAND_COLOR}">${d.groupCode}</span></div></div>${d.message ? `<div style="background:#f8fafc;padding:12px;border-radius:8px;margin:16px 0;font-style:italic">"${d.message}"</div>` : ''}<div class="btn-wrap"><a href="${d.groupLink}" class="btn">Join Group</a></div><p style="font-size:13px;color:#6b7280;margin-top:16px">This invite expires ${formatDate(d.expiresAt)}</p>`, `${d.inviterName} invited you to their group!`) }),
  group_member_joined: d => ({ subject: `👥 ${d.memberName} joined your group for ${d.eventTitle}`, html: baseTemplate(`<h2>New Member Joined!</h2><p>Hi ${d.hostName},</p><p><strong>${d.memberName}</strong> joined your group session for <strong>${d.eventTitle}</strong>.</p><div class="card"><div class="row"><span class="label">Group</span><span class="value">${d.groupName || 'Your Group'}</span></div><div class="row"><span class="label">Members</span><span class="value">${d.memberCount}</span></div><div class="row"><span class="label">Time Left</span><span class="value">${d.timeRemaining}</span></div></div><div class="btn-wrap"><a href="${d.groupLink}" class="btn">View Group</a></div>`) }),
  group_purchase_complete: d => ({ subject: `🎉 Group Purchase Complete - ${d.eventTitle}`, html: baseTemplate(`<div class="success"><strong>All Set!</strong></div><h2>Group Purchase Complete</h2><p>Hi ${d.memberName},</p><p>Everyone in your group has completed their purchase!</p><div class="card"><h3>${d.eventTitle}</h3><div class="row"><span class="label">Date</span><span class="value">${formatDate(d.eventDate)}</span></div><div class="row"><span class="label">Group Members</span><span class="value">${d.memberCount}</span></div><div class="row"><span class="label">Total Tickets</span><span class="value">${d.totalTickets}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/tickets" class="btn">View My Tickets</a></div>`) }),
  // SPLIT PAYMENTS
  split_payment_complete: d => ({ subject: `🎉 Split Payment Complete - ${d.eventTitle}`, html: baseTemplate(`<div class="success"><strong>All Paid!</strong></div><h2>Your Tickets Are Ready</h2><p>Hi ${d.name},</p><p>Everyone in your group has paid their share! Your tickets for <strong>${d.eventTitle}</strong> have been issued.</p><div class="card"><div class="row"><span class="label">Order</span><span class="value" style="font-family:monospace">${d.orderNumber}</span></div><div class="row"><span class="label">Your Share</span><span class="value">${formatCurrency(d.shareAmount || 0, d.currency || 'NGN')}</span></div></div><div class="btn-wrap"><a href="${APP_URL}/tickets" class="btn">View My Tickets</a></div>`, `Your tickets for ${d.eventTitle} are ready!`) }),
  split_payment_progress: d => ({ subject: `👥 ${d.payerName} paid their share for ${d.eventTitle}`, html: baseTemplate(`<h2>Payment Progress!</h2><p>Hi ${d.name},</p><p><strong>${d.payerName}</strong> just paid their share for <strong>${d.eventTitle}</strong>!</p><div class="highlight"><strong>${d.remainingCount} ${d.remainingCount === 1 ? 'person' : 'people'} left to pay</strong></div><p style="margin-top:16px">Once everyone pays, your tickets will be issued automatically.</p><div class="btn-wrap"><a href="${APP_URL}/pay-share" class="btn">Pay Your Share</a></div>`, `${d.payerName} paid their share!`) }),
}

// ============================================================================
// EMAIL TRACKING FUNCTIONS
// ============================================================================

// Generate a unique tracking ID
function generateTrackingId(campaignId?: string, messageId?: string, recipientEmail?: string): string {
  const hash = simpleHash(recipientEmail || Date.now().toString())
  if (campaignId && messageId) {
    return `${campaignId}_${messageId}_${hash}`
  } else if (messageId) {
    return `${messageId}_${hash}`
  }
  return `${Date.now()}_${hash}`
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).substring(0, 8)
}

// Inject tracking pixel into HTML
function injectTrackingPixel(html: string, trackingId: string): string {
  const pixelUrl = `${TRACKING_URL}?t=${encodeURIComponent(trackingId)}`
  const pixelTag = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;border:0" />`
  
  // Insert before </body> or at end of HTML
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelTag}</body>`)
  } else if (html.includes('</html>')) {
    return html.replace('</html>', `${pixelTag}</html>`)
  }
  return html + pixelTag
}

// Wrap links for click tracking
function wrapLinksForTracking(html: string, trackingId: string): string {
  // Regex to find all <a> tags with href
  const linkRegex = /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>/gi
  
  let position = 0
  return html.replace(linkRegex, (match, before, url, after) => {
    position++
    
    // Skip internal anchors, mailto, tel, and unsubscribe links
    if (url.startsWith('#') || 
        url.startsWith('mailto:') || 
        url.startsWith('tel:') ||
        url.includes('unsubscribe') ||
        url.includes('/profile?tab=settings')) {
      return match
    }
    
    // Create tracking URL
    const trackedUrl = `${TRACKING_URL}?t=${encodeURIComponent(trackingId)}&r=${encodeURIComponent(url)}`
    return `<a ${before}href="${trackedUrl}"${after}>`
  })
}

// Process HTML for tracking
function addEmailTracking(html: string, trackingId: string, enableClickTracking: boolean = true): string {
  let trackedHtml = html
  
  // Add click tracking to links
  if (enableClickTracking) {
    trackedHtml = wrapLinksForTracking(trackedHtml, trackingId)
  }
  
  // Add tracking pixel for opens
  trackedHtml = injectTrackingPixel(trackedHtml, trackingId)
  
  return trackedHtml
}

// ============================================================================
// SEND EMAIL FUNCTION
// ============================================================================

// Send email
async function sendEmail(supabase: any, req: any) {
  if (!RESEND_API_KEY) return { success: false, error: 'RESEND_API_KEY not configured' }
  const template = templates[req.type]
  if (!template) return { success: false, error: `Unknown type: ${req.type}` }
  let { subject, html } = template(req.data)
  const to = Array.isArray(req.to) ? req.to : [req.to]
  const perm = EMAIL_PERMISSIONS[req.type]
  const from = perm?.fromEmail || FROM_EMAIL
  let logId: string | undefined
  let messageId: string | undefined
  
  if (!req.skipLogging) {
    try {
      const { data } = await supabase.from('communication_logs').insert({ channel: 'email', template_key: req.type, recipient_email: to[0], recipient_user_id: req.userId || null, event_id: req.eventId || null, subject, status: 'queued', provider: 'resend', metadata: { recipientCount: to.length } }).select('id').single()
      logId = data?.id
      messageId = data?.id
    } catch (e) { log.error('Log error:', e) }
  }
  
  // Add email tracking for trackable email types
  const shouldTrack = TRACKABLE_EMAIL_TYPES.includes(req.type) || req.enableTracking === true
  let trackingId: string | undefined
  
  if (shouldTrack && !req.skipTracking) {
    trackingId = generateTrackingId(req.campaignId, messageId, to[0])
    html = addEmailTracking(html, trackingId, true)
    log.info(`Email tracking enabled: ${trackingId}`)
  }
  
  try {
    // Build email payload
    const emailPayload: any = { from, to, subject, html, attachments: req.attachments }
    
    // BCC support@ticketrack.com on ALL emails for complete record-keeping
    if (BCC_ALL_EMAILS) {
      // Don't BCC if sending TO support (avoid duplicate)
      const toEmails = Array.isArray(to) ? to : [to]
      if (!toEmails.includes(SUPPORT_EMAIL)) {
        emailPayload.bcc = [SUPPORT_EMAIL]
      }
    }
    
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) })
    const result = await res.json()
    if (!res.ok) {
      if (logId) await supabase.from('communication_logs').update({ status: 'failed', error_message: result.message }).eq('id', logId)
      return { success: false, error: result.message || 'Failed', logId }
    }
    if (logId) {
      await supabase.from('communication_logs').update({ 
        status: 'sent', 
        provider_message_id: result.id, 
        sent_at: new Date().toISOString(),
        metadata: { trackingId, tracked: shouldTrack }
      }).eq('id', logId)
    }
    return { success: true, messageId: result.id, logId, trackingId }
  } catch (e: any) {
    if (logId) await supabase.from('communication_logs').update({ status: 'failed', error_message: e.message }).eq('id', logId)
    return { success: false, error: e.message, logId }
  }
}

// Handler
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    if (req.method === 'GET') {
      // Preview endpoint for testing email templates
      const url = new URL(req.url)
      const type = url.searchParams.get('type')
      const preview = url.searchParams.get('preview') === 'true'

      if (!type) return new Response(JSON.stringify({ success: false, error: 'Missing type parameter' }), { status: 400, headers: cors })

      const auth = await getAuthContext(req)
      if (!auth.isAdmin && !auth.isServiceRole) {
        return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), { status: 403, headers: cors })
      }

      const template = templates[type]
      if (!template) return new Response(JSON.stringify({ success: false, error: 'Unknown template type' }), { status: 400, headers: cors })

      // Generate preview with sample data
      const sampleData = getSampleData(type)
      const { subject, html } = template(sampleData)

      if (preview) {
        return new Response(html, { headers: { 'Content-Type': 'text/html', ...cors } })
      }

      return new Response(JSON.stringify({
        success: true,
        template: { subject, html: html.substring(0, 500) + '...' },
        sampleData
      }), { headers: cors })
    }

    if (req.method !== 'POST') return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers: cors })
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ success: false, error: 'Unauthorized origin' }), { status: 403, headers: cors })

    const body = await req.json()
    if (!body.type || !body.to || !body.data) return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), { status: 400, headers: cors })

    const auth = await getAuthContext(req)
    const authCheck = await checkAuth(body.type, auth, body)
    if (!authCheck.ok) return new Response(JSON.stringify({ success: false, error: authCheck.err }), { status: 403, headers: cors })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const to = Array.isArray(body.to) ? body.to : [body.to]
    const rateCheck = await checkRateLimit(supabase, auth.userId, body.type, to.length)
    if (!rateCheck.ok) return new Response(JSON.stringify({ success: false, error: rateCheck.err }), { status: 429, headers: cors })

    const result = await sendEmail(supabase, body)
    return new Response(JSON.stringify(result), { status: result.success ? 200 : 500, headers: cors })
  } catch (e: any) {
    log.error('Handler error:', e)
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: cors })
  }
})

// Sample data for email previews
function getSampleData(type: string): any {
  const baseData = {
    firstName: 'John',
    userName: 'john.doe',
    organizerName: 'Tech Events Inc.',
    businessName: 'Tech Events Inc.',
    eventTitle: 'React Conference 2025',
    eventDate: '2025-03-15T10:00:00Z',
    ticketType: 'VIP Ticket',
    quantity: 2,
    amount: 150,
    currency: 'USD',
    orderNumber: 'ORD-123456',
    ticketCode: 'TKT-ABC123'
  }

  const typeSpecificData: Record<string, any> = {
    welcome: baseData,
    email_verification: { ...baseData, verificationUrl: `${APP_URL}/verify?token=sample` },
    password_reset: { ...baseData, resetUrl: `${APP_URL}/reset-password?token=sample` },
    ticket_purchase: {
      ...baseData,
      attendeeName: 'John Doe',
      venueName: 'Convention Center',
      totalAmount: 300,
      isFree: false
    }
  }

  return typeSpecificData[type] || baseData
}
