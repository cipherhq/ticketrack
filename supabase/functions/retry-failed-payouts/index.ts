/**
 * Retry Failed Payouts - Supabase Edge Function
 *
 * Cron job that retries failed payouts with exponential backoff.
 * Runs every 4 hours.
 * Retry schedule: 1h, 4h, 12h, 24h, 48h (max 5 retries)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  logError,
  safeLog,
  ERROR_CODES,
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Retry delays in hours
const RETRY_DELAYS = [1, 4, 12, 24, 48];
const MAX_RETRIES = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    safeLog.info("Starting retry failed payouts job...");

    // Get failed payouts that are due for retry
    const { data: failedPayouts, error: fetchError } = await supabase
      .from("payout_queue")
      .select(`
        *,
        organizers!inner (
          id,
          business_name,
          user_id,
          stripe_connect_id,
          paystack_recipient_code,
          flutterwave_subaccount_id
        )
      `)
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES)
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`);

    if (fetchError) {
      logError("fetch_failed_payouts", fetchError);
      throw new Error("Failed to fetch payouts");
    }

    if (!failedPayouts || failedPayouts.length === 0) {
      safeLog.info("No failed payouts to retry");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No failed payouts to retry",
          retried: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    safeLog.info(`Found ${failedPayouts.length} failed payouts to retry`);

    const results = {
      retried: 0,
      succeeded: 0,
      failed: 0,
      abandoned: 0,
      details: [] as any[],
    };

    for (const payout of failedPayouts) {
      try {
        const retryCount = payout.retry_count + 1;

        safeLog.info(`Retrying payout ${payout.id} (attempt ${retryCount}/${MAX_RETRIES})`);

        // Update status to processing
        await supabase
          .from("payout_queue")
          .update({
            status: "processing",
            retry_count: retryCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id);

        // Attempt the payout based on provider
        let success = false;
        let errorMessage = "";

        switch (payout.payment_provider) {
          case "paystack":
            ({ success, errorMessage } = await retryPaystackPayout(payout));
            break;
          case "stripe":
            ({ success, errorMessage } = await retryStripePayout(supabase, payout));
            break;
          case "flutterwave":
            ({ success, errorMessage } = await retryFlutterwavePayout(payout));
            break;
          default:
            errorMessage = "Unknown payment provider";
        }

        if (success) {
          // Update as pending (awaiting confirmation from provider)
          await supabase
            .from("payout_queue")
            .update({
              status: "pending",
              failure_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payout.id);

          results.succeeded++;
          results.details.push({
            payout_id: payout.id,
            organizer: payout.organizers.business_name,
            status: "succeeded",
            attempt: retryCount,
          });

          // Send success notification
          await sendRetryNotification(supabase, payout, "success", retryCount);
        } else {
          // Calculate next retry time
          const nextRetryDelay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
          const nextRetryAt = new Date(Date.now() + nextRetryDelay * 60 * 60 * 1000);

          if (retryCount >= MAX_RETRIES) {
            // Max retries reached - mark as permanently failed
            await supabase
              .from("payout_queue")
              .update({
                status: "failed",
                failure_reason: `Max retries (${MAX_RETRIES}) reached. Last error: ${errorMessage}`,
                next_retry_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payout.id);

            results.abandoned++;
            results.details.push({
              payout_id: payout.id,
              organizer: payout.organizers.business_name,
              status: "abandoned",
              reason: errorMessage,
            });

            // Send final failure notification
            await sendRetryNotification(supabase, payout, "abandoned", retryCount, errorMessage);

            // Log to audit
            await supabase.from("admin_audit_logs").insert({
              action: "payout_abandoned",
              entity_type: "payout",
              entity_id: payout.id,
              details: {
                organizer_id: payout.organizer_id,
                amount: payout.amount,
                currency: payout.currency,
                retries: retryCount,
                last_error: errorMessage,
              },
            });
          } else {
            // Schedule next retry
            await supabase
              .from("payout_queue")
              .update({
                status: "failed",
                failure_reason: errorMessage,
                next_retry_at: nextRetryAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", payout.id);

            results.failed++;
            results.details.push({
              payout_id: payout.id,
              organizer: payout.organizers.business_name,
              status: "failed",
              attempt: retryCount,
              next_retry: nextRetryAt.toISOString(),
              reason: errorMessage,
            });
          }
        }

        results.retried++;
      } catch (err: any) {
        logError("retry_payout", err, { payout_id: payout.id });

        // Reset to failed state for next retry
        await supabase
          .from("payout_queue")
          .update({
            status: "failed",
            failure_reason: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payout.id);

        results.failed++;
        results.details.push({
          payout_id: payout.id,
          status: "error",
          reason: err.message,
        });
      }
    }

    // Log job completion
    await supabase.from("admin_audit_logs").insert({
      action: "retry_failed_payouts_completed",
      entity_type: "payout",
      details: {
        total_retried: results.retried,
        succeeded: results.succeeded,
        failed: results.failed,
        abandoned: results.abandoned,
      },
    });

    safeLog.info(`Retry job completed: ${JSON.stringify(results)}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("retry_failed_payouts", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function retryPaystackPayout(
  payout: any
): Promise<{ success: boolean; errorMessage: string }> {
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecretKey) {
    return { success: false, errorMessage: "Paystack not configured" };
  }

  try {
    const response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(payout.amount * 100),
        recipient: payout.recipient_code,
        reason: `Retry payout for ${payout.organizers.business_name}`,
        reference: `${payout.id}-retry-${Date.now()}`,
      }),
    });

    const result = await response.json();

    if (result.status) {
      return { success: true, errorMessage: "" };
    } else {
      return { success: false, errorMessage: result.message || "Transfer failed" };
    }
  } catch (err: any) {
    return { success: false, errorMessage: err.message };
  }
}

async function retryStripePayout(
  supabase: any,
  payout: any
): Promise<{ success: boolean; errorMessage: string }> {
  try {
    const { default: Stripe } = await import(
      "https://esm.sh/stripe@14.21.0?target=deno"
    );

    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("provider", "stripe")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig) {
      return { success: false, errorMessage: "Stripe not configured" };
    }

    const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
      apiVersion: "2023-10-16",
    });

    const stripePayout = await stripe.payouts.create(
      {
        amount: Math.round(payout.amount * 100),
        currency: payout.currency.toLowerCase(),
        metadata: {
          payout_queue_id: payout.id,
          retry: "true",
        },
      },
      {
        stripeAccount: payout.organizers.stripe_connect_id,
      }
    );

    return { success: true, errorMessage: "" };
  } catch (err: any) {
    return { success: false, errorMessage: err.message };
  }
}

async function retryFlutterwavePayout(
  payout: any
): Promise<{ success: boolean; errorMessage: string }> {
  const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!flutterwaveSecretKey) {
    return { success: false, errorMessage: "Flutterwave not configured" };
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_bank: payout.bank_code,
        account_number: payout.account_number,
        amount: payout.amount,
        currency: payout.currency,
        narration: `Retry payout for ${payout.organizers.business_name}`,
        reference: `${payout.id}-retry-${Date.now()}`,
      }),
    });

    const result = await response.json();

    if (result.status === "success") {
      return { success: true, errorMessage: "" };
    } else {
      return { success: false, errorMessage: result.message || "Transfer failed" };
    }
  } catch (err: any) {
    return { success: false, errorMessage: err.message };
  }
}

async function sendRetryNotification(
  supabase: any,
  payout: any,
  status: "success" | "abandoned",
  attempt: number,
  errorMessage?: string
): Promise<void> {
  try {
    // Get organizer email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", payout.organizers.user_id)
      .single();

    if (!profile?.email) return;

    const emailType =
      status === "success"
        ? "payout_retry_succeeded"
        : "payout_permanently_failed";

    await supabase.functions.invoke("send-email", {
      body: {
        type: emailType,
        to: profile.email,
        data: {
          organizerName: payout.organizers.business_name,
          amount: payout.amount,
          currency: payout.currency,
          attempt,
          maxAttempts: MAX_RETRIES,
          errorMessage,
        },
      },
    });

    // Also notify finance team for abandoned payouts
    if (status === "abandoned") {
      await supabase.functions.invoke("send-email", {
        body: {
          type: "payout_requires_manual_intervention",
          to: Deno.env.get("FINANCE_ADMIN_EMAIL") || "finance@ticketrack.com",
          data: {
            organizerName: payout.organizers.business_name,
            organizerId: payout.organizer_id,
            amount: payout.amount,
            currency: payout.currency,
            payoutQueueId: payout.id,
            errorMessage,
          },
        },
      });
    }
  } catch (err) {
    logError("send_retry_notification", err);
    // Don't throw - notification failure shouldn't stop the retry process
  }
}
