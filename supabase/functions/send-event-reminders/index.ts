// Ticketrack Event Reminders Scheduler
// Sends 24h and 1h reminders to ticket holders
// Triggered by external cron (every 15 minutes)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const APP_URL = Deno.env.get('APP_URL') || 'https://ticketrack.com'

interface ReminderResult {
  type: '24h' | '1h'
  sent: number
  skipped: number
  failed: number
  errors: string[]
}

// Check if reminder was already sent (using communication_logs)
async function wasReminderSent(eventId: string, ticketId: string, templateKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('event_id', eventId)
    .eq('ticket_id', ticketId)
    .eq('template_key', templateKey)
    .eq('status', 'sent')
    .limit(1)
    .single()
  
  return !!data
}

// Send reminder email via send-email function
async function sendReminderEmail(
  templateKey: 'event_reminder_24h' | 'event_reminder_1h',
  ticket: any,
  event: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        type: templateKey,
        to: ticket.attendee_email,
        data: {
          attendeeName: ticket.attendee_name || 'there',
          eventTitle: event.title,
          eventDate: event.start_date,
          venueName: event.venue_name || 'Venue TBA',
          venueAddress: event.venue_address || event.venue_name,
          city: event.city || '',
          ticketType: ticket.ticket_type_name || 'General',
          ticketCode: ticket.ticket_code,
          appUrl: APP_URL
        },
        // Tracking fields for communication_logs
        userId: ticket.user_id,
        eventId: event.id,
        ticketId: ticket.id
      })
    })

    const result = await response.json()
    return { success: result.success, error: result.error }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// Process reminders for a specific time window
async function processReminders(
  reminderType: '24h' | '1h',
  hoursAhead: number,
  windowMinutes: number = 15
): Promise<ReminderResult> {
  const result: ReminderResult = {
    type: reminderType,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  const templateKey = reminderType === '24h' ? 'event_reminder_24h' : 'event_reminder_1h'
  
  // Calculate time window
  const now = new Date()
  const targetTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000))
  const windowStart = new Date(targetTime.getTime() - (windowMinutes / 2 * 60 * 1000))
  const windowEnd = new Date(targetTime.getTime() + (windowMinutes / 2 * 60 * 1000))

  console.log(`Processing ${reminderType} reminders for events between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`)

  // Find events in the time window
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, start_date, venue_name, venue_address, city, slug, google_map_link')
    .gte('start_date', windowStart.toISOString())
    .lte('start_date', windowEnd.toISOString())
    .eq('status', 'published')

  if (eventsError) {
    console.error('Error fetching events:', eventsError)
    result.errors.push(`Events query failed: ${eventsError.message}`)
    return result
  }

  if (!events || events.length === 0) {
    console.log(`No events found for ${reminderType} reminders`)
    return result
  }

  console.log(`Found ${events.length} events for ${reminderType} reminders`)

  // Process each event
  for (const event of events) {
    // Get all active tickets for this event
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        user_id,
        attendee_email,
        attendee_name,
        ticket_code,
        ticket_type:ticket_types(name)
      `)
      .eq('event_id', event.id)
      .eq('status', 'active')
      .eq('payment_status', 'completed')
      .not('attendee_email', 'is', null)

    if (ticketsError) {
      console.error(`Error fetching tickets for event ${event.id}:`, ticketsError)
      result.errors.push(`Tickets query failed for ${event.title}: ${ticketsError.message}`)
      continue
    }

    if (!tickets || tickets.length === 0) {
      console.log(`No active tickets for event: ${event.title}`)
      continue
    }

    console.log(`Processing ${tickets.length} tickets for event: ${event.title}`)

    // Send reminder to each ticket holder
    for (const ticket of tickets) {
      // Check if reminder was already sent
      const alreadySent = await wasReminderSent(event.id, ticket.id, templateKey)
      if (alreadySent) {
        result.skipped++
        continue
      }

      // Prepare ticket data with ticket type name
      const ticketWithTypeName = {
        ...ticket,
        ticket_type_name: ticket.ticket_type?.name || 'General'
      }

      // Send the reminder
      const sendResult = await sendReminderEmail(templateKey, ticketWithTypeName, event)
      
      if (sendResult.success) {
        result.sent++
        console.log(`✅ Sent ${reminderType} reminder to ${ticket.attendee_email} for ${event.title}`)
      } else {
        result.failed++
        result.errors.push(`Failed to send to ${ticket.attendee_email}: ${sendResult.error}`)
        console.error(`❌ Failed to send ${reminderType} reminder to ${ticket.attendee_email}: ${sendResult.error}`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return result
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Event Reminders Scheduler Started ===')
    const startTime = Date.now()

    // Process both 24h and 1h reminders
    const results: ReminderResult[] = []

    // 24-hour reminders
    const result24h = await processReminders('24h', 24, 15)
    results.push(result24h)
    console.log(`24h reminders: ${result24h.sent} sent, ${result24h.skipped} skipped, ${result24h.failed} failed`)

    // 1-hour reminders
    const result1h = await processReminders('1h', 1, 15)
    results.push(result1h)
    console.log(`1h reminders: ${result1h.sent} sent, ${result1h.skipped} skipped, ${result1h.failed} failed`)

    const duration = Date.now() - startTime
    console.log(`=== Completed in ${duration}ms ===`)

    // Summary
    const summary = {
      success: true,
      duration_ms: duration,
      results: results,
      totals: {
        sent: results.reduce((sum, r) => sum + r.sent, 0),
        skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        failed: results.reduce((sum, r) => sum + r.failed, 0)
      }
    }

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
