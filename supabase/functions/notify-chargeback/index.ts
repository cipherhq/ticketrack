import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, requireAdmin, authErrorResponse, AuthError, requireServiceRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ticketrack.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTH: Allow service-role (webhook calls) OR authenticated admin
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);

    let supabase: any;

    if (isServiceRole) {
      supabase = requireServiceRole(req);
    } else {
      const auth = await requireAuth(req);
      await requireAdmin(auth.supabase, auth.user.id);
      supabase = auth.supabase;
    }

    const { chargebackId, action } = await req.json();

    if (!chargebackId) {
      return new Response(
        JSON.stringify({ error: "chargebackId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get chargeback details
    const { data: chargeback, error: chargebackError } = await supabase
      .from("chargebacks")
      .select(`
        *,
        organizers(id, business_name, email, business_email),
        events(id, title),
        orders(id, order_number, buyer_email)
      `)
      .eq("id", chargebackId)
      .single();

    if (chargebackError || !chargeback) {
      return new Response(
        JSON.stringify({ error: "Chargeback not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizer = chargeback.organizers;
    const organizerEmail = organizer?.email || organizer?.business_email;

    if (!organizerEmail) {
      return new Response(
        JSON.stringify({ error: "No organizer email found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine email type based on action/status
    let emailType = "chargeback_notification";
    let emailData: any = {
      organizerName: organizer.business_name,
      eventTitle: chargeback.events?.title || "N/A",
      orderNumber: chargeback.orders?.order_number || "N/A",
      disputedAmount: chargeback.disputed_amount,
      currency: chargeback.currency,
      reason: chargeback.reason,
      status: chargeback.status,
      evidenceDueBy: chargeback.evidence_due_by,
      chargebackId: chargeback.provider_dispute_id,
      paymentProvider: chargeback.payment_provider,
    };

    if (action === "resolved" || chargeback.status === "won" || chargeback.status === "lost") {
      emailType = "chargeback_resolved";
      emailData = {
        organizerName: organizer.business_name,
        eventTitle: chargeback.events?.title || "N/A",
        orderNumber: chargeback.orders?.order_number || "N/A",
        disputedAmount: chargeback.disputed_amount,
        currency: chargeback.currency,
        resolution: chargeback.status,
        chargebackId: chargeback.provider_dispute_id,
      };
    }

    // Send email
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        type: emailType,
        to: organizerEmail,
        data: emailData,
        organizerId: organizer.id,
      }),
    });

    const emailResult = await emailResponse.json();

    // Log the notification
    await supabase.from("chargeback_activity_log").insert({
      chargeback_id: chargebackId,
      action: `email_sent_${emailType}`,
      notes: `Notification email sent to ${organizerEmail}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Chargeback notification sent to ${organizerEmail}`,
        emailType,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
