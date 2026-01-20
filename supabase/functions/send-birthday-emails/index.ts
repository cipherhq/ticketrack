// Send Birthday Emails - Scheduled daily to wish users a happy birthday
// Runs via Supabase cron or manual trigger

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get current date
    const today = new Date()
    const currentMonth = today.getMonth() + 1 // JavaScript months are 0-indexed (0-11)
    const currentDay = today.getDate() // Day of month (1-31)

    console.log(`Checking for birthdays on ${currentMonth}/${currentDay}`)

    // Find users whose birthday is today
    const { data: users, error: queryError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, birth_month, birth_day, email_notifications')
      .eq('birth_month', currentMonth)
      .eq('birth_day', currentDay)
      .eq('email_notifications', true) // Only send if user has email notifications enabled
      .not('email', 'is', null) // Must have an email

    if (queryError) {
      console.error('Error querying users:', queryError)
      throw queryError
    }

    if (!users || users.length === 0) {
      console.log('No birthdays found today')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No birthdays found today',
          count: 0 
        }),
        {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    console.log(`Found ${users.length} birthday(s) today`)

    // Track results
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Send birthday emails
    for (const user of users) {
      try {
        // Call the send-email function
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            type: 'birthday_wish',
            to: user.email,
            data: {
              firstName: user.first_name || 'Friend',
              lastName: user.last_name || '',
              email: user.email,
            },
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        results.sent++
        console.log(`Birthday email sent to ${user.email}`)
      } catch (error) {
        results.failed++
        const errorMsg = `Failed to send to ${user.email}: ${error.message}`
        results.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${users.length} birthday(s)`,
        results: {
          total: users.length,
          sent: results.sent,
          failed: results.failed,
          errors: results.errors,
        },
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Error processing birthday emails:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
