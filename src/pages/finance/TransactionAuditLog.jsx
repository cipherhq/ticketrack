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
  Loader2, Search, Download, ArrowUpRight, ArrowDownRight,
  Filter, Calendar
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

const TRANSACTION_TYPES = [
  'ticket_sale',
  'donation',
  'platform_fee_collected',
  'payment_processor_fee',
  'promoter_commission',
  'affiliate_commission',
  'organizer_payout',
  'refund_issued',
  'chargeback_debit',
  'chargeback_reversal',
  'manual_adjustment'
];

export function TransactionAuditLog() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadTransactions();
    logFinanceAction('view_audit_log');
  }, [typeFilter, page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('financial_transactions_log')
        .select(`
          *,
          organizers (business_name),
          events (title)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (typeFilter !== 'all') {
        query = query.eq('transaction_type', typeFilter);
      }

      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start);
      }

      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end + 'T23:59:59');
      }

      const { data, error, count } = await query;

      if (error) throw error;
      setTransactions(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      let query = supabase
        .from('financial_transactions_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (typeFilter !== 'all') {
        query = query.eq('transaction_type', typeFilter);
      }

      const { data } = await query;

      if (!data) return;

      const csv = [
        ['Date', 'Type', 'Description', 'Debit', 'Credit', 'Currency', 'Reference'].join(','),
        ...data.map(t => [
          new Date(t.created_at).toISOString(),
          t.transaction_type,
          `"${t.description || ''}"`,
          t.debit_amount || 0,
          t.credit_amount || 0,
          t.currency,
          t.provider_reference || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      logFinanceAction('export_audit_log');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const getTypeColor = (type) => {
    if (type.includes('sale') || type.includes('revenue')) return 'bg-green-100 text-green-800';
    if (type.includes('fee') || type.includes('commission')) return 'bg-blue-100 text-blue-800';
    if (type.includes('payout')) return 'bg-purple-100 text-purple-800';
    if (type.includes('refund') || type.includes('chargeback')) return 'bg-red-100 text-red-800';
    return 'bg-muted text-foreground';
  };

  const formatType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredTransactions = transactions.filter(t =>
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    t.organizers?.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.provider_reference?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / pageSize);

  if (loading && page === 1) {
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
          <h1 className="text-2xl font-bold text-foreground">Transaction Audit Log</h1>
          <p className="text-muted-foreground">Complete trail of all financial movements</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="rounded-xl">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px] rounded-xl">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TRANSACTION_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{formatType(type)}</SelectItem>
                ))}
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
              <Button onClick={loadTransactions} size="sm" className="rounded-xl">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Transactions ({totalCount.toLocaleString()})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Provider</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm">
                    <div>{new Date(tx.created_at).toLocaleDateString()}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(tx.transaction_type)}>
                      {formatType(tx.transaction_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate">
                    {tx.description || '-'}
                  </TableCell>
                  <TableCell>{tx.organizers?.business_name || '-'}</TableCell>
                  <TableCell className="text-right">
                    {tx.debit_amount > 0 && (
                      <span className="flex items-center justify-end text-red-600">
                        <ArrowDownRight className="w-4 h-4 mr-1" />
                        {formatPrice(tx.debit_amount, tx.currency)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.credit_amount > 0 && (
                      <span className="flex items-center justify-end text-green-600">
                        <ArrowUpRight className="w-4 h-4 mr-1" />
                        {formatPrice(tx.credit_amount, tx.currency)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {tx.payment_provider || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
