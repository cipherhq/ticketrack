// ticketRack - Auto Party Invite Reminders
// Called by Vercel cron every hour. Finds party invites with auto_remind_enabled
// where the party starts within auto_remind_hours_before, and sends reminder
// emails to pending guests who haven't been reminded yet.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'ticketRack <support@ticketrack.com>'
const BRAND_COLOR = '#2969FF'
const APP_URL = 'https://ticketrack.com'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // Require service role key (cron job auth)
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const now = new Date()

    // Find party invites where:
    // - auto_remind_enabled is true
    // - start_date is in the future
    // - start_date minus auto_remind_hours_before is <= now (time to send)
    // - auto_remind_sent_at is null (not yet sent)
    const { data: invites, error: invErr } = await supabase
      .from('party_invites')
      .select('id, title, start_date, venue_name, city, share_token, organizer_id, auto_remind_hours_before, cover_image_url')
      .eq('auto_remind_enabled', true)
      .is('auto_remind_sent_at', null)
      .gt('start_date', now.toISOString())
      .order('start_date', { ascending: true })
      .limit(50)

    if (invErr) {
      console.error('Error fetching invites:', invErr)
      return new Response(JSON.stringify({ error: 'Failed to fetch invites', detail: invErr.message }), { status: 500 })
    }

    if (!invites || invites.length === 0) {
      return new Response(JSON.stringify({ message: 'No invites due for auto-remind', sent: 0 }), { status: 200 })
    }

    let totalSent = 0
    let totalSkipped = 0
    const processedInvites: string[] = []

    for (const invite of invites) {
      const hoursBeforeEvent = invite.auto_remind_hours_before || 24
      const reminderThreshold = new Date(new Date(invite.start_date).getTime() - hoursBeforeEvent * 60 * 60 * 1000)

      // Only send if we've passed the reminder threshold
      if (now < reminderThreshold) {
        totalSkipped++
        continue
      }

      // Get pending guests with email who haven't been reminded
      const { data: guests, error: gErr } = await supabase
        .from('party_invite_guests')
        .select('id, email, rsvp_token, name')
        .eq('invite_id', invite.id)
        .eq('rsvp_status', 'pending')
        .not('email', 'is', null)
        .not('rsvp_token', 'is', null)
        .not('email_sent_at', 'is', null) // Only remind guests who got the initial invite
        .is('reminder_sent_at', null)

      if (gErr || !guests || guests.length === 0) {
        // Mark as sent even if no guests, to avoid re-processing
        await supabase.from('party_invites').update({ auto_remind_sent_at: now.toISOString() }).eq('id', invite.id)
        processedInvites.push(invite.id)
        continue
      }

      // Count going guests for social proof
      const { count: goingCount } = await supabase
        .from('party_invite_guests')
        .select('id', { count: 'exact', head: true })
        .eq('invite_id', invite.id)
        .eq('rsvp_status', 'going')

      // Send reminder to each pending guest
      const sentIds: string[] = []
      for (const g of guests) {
        if (!g.email || !g.rsvp_token) continue

        const rsvpUrl = `${APP_URL}/invite/${invite.share_token}?rsvp=${g.rsvp_token}`
        const subject = `⏰ Don't forget to RSVP - ${invite.title}`
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND_COLOR};padding:20px;text-align:center"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px">ticketRack</span></td></tr>
<tr><td style="padding:32px 28px">
<h2 style="font-size:24px;margin:0 0 8px 0;color:#1a1a2e">Don't Forget to RSVP!</h2>
<p style="margin:0 0 20px 0;font-size:16px;color:#6b7280">You haven't responded to your invite for <strong style="color:#1a1a2e">${invite.title}</strong>.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;border-radius:8px;margin-bottom:20px">
<tr><td style="padding:20px">
<p style="margin:0 0 6px 0;font-size:14px;color:#374151">📅 ${formatDate(invite.start_date)} • ${formatTime(invite.start_date)}</p>
<p style="margin:0;font-size:14px;color:#374151">📍 ${invite.venue_name || 'TBA'}${invite.city ? ', ' + invite.city : ''}</p>
</td></tr></table>
${goingCount ? `<p style="margin:0 0 20px 0;font-size:15px;color:#374151;text-align:center">🎉 <strong>${goingCount} ${goingCount === 1 ? 'person is' : 'people are'} already going!</strong></p>` : ''}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
<tr><td align="center" style="padding:12px 0">
<a href="${rsvpUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:16px 48px;text-decoration:none;border-radius:12px;font-weight:700;font-size:18px">RSVP Now</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #f0f0f0;text-align:center">
<p style="margin:0;font-size:12px;color:#9ca3af">Sent by ticketRack · <a href="${APP_URL}" style="color:${BRAND_COLOR}">ticketrack.com</a></p>
</td></tr></table></td></tr></table></body></html>`

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({ from: FROM_EMAIL, to: [g.email], subject, html }),
          })
          if (res.ok) {
            sentIds.push(g.id)
            totalSent++
          } else {
            console.error(`Failed to send reminder to ${g.email}:`, await res.text())
          }
        } catch (emailErr) {
          console.error(`Error sending to ${g.email}:`, emailErr)
        }
      }

      // Mark guests as reminded
      if (sentIds.length > 0) {
        await supabase
          .from('party_invite_guests')
          .update({ reminder_sent_at: now.toISOString() })
          .in('id', sentIds)
      }

      // Mark invite as auto-reminded
      await supabase
        .from('party_invites')
        .update({ auto_remind_sent_at: now.toISOString() })
        .eq('id', invite.id)

      processedInvites.push(invite.id)

      // Log activity
      await supabase.from('party_invite_activity').insert({
        invite_id: invite.id,
        action: 'auto_reminder_sent',
        performed_by: 'System',
        metadata: { count: sentIds.length },
      })
    }

    return new Response(JSON.stringify({
      message: 'Auto-reminders processed',
      sent: totalSent,
      skipped: totalSkipped,
      invitesProcessed: processedInvites.length,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Auto-remind error:', err)
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), { status: 500 })
  }
})
