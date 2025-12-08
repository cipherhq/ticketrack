import { useState, useEffect } from 'react';
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

export function AdminPayouts() {
  const navigate = useNavigate();
  const { logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(`
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
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayouts(data || []);
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      console.error('Action error:', error);
      alert('Failed to perform action');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
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
        return <Badge className="bg-gray-500 text-white rounded-lg">{status}</Badge>;
    }
  };

  const filteredPayouts = payouts.filter((payout) => {
    const matchesSearch =
      payout.organizers?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payout.events?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payout.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: payouts.filter((p) => p.status === 'pending').length,
    pendingAmount: payouts.filter((p) => p.status === 'pending').reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0),
    processing: payouts.filter((p) => p.status === 'processing').length,
    processingAmount: payouts.filter((p) => p.status === 'processing').reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0),
    completed: payouts.filter((p) => p.status === 'completed').length,
    completedAmount: payouts.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0),
    failed: payouts.filter((p) => p.status === 'failed' || p.status === 'rejected').length,
    failedAmount: payouts.filter((p) => p.status === 'failed' || p.status === 'rejected').reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0),
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Payout Management</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage organizer payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={loadPayouts} className="rounded-xl">
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
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-1">Pending Payouts</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{stats.pending}</h3>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{formatCurrency(stats.pendingAmount)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-1">Processing</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{stats.processing}</h3>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{formatCurrency(stats.processingAmount)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-1">Completed</p>
                <h3 className="text-2xl font-semibold text-green-600">{stats.completed}</h3>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{formatCurrency(stats.completedAmount)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-1">Failed</p>
                <h3 className="text-2xl font-semibold text-red-600">{stats.failed}</h3>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{formatCurrency(stats.failedAmount)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search payouts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-[#0F0F0F]/10 rounded-xl"
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
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">All Payout Requests ({filteredPayouts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0F0F0F]/10">
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Organizer</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Event</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Amount</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Fee</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Net Payout</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Bank Account</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Date</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F] font-medium">{payout.organizers?.business_name || 'Unknown'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/80">{payout.events?.title || 'N/A'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]">{formatCurrency(payout.amount)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/60">{formatCurrency(payout.fee)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#2969FF] font-medium">{formatCurrency(payout.net_amount)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/80 text-sm">
                        {payout.bank_accounts?.bank_name || 'N/A'}
                        {payout.bank_accounts?.account_number && (
                          <span> ••••{payout.bank_accounts.account_number.slice(-4)}</span>
                        )}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/60">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(payout.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5 text-[#0F0F0F]/60" />
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
                {filteredPayouts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#0F0F0F]/60">
                      No payouts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#0F0F0F]">
              {actionDialog === 'approve' && 'Approve Payout'}
              {actionDialog === 'reject' && 'Reject Payout'}
              {actionDialog === 'complete' && 'Complete Payout'}
              {actionDialog === 'details' && 'Payout Details'}
            </DialogTitle>
            {actionDialog !== 'details' && (
              <DialogDescription>
                {actionDialog === 'approve' &&
                  `Are you sure you want to approve this payout of ${formatCurrency(selectedPayout?.net_amount)} to ${selectedPayout?.organizers?.business_name}?`}
                {actionDialog === 'reject' &&
                  `Are you sure you want to reject this payout request from ${selectedPayout?.organizers?.business_name}?`}
                {actionDialog === 'complete' &&
                  `Mark this payout of ${formatCurrency(selectedPayout?.net_amount)} as completed?`}
              </DialogDescription>
            )}
          </DialogHeader>
          {actionDialog === 'details' && selectedPayout && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Organizer:</span>
                <span className="text-[#0F0F0F]">{selectedPayout.organizers?.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Event:</span>
                <span className="text-[#0F0F0F]">{selectedPayout.events?.title || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Gross Amount:</span>
                <span className="text-[#0F0F0F]">{formatCurrency(selectedPayout.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Platform Fee:</span>
                <span className="text-[#0F0F0F]">{formatCurrency(selectedPayout.fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Net Payout:</span>
                <span className="text-[#2969FF] font-medium">{formatCurrency(selectedPayout.net_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Bank Account:</span>
                <span className="text-[#0F0F0F]">
                  {selectedPayout.bank_accounts?.bank_name} - {selectedPayout.bank_accounts?.account_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Status:</span>
                {getStatusBadge(selectedPayout.status)}
              </div>
              {selectedPayout.failure_reason && (
                <div className="flex justify-between">
                  <span className="text-[#0F0F0F]/60">Failure Reason:</span>
                  <span className="text-red-600">{selectedPayout.failure_reason}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog(null)}
              className="rounded-xl border-[#0F0F0F]/10"
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
