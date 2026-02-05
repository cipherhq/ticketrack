import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Loader2, Lock, CheckCircle, AlertCircle, Globe, FileCheck, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { usePromoter } from '@/contexts/PromoterContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COUNTRY_CONFIG = {
  US: { name: 'United States', currency: 'USD', taxId: 'EIN/SSN', notes: 'Report commission income to IRS' },
  GB: { name: 'United Kingdom', currency: 'GBP', taxId: 'UTR/NI', notes: 'Report as self-employment income' },
  CA: { name: 'Canada', currency: 'CAD', taxId: 'SIN', notes: 'Report as business/self-employment income' },
  NG: { name: 'Nigeria', currency: 'NGN', taxId: 'TIN', notes: 'Report as commission income' },
  GH: { name: 'Ghana', currency: 'GHS', taxId: 'TIN', notes: 'Report as commission income' },
  KE: { name: 'Kenya', currency: 'KES', taxId: 'KRA PIN', notes: 'Report as commission income' },
  ZA: { name: 'South Africa', currency: 'ZAR', taxId: 'Tax Number', notes: 'Report as commission income' },
};

export function PromoterTaxDocuments() {
  const { promoter, loading: promoterLoading } = usePromoter();
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingCSV, setGeneratingCSV] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [yearSummary, setYearSummary] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [payoutsData, setPayoutsData] = useState([]);

  const currentYear = new Date().getFullYear();
  const now = new Date();
  const countryCode = promoter?.country_code || promoter?.country || 'NG';
  const countryConfig = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.NG;

  const isYearAvailable = (year) => {
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    return now > yearEnd;
  };

  const daysUntilAvailable = (year) => {
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    const diff = yearEnd - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  useEffect(() => {
    const years = [];
    for (let y = currentYear; y >= 2024; y--) {
      years.push(y.toString());
    }
    setAvailableYears(years);
    if (years.length > 0) setSelectedYear(years[0]);
  }, []);

  useEffect(() => {
    if (selectedYear && promoter?.id) loadYearSummary(selectedYear);
  }, [selectedYear, promoter?.id]);

  const loadYearSummary = async (year) => {
    if (!promoter?.id) return;
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Get sales
      const { data: sales } = await supabase.from('promoter_sales')
        .select('sale_amount, commission_amount, tickets_sold, created_at, events(title, currency)')
        .eq('promoter_id', promoter.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at');

      let summary = { totalCommission: 0, totalSales: 0, ticketsSold: 0, payouts: 0, currency: 'NGN' };
      const salesList = [];

      sales?.forEach(sale => {
        summary.totalCommission += parseFloat(sale.commission_amount || 0);
        summary.totalSales += parseFloat(sale.sale_amount || 0);
        summary.ticketsSold += sale.tickets_sold || 0;
        if (sale.events?.currency) summary.currency = sale.events.currency;

        salesList.push({
          event: sale.events?.title || 'Event',
          date: sale.created_at,
          ticketsSold: sale.tickets_sold,
          saleAmount: parseFloat(sale.sale_amount || 0),
          commission: parseFloat(sale.commission_amount || 0),
          currency: sale.events?.currency || 'NGN'
        });
      });

      // Get payouts
      const { data: payouts } = await supabase.from('promoter_payouts')
        .select('id, amount, status, created_at, reference')
        .eq('promoter_id', promoter.id)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at');

      const payoutsList = [];
      payouts?.forEach(p => { 
        summary.payouts += parseFloat(p.amount || 0);
        payoutsList.push({
          date: p.created_at,
          amount: parseFloat(p.amount || 0),
          reference: p.reference || p.id
        });
      });

      setYearSummary(summary);
      setSalesData(salesList);
      setPayoutsData(payoutsList);
    } catch (error) {
      console.error('Error loading year summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF Report
  const generatePDF = async () => {
    const yearNum = parseInt(selectedYear);
    if (!isYearAvailable(yearNum)) {
      alert(`Report for ${selectedYear} will be available on January 1, ${yearNum + 1}`);
      return;
    }

    setGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(41, 105, 255);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('PROMOTER EARNINGS STATEMENT', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tax Year ${selectedYear}`, pageWidth / 2, 32, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      
      // Promoter Info
      let yPos = 55;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PROMOTER INFORMATION', 14, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      yPos += 8;
      doc.text(`Name: ${promoter?.full_name || 'N/A'}`, 14, yPos);
      yPos += 6;
      doc.text(`Email: ${promoter?.email || 'N/A'}`, 14, yPos);
      yPos += 6;
      doc.text(`Promo Code: ${promoter?.short_code || 'N/A'}`, 14, yPos);
      yPos += 6;
      doc.text(`Commission Rate: ${promoter?.commission_rate || 0}%`, 14, yPos);
      yPos += 6;
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);

      // Summary Box
      yPos += 15;
      doc.setFillColor(244, 246, 250);
      doc.rect(14, yPos, pageWidth - 28, 35, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('EARNINGS SUMMARY', 20, yPos + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const col1 = 20;
      const col2 = 75;
      const col3 = 130;
      
      yPos += 18;
      doc.text(`Total Commission:`, col1, yPos);
      doc.setTextColor(40, 167, 69);
      doc.setFont('helvetica', 'bold');
      doc.text(formatPrice(yearSummary?.totalCommission || 0, yearSummary?.currency), col1, yPos + 6);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Sales Generated:`, col2, yPos);
      doc.text(formatPrice(yearSummary?.totalSales || 0, yearSummary?.currency), col2, yPos + 6);
      
      doc.text(`Tickets Sold:`, col3, yPos);
      doc.text(`${yearSummary?.ticketsSold || 0}`, col3, yPos + 6);

      // Sales Table
      yPos += 30;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SALES BREAKDOWN', 14, yPos);
      
      yPos += 5;
      
      if (salesData.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [['Event', 'Date', 'Tickets', 'Sales Amount', 'Commission']],
          body: salesData.map(s => [
            s.event.substring(0, 35),
            new Date(s.date).toLocaleDateString(),
            s.ticketsSold,
            formatPrice(s.saleAmount, s.currency),
            formatPrice(s.commission, s.currency)
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [41, 105, 255], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 249, 250] },
          margin: { left: 14, right: 14 }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
      } else {
        yPos += 10;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.text('No sales recorded in this period.', 14, yPos);
        yPos += 15;
      }

      // Payouts Table
      if (payoutsData.length > 0) {
        if (yPos > 220) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYOUTS RECEIVED', 14, yPos);
        
        yPos += 5;
        
        doc.autoTable({
          startY: yPos,
          head: [['Date', 'Amount', 'Reference']],
          body: payoutsData.map(p => [
            new Date(p.date).toLocaleDateString(),
            formatPrice(p.amount, yearSummary?.currency),
            p.reference
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [40, 167, 69], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 249, 250] },
          margin: { left: 14, right: 14 }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Tax Info
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFillColor(232, 244, 253);
      doc.rect(14, yPos, pageWidth - 28, 25, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 110, 253);
      doc.text('TAX INFORMATION', 20, yPos + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`Tax ID Type: ${countryConfig.taxId}`, 20, yPos + 18);
      doc.text(`Note: ${countryConfig.notes}`, 80, yPos + 18);

      // Footer
      yPos += 40;
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('This document is generated by Ticketrack for tax reporting purposes.', pageWidth / 2, yPos, { align: 'center' });
      doc.text('https://ticketrack.com | support@ticketrack.com', pageWidth / 2, yPos + 5, { align: 'center' });

      doc.save(`promoter-earnings-${selectedYear}-${promoter?.full_name?.replace(/\s+/g, '-') || 'promoter'}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Generate CSV Report
  const generateCSV = async () => {
    const yearNum = parseInt(selectedYear);
    if (!isYearAvailable(yearNum)) {
      alert(`Report for ${selectedYear} will be available on January 1, ${yearNum + 1}`);
      return;
    }

    setGeneratingCSV(true);
    try {
      let csvRows = [];
      
      // Header
      csvRows.push(['PROMOTER EARNINGS STATEMENT']);
      csvRows.push(['']);
      csvRows.push(['Tax Year', selectedYear]);
      csvRows.push(['Name', promoter?.full_name || 'N/A']);
      csvRows.push(['Email', promoter?.email || 'N/A']);
      csvRows.push(['Promo Code', promoter?.short_code || 'N/A']);
      csvRows.push(['Commission Rate', `${promoter?.commission_rate || 0}%`]);
      csvRows.push(['Generated', new Date().toLocaleString()]);
      csvRows.push(['']);
      
      // Summary
      csvRows.push(['SUMMARY']);
      csvRows.push(['Total Commission Earned', yearSummary?.totalCommission || 0]);
      csvRows.push(['Total Sales Generated', yearSummary?.totalSales || 0]);
      csvRows.push(['Total Tickets Sold', yearSummary?.ticketsSold || 0]);
      csvRows.push(['Total Payouts Received', yearSummary?.payouts || 0]);
      csvRows.push(['Currency', yearSummary?.currency || 'NGN']);
      csvRows.push(['']);
      
      // Sales
      csvRows.push(['SALES BREAKDOWN']);
      csvRows.push(['Event', 'Date', 'Tickets Sold', 'Sale Amount', 'Commission']);
      salesData.forEach(s => {
        csvRows.push([
          s.event,
          new Date(s.date).toLocaleDateString(),
          s.ticketsSold,
          s.saleAmount,
          s.commission
        ]);
      });
      csvRows.push(['']);
      
      // Payouts
      csvRows.push(['PAYOUTS RECEIVED']);
      csvRows.push(['Date', 'Amount', 'Reference']);
      payoutsData.forEach(p => {
        csvRows.push([
          new Date(p.date).toLocaleDateString(),
          p.amount,
          p.reference
        ]);
      });
      csvRows.push(['']);
      
      // Tax Info
      csvRows.push(['TAX INFORMATION']);
      csvRows.push(['Tax ID Type', countryConfig.taxId]);
      csvRows.push(['Notes', countryConfig.notes]);
      csvRows.push(['']);
      csvRows.push(['Generated by Ticketrack - https://ticketrack.com']);

      // Convert to CSV string
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promoter-earnings-${selectedYear}-${promoter?.full_name?.replace(/\s+/g, '-') || 'promoter'}.csv`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Failed to generate CSV.');
    } finally {
      setGeneratingCSV(false);
    }
  };

  const yearNum = parseInt(selectedYear);
  const available = isYearAvailable(yearNum);
  const daysLeft = daysUntilAvailable(yearNum);

  if (promoterLoading) {
    return (
      <div className="p-6">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 text-[#2969FF] mx-auto mb-4 animate-spin" />
            <p className="text-[#0F0F0F]/60">Loading promoter data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!promoter) {
    return (
      <div className="p-6">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">You need to be a promoter to access tax documents.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F]">Tax Documents</h1>
        <p className="text-[#0F0F0F]/60">Download your annual commission earnings statements</p>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileCheck className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-800">Promoter Earnings Statement</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your annual earnings report shows all commissions earned from ticket sales.
                Available on <strong>December 31st at 11:59 PM</strong> each year. Download as PDF for printing or CSV for spreadsheet analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2969FF]" />
            Generate Statement
          </CardTitle>
          <CardDescription>Select a year to view summary and download your statement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Selector */}
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F0F0F]">Tax Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-40 rounded-xl">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year} {!isYearAvailable(parseInt(year)) && '🔒'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6">
              <Badge className={`text-sm px-3 py-1 ${available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {available ? <><CheckCircle className="w-4 h-4 mr-1" />Available</> : <><Lock className="w-4 h-4 mr-1" />{daysLeft} days until available</>}
              </Badge>
            </div>
          </div>

          {/* Year Summary */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
            </div>
          ) : yearSummary && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#0F0F0F]">{selectedYear} Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-green-600">{formatPrice(yearSummary.totalCommission, yearSummary.currency)}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Total Commission</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-blue-600">{formatPrice(yearSummary.totalSales, yearSummary.currency)}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Sales Generated</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-purple-600">{yearSummary.ticketsSold}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Tickets Sold</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-orange-600">{formatPrice(yearSummary.payouts, yearSummary.currency)}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Paid Out</p>
                </div>
              </div>

              {/* Sales Preview */}
              {salesData.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-[#0F0F0F]/60 mb-2">Sales ({salesData.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {salesData.slice(0, 5).map((sale, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                        <div>
                          <p className="font-medium text-[#0F0F0F]">{sale.event}</p>
                          <p className="text-xs text-[#0F0F0F]/60">{new Date(sale.date).toLocaleDateString()} • {sale.ticketsSold} tickets</p>
                        </div>
                        <p className="font-semibold text-green-600">{formatPrice(sale.commission, sale.currency)}</p>
                      </div>
                    ))}
                    {salesData.length > 5 && (
                      <p className="text-sm text-center text-[#0F0F0F]/40">+ {salesData.length - 5} more sales</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Download Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={generatePDF}
              disabled={!available || generatingPDF || !yearSummary}
              className={`h-14 rounded-xl text-lg ${available ? 'bg-[#2969FF] hover:bg-[#2969FF]/90' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              {generatingPDF ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
              ) : available ? (
                <><Download className="w-5 h-5 mr-2" />Download PDF</>
              ) : (
                <><Lock className="w-5 h-5 mr-2" />PDF - Jan 1, {yearNum + 1}</>
              )}
            </Button>
            
            <Button
              onClick={generateCSV}
              disabled={!available || generatingCSV || !yearSummary}
              variant="outline"
              className={`h-14 rounded-xl text-lg border-2 ${available ? 'border-green-600 text-green-600 hover:bg-green-50' : 'border-gray-300 text-gray-400 cursor-not-allowed'}`}
            >
              {generatingCSV ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
              ) : available ? (
                <><FileSpreadsheet className="w-5 h-5 mr-2" />Download CSV</>
              ) : (
                <><Lock className="w-5 h-5 mr-2" />CSV - Jan 1, {yearNum + 1}</>
              )}
            </Button>
          </div>

          {/* Tax Info */}
          <div className="p-4 bg-[#F4F6FA] border border-[#0F0F0F]/10 rounded-xl">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-[#2969FF] mt-0.5" />
              <div>
                <p className="font-medium text-[#0F0F0F]">{countryConfig.name} Tax Information</p>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{countryConfig.notes}</p>
                <p className="text-sm text-[#0F0F0F]/40 mt-1">Tax ID Type: {countryConfig.taxId}</p>
              </div>
            </div>
          </div>

          {/* Availability Notice */}
          {!available && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Report Not Yet Available</p>
                  <p className="text-sm text-yellow-700 mt-1">Your {selectedYear} statement will be available on <strong>December 31, {selectedYear} at 11:59 PM</strong>.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
