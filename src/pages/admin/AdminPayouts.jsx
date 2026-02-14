import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, MoreVertical, DollarSign, CheckCircle, Clock, AlertCircle, Send, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';
import { formatPrice } from '@/config/currencies';
import { Pagination } from '@/components/ui/pagination';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

export function AdminPayouts() {
  const navigate = useNavigate();
  const { logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({
    pending: 0, pendingByCurrency: {},
    processing: 0, processingByCurrency: {},
    completed: 0, completedByCurrency: {},
    failed: 0, failedByCurrency: {},
  });

  // Load stats separately (lightweight aggregate query)
  const loadStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select('status, net_amount, currency');

      if (error) throw error;

      const groupByCurrency = (items) => {
        const byCurrency = {};
        items.forEach(p => {
          const currency = p.currency || 'NGN';
          if (!byCurrency[currency]) byCurrency[currency] = 0;
          byCurrency[currency] += parseFloat(p.net_amount) || 0;
        });
        return byCurrency;
      };

      const all = data || [];
      setStats({
        pending: all.filter(p => p.status === 'pending').length,
        pendingByCurrency: groupByCurrency(all.filter(p => p.status === 'pending')),
        processing: all.filter(p => p.status === 'processing').length,
        processingByCurrency: groupByCurrency(all.filter(p => p.status === 'processing')),
        completed: all.filter(p => p.status === 'completed').length,
        completedByCurrency: groupByCurrency(all.filter(p => p.status === 'completed')),
        failed: all.filter(p => p.status === 'failed' || p.status === 'rejected').length,
        failedByCurrency: groupByCurrency(all.filter(p => p.status === 'failed' || p.status === 'rejected')),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Load paginated payouts with server-side filtering
  const loadPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const selectQuery = `
        *,
        organizers (
          id,
          business_name,
          email
        ),
        bank_accounts (
          bank_name,
          account_number,
          account_name
        ),
        events (
          id,
          title
        )
      `;

      if (debouncedSearch) {
        // With search: fetch all (with status filter), filter client-side, paginate client-side
        let query = supabase
          .from('payouts')
          .select(selectQuery)
          .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Client-side search filter on joined fields
        const search = debouncedSearch.toLowerCase();
        const filtered = (data || []).filter(p =>
          p.organizers?.business_name?.toLowerCase().includes(search) ||
          p.events?.title?.toLowerCase().includes(search)
        );

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        setTotalCount(filtered.length);
        setPayouts(filtered.slice(from, from + ITEMS_PER_PAGE));
      } else {
        // No search: full server-side pagination
        let query = supabase
          .from('payouts')
          .select(selectQuery, { count: 'exact' })
          .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        setPayouts(data || []);
        setTotalCount(count || 0);
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter]);

  // Initial load
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Re-fetch payouts when page, search, or filter changes
  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleAction = (action, payout) => {
    setSelectedPayout(payout);
    setActionDialog(action);
  };

  const confirmAction = async () => {
    if (!selectedPayout) return;
    setProcessing(true);

    try {
      if (actionDialog === 'approve') {
        const { error } = await supabase
          .from('payouts')
          .update({ status: 'processing' })
          .eq('id', selectedPayout.id);
        if (error) throw error;
        await logAdminAction('payout_approved', 'payout', selectedPayout.id);
      } else if (actionDialog === 'reject') {
        const { error } = await supabase
          .from('payouts')
          .update({ status: 'rejected', failure_reason: 'Rejected by admin' })
          .eq('id', selectedPayout.id);
        if (error) throw error;
        await logAdminAction('payout_rejected', 'payout', selectedPayout.id);
      } else if (actionDialog === 'complete') {
        const { error } = await supabase
          .from('payouts')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', selectedPayout.id);
        if (error) throw error;
        await logAdminAction('payout_completed', 'payout', selectedPayout.id);
      }

      setActionDialog(null);
      setSelectedPayout(null);
      loadPayouts();
      loadStats();
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Failed to perform action');
    } finally {
      setProcessing(false);
    }
  };

  // Use multi-currency formatting
  const formatCurrency = (amount, currency = 'NGN') => {
    return formatPrice(amount || 0, currency);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white rounded-lg">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white rounded-lg">Pending</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500 text-white rounded-lg">Processing</Badge>;
      case 'failed':
      case 'rejected':
        return <Badge className="bg-red-500 text-white rounded-lg">{status === 'failed' ? 'Failed' : 'Rejected'}</Badge>;
      default:
        return <Badge className="bg-background0 text-white rounded-lg">{status}</Badge>;
    }
  };

  const formatMultiCurrency = (byCurrency) => {
    const entries = Object.entries(byCurrency).filter(([_, amt]) => amt > 0);
    if (entries.length === 0) return formatPrice(0, 'USD');
    return entries.map(([curr, amt]) => formatPrice(amt, curr)).join(' + ');
  };

  const handleRefresh = () => {
    loadPayouts();
    loadStats();
  };

  if (loading && payouts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Payout Management</h2>
          <p className="text-muted-foreground mt-1">Manage organizer payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleRefresh} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => navigate('/admin/payouts/process')}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <Send className="w-4 h-4 mr-2" />
            Process Payouts
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Pending Payouts</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.pending}</h3>
                <p className="text-sm text-muted-foreground mt-1">{formatMultiCurrency(stats.pendingByCurrency)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Processing</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.processing}</h3>
                <p className="text-sm text-muted-foreground mt-1">{formatMultiCurrency(stats.processingByCurrency)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Completed</p>
                <h3 className="text-2xl font-semibold text-green-600">{stats.completed}</h3>
                <p className="text-sm text-muted-foreground mt-1">{formatMultiCurrency(stats.completedByCurrency)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Failed</p>
                <h3 className="text-2xl font-semibold text-red-600">{stats.failed}</h3>
                <p className="text-sm text-muted-foreground mt-1">{formatMultiCurrency(stats.failedByCurrency)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search payouts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border/10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">All Payout Requests ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Organizer</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Event</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Fee</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Net Payout</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Bank Account</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-border/5 hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <p className="text-foreground font-medium">{payout.organizers?.business_name || 'Unknown'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">{payout.events?.title || 'N/A'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground">{formatCurrency(payout.amount, payout.currency)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-muted-foreground">{formatCurrency(payout.fee, payout.currency)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#2969FF] font-medium">{formatCurrency(payout.net_amount, payout.currency)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80 text-sm">
                        {payout.bank_accounts?.bank_name || 'N/A'}
                        {payout.bank_accounts?.account_number && (
                          <span> ••••{payout.bank_accounts.account_number.slice(-4)}</span>
                        )}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-muted-foreground">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(payout.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => handleAction('details', payout)}>
                            View Details
                          </DropdownMenuItem>
                          {payout.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('approve', payout)}>
                                Approve Payout
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => handleAction('reject', payout)}
                              >
                                Reject Payout
                              </DropdownMenuItem>
                            </>
                          )}
                          {payout.status === 'processing' && (
                            <DropdownMenuItem onClick={() => handleAction('complete', payout)}>
                              Mark as Completed
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {payouts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No payouts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {actionDialog === 'approve' && 'Approve Payout'}
              {actionDialog === 'reject' && 'Reject Payout'}
              {actionDialog === 'complete' && 'Complete Payout'}
              {actionDialog === 'details' && 'Payout Details'}
            </DialogTitle>
            {actionDialog !== 'details' && (
              <DialogDescription>
                {actionDialog === 'approve' &&
                  `Are you sure you want to approve this payout of ${formatCurrency(selectedPayout?.net_amount, selectedPayout?.currency)} to ${selectedPayout?.organizers?.business_name}?`}
                {actionDialog === 'reject' &&
                  `Are you sure you want to reject this payout request from ${selectedPayout?.organizers?.business_name}?`}
                {actionDialog === 'complete' &&
                  `Mark this payout of ${formatCurrency(selectedPayout?.net_amount, selectedPayout?.currency)} as completed?`}
              </DialogDescription>
            )}
          </DialogHeader>
          {actionDialog === 'details' && selectedPayout && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organizer:</span>
                <span className="text-foreground">{selectedPayout.organizers?.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event:</span>
                <span className="text-foreground">{selectedPayout.events?.title || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Amount:</span>
                <span className="text-foreground">{formatCurrency(selectedPayout.amount, selectedPayout.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee:</span>
                <span className="text-foreground">{formatCurrency(selectedPayout.fee, selectedPayout.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Payout:</span>
                <span className="text-[#2969FF] font-medium">{formatCurrency(selectedPayout.net_amount, selectedPayout.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank Account:</span>
                <span className="text-foreground">
                  {selectedPayout.bank_accounts?.bank_name} - {selectedPayout.bank_accounts?.account_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                {getStatusBadge(selectedPayout.status)}
              </div>
              {selectedPayout.failure_reason && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failure Reason:</span>
                  <span className="text-red-600">{selectedPayout.failure_reason}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog(null)}
              className="rounded-xl border-border/10"
            >
              {actionDialog === 'details' ? 'Close' : 'Cancel'}
            </Button>
            {actionDialog !== 'details' && (
              <Button
                onClick={confirmAction}
                disabled={processing}
                className={`rounded-xl ${
                  actionDialog === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#2969FF] hover:bg-[#2969FF]/90'
                } text-white`}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
