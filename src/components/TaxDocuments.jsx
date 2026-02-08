import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Loader2, Lock, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';

const COUNTRY_CONFIG = {
  US: { name: 'United States', currency: 'USD', taxDocument: '1099-K Style', taxId: 'EIN/SSN', notes: 'Report gross receipts to IRS' },
  GB: { name: 'United Kingdom', currency: 'GBP', taxDocument: 'Earnings Statement', taxId: 'UTR/VAT', notes: 'VAT at 20% if registered' },
  CA: { name: 'Canada', currency: 'CAD', taxDocument: 'Earnings Statement', taxId: 'SIN/BN', notes: 'GST/HST if registered' },
  NG: { name: 'Nigeria', currency: 'NGN', taxDocument: 'Earnings Statement', taxId: 'TIN', notes: 'VAT at 7.5% on fees' },
  GH: { name: 'Ghana', currency: 'GHS', taxDocument: 'Earnings Statement', taxId: 'TIN', notes: 'VAT at 15% on fees' },
  KE: { name: 'Kenya', currency: 'KES', taxDocument: 'Earnings Statement', taxId: 'KRA PIN', notes: 'VAT at 16% on fees' },
  ZA: { name: 'South Africa', currency: 'ZAR', taxDocument: 'Earnings Statement', taxId: 'Tax Number', notes: 'VAT at 15% if registered' },
};

