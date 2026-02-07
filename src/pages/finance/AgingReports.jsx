import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2, Clock, AlertTriangle, CheckCircle, Download,
  RefreshCw, Calendar, TrendingDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function AgingReports() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('NGN');
  const [reportType, setReportType] = useState('payouts');
  const [agingData, setAgingData] = useState([]);
  const [summary, setSummary] = useState({
    current: 0,
    aging7: 0,
    aging30: 0,
    aging60: 0,
    aging90Plus: 0,
    total: 0
  });

  useEffect(() => {
    loadAgingData();
    logFinanceAction('view_aging_reports');
  }, [currency, reportType]);

  const loadAgingData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const day60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      let data = [];

      if (reportType === 'payouts') {
        // Outstanding payouts aging
        const { data: escrows } = await supabase
          .from('escrow_balances')
          .select(`
            *,
            organizers (id, business_name, email)
          `)
          .eq('currency', currency)
          .in('status', ['eligible', 'pending', 'hold'])
          .order('payout_eligible_at', { ascending: true });

        data = (escrows || []).map(e => {
          const eligibleDate = e.payout_eligible_at ? new Date(e.payout_eligible_at) : new Date(e.created_at);
          let agingBucket = 'current';

          if (eligibleDate < day90) {
            agingBucket = '90+';
          } else if (eligibleDate < day60) {
            agingBucket = '60-90';
          } else if (eligibleDate < day30) {
            agingBucket = '30-60';
          } else if (eligibleDate < day7) {
            agingBucket = '7-30';
          }

          return {
            id: e.id,
            name: e.organizers?.business_name || 'Unknown',
            email: e.organizers?.email,
            amount: parseFloat(e.available_balance || 0),
            date: eligibleDate,
            status: e.status,
            agingBucket,
            daysAged: Math.floor((now - eligibleDate) / (1000 * 60 * 60 * 24))
          };
        });
      } else if (reportType === 'refunds') {
        // Pending refunds aging
        const { data: refunds } = await supabase
          .from('refunds')
          .select(`
            *,
            orders (buyer_name, buyer_email)
          `)
          .eq('currency', currency)
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        data = (refunds || []).map(r => {
          const createdDate = new Date(r.created_at);
          let agingBucket = 'current';

          if (createdDate < day90) {
            agingBucket = '90+';
          } else if (createdDate < day60) {
            agingBucket = '60-90';
          } else if (createdDate < day30) {
            agingBucket = '30-60';
          } else if (createdDate < day7) {
            agingBucket = '7-30';
          }

          return {
            id: r.id,
            name: r.orders?.buyer_name || 'Unknown',
            email: r.orders?.buyer_email,
            amount: parseFloat(r.amount || 0),
            date: createdDate,
            status: r.status,
            agingBucket,
            daysAged: Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))
          };
        });
      } else if (reportType === 'chargebacks') {
        // Open chargebacks aging
        const { data: chargebacks } = await supabase
          .from('chargebacks')
          .select(`
            *,
            organizers (business_name, email)
          `)
          .eq('currency', currency)
          .in('status', ['opened', 'needs_response', 'under_review'])
          .order('opened_at', { ascending: true });

        data = (chargebacks || []).map(c => {
          const openedDate = new Date(c.opened_at);
          let agingBucket = 'current';

          if (openedDate < day90) {
            agingBucket = '90+';
          } else if (openedDate < day60) {
            agingBucket = '60-90';
          } else if (openedDate < day30) {
            agingBucket = '30-60';
          } else if (openedDate < day7) {
            agingBucket = '7-30';
          }

          return {
            id: c.id,
            name: c.organizers?.business_name || 'Unknown',
            email: c.organizers?.email,
            amount: parseFloat(c.disputed_amount || 0),
            date: openedDate,
            status: c.status,
            agingBucket,
            daysAged: Math.floor((now - openedDate) / (1000 * 60 * 60 * 24))
          };
        });
      }

      setAgingData(data);

      // Calculate summary
      const current = data.filter(d => d.agingBucket === 'current').reduce((sum, d) => sum + d.amount, 0);
      const aging7 = data.filter(d => d.agingBucket === '7-30').reduce((sum, d) => sum + d.amount, 0);
      const aging30 = data.filter(d => d.agingBucket === '30-60').reduce((sum, d) => sum + d.amount, 0);
      const aging60 = data.filter(d => d.agingBucket === '60-90').reduce((sum, d) => sum + d.amount, 0);
      const aging90Plus = data.filter(d => d.agingBucket === '90+').reduce((sum, d) => sum + d.amount, 0);

      setSummary({
        current,
        aging7,
        aging30,
        aging60,
        aging90Plus,
        total: current + aging7 + aging30 + aging60 + aging90Plus
      });
    } catch (error) {
      console.error('Error loading aging data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Email', 'Amount', 'Date', 'Days Aged', 'Status', 'Aging Bucket'].join(','),
      ...agingData.map(d => [
        `"${d.name}"`,
        d.email || '',
        d.amount,
        d.date.toISOString().split('T')[0],
        d.daysAged,
        d.status,
        d.agingBucket
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aging-report-${reportType}-${currency}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logFinanceAction('export_aging_report');
  };

  const getAgingBadge = (bucket) => {
    const styles = {
      current: 'bg-green-100 text-green-800',
      '7-30': 'bg-yellow-100 text-yellow-800',
      '30-60': 'bg-orange-100 text-orange-800',
      '60-90': 'bg-red-100 text-red-800',
      '90+': 'bg-red-200 text-red-900'
    };
    const labels = {
      current: '0-7 days',
      '7-30': '7-30 days',
      '30-60': '30-60 days',
      '60-90': '60-90 days',
      '90+': '90+ days'
    };
    return <Badge className={styles[bucket]}>{labels[bucket]}</Badge>;
  };

  const getReportTitle = () => {
    const titles = {
      payouts: 'Outstanding Payouts',
      refunds: 'Pending Refunds',
      chargebacks: 'Open Chargebacks'
    };
    return titles[reportType] || 'Aging Report';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Aging Reports</h1>
          <p className="text-[#0F0F0F]/60">Track outstanding items by age</p>
        </div>
        <div className="flex gap-2">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[160px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payouts">Outstanding Payouts</SelectItem>
              <SelectItem value="refunds">Pending Refunds</SelectItem>
              <SelectItem value="chargebacks">Open Chargebacks</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[100px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NGN">NGN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="GHS">GHS</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAgingData} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExport} className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Aging Summary Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-[#0F0F0F]/60">Current (0-7 days)</span>
            </div>
            <p className="text-xl font-bold">{formatPrice(summary.current, currency)}</p>
            <p className="text-xs text-[#0F0F0F]/50">
              {agingData.filter(d => d.agingBucket === 'current').length} items
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-[#0F0F0F]/60">7-30 days</span>
            </div>
            <p className="text-xl font-bold">{formatPrice(summary.aging7, currency)}</p>
            <p className="text-xs text-[#0F0F0F]/50">
              {agingData.filter(d => d.agingBucket === '7-30').length} items
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-[#0F0F0F]/60">30-60 days</span>
            </div>
            <p className="text-xl font-bold">{formatPrice(summary.aging30, currency)}</p>
            <p className="text-xs text-[#0F0F0F]/50">
              {agingData.filter(d => d.agingBucket === '30-60').length} items
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl border-l-4 border-l-red-400">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-[#0F0F0F]/60">60-90 days</span>
            </div>
            <p className="text-xl font-bold">{formatPrice(summary.aging60, currency)}</p>
            <p className="text-xs text-[#0F0F0F]/50">
              {agingData.filter(d => d.agingBucket === '60-90').length} items
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl border-l-4 border-l-red-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              <span className="text-sm text-[#0F0F0F]/60">90+ days</span>
            </div>
            <p className="text-xl font-bold text-red-600">
              {formatPrice(summary.aging90Plus, currency)}
            </p>
            <p className="text-xs text-[#0F0F0F]/50">
              {agingData.filter(d => d.agingBucket === '90+').length} items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Total Summary */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl bg-gray-50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-[#0F0F0F]/60" />
            <span className="font-medium">Total {getReportTitle()}</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatPrice(summary.total, currency)}</p>
            <p className="text-sm text-[#0F0F0F]/60">{agingData.length} total items</p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>{getReportTitle()} Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agingData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm text-[#0F0F0F]/60">
                    {item.email || '-'}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatPrice(item.amount, currency)}
                  </TableCell>
                  <TableCell>
                    {item.date.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={item.daysAged > 30 ? 'text-red-600 font-medium' : ''}>
                      {item.daysAged}
                    </span>
                  </TableCell>
                  <TableCell>{getAgingBadge(item.agingBucket)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {agingData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#0F0F0F]/60">
                    No outstanding items found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Aging Distribution Chart */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Aging Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-full rounded-lg overflow-hidden flex">
            {summary.total > 0 && (
              <>
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${(summary.current / summary.total) * 100}%` }}
                  title={`Current: ${formatPrice(summary.current, currency)}`}
                />
                <div
                  className="bg-yellow-500 h-full transition-all"
                  style={{ width: `${(summary.aging7 / summary.total) * 100}%` }}
                  title={`7-30 days: ${formatPrice(summary.aging7, currency)}`}
                />
                <div
                  className="bg-orange-500 h-full transition-all"
                  style={{ width: `${(summary.aging30 / summary.total) * 100}%` }}
                  title={`30-60 days: ${formatPrice(summary.aging30, currency)}`}
                />
                <div
                  className="bg-red-400 h-full transition-all"
                  style={{ width: `${(summary.aging60 / summary.total) * 100}%` }}
                  title={`60-90 days: ${formatPrice(summary.aging60, currency)}`}
                />
                <div
                  className="bg-red-600 h-full transition-all"
                  style={{ width: `${(summary.aging90Plus / summary.total) * 100}%` }}
                  title={`90+ days: ${formatPrice(summary.aging90Plus, currency)}`}
                />
              </>
            )}
          </div>
          <div className="flex justify-between mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span>7-30 days</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>30-60 days</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-400" />
              <span>60-90 days</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-600" />
              <span>90+ days</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
