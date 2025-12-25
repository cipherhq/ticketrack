// Vercel Cron Job - Event Reminders
// Runs every 15 minutes to send 24h and 1h reminders

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Verify this is from Vercel Cron (not a random request)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Call the Supabase Edge Function
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/send-event-reminders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    const result = await response.json();
    
    console.log('Event reminders result:', result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