export function TaxDocuments({ type, recipientId, countryCode = 'NG' }) {
  const [selectedYear, setSelectedYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [yearSummary, setYearSummary] = useState(null);

  const currentYear = new Date().getFullYear();
  const now = new Date();
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
    if (selectedYear && recipientId) loadYearSummary(selectedYear);
  }, [selectedYear, recipientId]);

  const loadYearSummary = async (year) => {
    if (!recipientId) return;
    setLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      let summary = { grossEarnings: 0, platformFees: 0, netEarnings: 0, transactions: 0, payouts: 0, currency: 'NGN' };

      if (type === 'organizer') {
        const { data: events } = await supabase.from('events')
          .select('id, currency, orders(id, total_amount, platform_fee, status)')
          .eq('organizer_id', recipientId)
          .gte('start_date', startDate)
          .lte('start_date', endDate + 'T23:59:59');

        events?.forEach(event => {
          const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
          completedOrders.forEach(order => {
            summary.grossEarnings += parseFloat(order.total_amount || 0);
            summary.platformFees += parseFloat(order.platform_fee || 0);
            summary.transactions += 1;
          });
          if (event.currency) summary.currency = event.currency;
        });

        const { data: payouts } = await supabase.from('payouts')
          .select('net_amount')
          .eq('organizer_id', recipientId)
          .eq('status', 'completed')
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        payouts?.forEach(p => { summary.payouts += parseFloat(p.net_amount || 0); });
        summary.netEarnings = summary.grossEarnings - summary.platformFees;

      } else if (type === 'promoter') {
        const { data: sales } = await supabase.from('promoter_sales')
          .select('sale_amount, commission_amount, tickets_sold, events(currency)')
          .eq('promoter_id', recipientId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        sales?.forEach(sale => {
          summary.grossEarnings += parseFloat(sale.commission_amount || 0);
          summary.transactions += sale.tickets_sold || 0;
          if (sale.events?.currency) summary.currency = sale.events.currency;
        });

        const { data: payouts } = await supabase.from('promoter_payouts')
          .select('amount')
          .eq('promoter_id', recipientId)
          .eq('status', 'completed')
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        payouts?.forEach(p => { summary.payouts += parseFloat(p.amount || 0); });
        summary.netEarnings = summary.grossEarnings;

      } else if (type === 'affiliate') {
        const { data: earnings } = await supabase.from('referral_earnings')
          .select('commission_amount, status')
          .eq('user_id', recipientId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        earnings?.forEach(e => {
          summary.grossEarnings += parseFloat(e.commission_amount || 0);
          summary.transactions += 1;
          if (e.status === 'paid') summary.payouts += parseFloat(e.commission_amount || 0);
        });
        summary.netEarnings = summary.grossEarnings;
      }

      setYearSummary(summary);
    } catch (error) {
      console.error('Error loading year summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    const yearNum = parseInt(selectedYear);
    if (!isYearAvailable(yearNum)) {
      alert(`Report for ${selectedYear} will be available on January 1, ${yearNum + 1}`);
      return;
    }

    setGenerating(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      let reportData = [];
      const typeLabel = type === 'organizer' ? 'ORGANIZER' : type === 'promoter' ? 'PROMOTER' : 'AFFILIATE';

      reportData.push(['ANNUAL EARNINGS STATEMENT']);
      reportData.push(['Tax Year', selectedYear]);
      reportData.push(['Account Type', typeLabel]);
      reportData.push(['Country', countryConfig.name]);
      reportData.push(['Generated', new Date().toLocaleString()]);
      reportData.push(['']);
      reportData.push(['SUMMARY']);
      reportData.push(['Total Gross Earnings', yearSummary?.grossEarnings || 0]);
      if (type === 'organizer') reportData.push(['Platform Fees', yearSummary?.platformFees || 0]);
      reportData.push(['Net Earnings', yearSummary?.netEarnings || 0]);
      reportData.push(['Total Payouts Received', yearSummary?.payouts || 0]);
      reportData.push(['Total Transactions', yearSummary?.transactions || 0]);
      reportData.push(['Currency', yearSummary?.currency || 'NGN']);
      reportData.push(['']);

      if (type === 'organizer') {
        const { data: events } = await supabase.from('events')
          .select('id, title, start_date, currency, orders(id, total_amount, platform_fee, status)')
          .eq('organizer_id', recipientId)
          .gte('start_date', startDate)
          .lte('start_date', endDate + 'T23:59:59');

        reportData.push(['EVENTS BREAKDOWN']);
        reportData.push(['Event', 'Date', 'Gross Sales', 'Platform Fees', 'Net Earnings', 'Transactions']);
        events?.forEach(event => {
          const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
          const gross = completedOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
          const fees = completedOrders.reduce((s, o) => s + parseFloat(o.platform_fee || 0), 0);
          if (gross > 0) {
            reportData.push([event.title, new Date(event.start_date).toLocaleDateString(), gross, fees, gross - fees, completedOrders.length]);
          }
        });
      } else if (type === 'promoter') {
        const { data: sales } = await supabase.from('promoter_sales')
          .select('sale_amount, commission_amount, tickets_sold, created_at, events(title)')
          .eq('promoter_id', recipientId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        reportData.push(['SALES BREAKDOWN']);
        reportData.push(['Event', 'Date', 'Tickets Sold', 'Sale Amount', 'Commission']);
        sales?.forEach(sale => {
          reportData.push([sale.events?.title || 'Event', new Date(sale.created_at).toLocaleDateString(), sale.tickets_sold, sale.sale_amount, sale.commission_amount]);
        });
      } else if (type === 'affiliate') {
        const { data: earnings } = await supabase.from('referral_earnings')
          .select('commission_amount, status, created_at, events(title)')
          .eq('user_id', recipientId)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59');

        reportData.push(['REFERRAL EARNINGS']);
        reportData.push(['Event', 'Date', 'Commission', 'Status']);
        earnings?.forEach(e => {
          reportData.push([e.events?.title || 'Event', new Date(e.created_at).toLocaleDateString(), e.commission_amount, e.status]);
        });
      }

      reportData.push(['']);
      reportData.push(['TAX INFORMATION']);
      reportData.push(['Country', countryConfig.name]);
      reportData.push(['Document Type', countryConfig.taxDocument]);
      reportData.push(['Tax ID Type', countryConfig.taxId]);
      reportData.push(['Notes', countryConfig.notes]);
      reportData.push(['']);
      reportData.push(['Generated by Ticketrack - https://ticketrack.com']);

      const csvContent = reportData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earnings-statement-${selectedYear}-${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const yearNum = parseInt(selectedYear);
  const available = isYearAvailable(yearNum);
  const daysLeft = available ? 0 : daysUntilAvailable(yearNum);

  return (
    <Card className="border-border/10 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#2969FF]" />
          Tax Documents
        </CardTitle>
        <CardDescription>Download your annual earnings statement for tax purposes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32 rounded-xl">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year} {!isYearAvailable(parseInt(year)) && '🔒'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className={available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
            {available ? <><CheckCircle className="w-3 h-3 mr-1" />Available</> : <><Lock className="w-3 h-3 mr-1" />{daysLeft} days</>}
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#2969FF]" /></div>
        ) : yearSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-green-50 rounded-xl text-center">
              <p className="text-lg font-bold text-green-600">{formatPrice(yearSummary.netEarnings, yearSummary.currency)}</p>
              <p className="text-xs text-muted-foreground">Net Earnings</p>
            </div>
            {type === 'organizer' && (
              <div className="p-3 bg-red-50 rounded-xl text-center">
                <p className="text-lg font-bold text-red-600">{formatPrice(yearSummary.platformFees, yearSummary.currency)}</p>
                <p className="text-xs text-muted-foreground">Platform Fees</p>
              </div>
            )}
            <div className="p-3 bg-blue-50 rounded-xl text-center">
              <p className="text-lg font-bold text-blue-600">{formatPrice(yearSummary.payouts, yearSummary.currency)}</p>
              <p className="text-xs text-muted-foreground">Payouts</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl text-center">
              <p className="text-lg font-bold text-purple-600">{yearSummary.transactions}</p>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
          </div>
        )}

        <Button onClick={downloadReport} disabled={!available || generating} className={`w-full rounded-xl ${available ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}>
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : available ? <><Download className="w-4 h-4 mr-2" />Download {selectedYear} Statement</> : <><Lock className="w-4 h-4 mr-2" />Available Jan 1, {yearNum + 1}</>}
        </Button>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800">{countryConfig.name} Tax Info</p>
              <p className="text-blue-700">{countryConfig.notes}</p>
              <p className="text-blue-600 text-xs mt-1">Tax ID Type: {countryConfig.taxId}</p>
            </div>
          </div>
        </div>

        {!available && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">Your {selectedYear} earnings statement will be available on <strong>December 31, {selectedYear} at 11:59 PM</strong>.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
