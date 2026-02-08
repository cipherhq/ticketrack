import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Loader2, Lock, CheckCircle, AlertCircle, Globe, FileCheck, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useOrganizer } from '@/contexts/OrganizerContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COUNTRY_CONFIG = {
  US: { name: 'United States', currency: 'USD', taxDocument: '1099-K Style', taxId: 'EIN/SSN', notes: 'Report gross receipts to IRS' },
  GB: { name: 'United Kingdom', currency: 'GBP', taxDocument: 'Earnings Statement', taxId: 'UTR/VAT', notes: 'VAT at 20% if registered' },
  CA: { name: 'Canada', currency: 'CAD', taxDocument: 'Earnings Statement', taxId: 'SIN/BN', notes: 'GST/HST if registered' },
  NG: { name: 'Nigeria', currency: 'NGN', taxDocument: 'Earnings Statement', taxId: 'TIN', notes: 'VAT at 7.5% on fees' },
  GH: { name: 'Ghana', currency: 'GHS', taxDocument: 'Earnings Statement', taxId: 'TIN', notes: 'VAT at 15% on fees' },
  KE: { name: 'Kenya', currency: 'KES', taxDocument: 'Earnings Statement', taxId: 'KRA PIN', notes: 'VAT at 16% on fees' },
  ZA: { name: 'South Africa', currency: 'ZAR', taxDocument: 'Earnings Statement', taxId: 'Tax Number', notes: 'VAT at 15% if registered' },
};

