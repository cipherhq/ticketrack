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
  Loader2, TrendingUp, TrendingDown, DollarSign, Percent,
  Download, RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function PlatformPnL() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [currency, setCurrency] = useState('ALL');
  const [metricsByCurrency, setMetricsByCurrency] = useState({});
  const [dailyData, setDailyData] = useState([]);
  const [comparison, setComparison] = useState({
    grossChange: 0,
    feeChange: 0,
    profitChange: 0
  });

  // Helper to format multi-currency display
  const formatMultiCurrency = (metricKey) => {
    if (currency !== 'ALL') {
      const val = metricsByCurrency[currency]?.[metricKey] || 0;
      return formatPrice(val, currency);
    }
    const entries = Object.entries(metricsByCurrency)
      .filter(([_, m]) => m[metricKey] !== 0)
      .map(([curr, m]) => formatPrice(m[metricKey], curr));
    return entries.length > 0 ? entries.join(' · ') : formatPrice(0, 'USD');
  };

  // Get total for a metric across all currencies (for margin calculation)
  const getTotalMetric = (metricKey) => {
    if (currency !== 'ALL') {
      return metricsByCurrency[currency]?.[metricKey] || 0;
    }
    return Object.values(metricsByCurrency).reduce((sum, m) => sum + (m[metricKey] || 0), 0);
  };

  useEffect(() => {
    loadPnLData();
    logFinanceAction('view_platform_pnl');
  }, [period, currency]);

  const loadPnLData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate, prevStartDate, prevEndDate;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          prevEndDate = startDate;
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevEndDate = startDate;
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          prevStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
          prevEndDate = startDate;
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
          prevEndDate = startDate;
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevEndDate = startDate;
      }

      // Fetch current period orders (all currencies or filtered)
      let ordersQuery = supabase
        .from('orders')
        .select('total_amount, platform_fee, payment_processor_fee, created_at, currency')
        .in('status', ['completed'])
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString());

      if (currency !== 'ALL') {
        ordersQuery = ordersQuery.eq('currency', currency);
      }

      const { data: orders } = await ordersQuery;

      // Fetch chargebacks
      let chargebacksQuery = supabase
        .from('chargebacks')
        .select('disputed_amount, fee_amount, currency')
        .eq('status', 'lost')
        .gte('opened_at', startDate.toISOString());

      if (currency !== 'ALL') {
        chargebacksQuery = chargebacksQuery.eq('currency', currency);
      }

      const { data: chargebacks } = await chargebacksQuery;

      // Fetch commissions from promoter_sales (the actual table)
      let commissionsQuery = supabase
        .from('promoter_sales')
        .select('commission_amount, currency')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString());

      if (currency !== 'ALL') {
        commissionsQuery = commissionsQuery.eq('currency', currency);
      }

      const { data: commissions } = await commissionsQuery;

      // Fetch operating expenses
      let expensesQuery = supabase
        .from('platform_expenses')
        .select('amount, currency')
        .eq('status', 'approved')
        .gte('expense_date', startDate.toISOString().split('T')[0]);

      if (currency !== 'ALL') {
        expensesQuery = expensesQuery.eq('currency', currency);
      }

      const { data: expenses } = await expensesQuery;

      // Group metrics by currency
      const currencyMetrics = {};

      // Process orders
      orders?.forEach(o => {
        const curr = o.currency || 'USD';
        if (!currencyMetrics[curr]) {
          currencyMetrics[curr] = {
            grossRevenue: 0, platformFees: 0, processingCosts: 0,
            chargebacks: 0, promoterCommissions: 0, operatingExpenses: 0,
            netRevenue: 0, netProfit: 0, profitMargin: 0
          };
        }
        currencyMetrics[curr].grossRevenue += parseFloat(o.total_amount || 0);
        currencyMetrics[curr].platformFees += parseFloat(o.platform_fee || 0);
        currencyMetrics[curr].processingCosts += parseFloat(o.payment_processor_fee || 0);
      });

      // Process chargebacks
      chargebacks?.forEach(c => {
        const curr = c.currency || 'USD';
        if (currencyMetrics[curr]) {
          currencyMetrics[curr].chargebacks += parseFloat(c.disputed_amount || 0) + parseFloat(c.fee_amount || 0);
        }
      });

      // Process commissions
      commissions?.forEach(c => {
        const curr = c.currency || 'USD';
        if (currencyMetrics[curr]) {
          currencyMetrics[curr].promoterCommissions += parseFloat(c.commission_amount || 0);
        }
      });

      // Process expenses
      expenses?.forEach(e => {
        const curr = e.currency || 'NGN';
        if (!currencyMetrics[curr]) {
          currencyMetrics[curr] = {
            grossRevenue: 0, platformFees: 0, processingCosts: 0,
            chargebacks: 0, promoterCommissions: 0, operatingExpenses: 0,
            netRevenue: 0, netProfit: 0, profitMargin: 0
          };
        }
        currencyMetrics[curr].operatingExpenses += parseFloat(e.amount || 0);
      });

      // Calculate derived metrics per currency
      Object.keys(currencyMetrics).forEach(curr => {
        const m = currencyMetrics[curr];
        m.netRevenue = m.platformFees - m.processingCosts;
        m.netProfit = m.netRevenue - m.operatingExpenses - m.chargebacks;
        m.profitMargin = m.platformFees > 0 ? (m.netProfit / m.platformFees) * 100 : 0;
      });

      setMetricsByCurrency(currencyMetrics);

      // Fetch previous period for comparison
      let prevQuery = supabase
        .from('orders')
        .select('total_amount, platform_fee')
        .in('status', ['completed'])
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', prevEndDate.toISOString());

      if (currency !== 'ALL') {
        prevQuery = prevQuery.eq('currency', currency);
      }

      const { data: prevOrders } = await prevQuery;

      const prevGross = prevOrders?.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || 0;
      const prevFees = prevOrders?.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0) || 0;
      const currentGross = getTotalMetric('grossRevenue');
      const currentFees = getTotalMetric('platformFees');

      setComparison({
        grossChange: prevGross > 0 ? ((currentGross - prevGross) / prevGross) * 100 : 0,
        feeChange: prevFees > 0 ? ((currentFees - prevFees) / prevFees) * 100 : 0,
        profitChange: 0
      });

      // Daily breakdown for chart (grouped by date and currency)
      const dailyMap = {};
      orders?.forEach(order => {
        const date = order.created_at.split('T')[0];
        const curr = order.currency || 'USD';
        const key = `${date}-${curr}`;
        if (!dailyMap[key]) {
          dailyMap[key] = { date, currency: curr, gross: 0, fees: 0, count: 0 };
        }
        dailyMap[key].gross += parseFloat(order.total_amount || 0);
        dailyMap[key].fees += parseFloat(order.platform_fee || 0);
        dailyMap[key].count += 1;
      });

      setDailyData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Error loading P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const rows = [['Currency', 'Metric', 'Amount']];

    Object.entries(metricsByCurrency).forEach(([curr, m]) => {
      rows.push([curr, 'Gross Revenue', m.grossRevenue]);
      rows.push([curr, 'Platform Fees', m.platformFees]);
      rows.push([curr, 'Processing Costs', m.processingCosts]);
      rows.push([curr, 'Chargebacks', m.chargebacks]);
      rows.push([curr, 'Promoter Commissions', m.promoterCommissions]);
      rows.push([curr, 'Net Revenue', m.netRevenue]);
      rows.push([curr, 'Operating Expenses', m.operatingExpenses]);
      rows.push([curr, 'Net Profit', m.netProfit]);
      rows.push([curr, 'Profit Margin (%)', m.profitMargin.toFixed(2)]);
      rows.push(['', '', '']); // Empty row between currencies
    });

    const csv = rows.map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-pnl-${period}-${currency}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logFinanceAction('export_platform_pnl');
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
          <h1 className="text-2xl font-bold text-foreground">Platform P&L</h1>
          <p className="text-muted-foreground">Profit and loss overview</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[100px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="NGN">NGN</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="GHS">GHS</SelectItem>
              <SelectItem value="KES">KES</SelectItem>
              <SelectItem value="CAD">CAD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadPnLData} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={handleExport} className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gross Revenue</p>
                <p className="text-xl font-bold">{formatMultiCurrency('grossRevenue')}</p>
                {comparison.grossChange !== 0 && (
                  <div className={`flex items-center text-sm mt-1 ${comparison.grossChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {comparison.grossChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(comparison.grossChange).toFixed(1)}% vs prev
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Fees</p>
                <p className="text-xl font-bold text-green-600">{formatMultiCurrency('platformFees')}</p>
                {comparison.feeChange !== 0 && (
                  <div className={`flex items-center text-sm mt-1 ${comparison.feeChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {comparison.feeChange > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(comparison.feeChange).toFixed(1)}% vs prev
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-xl font-bold ${getTotalMetric('netProfit') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMultiCurrency('netProfit')}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTotalMetric('netProfit') >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {getTotalMetric('netProfit') >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Profit Margin</p>
                <p className={`text-2xl font-bold ${getTotalMetric('platformFees') > 0 ? (getTotalMetric('netProfit') / getTotalMetric('platformFees') * 100 >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                  {getTotalMetric('platformFees') > 0
                    ? (getTotalMetric('netProfit') / getTotalMetric('platformFees') * 100).toFixed(1)
                    : '0.0'}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Percent className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Profit & Loss Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Revenue Section */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3">Revenue</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Gross Transaction Volume</span>
                  <span className="font-medium">{formatMultiCurrency('grossRevenue')}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="pl-4">Platform Fees Collected</span>
                  <span className="font-medium">{formatMultiCurrency('platformFees')}</span>
                </div>
              </div>
            </div>

            {/* Cost of Revenue */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3">Cost of Revenue</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Payment Processing Fees</span>
                  <span className="font-medium">-{formatMultiCurrency('processingCosts')}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Net Revenue</span>
                  <span className={getTotalMetric('netRevenue') >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatMultiCurrency('netRevenue')}
                  </span>
                </div>
              </div>
            </div>

            {/* Organizer Costs (paid from organizer share, not platform revenue) */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3">Organizer Payouts</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span className="pl-4">Promoter Commissions (from organizer share)</span>
                  <span className="font-medium">{formatMultiCurrency('promoterCommissions')}</span>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3">Operating Expenses</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Operating Expenses</span>
                  <span className="font-medium">-{formatMultiCurrency('operatingExpenses')}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Chargebacks & Losses</span>
                  <span className="font-medium">-{formatMultiCurrency('chargebacks')}</span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="pt-2">
              <div className="flex justify-between text-xl font-bold">
                <span>Net Profit</span>
                <span className={getTotalMetric('netProfit') >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatMultiCurrency('netProfit')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Currency</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Gross Volume</th>
                  <th className="text-right py-2">Platform Fees</th>
                  <th className="text-right py-2">Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.slice(-30).map((day, idx) => (
                  <tr key={`${day.date}-${day.currency}-${idx}`} className="border-b last:border-0">
                    <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-xs">{day.currency}</Badge>
                    </td>
                    <td className="text-right">{day.count}</td>
                    <td className="text-right">{formatPrice(day.gross, day.currency)}</td>
                    <td className="text-right text-green-600">{formatPrice(day.fees, day.currency)}</td>
                    <td className="text-right">{formatPrice(day.gross / day.count, day.currency)}</td>
                  </tr>
                ))}
                {dailyData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No data for selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
