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
  const [currency, setCurrency] = useState('NGN');
  const [metrics, setMetrics] = useState({
    grossRevenue: 0,
    platformFees: 0,
    processingCosts: 0,
    refunds: 0,
    chargebacks: 0,
    promoterCommissions: 0,
    netRevenue: 0,
    operatingExpenses: 0,
    netProfit: 0,
    profitMargin: 0
  });
  const [dailyData, setDailyData] = useState([]);
  const [comparison, setComparison] = useState({
    grossChange: 0,
    feeChange: 0,
    profitChange: 0
  });

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

      // Fetch current period orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, platform_fee, payment_processor_fee, created_at')
        .eq('currency', currency)
        .in('status', ['completed', 'refunded'])
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString());

      // Fetch refunds
      const { data: refunds } = await supabase
        .from('refunds')
        .select('amount')
        .eq('currency', currency)
        .eq('status', 'completed')
        .gte('processed_at', startDate.toISOString());

      // Fetch chargebacks
      const { data: chargebacks } = await supabase
        .from('chargebacks')
        .select('disputed_amount, fee_amount')
        .eq('currency', currency)
        .eq('status', 'lost')
        .gte('opened_at', startDate.toISOString());

      // Fetch commissions
      const { data: commissions } = await supabase
        .from('promoter_earnings')
        .select('commission_amount')
        .eq('currency', currency)
        .gte('created_at', startDate.toISOString());

      // Fetch operating expenses
      const { data: expenses } = await supabase
        .from('platform_expenses')
        .select('amount')
        .eq('currency', currency)
        .eq('status', 'approved')
        .gte('expense_date', startDate.toISOString().split('T')[0]);

      // Calculate metrics
      const grossRevenue = orders?.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || 0;
      const platformFees = orders?.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0) || 0;
      const processingCosts = orders?.reduce((sum, o) => sum + parseFloat(o.payment_processor_fee || 0), 0) || 0;
      const totalRefunds = refunds?.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0) || 0;
      const totalChargebacks = chargebacks?.reduce((sum, c) => sum + parseFloat(c.disputed_amount || 0) + parseFloat(c.fee_amount || 0), 0) || 0;
      const totalCommissions = commissions?.reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0) || 0;

      const netRevenue = platformFees - processingCosts - totalCommissions;
      const netProfit = netRevenue - totalExpenses - totalChargebacks;
      const profitMargin = platformFees > 0 ? (netProfit / platformFees) * 100 : 0;

      setMetrics({
        grossRevenue,
        platformFees,
        processingCosts,
        refunds: totalRefunds,
        chargebacks: totalChargebacks,
        promoterCommissions: totalCommissions,
        netRevenue,
        operatingExpenses: totalExpenses,
        netProfit,
        profitMargin
      });

      // Fetch previous period for comparison
      const { data: prevOrders } = await supabase
        .from('orders')
        .select('total_amount, platform_fee')
        .eq('currency', currency)
        .in('status', ['completed', 'refunded'])
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', prevEndDate.toISOString());

      const prevGross = prevOrders?.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || 0;
      const prevFees = prevOrders?.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0) || 0;

      setComparison({
        grossChange: prevGross > 0 ? ((grossRevenue - prevGross) / prevGross) * 100 : 0,
        feeChange: prevFees > 0 ? ((platformFees - prevFees) / prevFees) * 100 : 0,
        profitChange: 0 // Would need previous period profit calculation
      });

      // Daily breakdown for chart
      const dailyMap = {};
      orders?.forEach(order => {
        const date = order.created_at.split('T')[0];
        if (!dailyMap[date]) {
          dailyMap[date] = { date, gross: 0, fees: 0, count: 0 };
        }
        dailyMap[date].gross += parseFloat(order.total_amount || 0);
        dailyMap[date].fees += parseFloat(order.platform_fee || 0);
        dailyMap[date].count += 1;
      });

      setDailyData(Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Error loading P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Metric', 'Amount', 'Currency'],
      ['Gross Revenue', metrics.grossRevenue, currency],
      ['Platform Fees', metrics.platformFees, currency],
      ['Processing Costs', metrics.processingCosts, currency],
      ['Refunds', metrics.refunds, currency],
      ['Chargebacks', metrics.chargebacks, currency],
      ['Promoter Commissions', metrics.promoterCommissions, currency],
      ['Net Revenue', metrics.netRevenue, currency],
      ['Operating Expenses', metrics.operatingExpenses, currency],
      ['Net Profit', metrics.netProfit, currency],
      ['Profit Margin (%)', metrics.profitMargin.toFixed(2), '%']
    ].map(row => row.join(',')).join('\n');

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
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Platform P&L</h1>
          <p className="text-[#0F0F0F]/60">Profit and loss overview</p>
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
              <SelectItem value="NGN">NGN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="GHS">GHS</SelectItem>
              <SelectItem value="KES">KES</SelectItem>
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
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Gross Revenue</p>
                <p className="text-2xl font-bold">{formatPrice(metrics.grossRevenue, currency)}</p>
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

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Platform Fees</p>
                <p className="text-2xl font-bold">{formatPrice(metrics.platformFees, currency)}</p>
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

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Net Profit</p>
                <p className={`text-2xl font-bold ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPrice(metrics.netProfit, currency)}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metrics.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {metrics.netProfit >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Profit Margin</p>
                <p className={`text-2xl font-bold ${metrics.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.profitMargin.toFixed(1)}%
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
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
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
                  <span className="font-medium">{formatPrice(metrics.grossRevenue, currency)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="pl-4">Platform Fees Collected</span>
                  <span className="font-medium">{formatPrice(metrics.platformFees, currency)}</span>
                </div>
              </div>
            </div>

            {/* Cost of Revenue */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3">Cost of Revenue</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Payment Processing Fees</span>
                  <span className="font-medium">-{formatPrice(metrics.processingCosts, currency)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Promoter Commissions</span>
                  <span className="font-medium">-{formatPrice(metrics.promoterCommissions, currency)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Net Revenue</span>
                  <span className={metrics.netRevenue >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatPrice(metrics.netRevenue, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-3">Operating Expenses</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Operating Expenses</span>
                  <span className="font-medium">-{formatPrice(metrics.operatingExpenses, currency)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span className="pl-4">Chargebacks & Losses</span>
                  <span className="font-medium">-{formatPrice(metrics.chargebacks, currency)}</span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="pt-2">
              <div className="flex justify-between text-xl font-bold">
                <span>Net Profit</span>
                <span className={metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatPrice(metrics.netProfit, currency)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Gross Volume</th>
                  <th className="text-right py-2">Platform Fees</th>
                  <th className="text-right py-2">Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.slice(-14).map((day) => (
                  <tr key={day.date} className="border-b last:border-0">
                    <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                    <td className="text-right">{day.count}</td>
                    <td className="text-right">{formatPrice(day.gross, currency)}</td>
                    <td className="text-right text-green-600">{formatPrice(day.fees, currency)}</td>
                    <td className="text-right">{formatPrice(day.gross / day.count, currency)}</td>
                  </tr>
                ))}
                {dailyData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#0F0F0F]/60">
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