export function TaxDocuments() {
  const { organizer } = useOrganizer();
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingCSV, setGeneratingCSV] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [yearSummary, setYearSummary] = useState(null);
  const [eventsData, setEventsData] = useState([]);
  const [payoutsData, setPayoutsData] = useState([]);

  const currentYear = new Date().getFullYear();
  const now = new Date();
  const countryCode = organizer?.country_code || 'NG';
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
    if (selectedYear && organizer?.id) loadYearSummary(selectedYear);
  }, [selectedYear, organizer?.id]);

  const loadYearSummary = async (year) => {
    if (!organizer?.id) return;
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      // Get events with orders
      const { data: events } = await supabase.from('events')
        .select('id, title, start_date, end_date, currency, orders(id, total_amount, platform_fee, status, created_at)')
        .eq('organizer_id', organizer.id)
        .gte('start_date', startDate)
        .lte('start_date', endDate + 'T23:59:59')
        .order('start_date');

      let summary = { grossEarnings: 0, platformFees: 0, netEarnings: 0, transactions: 0, payouts: 0, currency: 'NGN' };
      const eventsList = [];

      events?.forEach(event => {
        const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
        const gross = completedOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
        const fees = completedOrders.reduce((s, o) => s + parseFloat(o.platform_fee || 0), 0);
        
        if (gross > 0) {
          summary.grossEarnings += gross;
          summary.platformFees += fees;
          summary.transactions += completedOrders.length;
          if (event.currency) summary.currency = event.currency;
          
          eventsList.push({
            title: event.title,
            date: event.start_date,
            grossSales: gross,
            platformFees: fees,
            netEarnings: gross - fees,
            transactions: completedOrders.length,
            currency: event.currency || 'NGN'
          });
        }
      });

      // Get payouts
      const { data: payouts } = await supabase.from('payouts')
        .select('id, net_amount, status, created_at, payout_reference')
        .eq('organizer_id', organizer.id)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at');

      const payoutsList = [];
      payouts?.forEach(p => { 
        summary.payouts += parseFloat(p.net_amount || 0);
        payoutsList.push({
          date: p.created_at,
          amount: parseFloat(p.net_amount || 0),
          reference: p.payout_reference || p.id
        });
      });

      summary.netEarnings = summary.grossEarnings - summary.platformFees;

      setYearSummary(summary);
      setEventsData(eventsList);
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
      doc.text('ANNUAL EARNINGS STATEMENT', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tax Year ${selectedYear}`, pageWidth / 2, 32, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      
      // Organization Info
      let yPos = 55;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ORGANIZER INFORMATION', 14, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      yPos += 8;
      doc.text(`Business Name: ${organizer?.business_name || 'N/A'}`, 14, yPos);
      yPos += 6;
      doc.text(`Email: ${organizer?.email || 'N/A'}`, 14, yPos);
      yPos += 6;
      doc.text(`Country: ${countryConfig.name}`, 14, yPos);
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
      doc.text(`Gross Sales:`, col1, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(formatPrice(yearSummary?.grossEarnings || 0, yearSummary?.currency), col1, yPos + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Platform Fees:`, col2, yPos);
      doc.setTextColor(220, 53, 69);
      doc.setFont('helvetica', 'bold');
      doc.text(formatPrice(yearSummary?.platformFees || 0, yearSummary?.currency), col2, yPos + 6);
      
      doc.setTextColor(40, 167, 69);
      doc.setFont('helvetica', 'normal');
      doc.text(`Net Earnings:`, col3, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(formatPrice(yearSummary?.netEarnings || 0, yearSummary?.currency), col3, yPos + 6);
      
      doc.setTextColor(0, 0, 0);

      // Events Table
      yPos += 30;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('EVENTS BREAKDOWN', 14, yPos);
      
      yPos += 5;
      
      if (eventsData.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [['Event', 'Date', 'Gross Sales', 'Platform Fees', 'Net Earnings', 'Orders']],
          body: eventsData.map(e => [
            e.title.substring(0, 30),
            new Date(e.date).toLocaleDateString(),
            formatPrice(e.grossSales, e.currency),
            formatPrice(e.platformFees, e.currency),
            formatPrice(e.netEarnings, e.currency),
            e.transactions
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
        doc.text('No events with sales in this period.', 14, yPos);
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

      // Tax Information
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFillColor(232, 244, 253);
      doc.rect(14, yPos, pageWidth - 28, 30, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 110, 253);
      doc.text(`${countryConfig.name} TAX INFORMATION`, 20, yPos + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(`Document Type: ${countryConfig.taxDocument}`, 20, yPos + 18);
      doc.text(`Tax ID Type: ${countryConfig.taxId}`, 20, yPos + 24);
      doc.text(`Note: ${countryConfig.notes}`, 100, yPos + 18);

      // Footer
      yPos += 45;
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('This document is generated by Ticketrack for tax reporting purposes.', pageWidth / 2, yPos, { align: 'center' });
      doc.text('https://ticketrack.com | support@ticketrack.com', pageWidth / 2, yPos + 5, { align: 'center' });

      // Save PDF
      doc.save(`earnings-statement-${selectedYear}-${organizer?.business_name?.replace(/\s+/g, '-') || 'organizer'}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
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
      csvRows.push(['ANNUAL EARNINGS STATEMENT']);
      csvRows.push(['']);
      csvRows.push(['Tax Year', selectedYear]);
      csvRows.push(['Business Name', organizer?.business_name || 'N/A']);
      csvRows.push(['Email', organizer?.email || 'N/A']);
      csvRows.push(['Country', countryConfig.name]);
      csvRows.push(['Generated', new Date().toLocaleString()]);
      csvRows.push(['']);
      
      // Summary
      csvRows.push(['SUMMARY']);
      csvRows.push(['Gross Sales', yearSummary?.grossEarnings || 0]);
      csvRows.push(['Platform Fees', yearSummary?.platformFees || 0]);
      csvRows.push(['Net Earnings', yearSummary?.netEarnings || 0]);
      csvRows.push(['Total Payouts', yearSummary?.payouts || 0]);
      csvRows.push(['Total Orders', yearSummary?.transactions || 0]);
      csvRows.push(['Currency', yearSummary?.currency || 'NGN']);
      csvRows.push(['']);
      
      // Events
      csvRows.push(['EVENTS BREAKDOWN']);
      csvRows.push(['Event', 'Date', 'Gross Sales', 'Platform Fees', 'Net Earnings', 'Orders']);
      eventsData.forEach(e => {
        csvRows.push([
          e.title,
          new Date(e.date).toLocaleDateString(),
          e.grossSales,
          e.platformFees,
          e.netEarnings,
          e.transactions
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
      csvRows.push(['Country', countryConfig.name]);
      csvRows.push(['Document Type', countryConfig.taxDocument]);
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
      a.download = `earnings-statement-${selectedYear}-${organizer?.business_name?.replace(/\s+/g, '-') || 'organizer'}.csv`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setGeneratingCSV(false);
    }
  };

  const yearNum = parseInt(selectedYear);
  const available = isYearAvailable(yearNum);
  const daysLeft = daysUntilAvailable(yearNum);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tax Documents</h1>
        <p className="text-muted-foreground">Download your annual earnings statements for tax purposes</p>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileCheck className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-800">Annual Earnings Statement</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your annual earnings report becomes available on <strong>December 31st at 11:59 PM</strong> each year. 
                Use this document for your tax filings. Download as PDF for printing or CSV for spreadsheet analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/10 rounded-2xl">
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
              <label className="text-sm font-medium text-foreground">Tax Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-40 rounded-xl">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year} {!isYearAvailable(parseInt(year)) && '🔒'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6">
              <Badge className={`text-sm px-3 py-1 ${available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {available ? (
                  <><CheckCircle className="w-4 h-4 mr-1" />Available</>
                ) : (
                  <><Lock className="w-4 h-4 mr-1" />{daysLeft} days until available</>
                )}
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
              <h3 className="font-semibold text-foreground">{selectedYear} Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-blue-600">{formatPrice(yearSummary.grossEarnings, yearSummary.currency)}</p>
                  <p className="text-xs text-muted-foreground">Gross Sales</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-red-600">{formatPrice(yearSummary.platformFees, yearSummary.currency)}</p>
                  <p className="text-xs text-muted-foreground">Platform Fees</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-green-600">{formatPrice(yearSummary.netEarnings, yearSummary.currency)}</p>
                  <p className="text-xs text-muted-foreground">Net Earnings</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-orange-600">{formatPrice(yearSummary.payouts, yearSummary.currency)}</p>
                  <p className="text-xs text-muted-foreground">Payouts Received</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <p className="text-xl font-bold text-purple-600">{yearSummary.transactions}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>

              {/* Events List Preview */}
              {eventsData.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Events ({eventsData.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {eventsData.map((event, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <div>
                          <p className="font-medium text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{new Date(event.date).toLocaleDateString()}</p>
                        </div>
                        <p className="font-semibold text-green-600">{formatPrice(event.netEarnings, event.currency)}</p>
                      </div>
                    ))}
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
              className={`h-14 rounded-xl text-lg border-2 ${available ? 'border-green-600 text-green-600 hover:bg-green-50' : 'border-border/30 text-muted-foreground cursor-not-allowed'}`}
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

          {/* Country Tax Note */}
          <div className="p-4 bg-muted border border-border/10 rounded-xl">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-[#2969FF] mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{countryConfig.name} Tax Information</p>
                <p className="text-sm text-muted-foreground mt-1">{countryConfig.notes}</p>
                <p className="text-sm text-muted-foreground mt-1">Tax ID Type: {countryConfig.taxId} • Document: {countryConfig.taxDocument}</p>
              </div>
            </div>
          </div>

          {/* Availability Notice */}
          {!available && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Report Not Yet Available</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your {selectedYear} annual earnings statement will be available for download on <strong>December 31, {selectedYear} at 11:59 PM</strong>. 
                    You can view the current year's earnings summary above.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
