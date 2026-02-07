import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2, Search, AlertTriangle, Clock, CheckCircle,
  XCircle, Eye, TrendingDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function ChargebacksManagement() {
  const navigate = useNavigate();
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [chargebacks, setChargebacks] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    won: 0,
    lost: 0,
    totalAmountByCurrency: {},
    pendingAmountByCurrency: {}
  });

  useEffect(() => {
    loadChargebacks();
    logFinanceAction('view_chargebacks');
  }, [statusFilter, providerFilter]);

  const loadChargebacks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('chargebacks')
        .select(`
          *,
          organizers (id, business_name),
          events (id, title),
          orders (id, order_number, buyer_email)
        `)
        .order('opened_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (providerFilter !== 'all') {
        query = query.eq('payment_provider', providerFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setChargebacks(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const pending = data?.filter(c => ['opened', 'needs_response', 'under_review'].includes(c.status)).length || 0;
      const won = data?.filter(c => c.status === 'won').length || 0;
      const lost = data?.filter(c => c.status === 'lost').length || 0;

      // Group by currency
      const totalAmountByCurrency = {};
      const pendingAmountByCurrency = {};
      data?.forEach(c => {
        const currency = c.currency || 'USD';
        const amount = parseFloat(c.disputed_amount || 0);
        totalAmountByCurrency[currency] = (totalAmountByCurrency[currency] || 0) + amount;
        if (['opened', 'needs_response', 'under_review'].includes(c.status)) {
          pendingAmountByCurrency[currency] = (pendingAmountByCurrency[currency] || 0) + amount;
        }
      });

      setStats({ total, pending, won, lost, totalAmountByCurrency, pendingAmountByCurrency });
    } catch (error) {
      console.error('Error loading chargebacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      opened: 'bg-yellow-100 text-yellow-800',
      needs_response: 'bg-orange-100 text-orange-800',
      under_review: 'bg-blue-100 text-blue-800',
      won: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
      withdrawn: 'bg-purple-100 text-purple-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status.replace('_', ' ')}</Badge>;
  };

  const getEvidenceDueStatus = (dueDate) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
    } else if (daysLeft <= 3) {
      return <Badge className="bg-orange-100 text-orange-800">{daysLeft} days left</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">{daysLeft} days left</Badge>;
    }
  };

  const filteredChargebacks = chargebacks.filter(c =>
    c.organizers?.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.orders?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.provider_dispute_id?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F]">Chargebacks & Disputes</h1>
        <p className="text-[#0F0F0F]/60">Manage payment disputes and chargebacks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-[#0F0F0F]/50">{formatMultiCurrencyCompact(stats.pendingAmountByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Won</p>
                <p className="text-2xl font-bold">{stats.won}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Lost</p>
                <p className="text-2xl font-bold">{stats.lost}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Disputed</p>
                <p className="text-2xl font-bold">{formatMultiCurrencyCompact(stats.totalAmountByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Actions Alert */}
      {stats.pending > 0 && (
        <Card className="border-orange-200 bg-orange-50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <p className="text-orange-800">
                <span className="font-semibold">{stats.pending} disputes</span> require attention
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search by organizer, order, or dispute ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="needs_response">Needs Response</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[140px] rounded-xl">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paystack">Paystack</SelectItem>
                <SelectItem value="flutterwave">Flutterwave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Chargebacks Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Disputes ({filteredChargebacks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opened</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Evidence Due</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChargebacks.map((cb) => (
                <TableRow key={cb.id}>
                  <TableCell className="text-sm">
                    {new Date(cb.opened_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{cb.payment_provider}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {cb.organizers?.business_name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono">
                      {cb.orders?.order_number || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-red-600">
                    {formatPrice(cb.disputed_amount, cb.currency)}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {cb.reason || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(cb.status)}</TableCell>
                  <TableCell>
                    {cb.status === 'needs_response' && getEvidenceDueStatus(cb.evidence_due_by)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/finance/chargebacks/${cb.id}`)}
                      className="rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredChargebacks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-[#0F0F0F]/60">
                    No chargebacks found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
