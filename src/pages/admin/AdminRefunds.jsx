import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  RefreshCw as RefundIcon,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

export function AdminRefunds() {
  const { logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadRefunds();
  }, []);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      // Check if refunds table exists, if not use tickets with refund_requested status
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          events (
            id,
            title,
            organizers (
              id,
              business_name
            )
          ),
          profiles:user_id (
            full_name,
            email
          )
        `)
        .in('payment_status', ['refund_requested', 'refunded', 'refund_rejected'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const transformedRefunds = (data || []).map((ticket) => ({
        id: ticket.id,
        ticketId: ticket.id,
        customerName: ticket.attendee_name || ticket.profiles?.full_name || 'Unknown',
        customerEmail: ticket.attendee_email || ticket.profiles?.email || 'N/A',
        eventName: ticket.events?.title || 'Unknown Event',
        organizerName: ticket.events?.organizers?.business_name || 'Unknown',
        amount: parseFloat(ticket.total_amount) || 0,
        quantity: ticket.quantity || 1,
        status: ticket.payment_status === 'refund_requested' ? 'pending' : 
                ticket.payment_status === 'refunded' ? 'approved' : 'rejected',
        requestedAt: ticket.updated_at,
        reason: ticket.refund_reason || 'Not specified',
      }));

      setRefunds(transformedRefunds);
    } catch (error) {
      console.error('Error loading refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action, refund) => {
    setSelectedRefund(refund);
    setActionDialog(action);
    setRejectionReason('');
  };

  const confirmAction = async () => {
    if (!selectedRefund) return;
    setProcessing(true);

    try {
      if (actionDialog === 'approve') {
        const { error } = await supabase
          .from('tickets')
          .update({ 
            payment_status: 'refunded',
            refunded_at: new Date().toISOString()
          })
          .eq('id', selectedRefund.ticketId);
        if (error) throw error;
        await logAdminAction('refund_approved', 'ticket', selectedRefund.ticketId);
        alert('Refund approved successfully');
      } else if (actionDialog === 'reject') {
        if (!rejectionReason.trim()) {
          alert('Please provide a rejection reason');
          setProcessing(false);
          return;
        }
        const { error } = await supabase
          .from('tickets')
          .update({ 
            payment_status: 'refund_rejected',
            refund_rejection_reason: rejectionReason
          })
          .eq('id', selectedRefund.ticketId);
        if (error) throw error;
        await logAdminAction('refund_rejected', 'ticket', selectedRefund.ticketId, { reason: rejectionReason });
        alert('Refund rejected');
      }

      setActionDialog(null);
      setSelectedRefund(null);
      loadRefunds();
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
      case 'approved':
        return <Badge className="bg-green-500 text-white rounded-lg">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white rounded-lg">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white rounded-lg">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white rounded-lg">{status}</Badge>;
    }
  };

  const filteredRefunds = refunds.filter((refund) => {
    const matchesSearch =
      refund.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.eventName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || refund.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: refunds.filter((r) => r.status === 'pending').length,
    pendingAmount: refunds.filter((r) => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0),
    approved: refunds.filter((r) => r.status === 'approved').length,
    approvedAmount: refunds.filter((r) => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0),
    rejected: refunds.filter((r) => r.status === 'rejected').length,
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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Refund Management</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Review and process refund requests</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadRefunds} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-1">Pending Refunds</p>
                <h3 className="text-2xl font-semibold text-yellow-600">{stats.pending}</h3>
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
                <p className="text-[#0F0F0F]/60 mb-1">Approved</p>
                <h3 className="text-2xl font-semibold text-green-600">{stats.approved}</h3>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{formatCurrency(stats.approvedAmount)}</p>
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
                <p className="text-[#0F0F0F]/60 mb-1">Rejected</p>
                <h3 className="text-2xl font-semibold text-red-600">{stats.rejected}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-1">Total Requests</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{refunds.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <RefundIcon className="w-5 h-5 text-[#2969FF]" />
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
                placeholder="Search refunds..."
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
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Refunds Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Refund Requests ({filteredRefunds.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0F0F0F]/10">
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Customer</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Event</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Tickets</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Amount</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Reason</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Date</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map((refund) => (
                  <tr key={refund.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F] font-medium">{refund.customerName}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{refund.customerEmail}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/80">{refund.eventName}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{refund.organizerName}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]">{refund.quantity}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F] font-medium">{formatCurrency(refund.amount)}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/80 text-sm max-w-xs truncate">{refund.reason}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/60">
                        {new Date(refund.requestedAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(refund.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5 text-[#0F0F0F]/60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => handleAction('details', refund)}>
                            View Details
                          </DropdownMenuItem>
                          {refund.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('approve', refund)}>
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                Approve Refund
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => handleAction('reject', refund)}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject Refund
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredRefunds.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#0F0F0F]/60">
                      No refund requests found
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
              {actionDialog === 'approve' && 'Approve Refund'}
              {actionDialog === 'reject' && 'Reject Refund'}
              {actionDialog === 'details' && 'Refund Details'}
            </DialogTitle>
          </DialogHeader>

          {actionDialog === 'details' && selectedRefund && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Customer:</span>
                <span className="text-[#0F0F0F]">{selectedRefund.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Email:</span>
                <span className="text-[#0F0F0F]">{selectedRefund.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Event:</span>
                <span className="text-[#0F0F0F]">{selectedRefund.eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Amount:</span>
                <span className="text-[#2969FF] font-medium">{formatCurrency(selectedRefund.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Reason:</span>
                <span className="text-[#0F0F0F] max-w-xs text-right">{selectedRefund.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0F0F0F]/60">Status:</span>
                {getStatusBadge(selectedRefund.status)}
              </div>
            </div>
          )}

          {actionDialog === 'approve' && (
            <div className="py-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-[#0F0F0F] font-medium">Approve refund of {formatCurrency(selectedRefund?.amount)}</p>
                    <p className="text-sm text-[#0F0F0F]/60 mt-1">
                      This will process a refund to {selectedRefund?.customerName} for their ticket to {selectedRefund?.eventName}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {actionDialog === 'reject' && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-[#0F0F0F] font-medium">Reject refund request</p>
                    <p className="text-sm text-[#0F0F0F]/60 mt-1">
                      The customer will be notified that their refund has been rejected.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  className="rounded-xl"
                />
              </div>
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
                disabled={processing || (actionDialog === 'reject' && !rejectionReason.trim())}
                className={`rounded-xl ${
                  actionDialog === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
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
