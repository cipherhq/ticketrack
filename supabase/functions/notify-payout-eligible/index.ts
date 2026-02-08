import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find events that ended in the last 24 hours and haven't been paid out
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(`
        id, title, end_date, currency,
        organizer:organizers(id, business_name, email, business_email),
        orders(id, total_amount, platform_fee, status)
      `)
      .lt("end_date", now.toISOString())
      .gt("end_date", yesterday.toISOString())
      .is("payout_status", null);

    if (eventsError) throw eventsError;

    const notificationsSent = [];

    for (const event of events || []) {
      // Calculate net earnings for this event
      const completedOrders = event.orders?.filter((o: any) => o.status === "completed") || [];
      const totalAmount = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || 0), 0);
      const platformFees = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.platform_fee || 0), 0);
      const netEarnings = totalAmount - platformFees;

      if (netEarnings <= 0) continue;

      const organizer = event.organizer;
      const organizerEmail = organizer?.email || organizer?.business_email;

      if (!organizerEmail) continue;

      // Check if we already sent a notification for this event
      const { data: existingNotification } = await supabase
        .from("notification_log")
        .select("id")
        .eq("event_id", event.id)
        .eq("notification_type", "payout_eligible")
        .single();

      if (existingNotification) continue;

      // Send email notification
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          type: "payout_eligible",
          to: organizerEmail,
          data: {
            organizerName: organizer.business_name,
            eventTitle: event.title,
            amount: netEarnings,
            currency: event.currency,
            eligibleDate: event.end_date,
            eventId: event.id,
          },
          organizerId: organizer.id,
          eventId: event.id,
        }),
      });

      // Log the notification
      await supabase.from("notification_log").insert({
        event_id: event.id,
        organizer_id: organizer.id,
        notification_type: "payout_eligible",
        recipient_email: organizerEmail,
        sent_at: new Date().toISOString(),
      });

      notificationsSent.push({
        eventId: event.id,
        eventTitle: event.title,
        organizerEmail,
        amount: netEarnings,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notificationsSent.length} payout eligible notifications`,
        notifications: notificationsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
