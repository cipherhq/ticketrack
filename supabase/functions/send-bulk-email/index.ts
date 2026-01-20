import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const FROM_EMAIL = 'Ticketrack <support@ticketrack.com>';
const SUPPORT_EMAIL = 'support@ticketrack.com';
const APP_URL = 'https://ticketrack.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email template
const emailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #2969FF 0%, #1a4fd6 100%); padding: 30px; text-align: center; }
    .header img { height: 40px; }
    .header h1 { color: #fff; margin: 10px 0 0; font-size: 20px; font-weight: 600; }
    .content { padding: 30px; }
    .footer { background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
    .footer a { color: #2969FF; text-decoration: none; }
    a { color: #2969FF; }
    p { margin: 0 0 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ticketrack</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Sent via <a href="${APP_URL}">Ticketrack</a></p>
      <p style="margin-top: 10px; color: #999;">If you no longer wish to receive these emails, you can update your preferences.</p>
    </div>
  </div>
</body>
</html>
`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { campaignId, recipients, subject, body, variables, organizerId } = await req.json();

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No recipients provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process emails in batches of 50
    const BATCH_SIZE = 50;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (recipient: any) => {
          // Replace variables for this recipient
          let personalizedSubject = subject;
          let personalizedBody = body;

          // Replace recipient-specific variables
          personalizedSubject = personalizedSubject.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
          personalizedBody = personalizedBody.replace(/\{\{attendee_name\}\}/g, recipient.name || 'there');
          personalizedBody = personalizedBody.replace(/\{\{ticket_type\}\}/g, recipient.ticket_type || 'General');

          // Replace event/organizer variables
          Object.entries(variables || {}).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            personalizedSubject = personalizedSubject.replace(regex, value as string);
            personalizedBody = personalizedBody.replace(regex, value as string);
          });

          // Send email with BCC to support for record-keeping
          const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: recipient.email,
            bcc: recipient.email !== SUPPORT_EMAIL ? [SUPPORT_EMAIL] : undefined,
            subject: personalizedSubject,
            html: emailTemplate(personalizedBody),
          });

          if (error) {
            throw new Error(error.message);
          }

          // Log to communication_logs
          await supabase.from('communication_logs').insert({
            organizer_id: organizerId,
            campaign_id: campaignId,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            channel: 'email',
            message_type: 'campaign',
            subject: personalizedSubject,
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: data?.id,
          });

          return data;
        })
      );

      // Count results
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          errors.push(`${batch[idx].email}: ${result.reason}`);
          console.error(`Failed to send to ${batch[idx].email}:`, result.reason);
        }
      });

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update campaign with final counts
    if (campaignId) {
      await supabase
        .from('email_campaigns')
        .update({
          total_sent: successCount,
          total_failed: failCount,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Bulk email error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
