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

    // Update escrow eligibility first
    await updateEscrowEligibility(supabase);

    // Send pre-payout reminders (24 hours before eligibility)
    await sendPrePayoutReminders(supabase);

    // Process Paystack donation payouts (NGN, GHS)
    await processPaystackDonationPayouts(supabase);

    // Process escrow-based payouts
    await processEscrowPayouts(supabase);

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

    // Calculate the cutoff date for events that have ended
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    const cutoffDateStr = cutoffDate.toISOString();

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
          paystack_subaccount_id,
          paystack_subaccount_enabled,
          flutterwave_subaccount_id,
          flutterwave_subaccount_enabled,
          country_code,
          kyc_status,
          kyc_verified
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

    // Centralized minimum payout thresholds
    const MINIMUM_PAYOUTS: { [key: string]: number } = {
      NGN: 1000, GHS: 10, USD: 5, GBP: 5, EUR: 5, KES: 500, ZAR: 50, CAD: 5, AUD: 5
    };
    const getMinimumPayout = (currency: string): number => {
      return MINIMUM_PAYOUTS[currency.toUpperCase()] || 5;
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
      // KYC is only required if organizer has NO payment gateway connected
      const hasPaymentGateway =
        (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") ||
        (organizer.paystack_subaccount_id && organizer.paystack_subaccount_enabled) ||
        (organizer.flutterwave_subaccount_id && organizer.flutterwave_subaccount_enabled);

      if (!hasPaymentGateway) {
        const isKYCVerified = organizer.kyc_verified || organizer.kyc_status === "approved";

        if (!isKYCVerified) {
          console.log(`KYC not verified for ${organizer.business_name} (no payment gateway) - skipping payout`);

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
              reason: "KYC verification required - no payment gateway connected",
              event_id: event.id,
              event_title: event.title,
              kyc_status: organizer.kyc_status,
              kyc_verified: organizer.kyc_verified,
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

        // Get organizer's events for promoter commission lookup
        const { data: orgEvents } = await supabase
          .from("events")
          .select("id")
          .eq("organizer_id", organizer.id);

        const orgEventIds = (orgEvents || []).map((e: any) => e.id);

        // Get all promoter commissions grouped by currency
        let promoterCommissionsByCurrency: Record<string, number> = {};
        if (orgEventIds.length > 0) {
          const { data: promoterSales } = await supabase
            .from("promoter_sales")
            .select("commission_amount, events!inner(currency)")
            .in("event_id", orgEventIds);

          for (const sale of promoterSales || []) {
            const currency = ((sale as any).events?.currency || "USD").toUpperCase();
            promoterCommissionsByCurrency[currency] =
              (promoterCommissionsByCurrency[currency] || 0) + (parseFloat(sale.commission_amount) || 0);
          }
        }

        for (const available of balance.available) {
          const currency = available.currency.toUpperCase();

          // Deduct promoter commissions for this currency
          const commissionForCurrency = promoterCommissionsByCurrency[currency] || 0;
          const commissionInCents = Math.round(commissionForCurrency * 100);
          const payoutAmountCents = available.amount - commissionInCents;
          const amount = payoutAmountCents / 100;
          const minPayoutForCurrency = getMinimumPayout(currency);

          console.log(`${organizer.business_name}: ${currency} ${available.amount / 100} available, ${commissionForCurrency} commission, ${amount} after deduction (min: ${minPayoutForCurrency})`);

          if (amount < minPayoutForCurrency) {
            console.log(`Below minimum threshold (${minPayoutForCurrency} ${currency}) after commission deduction, skipping`);
            continue;
          }

          const payout = await stripe.payouts.create(
            {
              amount: payoutAmountCents,
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

// Process Paystack donation payouts for NGN and GHS organizers
async function processPaystackDonationPayouts(supabase: any) {
  console.log("Processing Paystack donation payouts...");

  try {
    // Get organizers with pending donation payouts (Paystack countries: NG, GH)
    const { data: pendingDonations, error } = await supabase
      .from("orders")
      .select(`
        event_id,
        currency,
        events!inner (
          id,
          title,
          end_date,
          organizer_id,
          organizers!inner (
            id,
            business_name,
            country_code,
            bank_account_number,
            bank_code,
            kyc_verified,
            kyc_status,
            paystack_recipient_code,
            user_id,
            stripe_connect_id,
            stripe_connect_status,
            paystack_subaccount_id,
            paystack_subaccount_enabled,
            flutterwave_subaccount_id,
            flutterwave_subaccount_enabled
          )
        )
      `)
      .eq("is_donation", true)
      .eq("status", "completed")
      .eq("payout_status", "pending")
      .in("currency", ["NGN", "GHS"])
      .not("total_amount", "eq", 0);

    if (error) {
      console.error("Error fetching pending donations:", error);
      return;
    }

    if (!pendingDonations || pendingDonations.length === 0) {
      console.log("No pending Paystack donation payouts");
      return;
    }

    // Group by organizer
    const organizerDonations = new Map<string, any[]>();
    for (const donation of pendingDonations) {
      const organizerId = donation.events.organizer_id;
      if (!organizerDonations.has(organizerId)) {
        organizerDonations.set(organizerId, []);
      }
      organizerDonations.get(organizerId)!.push(donation);
    }

    console.log(`Found ${organizerDonations.size} organizers with pending donation payouts`);

    // Process each organizer's donations
    for (const [organizerId, donations] of organizerDonations) {
      const organizer = donations[0].events.organizers;

      // Check if organizer has bank details
      if (!organizer.bank_account_number || !organizer.bank_code) {
        console.log(`Skipping ${organizer.business_name} - no bank details`);
        continue;
      }

      // Check if organizer has any payment gateway connected
      const hasPaymentGateway =
        (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") ||
        (organizer.paystack_subaccount_id && organizer.paystack_subaccount_enabled) ||
        (organizer.flutterwave_subaccount_id && organizer.flutterwave_subaccount_enabled);

      // KYC only required if NO payment gateway is connected
      if (!hasPaymentGateway) {
        const isKYCVerified = organizer.kyc_verified || organizer.kyc_status === "approved";
        if (!isKYCVerified) {
          console.log(`Skipping ${organizer.business_name} - KYC not verified (no payment gateway)`);

          // Send KYC reminder
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
                  message: "You have pending donation payouts. Please complete KYC verification to receive your funds.",
                  appUrl: "https://ticketrack.com/organizer/kyc-verification",
                },
              },
            });
          }
          continue;
        }
      }

      // Trigger Paystack payout for this organizer
      try {
        await supabase.functions.invoke("trigger-paystack-payout", {
          body: {
            organizerId: organizerId,
            isDonationPayout: true,
            triggeredBy: "auto",
          },
        });

        console.log(`Paystack donation payout triggered for ${organizer.business_name}`);
      } catch (payoutErr) {
        console.error(`Paystack payout error for ${organizer.business_name}:`, payoutErr);
      }
    }
  } catch (error) {
    console.error("Error processing Paystack donation payouts:", error);
  }
}

// Update escrow balance eligibility
async function updateEscrowEligibility(supabase: any) {
  console.log("Updating escrow eligibility...");

  try {
    // Call the database function to update eligible escrow balances
    const { data: count, error } = await supabase.rpc("update_escrow_eligibility");

    if (error) {
      console.error("Error updating escrow eligibility:", error);
      return;
    }

    console.log(`Updated ${count || 0} escrow balances to eligible status`);
  } catch (error) {
    console.error("Error in updateEscrowEligibility:", error);
  }
}

// Process payouts from eligible escrow balances
async function processEscrowPayouts(supabase: any) {
  console.log("Processing escrow-based payouts...");

  try {
    // Get eligible escrow balances
    const { data: eligibleEscrows, error: fetchError } = await supabase
      .from("escrow_balances")
      .select(`
        *,
        organizers (
          id,
          business_name,
          user_id,
          stripe_connect_id,
          stripe_connect_status,
          paystack_recipient_code,
          flutterwave_subaccount_id,
          country_code,
          kyc_status,
          kyc_verified
        ),
        events (
          id,
          title
        )
      `)
      .eq("status", "eligible")
      .gt("available_balance", 0);

    if (fetchError) {
      console.error("Error fetching eligible escrows:", fetchError);
      return;
    }

    if (!eligibleEscrows || eligibleEscrows.length === 0) {
      console.log("No eligible escrow balances to process");
      return;
    }

    console.log(`Found ${eligibleEscrows.length} eligible escrow balances`);

    for (const escrow of eligibleEscrows) {
      const organizer = escrow.organizers;

      // Skip if no organizer
      if (!organizer) {
        console.log(`Skipping escrow ${escrow.id} - no organizer found`);
        continue;
      }

      // Check KYC if no payment gateway
      const hasPaymentGateway =
        (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") ||
        organizer.paystack_recipient_code ||
        organizer.flutterwave_subaccount_id;

      if (!hasPaymentGateway) {
        const isKYCVerified = organizer.kyc_verified || organizer.kyc_status === "approved";
        if (!isKYCVerified) {
          console.log(`Skipping escrow ${escrow.id} - KYC not verified`);
          continue;
        }
      }

      // Queue payout from escrow
      try {
        const { data: queueResult, error: queueError } = await supabase.rpc(
          "queue_payout_from_escrow",
          { p_escrow_id: escrow.id }
        );

        if (queueError) {
          console.error(`Error queueing payout for escrow ${escrow.id}:`, queueError);
          continue;
        }

        if (queueResult?.success) {
          console.log(
            `Queued payout of ${queueResult.amount} ${escrow.currency} for ${organizer.business_name}`
          );

          // If approval is not required, process immediately
          if (!queueResult.requires_approval && queueResult.queue_id) {
            // Determine which payout function to call based on provider
            const provider = queueResult.payment_provider || "manual";

            if (provider === "stripe") {
              await supabase.functions.invoke("trigger-stripe-connect-payout", {
                body: {
                  payoutQueueId: queueResult.queue_id,
                  organizerId: organizer.id,
                  amount: queueResult.amount,
                  currency: escrow.currency,
                },
              });
            } else if (provider === "paystack") {
              await supabase.functions.invoke("trigger-paystack-payout", {
                body: {
                  payoutQueueId: queueResult.queue_id,
                  organizerId: organizer.id,
                  triggeredBy: "escrow_auto",
                },
              });
            }
          }
        }
      } catch (queueErr) {
        console.error(`Error processing escrow ${escrow.id}:`, queueErr);
      }
    }

    // Log completion
    await supabase.from("admin_audit_logs").insert({
      action: "escrow_payouts_processed",
      entity_type: "escrow",
      details: {
        eligible_count: eligibleEscrows.length,
      },
    });
  } catch (error) {
    console.error("Error processing escrow payouts:", error);
  }
}
