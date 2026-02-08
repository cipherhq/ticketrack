import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, DollarSign, Clock, CheckCircle, Users,
  Calendar, ArrowRight, Loader2, AlertCircle, Shield,
  FileText, Lock, BarChart3, Receipt
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

// Helper to format currency object as multi-currency string
const formatCurrencyBreakdown = (currencyObj) => {
  if (!currencyObj || Object.keys(currencyObj).length === 0) {
    return 'Free';
  }

  const entries = Object.entries(currencyObj).filter(([_, amount]) => amount > 0);
  if (entries.length === 0) return 'Free';

  return entries.map(([currency, amount]) => formatPrice(amount, currency)).join(' · ');
};

export function FinanceDashboard() {
  const navigate = useNavigate();
  const { financeUser, logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenueByCurrency: {},
    pendingPayoutsByCurrency: {},
    completedPayoutsByCurrency: {},
    pendingEventCount: 0,
    pendingApprovals: 0,
    openChargebacks: 0,
    escrowByCurrency: {},
    recentPayouts: []
  });

  useEffect(() => {
    loadDashboardData();
    logFinanceAction('view_dashboard');
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Total platform revenue by currency
      const { data: orders } = await supabase
        .from('orders')
        .select('platform_fee, currency')
        .eq('status', 'completed');

      const revenueByCurrency = {};
      orders?.forEach(o => {
        const currency = o.currency || 'NGN';
        const fee = parseFloat(o.platform_fee || 0);
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + fee;
      });

      // Pending events count (ended but not paid)
      const now = new Date().toISOString();
      const { data: pendingEvents, count } = await supabase
        .from('events')
        .select('id', { count: 'exact' })
        .lt('end_date', now)
        .neq('payout_status', 'paid');

      // Completed payouts by currency
      const { data: completedPayouts } = await supabase
        .from('payouts')
        .select('net_amount, currency')
        .eq('status', 'completed');

      const completedPayoutsByCurrency = {};
      completedPayouts?.forEach(p => {
        const currency = p.currency || 'NGN';
        const amount = parseFloat(p.net_amount || 0);
        completedPayoutsByCurrency[currency] = (completedPayoutsByCurrency[currency] || 0) + amount;
      });

      // Pending payouts by currency
      const { data: pendingPayoutsData } = await supabase
        .from('payouts')
        .select('net_amount, currency')
        .in('status', ['pending', 'processing']);

      const pendingPayoutsByCurrency = {};
      pendingPayoutsData?.forEach(p => {
        const currency = p.currency || 'NGN';
        const amount = parseFloat(p.net_amount || 0);
        pendingPayoutsByCurrency[currency] = (pendingPayoutsByCurrency[currency] || 0) + amount;
      });

      // Recent payout activity
      const { data: recentPayouts } = await supabase
        .from('payouts')
        .select('*, organizers(business_name)')
        .eq('status', 'completed')
        .order('processed_at', { ascending: false })
        .limit(5);

      // Pending approvals
      const { count: approvalCount } = await supabase
        .from('payout_approval_requests')
        .select('id', { count: 'exact' })
        .eq('status', 'pending');

      // Open chargebacks
      const { count: chargebackCount } = await supabase
        .from('chargebacks')
        .select('id', { count: 'exact' })
        .in('status', ['opened', 'needs_response', 'under_review']);

      // Escrow balance by currency
      const { data: escrowData } = await supabase
        .from('escrow_balances')
        .select('available_balance, currency')
        .in('status', ['pending', 'eligible']);

      const escrowByCurrency = {};
      escrowData?.forEach(e => {
        const currency = e.currency || 'NGN';
        const amount = parseFloat(e.available_balance || 0);
        escrowByCurrency[currency] = (escrowByCurrency[currency] || 0) + amount;
      });

      setStats({
        revenueByCurrency,
        pendingPayoutsByCurrency,
        completedPayoutsByCurrency,
        pendingEventCount: count || 0,
        pendingApprovals: approvalCount || 0,
        openChargebacks: chargebackCount || 0,
        escrowByCurrency,
        recentPayouts: recentPayouts || []
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {financeUser?.email}</p>
      </div>

      {/* Alert for pending payouts */}
      {stats.pendingEventCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-800">
                <span className="font-semibold">{stats.pendingEventCount} events</span> have ended and are awaiting payout
              </p>
            </div>
            <Button 
              onClick={() => navigate('/finance/payouts/events')}
              className="bg-yellow-600 hover:bg-yellow-700 rounded-xl"
            >
              Process Payouts
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Platform Revenue</p>
                <p className="text-xl font-bold text-foreground">{formatCurrencyBreakdown(stats.revenueByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-xl font-bold text-foreground">{formatCurrencyBreakdown(stats.pendingPayoutsByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid Out</p>
                <p className="text-xl font-bold text-foreground">{formatCurrencyBreakdown(stats.completedPayoutsByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Events</p>
                <p className="text-2xl font-bold text-foreground">{stats.pendingEventCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="border-border/10 rounded-2xl">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-between rounded-xl h-14"
              onClick={() => navigate('/finance/payouts/events')}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#2969FF]" />
                <span>Process Event Payouts</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">{stats.pendingEventCount} pending</Badge>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-between rounded-xl h-14"
              onClick={() => navigate('/finance/payouts/affiliates')}
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span>Process Affiliate Payouts</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl h-14"
              onClick={() => navigate('/finance/revenue/overview')}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span>View Revenue Reports</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl h-14"
              onClick={() => navigate('/finance/approvals')}
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-orange-600" />
                <span>Pending Approvals</span>
              </div>
              {stats.pendingApprovals > 0 && (
                <Badge className="bg-orange-100 text-orange-800">{stats.pendingApprovals}</Badge>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl h-14"
              onClick={() => navigate('/finance/chargebacks')}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>Chargebacks & Disputes</span>
              </div>
              {stats.openChargebacks > 0 && (
                <Badge className="bg-red-100 text-red-800">{stats.openChargebacks}</Badge>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Payouts */}
        <Card className="border-border/10 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Payouts</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/finance/payouts/history')}
              className="text-[#2969FF]"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentPayouts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payouts yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentPayouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div>
                      <p className="font-medium text-foreground">{payout.organizers?.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payout.processed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatPrice(payout.net_amount, payout.currency || getDefaultCurrency(payout.country_code || payout.country))}</p>
                      <Badge className="bg-green-100 text-green-800 text-xs">Paid</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Finance Tools Grid */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Finance Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/escrow')}
            >
              <Lock className="w-5 h-5 text-blue-600" />
              <span className="text-xs">Escrow</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/batching')}
            >
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-xs">Batching</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/pnl')}
            >
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <span className="text-xs">P&L</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/settlements')}
            >
              <CheckCircle className="w-5 h-5 text-teal-600" />
              <span className="text-xs">Settlements</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/invoices')}
            >
              <FileText className="w-5 h-5 text-indigo-600" />
              <span className="text-xs">Invoices</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/audit-log')}
            >
              <Receipt className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs">Audit Log</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/expenses')}
            >
              <DollarSign className="w-5 h-5 text-red-600" />
              <span className="text-xs">Expenses</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/forecast')}
            >
              <TrendingUp className="w-5 h-5 text-cyan-600" />
              <span className="text-xs">Forecast</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/aging')}
            >
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-xs">Aging</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-auto py-4 rounded-xl"
              onClick={() => navigate('/finance/bank-reconciliation')}
            >
              <Calendar className="w-5 h-5 text-pink-600" />
              <span className="text-xs">Bank Recon</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Escrow Summary */}
      {Object.keys(stats.escrowByCurrency).length > 0 && Object.values(stats.escrowByCurrency).some(v => v > 0) && (
        <Card className="border-border/10 rounded-2xl bg-blue-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">Escrow Balance</p>
                <p className="text-xl font-bold text-blue-900">{formatCurrencyBreakdown(stats.escrowByCurrency)}</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/finance/escrow')}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              Manage Escrow
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
