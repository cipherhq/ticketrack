/**
 * Generate Invoice - Supabase Edge Function
 *
 * Generates PDF earnings statements/invoices for organizers.
 * Uses @react-pdf/renderer for PDF generation.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
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

interface InvoiceRequest {
  organizer_id: string;
  invoice_type?: "earnings" | "payout" | "commission";
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  event_id?: string;
  send_email?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: InvoiceRequest = await req.json();
    const {
      organizer_id,
      invoice_type = "earnings",
      period_start,
      period_end,
      event_id,
      send_email = false,
    } = body;

    if (!organizer_id || !period_start || !period_end) {
      return errorResponse(
        ERROR_CODES.MISSING_FIELDS,
        400,
        undefined,
        "organizer_id, period_start, and period_end are required",
        corsHeaders
      );
    }

    safeLog.info(`Generating ${invoice_type} invoice for organizer ${organizer_id}`);

    // Get organizer details
    const { data: organizer, error: orgError } = await supabase
      .from("organizers")
      .select(`
        *,
        profiles!user_id (
          email,
          full_name,
          phone
        )
      `)
      .eq("id", organizer_id)
      .single();

    if (orgError || !organizer) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        404,
        orgError,
        "Organizer not found",
        corsHeaders
      );
    }

    // Generate invoice using database function
    const { data: invoiceResult, error: genError } = await supabase.rpc(
      "generate_earnings_invoice",
      {
        p_organizer_id: organizer_id,
        p_period_start: period_start,
        p_period_end: period_end,
        p_event_id: event_id || null,
      }
    );

    if (genError || !invoiceResult?.success) {
      return errorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        500,
        genError || invoiceResult?.error,
        "Failed to generate invoice",
        corsHeaders
      );
    }

    // Get the full invoice with line items
    const { data: invoice, error: fetchError } = await supabase
      .from("organizer_invoices")
      .select(`
        *,
        invoice_line_items (*)
      `)
      .eq("id", invoiceResult.invoice_id)
      .single();

    if (fetchError || !invoice) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        404,
        fetchError,
        "Invoice not found after generation",
        corsHeaders
      );
    }

    // Generate PDF content (HTML for now, can be converted to PDF)
    const pdfHtml = generateInvoiceHtml(organizer, invoice);

    // Store PDF in storage
    const pdfFileName = `invoices/${organizer_id}/${invoice.invoice_number}.html`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(pdfFileName, new Blob([pdfHtml], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      logError("upload_invoice_pdf", uploadError);
      // Don't fail - PDF storage is nice-to-have
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(pdfFileName);

    // Update invoice with PDF path
    await supabase
      .from("organizer_invoices")
      .update({
        pdf_path: pdfFileName,
        pdf_generated_at: new Date().toISOString(),
        status: "generated",
      })
      .eq("id", invoice.id);

    // Send email if requested
    if (send_email && organizer.profiles?.email) {
      await sendInvoiceEmail(supabase, organizer, invoice, urlData?.publicUrl);
    }

    safeLog.info(`Invoice ${invoice.invoice_number} generated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        pdf_url: urlData?.publicUrl,
        gross_sales: invoice.gross_sales,
        net_earnings: invoiceResult.net_earnings,
        currency: invoice.currency,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("generate_invoice", error);
    return errorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      error,
      undefined,
      corsHeaders
    );
  }
});

function generateInvoiceHtml(organizer: any, invoice: any): string {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const lineItems = invoice.invoice_line_items || [];
  const revenueItems = lineItems.filter((item: any) => !item.is_deduction);
  const deductionItems = lineItems.filter((item: any) => item.is_deduction);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2969FF;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2969FF;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-number {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .invoice-date {
      color: #666;
      margin-top: 5px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .party {
      width: 45%;
    }
    .party-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .party-name {
      font-size: 18px;
      font-weight: bold;
    }
    .period {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .period-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .period-dates {
      font-weight: bold;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 15px;
      padding-bottom: 5px;
      border-bottom: 1px solid #eee;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f8f9fa;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
    }
    td {
      border-bottom: 1px solid #eee;
    }
    .amount {
      text-align: right;
      font-family: monospace;
    }
    .deduction {
      color: #dc3545;
    }
    .totals {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .total-row.final {
      border-top: 2px solid #333;
      padding-top: 15px;
      margin-top: 10px;
      font-size: 20px;
      font-weight: bold;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Ticketrack</div>
    <div class="invoice-info">
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div class="invoice-date">Generated: ${formatDate(invoice.created_at)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">Ticketrack Limited</div>
      <div>Lagos, Nigeria</div>
    </div>
    <div class="party">
      <div class="party-label">To</div>
      <div class="party-name">${organizer.business_name}</div>
      <div>${organizer.profiles?.email || ""}</div>
    </div>
  </div>

  <div class="period">
    <div class="period-label">Statement Period</div>
    <div class="period-dates">${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}</div>
  </div>

  ${revenueItems.length > 0 ? `
  <div class="section">
    <div class="section-title">Revenue</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${revenueItems.map((item: any) => `
          <tr>
            <td>${item.description}</td>
            <td class="amount">${formatCurrency(item.amount, invoice.currency)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${deductionItems.length > 0 ? `
  <div class="section">
    <div class="section-title">Deductions</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${deductionItems.map((item: any) => `
          <tr>
            <td>${item.description}</td>
            <td class="amount deduction">-${formatCurrency(item.amount, invoice.currency)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <div class="totals">
    <div class="total-row">
      <span>Gross Sales</span>
      <span>${formatCurrency(invoice.gross_sales || 0, invoice.currency)}</span>
    </div>
    <div class="total-row">
      <span>Platform Fees</span>
      <span class="deduction">-${formatCurrency(invoice.platform_fees || 0, invoice.currency)}</span>
    </div>
    ${invoice.refunds > 0 ? `
    <div class="total-row">
      <span>Refunds</span>
      <span class="deduction">-${formatCurrency(invoice.refunds, invoice.currency)}</span>
    </div>
    ` : ""}
    ${invoice.chargebacks > 0 ? `
    <div class="total-row">
      <span>Chargebacks</span>
      <span class="deduction">-${formatCurrency(invoice.chargebacks, invoice.currency)}</span>
    </div>
    ` : ""}
    ${invoice.promoter_commissions > 0 ? `
    <div class="total-row">
      <span>Promoter Commissions</span>
      <span class="deduction">-${formatCurrency(invoice.promoter_commissions, invoice.currency)}</span>
    </div>
    ` : ""}
    <div class="total-row final">
      <span>Net Earnings</span>
      <span>${formatCurrency(invoice.net_earnings || 0, invoice.currency)}</span>
    </div>
  </div>

  <div class="footer">
    <p>This is an automatically generated earnings statement from Ticketrack.</p>
    <p>For questions, contact finance@ticketrack.com</p>
  </div>
</body>
</html>
  `.trim();
}

async function sendInvoiceEmail(
  supabase: any,
  organizer: any,
  invoice: any,
  pdfUrl?: string
): Promise<void> {
  try {
    await supabase.rpc("mark_invoice_sent", {
      p_invoice_id: invoice.id,
      p_email: organizer.profiles?.email,
    });

    await supabase.functions.invoke("send-email", {
      body: {
        type: "earnings_statement",
        to: organizer.profiles?.email,
        data: {
          organizerName: organizer.business_name,
          invoiceNumber: invoice.invoice_number,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          grossSales: invoice.gross_sales,
          netEarnings: invoice.net_earnings,
          currency: invoice.currency,
          pdfUrl,
          dashboardUrl: "https://ticketrack.com/organizer/finance",
        },
      },
    });

    safeLog.info(`Invoice email sent to ${organizer.profiles?.email}`);
  } catch (err) {
    logError("send_invoice_email", err);
    // Don't throw - email failure shouldn't fail the invoice generation
  }
}
