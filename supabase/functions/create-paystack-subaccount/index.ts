import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Paystack not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { organizerId, bankCode, accountNumber, businessName, percentageCharge } = body;

    // Verify organizer belongs to user
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("id, user_id, business_name, business_email, country_code, paystack_subaccount_id")
      .eq("id", organizerId)
      .eq("user_id", user.id)
      .single();

    if (orgError || !organizer) {
      return new Response(
        JSON.stringify({ success: false, error: "Organizer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already has subaccount
    if (organizer.paystack_subaccount_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Subaccount already exists",
          subaccountId: organizer.paystack_subaccount_id 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check country eligibility (Nigeria only for now)
    if (organizer.country_code !== "NG") {
      return new Response(
        JSON.stringify({ success: false, error: "Paystack subaccounts only available for Nigeria" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform fee percentage from settings
    const { data: feeSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paystack_subaccount_platform_fee_percentage")
      .single();

    const platformFeePercentage = parseFloat(feeSetting?.value || "5");

    // Create Paystack subaccount
    const paystackResponse = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: businessName || organizer.business_name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: platformFeePercentage, // Platform fee percentage
        primary_contact_email: organizer.business_email,
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: paystackData.message || "Failed to create Paystack subaccount" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subaccountCode = paystackData.data.subaccount_code;

    // Update organizer with subaccount info
    const { error: updateError } = await supabase
      .from("organizers")
      .update({
        paystack_subaccount_id: subaccountCode,
        paystack_subaccount_status: "active",
        paystack_subaccount_enabled: true,
        paystack_subaccount_onboarded_at: new Date().toISOString(),
        paystack_subaccount_payouts_enabled: true,
        paystack_subaccount_charges_enabled: true,
      })
      .eq("id", organizerId);

    if (updateError) {
      console.error("Update error:", updateError);
      // Subaccount was created in Paystack but we failed to save it
      // This is a partial success - log for manual fix
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Subaccount created but database update failed. Contact support.",
          subaccountCode 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subaccountCode,
        message: "Paystack subaccount created successfully!",
        data: {
          businessName: paystackData.data.business_name,
          accountNumber: paystackData.data.account_number,
          bank: paystackData.data.settlement_bank,
          percentageCharge: paystackData.data.percentage_charge,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
