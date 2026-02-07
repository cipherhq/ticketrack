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
  Loader2, Search, Lock, Unlock, DollarSign, Clock,
  CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function EscrowManagement() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [escrows, setEscrows] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [stats, setStats] = useState({
    totalPending: 0,
    totalEligible: 0,
    totalHeld: 0,
    currencies: []
  });

  useEffect(() => {
    loadEscrowData();
    logFinanceAction('view_escrow_management');
  }, [statusFilter, currencyFilter]);

  const loadEscrowData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('escrow_balances')
        .select(`
          *,
          organizers (id, business_name, email),
          events (id, title)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (currencyFilter !== 'all') {
        query = query.eq('currency', currencyFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEscrows(data || []);

      // Calculate stats
      const pending = data?.filter(e => e.status === 'pending').reduce((sum, e) => sum + parseFloat(e.available_balance || 0), 0) || 0;
      const eligible = data?.filter(e => e.status === 'eligible').reduce((sum, e) => sum + parseFloat(e.available_balance || 0), 0) || 0;
      const held = data?.filter(e => e.status === 'hold').reduce((sum, e) => sum + parseFloat(e.available_balance || 0), 0) || 0;

      const currencies = [...new Set(data?.map(e => e.currency) || [])];

      setStats({ totalPending: pending, totalEligible: eligible, totalHeld: held, currencies });
    } catch (error) {
      console.error('Error loading escrow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHoldEscrow = async (escrowId, reason) => {
    try {
      await supabase
        .from('escrow_balances')
        .update({
          status: 'hold',
          hold_reason: reason || 'Manual hold',
          held_at: new Date().toISOString()
        })
        .eq('id', escrowId);

      logFinanceAction('hold_escrow', { escrow_id: escrowId });
      loadEscrowData();
    } catch (error) {
      console.error('Error holding escrow:', error);
    }
  };

  const handleReleaseHold = async (escrowId) => {
    try {
      await supabase
        .from('escrow_balances')
        .update({
          status: 'eligible',
          hold_reason: null,
          held_at: null,
          held_by: null
        })
        .eq('id', escrowId);

      logFinanceAction('release_escrow_hold', { escrow_id: escrowId });
      loadEscrowData();
    } catch (error) {
      console.error('Error releasing hold:', error);
    }
  };

  const handleProcessPayout = async (escrowId) => {
    try {
      const { data, error } = await supabase.rpc('queue_payout_from_escrow', {
        p_escrow_id: escrowId
      });

      if (error) throw error;

      logFinanceAction('queue_escrow_payout', { escrow_id: escrowId, result: data });
      loadEscrowData();
    } catch (error) {
      console.error('Error processing payout:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      eligible: 'bg-green-100 text-green-800',
      hold: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
      paid: 'bg-gray-100 text-gray-800',
      disputed: 'bg-orange-100 text-orange-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const filteredEscrows = escrows.filter(e =>
    e.organizers?.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.events?.title?.toLowerCase().includes(search.toLowerCase())
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Escrow Management</h1>
          <p className="text-[#0F0F0F]/60">Manage organizer funds held in escrow</p>
        </div>
        <Button onClick={loadEscrowData} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Escrow</p>
                <p className="text-2xl font-bold">{formatPrice(stats.totalPending, 'NGN')}</p>
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
                <p className="text-sm text-[#0F0F0F]/60">Ready for Payout</p>
                <p className="text-2xl font-bold">{formatPrice(stats.totalEligible, 'NGN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">On Hold</p>
                <p className="text-2xl font-bold">{formatPrice(stats.totalHeld, 'NGN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search organizer or event..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="hold">On Hold</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-[120px] rounded-xl">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {stats.currencies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Escrow Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Escrow Balances ({filteredEscrows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizer</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Eligible Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEscrows.map((escrow) => (
                <TableRow key={escrow.id}>
                  <TableCell className="font-medium">
                    {escrow.organizers?.business_name || 'Unknown'}
                  </TableCell>
                  <TableCell>{escrow.events?.title || 'General'}</TableCell>
                  <TableCell>{formatPrice(escrow.gross_amount, escrow.currency)}</TableCell>
                  <TableCell className="text-red-600">
                    -{formatPrice(parseFloat(escrow.platform_fees || 0) + parseFloat(escrow.promoter_commissions || 0), escrow.currency)}
                  </TableCell>
                  <TableCell className="font-bold text-green-600">
                    {formatPrice(escrow.available_balance, escrow.currency)}
                  </TableCell>
                  <TableCell>{getStatusBadge(escrow.status)}</TableCell>
                  <TableCell>
                    {escrow.payout_eligible_at
                      ? new Date(escrow.payout_eligible_at).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {escrow.status === 'eligible' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleProcessPayout(escrow.id)}
                            className="bg-green-600 hover:bg-green-700 rounded-lg"
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleHoldEscrow(escrow.id, 'Manual review required')}
                            className="rounded-lg"
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {escrow.status === 'hold' && (
                        <Button
                          size="sm"
                          onClick={() => handleReleaseHold(escrow.id)}
                          className="bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                          <Unlock className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEscrows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#0F0F0F]/60">
                    No escrow balances found
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
