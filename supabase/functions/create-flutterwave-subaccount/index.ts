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
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");

    if (!flutterwaveSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Flutterwave not configured" }),
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
    const { organizerId, bankCode, accountNumber, businessName, country } = body;

    // Verify organizer belongs to user
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select("id, user_id, business_name, business_email, country_code, flutterwave_subaccount_id")
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
    if (organizer.flutterwave_subaccount_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Subaccount already exists",
          subaccountId: organizer.flutterwave_subaccount_id 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check country eligibility
    const eligibleCountries = ["NG", "GH", "KE", "ZA"];
    if (!eligibleCountries.includes(organizer.country_code)) {
      return new Response(
        JSON.stringify({ success: false, error: "Flutterwave subaccounts only available for Nigeria, Ghana, Kenya, and South Africa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map country code to Flutterwave country format
    const countryMap: Record<string, string> = {
      "NG": "NG",
      "GH": "GH", 
      "KE": "KE",
      "ZA": "ZA"
    };

    // Get platform fee percentage from settings
    const { data: feeSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "flutterwave_subaccount_platform_fee_percentage")
      .single();

    const platformFeePercentage = parseFloat(feeSetting?.value || "5");

    // Create Flutterwave subaccount
    const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/subaccounts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${flutterwaveSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_bank: bankCode,
        account_number: accountNumber,
        business_name: businessName || organizer.business_name,
        business_email: organizer.business_email,
        business_contact: organizer.business_email,
        business_contact_mobile: "+2340000000000", // Placeholder, update if you have phone
        business_mobile: "+2340000000000",
        country: countryMap[organizer.country_code] || "NG",
        split_type: "percentage",
        split_value: platformFeePercentage, // Platform takes this percentage
      }),
    });

    const flutterwaveData = await flutterwaveResponse.json();

    if (flutterwaveData.status !== "success") {
      console.error("Flutterwave error:", flutterwaveData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: flutterwaveData.message || "Failed to create Flutterwave subaccount" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subaccountId = flutterwaveData.data.subaccount_id;

    // Update organizer with subaccount info
    const { error: updateError } = await supabase
      .from("organizers")
      .update({
        flutterwave_subaccount_id: subaccountId,
        flutterwave_subaccount_status: "active",
        flutterwave_subaccount_enabled: true,
        flutterwave_subaccount_onboarded_at: new Date().toISOString(),
        flutterwave_subaccount_payouts_enabled: true,
        flutterwave_subaccount_charges_enabled: true,
      })
      .eq("id", organizerId);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Subaccount created but database update failed. Contact support.",
          subaccountId 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subaccountId,
        message: "Flutterwave subaccount created successfully!",
        data: {
          businessName: flutterwaveData.data.business_name,
          accountNumber: flutterwaveData.data.account_number,
          bank: flutterwaveData.data.account_bank,
          splitValue: flutterwaveData.data.split_value,
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
