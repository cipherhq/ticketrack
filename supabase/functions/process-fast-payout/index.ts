/**
 * Process Fast Payout - Supabase Edge Function
 * 
 * Handles fast payout requests from organizers
 * - Validates eligibility
 * - Creates payout request
 * - Initiates Paystack transfer
 * - Updates order statuses
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  errorResponse, 
  logError, 
  safeLog,
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_API = "https://api.paystack.co";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { requestId, organizerId, amount, eventId } = await req.json();

    // If requestId provided, process existing request
    // Otherwise, create new request and process
    let fastPayoutRequest: any;

    if (requestId) {
      // Get existing request
      const { data, error } = await supabase
        .from("fast_payout_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (error || !data) {
        throw new Error("Fast payout request not found");
      }

      if (data.status !== "approved") {
        throw new Error(`Request status is ${data.status}, expected approved`);
      }

      fastPayoutRequest = data;
    } else {
      // Create new request via RPC
      const { data: createResult, error: createError } = await supabase.rpc(
        "create_fast_payout_request",
        {
          p_organizer_id: organizerId,
          p_amount: amount,
          p_event_id: eventId || null,
        }
      );

      if (createError) throw createError;
      if (!createResult?.success) {
        throw new Error(createResult?.error || "Failed to create fast payout request");
      }

      // Fetch the created request
      const { data, error } = await supabase
        .from("fast_payout_requests")
        .select("*")
        .eq("id", createResult.request_id)
        .single();

      if (error || !data) {
        throw new Error("Failed to fetch created request");
      }

      fastPayoutRequest = data;
    }

    // Update status to processing
    await supabase
      .from("fast_payout_requests")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", fastPayoutRequest.id);

    // Get organizer details
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("*, profiles(email)")
      .eq("id", fastPayoutRequest.organizer_id)
      .single();

    if (orgError || !organizer) {
      throw new Error("Organizer not found");
    }

    // Validate bank details
    if (!organizer.bank_account_number || !organizer.bank_code) {
      await supabase
        .from("fast_payout_requests")
        .update({ 
          status: "failed", 
          failure_reason: "Bank details not configured",
          updated_at: new Date().toISOString() 
        })
        .eq("id", fastPayoutRequest.id);
      
      throw new Error("Bank details not configured. Please add bank account.");
    }

    // Get Paystack secret key
    const countryCode = organizer.country_code || "NG";
    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_config")
      .select("secret_key_encrypted")
      .eq("country_code", countryCode)
      .eq("provider", "paystack")
      .eq("is_active", true)
      .single();

    if (!gatewayConfig?.secret_key_encrypted) {
      throw new Error(`Paystack not configured for ${countryCode}`);
    }

    const paystackSecretKey = gatewayConfig.secret_key_encrypted;

    // Create or get transfer recipient
    let recipientCode = organizer.paystack_recipient_code;

    if (!recipientCode) {
      const recipientResponse = await fetch(`${PAYSTACK_API}/transferrecipient`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: organizer.account_name || organizer.business_name,
          account_number: organizer.bank_account_number,
          bank_code: organizer.bank_code,
          currency: fastPayoutRequest.currency,
          metadata: {
            organizer_id: organizer.id,
            platform: "ticketrack",
          },
        }),
      });

      const recipientData = await recipientResponse.json();

      if (!recipientData.status) {
        await supabase
          .from("fast_payout_requests")
          .update({ 
            status: "failed", 
            failure_reason: recipientData.message || "Failed to create transfer recipient",
            updated_at: new Date().toISOString() 
          })
          .eq("id", fastPayoutRequest.id);
        
        throw new Error(recipientData.message || "Failed to create transfer recipient");
      }

      recipientCode = recipientData.data.recipient_code;

      // Save for future use
      await supabase
        .from("organizers")
        .update({ 
          paystack_recipient_code: recipientCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizer.id);
    }

    // Initiate transfer (net amount after fee deduction)
    const transferRef = `FAST-${fastPayoutRequest.id.slice(0, 8)}-${Date.now()}`;
    const amountInKobo = Math.round(fastPayoutRequest.net_amount * 100);

    const transferResponse = await fetch(`${PAYSTACK_API}/transfer`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountInKobo,
        recipient: recipientCode,
        reason: `Ticketrack Fast Payout - ${fastPayoutRequest.event_id ? `Event ${fastPayoutRequest.event_id}` : "Multiple events"}`,
        reference: transferRef,
        metadata: {
          type: "fast_payout",
          fast_payout_id: fastPayoutRequest.id,
          organizer_id: organizer.id,
          event_id: fastPayoutRequest.event_id || null,
          gross_amount: fastPayoutRequest.gross_amount,
          fee_amount: fastPayoutRequest.fee_amount,
          net_amount: fastPayoutRequest.net_amount,
          platform: "ticketrack",
        },
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      await supabase
        .from("fast_payout_requests")
        .update({ 
          status: "failed", 
          failure_reason: transferData.message || "Transfer failed",
          updated_at: new Date().toISOString() 
        })
        .eq("id", fastPayoutRequest.id);
      
      throw new Error(transferData.message || "Transfer failed");
    }

    // Update fast payout request
    await supabase
      .from("fast_payout_requests")
      .update({
        status: transferData.data.status === "success" ? "completed" : "processing",
        payment_provider: "paystack",
        transfer_reference: transferRef,
        transfer_code: transferData.data.transfer_code,
        processed_at: new Date().toISOString(),
        completed_at: transferData.data.status === "success" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fastPayoutRequest.id);

    // Update orders to mark as fast-payout processed
    if (fastPayoutRequest.order_ids && fastPayoutRequest.order_ids.length > 0) {
      await supabase
        .from("orders")
        .update({
          payout_status: "fast_payout",
          payout_reference: transferRef,
          payout_initiated_at: new Date().toISOString(),
        })
        .in("id", fastPayoutRequest.order_ids);
    }

    // Record in paystack_payouts for tracking
    await supabase.from("paystack_payouts").insert({
      organizer_id: organizer.id,
      event_id: fastPayoutRequest.event_id,
      transfer_code: transferData.data.transfer_code,
      transfer_reference: transferRef,
      recipient_code: recipientCode,
      amount: fastPayoutRequest.net_amount,
      currency: fastPayoutRequest.currency,
      status: transferData.data.status,
      is_fast_payout: true,
      fast_payout_fee: fastPayoutRequest.fee_amount,
      triggered_at: new Date().toISOString(),
    });

    // Send notification email
    try {
      const organizerEmail = organizer.profiles?.email || organizer.business_email;
      if (organizerEmail) {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "fast_payout_initiated",
            to: organizerEmail,
            data: {
              organizerName: organizer.business_name,
              grossAmount: fastPayoutRequest.gross_amount.toFixed(2),
              feeAmount: fastPayoutRequest.fee_amount.toFixed(2),
              netAmount: fastPayoutRequest.net_amount.toFixed(2),
              currency: fastPayoutRequest.currency,
              bankName: organizer.bank_name || "Your bank",
              accountEnding: organizer.bank_account_number?.slice(-4) || "****",
              reference: transferRef,
            },
          },
        });
      }
    } catch (emailErr) {
      console.error("Failed to send fast payout email:", emailErr);
    }

    // Audit log
    await supabase.from("admin_audit_logs").insert({
      action: "fast_payout_processed",
      entity_type: "fast_payout",
      entity_id: fastPayoutRequest.id,
      details: {
        organizer_id: organizer.id,
        gross_amount: fastPayoutRequest.gross_amount,
        fee_amount: fastPayoutRequest.fee_amount,
        net_amount: fastPayoutRequest.net_amount,
        currency: fastPayoutRequest.currency,
        transfer_code: transferData.data.transfer_code,
        reference: transferRef,
        order_count: fastPayoutRequest.order_ids?.length || 0,
      },
    });

    safeLog.info(`Fast payout ${fastPayoutRequest.id} processed: ${fastPayoutRequest.net_amount} ${fastPayoutRequest.currency}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Fast payout initiated successfully",
        data: {
          request_id: fastPayoutRequest.id,
          reference: transferRef,
          gross_amount: fastPayoutRequest.gross_amount,
          fee_amount: fastPayoutRequest.fee_amount,
          net_amount: fastPayoutRequest.net_amount,
          currency: fastPayoutRequest.currency,
          status: transferData.data.status,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("fast_payout", error);

    return errorResponse(
      ERROR_CODES.PAYOUT_FAILED,
      400,
      error,
      undefined,
      corsHeaders
    );
  }
});
