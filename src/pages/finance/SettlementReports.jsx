import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Download, Calendar, ArrowUpDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function SettlementReports() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [stats, setStats] = useState({
    totalSettlements: 0,
    reconciledCount: 0,
    unreconciledCount: 0,
    discrepancyByCurrency: {}
  });

  useEffect(() => {
    loadSettlements();
    logFinanceAction('view_settlement_reports');
  }, [providerFilter, statusFilter]);

  const loadSettlements = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('provider_settlements')
        .select('*')
        .order('settlement_date', { ascending: false });

      if (providerFilter !== 'all') {
        query = query.eq('provider', providerFilter);
      }

      if (statusFilter === 'reconciled') {
        query = query.eq('is_reconciled', true);
      } else if (statusFilter === 'unreconciled') {
        query = query.eq('is_reconciled', false);
      } else if (statusFilter === 'discrepancy') {
        query = query.neq('discrepancy', 0);
      }

      if (dateRange.start) {
        query = query.gte('settlement_date', dateRange.start);
      }

      if (dateRange.end) {
        query = query.lte('settlement_date', dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSettlements(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const reconciled = data?.filter(s => s.is_reconciled).length || 0;
      const unreconciled = total - reconciled;

      // Group discrepancy by currency
      const discrepancyByCurrency = {};
      data?.forEach(s => {
        const currency = s.currency || 'USD';
        const discrepancy = Math.abs(parseFloat(s.discrepancy || 0));
        discrepancyByCurrency[currency] = (discrepancyByCurrency[currency] || 0) + discrepancy;
      });

      setStats({
        totalSettlements: total,
        reconciledCount: reconciled,
        unreconciledCount: unreconciled,
        discrepancyByCurrency
      });
    } catch (error) {
      console.error('Error loading settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSettlements = async (provider) => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('sync-provider-settlements', {
        body: { provider: provider || 'all' }
      });

      if (response.error) throw response.error;

      logFinanceAction('sync_settlements', { provider });
      loadSettlements();
    } catch (error) {
      console.error('Error syncing settlements:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleReconcile = async (settlementId) => {
    try {
      await supabase
        .from('provider_settlements')
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString()
        })
        .eq('id', settlementId);

      logFinanceAction('reconcile_settlement', { settlement_id: settlementId });
      loadSettlements();
    } catch (error) {
      console.error('Error reconciling:', error);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'Provider', 'Settlement ID', 'Provider Gross', 'Provider Fees', 'Provider Net', 'Our Gross', 'Our Net', 'Discrepancy', 'Status', 'Currency'].join(','),
      ...settlements.map(s => [
        s.settlement_date,
        s.provider,
        s.settlement_id,
        s.provider_gross,
        s.provider_fees,
        s.provider_net,
        s.our_gross,
        s.our_net,
        s.discrepancy,
        s.is_reconciled ? 'Reconciled' : 'Pending',
        s.currency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logFinanceAction('export_settlements');
  };

  const getProviderColor = (provider) => {
    const colors = {
      stripe: 'bg-purple-100 text-purple-800',
      paystack: 'bg-blue-100 text-blue-800',
      flutterwave: 'bg-orange-100 text-orange-800'
    };
    return colors[provider] || 'bg-muted text-foreground';
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
          <h1 className="text-2xl font-bold text-foreground">Settlement Reports</h1>
          <p className="text-muted-foreground">Reconcile payments with provider settlements</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSyncSettlements()}
            disabled={syncing}
            className="rounded-xl"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync All
          </Button>
          <Button variant="outline" onClick={handleExport} className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <ArrowUpDown className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Settlements</p>
                <p className="text-2xl font-bold">{stats.totalSettlements}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reconciled</p>
                <p className="text-2xl font-bold">{stats.reconciledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.unreconciledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Discrepancy</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatMultiCurrencyCompact(stats.discrepancyByCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[150px] rounded-xl">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
                <SelectItem value="flutterwave">Flutterwave</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="unreconciled">Pending</SelectItem>
                <SelectItem value="discrepancy">Has Discrepancy</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-[140px] rounded-xl"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-[140px] rounded-xl"
              />
              <Button onClick={loadSettlements} size="sm" className="rounded-xl">
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlements Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Settlement Records ({settlements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Settlement ID</TableHead>
                <TableHead className="text-right">Provider Net</TableHead>
                <TableHead className="text-right">Our Records</TableHead>
                <TableHead className="text-right">Discrepancy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell>
                    {new Date(settlement.settlement_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getProviderColor(settlement.provider)}>
                      {settlement.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {settlement.settlement_id || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(settlement.provider_net, settlement.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(settlement.our_net, settlement.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {settlement.discrepancy !== 0 ? (
                      <span className={parseFloat(settlement.discrepancy) > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatPrice(settlement.discrepancy, settlement.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {settlement.is_reconciled ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Reconciled
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!settlement.is_reconciled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReconcile(settlement.id)}
                        className="rounded-lg"
                      >
                        Reconcile
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {settlements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No settlement records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Provider Sync Status */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Provider Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['stripe', 'paystack', 'flutterwave'].map((provider) => {
              const providerSettlements = settlements.filter(s => s.provider === provider);
              const lastSync = providerSettlements[0]?.settlement_date;
              const pendingCount = providerSettlements.filter(s => !s.is_reconciled).length;

              return (
                <Card key={provider} className="border rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={getProviderColor(provider)}>
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSyncSettlements(provider)}
                        disabled={syncing}
                        className="rounded-lg"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Settlement:</span>
                        <span>{lastSync ? new Date(lastSync).toLocaleDateString() : 'Never'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Records:</span>
                        <span>{providerSettlements.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pending:</span>
                        <span className={pendingCount > 0 ? 'text-yellow-600' : 'text-green-600'}>
                          {pendingCount}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
