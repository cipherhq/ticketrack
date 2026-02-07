/**
 * Sync Provider Settlements - Supabase Edge Function
 *
 * Fetches and imports settlement data from payment providers
 * for reconciliation purposes.
 *
 * Supports: Stripe, Paystack, Flutterwave
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

interface SyncRequest {
  provider?: "stripe" | "paystack" | "flutterwave";
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  country_code?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SyncRequest = await req.json().catch(() => ({}));

    // Default to yesterday and today
    const endDate = body.end_date || new Date().toISOString().split("T")[0];
    const startDate =
      body.start_date ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    safeLog.info(`Syncing settlements from ${startDate} to ${endDate}`);

    const results = {
      stripe: { synced: 0, errors: [] as string[] },
      paystack: { synced: 0, errors: [] as string[] },
      flutterwave: { synced: 0, errors: [] as string[] },
    };

    // Sync based on provider or all
    const providers = body.provider ? [body.provider] : ["stripe", "paystack", "flutterwave"];

    for (const provider of providers) {
      try {
        switch (provider) {
          case "stripe":
            results.stripe = await syncStripeSettlements(supabase, startDate, endDate);
            break;
          case "paystack":
            results.paystack = await syncPaystackSettlements(supabase, startDate, endDate);
            break;
          case "flutterwave":
            results.flutterwave = await syncFlutterwaveSettlements(supabase, startDate, endDate);
            break;
        }
      } catch (err: any) {
        logError(`sync_${provider}_settlements`, err);
        (results as any)[provider].errors.push(err.message);
      }
    }

    // Log sync completion
    await supabase.from("admin_audit_logs").insert({
      action: "settlements_synced",
      entity_type: "settlement",
      details: {
        start_date: startDate,
        end_date: endDate,
        results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        start_date: startDate,
        end_date: endDate,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("sync_provider_settlements", error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      error,
      undefined,
      corsHeaders
    );
  }
});

async function syncStripeSettlements(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<{ synced: number; errors: string[] }> {
  const { data: gatewayConfig } = await supabase
    .from("payment_gateway_config")
    .select("secret_key_encrypted")
    .eq("provider", "stripe")
    .eq("is_active", true)
    .single();

  if (!gatewayConfig) {
    return { synced: 0, errors: ["Stripe not configured"] };
  }

  const stripe = new Stripe(gatewayConfig.secret_key_encrypted, {
    apiVersion: "2023-10-16",
  });

  let synced = 0;
  const errors: string[] = [];

  try {
    // Fetch balance transactions (settlements)
    const balanceTransactions = await stripe.balanceTransactions.list({
      created: {
        gte: Math.floor(new Date(startDate).getTime() / 1000),
        lte: Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000),
      },
      type: "payout",
      limit: 100,
    });

    for (const transaction of balanceTransactions.data) {
      try {
        const settlementDate = new Date(transaction.created * 1000)
          .toISOString()
          .split("T")[0];

        // Get associated payout
        let payoutData: any = null;
        if (transaction.source) {
          try {
            payoutData = await stripe.payouts.retrieve(transaction.source as string);
          } catch {
            // Payout might not exist
          }
        }

        // Import settlement
        const { data: result, error } = await supabase.rpc("import_provider_settlement", {
          p_provider: "stripe",
          p_settlement_id: transaction.id,
          p_settlement_date: settlementDate,
          p_period_start: new Date(
            (transaction.created - 86400) * 1000
          ).toISOString(),
          p_period_end: new Date(transaction.created * 1000).toISOString(),
          p_provider_gross: Math.abs(transaction.amount) / 100,
          p_provider_fees: Math.abs(transaction.fee) / 100,
          p_provider_refunds: 0,
          p_provider_chargebacks: 0,
          p_provider_net: Math.abs(transaction.net) / 100,
          p_currency: transaction.currency.toUpperCase(),
          p_raw_data: JSON.stringify({
            transaction,
            payout: payoutData,
          }),
        });

        if (error) {
          if (!error.message?.includes("already imported")) {
            errors.push(`Transaction ${transaction.id}: ${error.message}`);
          }
        } else {
          synced++;
        }
      } catch (txError: any) {
        errors.push(`Transaction ${transaction.id}: ${txError.message}`);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  // Update sync status
  await supabase
    .from("settlement_sync_status")
    .upsert({
      provider: "stripe",
      country_code: null,
      last_sync_at: new Date().toISOString(),
      last_sync_success: errors.length === 0,
      last_synced_date: endDate,
      next_sync_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    }, { onConflict: "provider,country_code" });

  return { synced, errors };
}

async function syncPaystackSettlements(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<{ synced: number; errors: string[] }> {
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecretKey) {
    return { synced: 0, errors: ["Paystack not configured"] };
  }

  let synced = 0;
  const errors: string[] = [];

  try {
    // Fetch settlements
    const response = await fetch(
      `https://api.paystack.co/settlement?from=${startDate}&to=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const result = await response.json();

    if (!result.status) {
      errors.push(result.message || "Failed to fetch settlements");
      return { synced, errors };
    }

    for (const settlement of result.data || []) {
      try {
        const settlementDate = new Date(settlement.settlement_date || settlement.created_at)
          .toISOString()
          .split("T")[0];

        const { error } = await supabase.rpc("import_provider_settlement", {
          p_provider: "paystack",
          p_settlement_id: settlement.id?.toString(),
          p_settlement_date: settlementDate,
          p_period_start: settlement.start_date || startDate,
          p_period_end: settlement.end_date || endDate,
          p_provider_gross: settlement.total_amount / 100,
          p_provider_fees: settlement.total_fees / 100,
          p_provider_refunds: 0,
          p_provider_chargebacks: 0,
          p_provider_net: settlement.net_amount / 100,
          p_currency: settlement.currency || "NGN",
          p_raw_data: JSON.stringify(settlement),
        });

        if (error) {
          if (!error.message?.includes("already imported")) {
            errors.push(`Settlement ${settlement.id}: ${error.message}`);
          }
        } else {
          synced++;
        }
      } catch (settError: any) {
        errors.push(`Settlement ${settlement.id}: ${settError.message}`);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  // Update sync status
  await supabase
    .from("settlement_sync_status")
    .upsert({
      provider: "paystack",
      country_code: null,
      last_sync_at: new Date().toISOString(),
      last_sync_success: errors.length === 0,
      last_synced_date: endDate,
      next_sync_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    }, { onConflict: "provider,country_code" });

  return { synced, errors };
}

async function syncFlutterwaveSettlements(
  supabase: any,
  startDate: string,
  endDate: string
): Promise<{ synced: number; errors: string[] }> {
  const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!flutterwaveSecretKey) {
    return { synced: 0, errors: ["Flutterwave not configured"] };
  }

  let synced = 0;
  const errors: string[] = [];

  try {
    // Fetch settlements
    const response = await fetch(
      `https://api.flutterwave.com/v3/settlements?from=${startDate}&to=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
        },
      }
    );

    const result = await response.json();

    if (result.status !== "success") {
      errors.push(result.message || "Failed to fetch settlements");
      return { synced, errors };
    }

    for (const settlement of result.data || []) {
      try {
        const settlementDate = new Date(settlement.created_at)
          .toISOString()
          .split("T")[0];

        const { error } = await supabase.rpc("import_provider_settlement", {
          p_provider: "flutterwave",
          p_settlement_id: settlement.id?.toString(),
          p_settlement_date: settlementDate,
          p_period_start: settlement.due_date || startDate,
          p_period_end: settlementDate,
          p_provider_gross: settlement.gross_amount,
          p_provider_fees: settlement.app_fee || 0,
          p_provider_refunds: 0,
          p_provider_chargebacks: 0,
          p_provider_net: settlement.net_amount,
          p_currency: settlement.currency || "NGN",
          p_raw_data: JSON.stringify(settlement),
        });

        if (error) {
          if (!error.message?.includes("already imported")) {
            errors.push(`Settlement ${settlement.id}: ${error.message}`);
          }
        } else {
          synced++;
        }
      } catch (settError: any) {
        errors.push(`Settlement ${settlement.id}: ${settError.message}`);
      }
    }
  } catch (err: any) {
    errors.push(err.message);
  }

  // Update sync status
  await supabase
    .from("settlement_sync_status")
    .upsert({
      provider: "flutterwave",
      country_code: null,
      last_sync_at: new Date().toISOString(),
      last_sync_success: errors.length === 0,
      last_synced_date: endDate,
      next_sync_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    }, { onConflict: "provider,country_code" });

  return { synced, errors };
}
