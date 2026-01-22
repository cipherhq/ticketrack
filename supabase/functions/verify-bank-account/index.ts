import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const body = await req.json();
    const { bankCode, accountNumber, provider = 'paystack' } = body;

    if (!bankCode || !accountNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Bank code and account number are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (provider === 'paystack') {
      const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
      
      if (!paystackSecretKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Paystack not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify with Paystack
      const response = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            "Authorization": `Bearer ${paystackSecretKey}`,
          },
        }
      );

      const data = await response.json();

      if (!data.status) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: data.message || "Could not verify account" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          accountNumber: data.data.account_number,
          accountName: data.data.account_name,
          bankId: data.data.bank_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (provider === 'flutterwave') {
      const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
      
      if (!flutterwaveSecretKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Flutterwave not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify with Flutterwave
      const response = await fetch(
        "https://api.flutterwave.com/v3/accounts/resolve",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${flutterwaveSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_number: accountNumber,
            account_bank: bankCode,
          }),
        }
      );

      const data = await response.json();

      if (data.status !== "success") {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: data.message || "Could not verify account" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          accountNumber: data.data.account_number,
          accountName: data.data.account_name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid provider" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
