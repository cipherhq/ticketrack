import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get share details with split payment and event
    const { data: share, error: shareError } = await supabase
      .from("group_split_shares")
      .select(`
        *,
        split_payment:group_split_payments(
          *,
          event:events(id, title, slug, start_date, image_url, currency)
        )
      `)
      .eq("id", shareId)
      .single();

    if (shareError || !share) {
      throw new Error("Share not found");
    }

    // Check if already paid
    if (share.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ success: true, message: "Already paid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const splitPayment = share.split_payment;
    const event = splitPayment?.event;

    if (!event || !share.email) {
      throw new Error("Missing event or email");
    }

    // Generate payment link using environment variable or default
    const siteUrl = Deno.env.get("SITE_URL") || "https://ticketrack.com";
    const paymentLink = `${siteUrl}/pay-share/${share.payment_token}`;

    // Calculate time remaining
    const expiresAt = new Date(splitPayment.expires_at);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

    // Format amount
    const formatAmount = (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'NGN'
      }).format(amount);
    };

    const amountFormatted = formatAmount(share.share_amount, splitPayment.currency);

    // Send email via Resend
    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #2969FF 0%, #1a4fd8 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">⏰ Reminder: Pay Your Share</h1>
            </div>
            <div style="padding: 30px;">
              <p style="margin-top: 0;">Hey ${share.name || 'there'}!</p>
              <p>This is a friendly reminder to pay your share for <strong>${event.title}</strong>.</p>
              
              <div style="background: #f0f4ff; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div style="font-size: 14px; color: #666;">Your Share</div>
                <div style="font-size: 32px; font-weight: bold; color: #2969FF;">${amountFormatted}</div>
              </div>

              ${hoursRemaining > 0 ? `
              <div style="background: #fff3cd; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: center;">
                <span style="font-size: 14px; color: #856404;">⏰ Only <strong>${hoursRemaining} hours</strong> left to pay!</span>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 30px 0;">
                <a href="${paymentLink}" style="display: inline-block; background: #2969FF; color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px;">Pay Your Share Now</a>
              </div>

              <p style="color: #666; font-size: 14px; text-align: center;">
                Tickets will only be issued once everyone in your group has paid.
              </p>
            </div>
            <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">Ticketrack - Your ticket to unforgettable experiences</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Ticketrack <support@ticketrack.com>",
          to: [share.email],
          subject: `⏰ Reminder: Pay your share for ${event.title}`,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Resend error:", errorData);
        throw new Error("Failed to send reminder email");
      }
    }

    // Update reminder count
    await supabase
      .from("group_split_shares")
      .update({
        reminder_count: (share.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", shareId);

    return new Response(
      JSON.stringify({ success: true, message: "Reminder sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send split reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
