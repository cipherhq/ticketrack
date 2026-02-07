import { useState, useEffect } from 'react';
import { 
  TrendingUp, DollarSign, CheckCircle, Clock, Loader2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function RevenueOverview() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenueByCurrency: {},
    totalPaidOutByCurrency: {},
    pendingPayoutsByCurrency: {},
    revenueByMonth: []
  });

  useEffect(() => {
    loadRevenueData();
    logFinanceAction('view_revenue_overview');
  }, []);

  const loadRevenueData = async () => {
    setLoading(true);
    try {
      const { data: orders } = await supabase.from('orders').select('platform_fee, created_at, currency').eq('status', 'completed');

      // Group revenue by currency
      const totalRevenueByCurrency = {};
      orders?.forEach(o => {
        const currency = o.currency || 'USD';
        totalRevenueByCurrency[currency] = (totalRevenueByCurrency[currency] || 0) + parseFloat(o.platform_fee || 0);
      });

      const { data: payouts } = await supabase.from('payouts').select('net_amount, currency').eq('status', 'completed');

      // Group paid out by currency
      const totalPaidOutByCurrency = {};
      payouts?.forEach(p => {
        const currency = p.currency || 'USD';
        totalPaidOutByCurrency[currency] = (totalPaidOutByCurrency[currency] || 0) + parseFloat(p.net_amount || 0);
      });

      const { data: pendingPayouts } = await supabase.from('payouts').select('net_amount, currency').in('status', ['pending', 'processing']);

      // Group pending by currency
      const pendingPayoutsByCurrency = {};
      pendingPayouts?.forEach(p => {
        const currency = p.currency || 'USD';
        pendingPayoutsByCurrency[currency] = (pendingPayoutsByCurrency[currency] || 0) + parseFloat(p.net_amount || 0);
      });

      const revenueByMonth = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthOrders = orders?.filter(o => {
          const d = new Date(o.created_at);
          return d >= monthStart && d <= monthEnd;
        }) || [];
        // Group by currency for this month
        const revenueByCurrency = {};
        monthOrders.forEach(o => {
          const curr = o.currency || 'USD';
          revenueByCurrency[curr] = (revenueByCurrency[curr] || 0) + parseFloat(o.platform_fee || 0);
        });
        revenueByMonth.push({
          month: monthStart.toLocaleString('default', { month: 'short', year: '2-digit' }),
          revenue: monthOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0),
          revenueByCurrency
        });
      }

      setStats({ totalRevenueByCurrency, totalPaidOutByCurrency, pendingPayoutsByCurrency, revenueByMonth });
    } catch (error) {
      console.error('Error loading revenue:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  const maxRevenue = Math.max(...stats.revenueByMonth.map(m => m.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Revenue Overview</h1>
          <p className="text-[#0F0F0F]/60">Platform financial performance</p>
        </div>
        <Button onClick={loadRevenueData} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Platform Revenue</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{formatMultiCurrencyCompact(stats.totalRevenueByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Paid Out</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{formatMultiCurrencyCompact(stats.totalPaidOutByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Payouts</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{formatMultiCurrencyCompact(stats.pendingPayoutsByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Monthly Revenue (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-64 gap-2">
            {stats.revenueByMonth.map((month, idx) => {
              const height = (month.revenue / maxRevenue) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-[#F4F6FA] rounded-t-lg relative" style={{ height: '200px' }}>
                    <div 
                      className="absolute bottom-0 w-full bg-[#2969FF] rounded-t-lg transition-all hover:bg-[#2969FF]/80"
                      style={{ height: `${Math.max(height, 3)}%` }}
                      title={formatMultiCurrencyCompact(month.revenueByCurrency)}
                    />
                  </div>
                  <p className="text-xs text-[#0F0F0F]/60 whitespace-nowrap">{month.month}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
