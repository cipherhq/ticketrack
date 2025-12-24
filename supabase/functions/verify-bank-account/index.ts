import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      throw new Error("Account number and bank code are required");
    }

    if (account_number.length !== 10) {
      throw new Error("Account number must be 10 digits");
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("Paystack secret key not configured");
    }

    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const data = await response.json();

    if (!data.status) {
      return new Response(
        JSON.stringify({ status: false, message: data.message || "Could not verify account" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: true, 
        data: {
          account_name: data.data.account_name,
          account_number: data.data.account_number,
          bank_id: data.data.bank_id,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error verifying account:", error);
    return new Response(
      JSON.stringify({ status: false, message: error.message || "Failed to verify account" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
});
