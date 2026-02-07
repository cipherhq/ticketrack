import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, CheckCircle, XCircle, Clock, Shield,
  AlertTriangle, User, DollarSign
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function PendingApprovals() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [thresholds, setThresholds] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalPendingAmount: 0
  });

  useEffect(() => {
    loadApprovalRequests();
    loadThresholds();
    logFinanceAction('view_pending_approvals');
  }, []);

  const loadApprovalRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payout_approval_requests')
        .select(`
          *,
          payout_queue (
            id,
            amount,
            currency,
            payment_provider,
            organizer_id,
            organizers (business_name, email)
          ),
          payout_approvals (id, approver_id, decision, notes, created_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApprovalRequests(data || []);

      // Calculate stats
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      const approved = data?.filter(r => r.status === 'approved').length || 0;
      const rejected = data?.filter(r => r.status === 'rejected').length || 0;
      const pendingAmount = data?.filter(r => r.status === 'pending')
        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0) || 0;

      setStats({
        pending,
        approved,
        rejected,
        totalPendingAmount: pendingAmount
      });
    } catch (error) {
      console.error('Error loading approval requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThresholds = async () => {
    try {
      const { data } = await supabase
        .from('payout_approval_thresholds')
        .select('*')
        .order('threshold_amount', { ascending: true });

      setThresholds(data || []);
    } catch (error) {
      console.error('Error loading thresholds:', error);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Record approval
      await supabase.from('payout_approvals').insert({
        request_id: selectedRequest.id,
        approver_id: user.id,
        decision: 'approved',
        notes: reviewNotes
      });

      // Check if enough approvals
      const newApprovalCount = (selectedRequest.current_approvals || 0) + 1;

      if (newApprovalCount >= selectedRequest.required_approvals) {
        // Update request status
        await supabase
          .from('payout_approval_requests')
          .update({
            status: 'approved',
            current_approvals: newApprovalCount
          })
          .eq('id', selectedRequest.id);

        // Update payout queue
        await supabase
          .from('payout_queue')
          .update({
            requires_approval: false,
            status: 'queued'
          })
          .eq('id', selectedRequest.payout_queue_id);
      } else {
        // Just update approval count
        await supabase
          .from('payout_approval_requests')
          .update({ current_approvals: newApprovalCount })
          .eq('id', selectedRequest.id);
      }

      logFinanceAction('approve_payout', {
        request_id: selectedRequest.id,
        amount: selectedRequest.amount
      });

      setReviewDialogOpen(false);
      setReviewNotes('');
      loadApprovalRequests();
    } catch (error) {
      console.error('Error approving:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Record rejection
      await supabase.from('payout_approvals').insert({
        request_id: selectedRequest.id,
        approver_id: user.id,
        decision: 'rejected',
        notes: reviewNotes
      });

      // Update request status
      await supabase
        .from('payout_approval_requests')
        .update({ status: 'rejected' })
        .eq('id', selectedRequest.id);

      // Update payout queue
      await supabase
        .from('payout_queue')
        .update({ status: 'rejected' })
        .eq('id', selectedRequest.payout_queue_id);

      logFinanceAction('reject_payout', {
        request_id: selectedRequest.id,
        amount: selectedRequest.amount
      });

      setReviewDialogOpen(false);
      setReviewNotes('');
      loadApprovalRequests();
    } catch (error) {
      console.error('Error rejecting:', error);
    } finally {
      setProcessing(false);
    }
  };

  const openReviewDialog = (request) => {
    setSelectedRequest(request);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status}</Badge>;
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
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F]">Pending Approvals</h1>
        <p className="text-[#0F0F0F]/60">Review and approve large payout requests</p>
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
                <p className="text-sm text-[#0F0F0F]/60">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
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
                <p className="text-sm text-[#0F0F0F]/60">Rejected</p>
                <p className="text-2xl font-bold">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Amount</p>
                <p className="text-2xl font-bold">
                  {formatPrice(stats.totalPendingAmount, 'NGN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for pending approvals */}
      {stats.pending > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800">
              <span className="font-semibold">{stats.pending} payout{stats.pending > 1 ? 's' : ''}</span> require
              {stats.pending === 1 ? 's' : ''} your approval
            </p>
          </CardContent>
        </Card>
      )}

      {/* Approval Requests Table */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Approval Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Approvals</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvalRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {request.payout_queue?.organizers?.business_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-[#0F0F0F]/60">
                        {request.payout_queue?.organizers?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-lg">
                    {formatPrice(request.amount, request.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {request.payout_queue?.payment_provider}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: request.required_approvals }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            i < request.current_approvals
                              ? 'bg-green-100'
                              : 'bg-gray-100'
                          }`}
                        >
                          {i < request.current_approvals ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      ))}
                      <span className="ml-2 text-sm text-[#0F0F0F]/60">
                        {request.current_approvals}/{request.required_approvals}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(request.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {request.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => openReviewDialog(request)}
                        className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-lg"
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {approvalRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#0F0F0F]/60">
                    No approval requests
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Approval Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Threshold Amount</TableHead>
                <TableHead>Required Approvers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {thresholds.map((threshold) => (
                <TableRow key={threshold.id}>
                  <TableCell>{threshold.currency}</TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(threshold.threshold_amount, threshold.currency)}
                  </TableCell>
                  <TableCell>
                    {threshold.required_approvers} approver{threshold.required_approvers > 1 ? 's' : ''}
                  </TableCell>
                </TableRow>
              ))}
              {thresholds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-[#0F0F0F]/60">
                    No thresholds configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Payout Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <Card className="border rounded-xl bg-gray-50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[#0F0F0F]/60">Organizer</span>
                    <span className="font-medium">
                      {selectedRequest.payout_queue?.organizers?.business_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#0F0F0F]/60">Amount</span>
                    <span className="font-bold text-lg">
                      {formatPrice(selectedRequest.amount, selectedRequest.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#0F0F0F]/60">Provider</span>
                    <span>{selectedRequest.payout_queue?.payment_provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#0F0F0F]/60">Approvals</span>
                    <span>
                      {selectedRequest.current_approvals}/{selectedRequest.required_approvals}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Previous approvals */}
              {selectedRequest.payout_approvals?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Previous Decisions</p>
                  <div className="space-y-2">
                    {selectedRequest.payout_approvals.map((approval) => (
                      <div
                        key={approval.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                      >
                        <Badge className={
                          approval.decision === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }>
                          {approval.decision}
                        </Badge>
                        <span className="text-[#0F0F0F]/60">
                          {new Date(approval.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add notes for this decision..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-1 rounded-xl"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleReject}
                  disabled={processing}
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
