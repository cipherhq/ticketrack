/**
 * Process Payout Batch - Supabase Edge Function
 *
 * Processes a batch of payouts through the appropriate payment provider.
 * Supports Paystack (NGN/GHS), Stripe Connect (USD/GBP/EUR), and Flutterwave.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  errorResponse,
  logError,
  safeLog,
  ERROR_CODES,
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BatchItem {
  id: string;
  organizer_id: string;
  recipient_code: string;
  account_number: string;
  bank_code: string;
  amount: number;
  currency: string;
  reference: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_id } = await req.json();

    if (!batch_id) {
      return errorResponse(
        ERROR_CODES.MISSING_FIELDS,
        400,
        undefined,
        "batch_id is required",
        corsHeaders
      );
    }

    safeLog.info(`Processing batch: ${batch_id}`);

    // Get batch details
    const { data: batch, error: batchError } = await supabase
      .from("payout_batches")
      .select("*")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        404,
        batchError,
        "Batch not found",
        corsHeaders
      );
    }

    if (batch.status !== "processing") {
      return errorResponse(
        ERROR_CODES.INVALID_REQUEST,
        400,
        undefined,
        `Batch is not in processing status. Current: ${batch.status}`,
        corsHeaders
      );
    }

    // Get batch items to process
    const { data: items, error: itemsError } = await supabase
      .from("payout_batch_items")
      .select("*")
      .eq("batch_id", batch_id)
      .eq("status", "processing")
      .order("sort_order", { ascending: true });

    if (itemsError) {
      logError("get_batch_items", itemsError);
      throw new Error("Failed to fetch batch items");
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No items to process",
          batch_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    safeLog.info(`Processing ${items.length} items for batch ${batch.batch_number}`);

    // Process based on provider
    let results: { success: number; failed: number; errors: string[] };

    switch (batch.provider) {
      case "paystack":
        results = await processPaystackBatch(supabase, batch, items);
        break;
      case "stripe":
        results = await processStripeBatch(supabase, batch, items);
        break;
      case "flutterwave":
        results = await processFlutterwaveBatch(supabase, batch, items);
        break;
      default:
        results = await processManualBatch(supabase, batch, items);
    }

    // Log completion
    await supabase.from("batch_audit_log").insert({
      batch_id,
      action: "batch_processed",
      description: `Processed ${items.length} items: ${results.success} success, ${results.failed} failed`,
      performed_by_type: "system",
      metadata: results,
    });

    return new Response(
      JSON.stringify({
        success: true,
        batch_id,
        batch_number: batch.batch_number,
        items_processed: items.length,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("process_payout_batch", error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      error,
      undefined,
      corsHeaders
    );
  }
});

async function processPaystackBatch(
  supabase: any,
  batch: any,
  items: BatchItem[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecretKey) {
    throw new Error("Paystack not configured");
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      // Initiate transfer
      const response = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: Math.round(item.amount * 100), // Paystack uses kobo
          recipient: item.recipient_code,
          reason: `Batch payout ${batch.batch_number} - ${item.reference}`,
          reference: item.reference,
        }),
      });

      const result = await response.json();

      if (result.status) {
        // Update item status
        await supabase.rpc("update_batch_item_status", {
          p_item_id: item.id,
          p_status: "pending", // Paystack transfers are async
          p_provider_transfer_id: result.data?.transfer_code,
          p_provider_reference: result.data?.reference,
        });
        success++;
      } else {
        await supabase.rpc("update_batch_item_status", {
          p_item_id: item.id,
          p_status: "failed",
          p_failure_reason: result.message || "Transfer failed",
        });
        failed++;
        errors.push(`${item.reference}: ${result.message}`);
      }
    } catch (err: any) {
      await supabase.rpc("update_batch_item_status", {
        p_item_id: item.id,
        p_status: "failed",
        p_failure_reason: err.message,
      });
      failed++;
      errors.push(`${item.reference}: ${err.message}`);
    }
  }

  return { success, failed, errors };
}

async function processStripeBatch(
  supabase: any,
  batch: any,
  items: BatchItem[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  // Get Stripe config
  const { data: gatewayConfig } = await supabase
    .from("payment_gateway_config")
    .select("secret_key_encrypted")
    .eq("provider", "stripe")
    .eq("is_active", true)
    .single();

  if (!gatewayConfig) {
    throw new Error("Stripe not configured");
  }

  const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
    apiVersion: "2023-10-16",
  });

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      // Get organizer's Stripe Connect ID
      const { data: organizer } = await supabase
        .from("organizers")
        .select("stripe_connect_id")
        .eq("id", item.organizer_id)
        .single();

      if (!organizer?.stripe_connect_id) {
        throw new Error("No Stripe Connect account");
      }

      // Create payout to connected account
      const payout = await stripe.payouts.create(
        {
          amount: Math.round(item.amount * 100),
          currency: item.currency.toLowerCase(),
          metadata: {
            batch_id: batch.id,
            batch_number: batch.batch_number,
            reference: item.reference,
          },
        },
        {
          stripeAccount: organizer.stripe_connect_id,
        }
      );

      await supabase.rpc("update_batch_item_status", {
        p_item_id: item.id,
        p_status: "pending",
        p_provider_transfer_id: payout.id,
        p_provider_reference: payout.id,
      });
      success++;
    } catch (err: any) {
      await supabase.rpc("update_batch_item_status", {
        p_item_id: item.id,
        p_status: "failed",
        p_failure_reason: err.message,
      });
      failed++;
      errors.push(`${item.reference}: ${err.message}`);
    }
  }

  return { success, failed, errors };
}

async function processFlutterwaveBatch(
  supabase: any,
  batch: any,
  items: BatchItem[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!flutterwaveSecretKey) {
    throw new Error("Flutterwave not configured");
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const response = await fetch("https://api.flutterwave.com/v3/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_bank: item.bank_code,
          account_number: item.account_number,
          amount: item.amount,
          currency: item.currency,
          narration: `Batch payout ${batch.batch_number}`,
          reference: item.reference,
        }),
      });

      const result = await response.json();

      if (result.status === "success") {
        await supabase.rpc("update_batch_item_status", {
          p_item_id: item.id,
          p_status: "pending",
          p_provider_transfer_id: result.data?.id?.toString(),
          p_provider_reference: result.data?.reference,
        });
        success++;
      } else {
        await supabase.rpc("update_batch_item_status", {
          p_item_id: item.id,
          p_status: "failed",
          p_failure_reason: result.message || "Transfer failed",
        });
        failed++;
        errors.push(`${item.reference}: ${result.message}`);
      }
    } catch (err: any) {
      await supabase.rpc("update_batch_item_status", {
        p_item_id: item.id,
        p_status: "failed",
        p_failure_reason: err.message,
      });
      failed++;
      errors.push(`${item.reference}: ${err.message}`);
    }
  }

  return { success, failed, errors };
}

async function processManualBatch(
  supabase: any,
  batch: any,
  items: BatchItem[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  // For manual batches, just mark all as pending for manual processing
  let success = 0;
  const failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    await supabase.rpc("update_batch_item_status", {
      p_item_id: item.id,
      p_status: "pending",
    });
    success++;
  }

  // Send notification for manual processing
  await supabase.functions.invoke("send-email", {
    body: {
      type: "batch_ready_for_manual_processing",
      to: Deno.env.get("FINANCE_ADMIN_EMAIL") || "finance@ticketrack.com",
      data: {
        batchNumber: batch.batch_number,
        itemCount: items.length,
        totalAmount: batch.total_amount,
        currency: batch.currency,
      },
    },
  });

  return { success, failed, errors };
}
