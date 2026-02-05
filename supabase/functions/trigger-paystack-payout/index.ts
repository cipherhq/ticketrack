/**
 * Trigger Paystack Payout - Supabase Edge Function
 * 
 * Handles payouts for organizers using Paystack (Nigeria, Ghana)
 * Uses Paystack Transfer API to send funds to organizer bank accounts
 * 
 * Supported currencies: NGN, GHS
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  errorResponse, 
  logError, 
  ERROR_CODES 
} from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paystack API base URL
const PAYSTACK_API = "https://api.paystack.co";

// Currency to country mapping for Paystack
const CURRENCY_COUNTRY_MAP: Record<string, string> = {
  NGN: "NG",
  GHS: "GH",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { eventId, organizerId, triggeredBy, isDonationPayout } = await req.json();

    if (!eventId && !organizerId) {
      throw new Error("Either eventId or organizerId is required");
    }

    // Get organizer details
    let organizer;
    if (organizerId) {
      const { data, error } = await supabase
        .from("organizers")
        .select("*, profiles(email)")
        .eq("id", organizerId)
        .single();
      if (error || !data) throw new Error("Organizer not found");
      organizer = data;
    } else {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventId)
        .single();
      if (eventError || !event) throw new Error("Event not found");
      
      const { data, error } = await supabase
        .from("organizers")
        .select("*, profiles(email)")
        .eq("id", event.organizer_id)
        .single();
      if (error || !data) throw new Error("Organizer not found");
      organizer = data;
    }

    // Validate organizer has bank details
    if (!organizer.bank_account_number || !organizer.bank_code) {
      throw new Error("Organizer bank details not configured. Please add bank account in settings.");
    }

    // Check if organizer has ANY payment gateway connected
    const hasPaymentGateway =
      (organizer.stripe_connect_id && organizer.stripe_connect_status === "active") ||
      (organizer.paystack_subaccount_id && organizer.paystack_subaccount_enabled) ||
      (organizer.flutterwave_subaccount_id && organizer.flutterwave_subaccount_enabled);

    // KYC only required if NO payment gateway is connected
    if (!hasPaymentGateway) {
      const isKYCVerified = organizer.kyc_verified || organizer.kyc_status === "approved";
      if (!isKYCVerified) {
        throw new Error("KYC verification required - no payment gateway connected");
      }
    }

    // Get Paystack secret key for the country
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

    // Calculate payout amount
    let payoutAmount = 0;
    let payoutCurrency = organizer.payout_currency || "NGN";
    let orderIds: string[] = [];

    if (eventId) {
      // Get unpaid orders for this event (including donations)
      const query = supabase
        .from("orders")
        .select("id, total_amount, platform_fee, currency, is_donation")
        .eq("event_id", eventId)
        .eq("status", "completed")
        .eq("payout_status", "pending")
        .not("total_amount", "eq", 0);

      if (isDonationPayout) {
        query.eq("is_donation", true);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No pending payouts for this event" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate total payout (total_amount - platform_fee for each order)
      for (const order of orders) {
        const orderPayout = (order.total_amount || 0) - (order.platform_fee || 0);
        payoutAmount += orderPayout;
        orderIds.push(order.id);
        payoutCurrency = order.currency || payoutCurrency;
      }

      // Deduct promoter commissions from organizer payout
      const { data: promoterSales } = await supabase
        .from("promoter_sales")
        .select("commission_amount")
        .eq("event_id", eventId);

      const totalPromoterCommission = (promoterSales || [])
        .reduce((sum, sale) => sum + (parseFloat(sale.commission_amount) || 0), 0);

      payoutAmount = payoutAmount - totalPromoterCommission;
    } else {
      // Get all unpaid orders for this organizer
      const { data: events } = await supabase
        .from("events")
        .select("id")
        .eq("organizer_id", organizerId);

      if (!events || events.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No events found for organizer" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const eventIds = events.map(e => e.id);

      const query = supabase
        .from("orders")
        .select("id, total_amount, platform_fee, currency, is_donation")
        .in("event_id", eventIds)
        .eq("status", "completed")
        .eq("payout_status", "pending")
        .not("total_amount", "eq", 0);

      if (isDonationPayout) {
        query.eq("is_donation", true);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No pending payouts" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const order of orders) {
        const orderPayout = (order.total_amount || 0) - (order.platform_fee || 0);
        payoutAmount += orderPayout;
        orderIds.push(order.id);
      }

      // Deduct promoter commissions from organizer payout
      const { data: promoterSales } = await supabase
        .from("promoter_sales")
        .select("commission_amount")
        .in("event_id", eventIds);

      const totalPromoterCommission = (promoterSales || [])
        .reduce((sum: number, sale: any) => sum + (parseFloat(sale.commission_amount) || 0), 0);

      payoutAmount = payoutAmount - totalPromoterCommission;
    }

    // Check minimum payout threshold
    const MINIMUM_PAYOUTS: Record<string, number> = {
      NGN: 1000, GHS: 10, USD: 5, GBP: 5, EUR: 5, KES: 500, ZAR: 50, CAD: 5, AUD: 5
    };
    const minimumPayout = MINIMUM_PAYOUTS[payoutCurrency] || 5;
    if (payoutAmount < minimumPayout) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Payout amount (${payoutAmount} ${payoutCurrency}) is below minimum threshold (${minimumPayout} ${payoutCurrency})` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or get transfer recipient
    let recipientCode = organizer.paystack_recipient_code;

    if (!recipientCode) {
      // Create transfer recipient
      const recipientResponse = await fetch(`${PAYSTACK_API}/transferrecipient`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban", // Nigerian bank account
          name: organizer.account_name || organizer.business_name,
          account_number: organizer.bank_account_number,
          bank_code: organizer.bank_code,
          currency: payoutCurrency,
          metadata: {
            organizer_id: organizer.id,
            platform: "ticketrack",
          },
        }),
      });

      const recipientData = await recipientResponse.json();

      if (!recipientData.status) {
        throw new Error(recipientData.message || "Failed to create transfer recipient");
      }

      recipientCode = recipientData.data.recipient_code;

      // Save recipient code for future use
      await supabase
        .from("organizers")
        .update({ 
          paystack_recipient_code: recipientCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizer.id);
    }

    // Initiate transfer with idempotency key to prevent duplicate transfers
    const transferRef = `TRF-${organizer.id.slice(0, 8)}-${Date.now()}`;
    const idempotencyKey = `payout-${organizer.id}-${eventId || 'all'}-${Date.now()}`;
    const amountInKobo = Math.round(payoutAmount * 100); // Convert to kobo/pesewas

    const transferResponse = await fetch(`${PAYSTACK_API}/transfer`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountInKobo,
        recipient: recipientCode,
        reason: isDonationPayout 
          ? `Ticketrack donation payout for ${eventId ? `event ${eventId}` : "all events"}`
          : `Ticketrack payout for ${eventId ? `event ${eventId}` : "all events"}`,
        reference: transferRef,
        metadata: {
          organizer_id: organizer.id,
          event_id: eventId || null,
          order_ids: orderIds,
          is_donation: isDonationPayout || false,
          platform: "ticketrack",
        },
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      throw new Error(transferData.message || "Transfer failed");
    }

    // Record payout in database
    const { error: payoutError } = await supabase.from("paystack_payouts").insert({
      organizer_id: organizer.id,
      event_id: eventId || null,
      transfer_code: transferData.data.transfer_code,
      transfer_reference: transferRef,
      recipient_code: recipientCode,
      amount: payoutAmount,
      currency: payoutCurrency,
      status: transferData.data.status, // pending, success, failed
      is_donation: isDonationPayout || false,
      triggered_by: triggeredBy || null,
      triggered_at: new Date().toISOString(),
      order_ids: orderIds,
    });

    if (payoutError) {
      console.error("Failed to record payout:", payoutError);
    }

    // Update orders payout status
    await supabase
      .from("orders")
      .update({ 
        payout_status: "processing",
        payout_reference: transferRef,
        payout_initiated_at: new Date().toISOString(),
      })
      .in("id", orderIds);

    // Send notification email
    try {
      const organizerEmail = organizer.profiles?.email || organizer.business_email;
      if (organizerEmail) {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "paystack_payout_initiated",
            to: organizerEmail,
            data: {
              organizerName: organizer.business_name,
              amount: payoutAmount.toFixed(2),
              currency: payoutCurrency,
              bankName: organizer.bank_name || "Your bank",
              accountEnding: organizer.bank_account_number?.slice(-4) || "****",
              reference: transferRef,
              isDonation: isDonationPayout || false,
            },
          },
        });
      }
    } catch (emailErr) {
      console.error("Failed to send payout email:", emailErr);
    }

    // Log audit
    await supabase.from("admin_audit_logs").insert({
      action: isDonationPayout ? "donation_payout_initiated" : "paystack_payout_initiated",
      entity_type: "organizer",
      entity_id: organizer.id,
      details: {
        amount: payoutAmount,
        currency: payoutCurrency,
        transfer_code: transferData.data.transfer_code,
        reference: transferRef,
        order_count: orderIds.length,
        is_donation: isDonationPayout || false,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payout initiated successfully",
        data: {
          reference: transferRef,
          amount: payoutAmount,
          currency: payoutCurrency,
          status: transferData.data.status,
          orderCount: orderIds.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logError("paystack_payout", error, { eventId, organizerId });

    return errorResponse(
      ERROR_CODES.PAYOUT_FAILED,
      400,
      error,
      undefined,
      corsHeaders
    );
  }
});
