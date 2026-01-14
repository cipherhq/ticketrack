import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting auto-payout process...");

    // Send pre-payout reminders (24 hours before eligibility)
    await sendPrePayoutReminders(supabase);

    // Intelligent payout scheduling based on event type
    const getPayoutDelayDays = async (eventType: string, eventSize: number): Promise<number> => {
      // Base delays by event type
      const baseDelays: { [key: string]: number } = {
        'concert': 7,      // Large events need more time for refunds
        'conference': 5,   // Medium events
        'workshop': 1,     // Small events can payout faster
        'webinar': 0,      // Digital events can payout immediately
        'sports': 3,       // Sports events
        'theater': 2,      // Theater/shows
        'party': 1,        // Parties/social events
        'other': 3         // Default fallback
      };

      const baseDelay = baseDelays[eventType?.toLowerCase()] || baseDelays['other'];

      // Adjust based on event size (attendee count)
      let sizeAdjustment = 0;
      if (eventSize > 1000) sizeAdjustment = 2;
      else if (eventSize > 500) sizeAdjustment = 1;
      else if (eventSize < 50) sizeAdjustment = -1; // Small events can payout faster

      const finalDelay = Math.max(0, baseDelay + sizeAdjustment); // Never go below 0

      console.log(`Event type: ${eventType}, size: ${eventSize}, delay: ${finalDelay} days`);
      return finalDelay;
    };

    console.log(`Looking for events ended before: ${cutoffDateStr}`);

    // Get all potentially eligible events first
    const { data: allEvents, error: eventsError } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        end_date,
        event_type,
        organizer_id,
        organizers!inner (
          id,
          business_name,
          user_id,
          stripe_connect_id,
          stripe_connect_status,
          stripe_connect_payouts_enabled,
          stripe_connect_charges_enabled,
          country_code,
          kyc_status,
          kyc_verified,
          stripe_identity_status
        )
      `)
      .not("organizers.stripe_connect_id", "is", null)
      .eq("organizers.stripe_connect_status", "active")
      .eq("organizers.stripe_connect_payouts_enabled", true);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw new Error("Failed to fetch events");
    }

    // Filter events based on intelligent delay calculation
    const eligibleEvents = [];
    for (const event of allEvents || []) {
      // Get attendee count for size calculation
      const { count: attendeeCount } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      const delayDays = await getPayoutDelayDays(event.event_type, attendeeCount || 0);
      const eventCutoffDate = new Date();
      eventCutoffDate.setDate(eventCutoffDate.getDate() - delayDays);

      if (new Date(event.end_date) < eventCutoffDate) {
        eligibleEvents.push(event);
      }
    }

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw new Error("Failed to fetch eligible events");
    }

    console.log(`Found ${eligibleEvents?.length || 0} eligible events`);

    if (!eligibleEvents || eligibleEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No events eligible for payout",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("country_code", "US")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      throw new Error("Stripe not configured");
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    // Currency-specific minimum payout thresholds
    const getMinimumPayout = (currency: string): number => {
      const minimums: { [key: string]: number } = {
        'USD': 10,
        'EUR': 10,
        'GBP': 8,
        'NGN': 5000,
        'GHS': 50,
        'KES': 1000,
        'ZAR': 150,
        'CAD': 12,
        'AUD': 15
      };
      return minimums[currency.toUpperCase()] || 10; // Default to $10 USD equivalent
    };

    const results = [];
    const kycBlockedOrganizers = [];
    const processedOrganizers = new Set();

    for (const event of eligibleEvents) {
      const organizer = event.organizers;

      if (processedOrganizers.has(organizer.id)) {
        console.log(`Skipping ${organizer.business_name} - already processed`);
        continue;
      }

      console.log(`Processing organizer: ${organizer.business_name}`);

      // SECURITY: KYC VERIFICATION CHECK
      const isKYCVerified = await checkKYCStatus(supabase, organizer);

      if (!isKYCVerified) {
        console.log(`KYC not verified for ${organizer.business_name} - skipping payout`);
        
        kycBlockedOrganizers.push({
          organizer_id: organizer.id,
          business_name: organizer.business_name,
          kyc_status: organizer.kyc_status,
          event_title: event.title,
        });

        await supabase.from("admin_audit_logs").insert({
          action: "auto_payout_blocked_kyc",
          entity_type: "organizer",
          entity_id: organizer.id,
          details: {
            reason: "KYC verification required",
            event_id: event.id,
            event_title: event.title,
            kyc_status: organizer.kyc_status,
            kyc_verified: organizer.kyc_verified,
            stripe_identity_status: organizer.stripe_identity_status,
          },
        });

        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", organizer.user_id)
            .single();

          if (profile?.email) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "payout_blocked_kyc",
                to: profile.email,
                data: {
                  organizerName: organizer.business_name,
                  eventTitle: event.title,
                  message: "Your payout is pending KYC verification. Please complete identity verification to receive your funds.",
                  appUrl: "https://ticketrack.com/organizer/kyc-verification",
                },
              },
            });
          }
        } catch (emailErr) {
          console.error("Failed to send KYC blocked email:", emailErr);
        }

        processedOrganizers.add(organizer.id);
        continue;
      }

      try {
        const { data: existingPayout } = await supabase
          .from("stripe_connect_payouts")
          .select("id")
          .eq("event_id", event.id)
          .eq("organizer_id", organizer.id)
          .in("status", ["pending", "completed"])
          .single();

        if (existingPayout) {
          console.log(`Payout already exists for event ${event.title}`);
          continue;
        }

        const balance = await stripe.balance.retrieve({
          stripeAccount: organizer.stripe_connect_id,
        });

        for (const available of balance.available) {
          const amount = available.amount / 100;
          const currency = available.currency.toUpperCase();
          const minPayoutForCurrency = getMinimumPayout(currency);

          console.log(`${organizer.business_name}: ${currency} ${amount} available (min: ${minPayoutForCurrency})`);

          if (amount < minPayoutForCurrency) {
            console.log(`Below minimum threshold (${minPayoutForCurrency} ${currency}), skipping`);
            continue;
          }

          const payout = await stripe.payouts.create(
            {
              amount: available.amount,
              currency: available.currency,
              metadata: {
                organizer_id: organizer.id,
                event_id: event.id,
                triggered_by: "auto_payout_system",
                kyc_verified: "true",
              },
            },
            {
              stripeAccount: organizer.stripe_connect_id,
            }
          );

          console.log(`Payout created: ${payout.id}`);

          const { error: insertError } = await supabase
            .from("stripe_connect_payouts")
            .insert({
              organizer_id: organizer.id,
              event_id: event.id,
              stripe_payout_id: payout.id,
              stripe_account_id: organizer.stripe_connect_id,
              amount: amount,
              currency: currency,
              status: "pending",
              triggered_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error("Failed to record payout:", insertError);
          }

          results.push({
            organizer: organizer.business_name,
            event: event.title,
            amount,
            currency,
            payoutId: payout.id,
            status: "success",
          });

          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", organizer.user_id)
              .single();

            if (profile?.email) {
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "stripe_connect_payout_initiated",
                  to: profile.email,
                  data: {
                    organizerName: organizer.business_name,
                    eventTitle: event.title,
                    amount: amount.toFixed(2),
                    currency: currency,
                    estimatedArrival: "3-5 business days",
                    payoutId: payout.id,
                  },
                },
              });
            }
          } catch (emailErr) {
            console.error("Failed to send payout email:", emailErr);
          }
        }

        processedOrganizers.add(organizer.id);
      } catch (err) {
        console.error(`Error processing ${organizer.business_name}:`, err);
        results.push({
          organizer: organizer.business_name,
          event: event.title,
          status: "error",
          error: err.message,
        });
      }
    }

    await supabase.from("admin_audit_logs").insert({
      admin_id: null,
      action: "auto_payout_triggered",
      entity_type: "payout",
      details: {
        events_checked: eligibleEvents.length,
        payouts_created: results.filter((r) => r.status === "success").length,
        kyc_blocked: kycBlockedOrganizers.length,
        kyc_blocked_organizers: kycBlockedOrganizers,
        results,
      },
    });

    console.log("Auto-payout process completed");
    console.log(`KYC blocked: ${kycBlockedOrganizers.length} organizers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} payouts`,
        processed: results.filter((r) => r.status === "success").length,
        kyc_blocked: kycBlockedOrganizers.length,
        results,
        kyc_blocked_organizers: kycBlockedOrganizers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-payout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkKYCStatus(supabase: any, organizer: any): Promise<boolean> {
  if (organizer.kyc_verified === true) return true;
  if (organizer.stripe_identity_status === "verified") return true;

  if (
    organizer.stripe_connect_status === "active" &&
    organizer.stripe_connect_charges_enabled === true &&
    organizer.stripe_connect_payouts_enabled === true
  ) {
    const { data: autoTrustSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "stripe_connect_auto_trust_kyc")
      .single();

    if (autoTrustSetting?.value === "true") return true;
  }

  const { data: approvedDocs, error } = await supabase
    .from("kyc_documents")
    .select("id, status")
    .eq("organizer_id", organizer.id)
    .eq("status", "approved")
    .limit(1);

  if (!error && approvedDocs && approvedDocs.length > 0) return true;

  const { data: kycVerification } = await supabase
    .from("kyc_verifications")
    .select("verification_level, bvn_verified, status")
    .eq("organizer_id", organizer.id)
    .single();

  if (kycVerification) {
    if (kycVerification.verification_level >= 1 && kycVerification.status === "verified") return true;
    if (kycVerification.bvn_verified === true) return true;
  }

  return false;
}

// Send pre-payout reminders to organizers 24 hours before payout eligibility
async function sendPrePayoutReminders(supabase: any) {
  console.log("Checking for pre-payout reminders...");

  try {
    // Get events that will be eligible for payout in 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString();

    const { data: upcomingEvents, error } = await supabase
      .from("events")
      .select(`
        id,
        title,
        end_date,
        event_type,
        organizer_id,
        organizers!inner (
          id,
          business_name,
          user_id,
          stripe_connect_id,
          stripe_connect_status,
          stripe_connect_payouts_enabled,
          country_code
        )
      `)
      .not("organizers.stripe_connect_id", "is", null)
      .eq("organizers.stripe_connect_status", "active")
      .eq("organizers.stripe_connect_payouts_enabled", true)
      .lt("end_date", tomorrowStr);

    if (error) {
      console.error("Error fetching upcoming events:", error);
      return;
    }

    console.log(`Found ${upcomingEvents?.length || 0} events for pre-payout reminders`);

    for (const event of upcomingEvents || []) {
      // Get attendee count for intelligent delay calculation
      const { count: attendeeCount } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      const delayDays = await getPayoutDelayDays(event.event_type, attendeeCount || 0);
      const payoutDate = new Date(event.end_date);
      payoutDate.setDate(payoutDate.getDate() + delayDays);

      // Only send reminder if payout is tomorrow
      const payoutTomorrow = new Date();
      payoutTomorrow.setDate(payoutTomorrow.getDate() + 1);
      payoutTomorrow.setHours(0, 0, 0, 0);
      payoutDate.setHours(0, 0, 0, 0);

      if (payoutDate.getTime() === payoutTomorrow.getTime()) {
        // Check if we've already sent a reminder for this event
        const { data: existingReminder } = await supabase
          .from("admin_audit_logs")
          .select("id")
          .eq("entity_type", "event")
          .eq("entity_id", event.id)
          .eq("action", "pre_payout_reminder_sent")
          .limit(1);

        if (!existingReminder) {
          const organizer = event.organizers;
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", organizer.user_id)
            .single();

          if (profile?.email) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "pre_payout_reminder",
                to: profile.email,
                data: {
                  organizerName: organizer.business_name,
                  eventTitle: event.title,
                  payoutDate: payoutDate.toLocaleDateString(),
                  daysUntilPayout: 1,
                  appUrl: "https://ticketrack.com/organizer/finance",
                },
              },
            });

            // Log the reminder
            await supabase.from("admin_audit_logs").insert({
              action: "pre_payout_reminder_sent",
              entity_type: "event",
              entity_id: event.id,
              details: {
                organizer_id: organizer.id,
                event_title: event.title,
                payout_date: payoutDate.toISOString(),
              },
            });

            console.log(`Pre-payout reminder sent for ${event.title}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error sending pre-payout reminders:", error);
  }
}
