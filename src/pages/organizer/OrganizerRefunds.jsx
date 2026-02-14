import { useState, useEffect } from 'react';
import { Loader2, RotateCcw, CheckCircle, XCircle, AlertCircle, Search, Filter, Eye, MessageSquare, CreditCard, Zap, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTip } from '@/components/HelpTip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { sendRefundCompletedOrganizerEmail } from '@/lib/emailService';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { toast } from 'sonner';

export function OrganizerRefunds() {
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState({ open: false, refund: null, action: null });
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Connect refund modal
  const [connectRefundModal, setConnectRefundModal] = useState({ open: false, refund: null });
  const [connectRefundNotes, setConnectRefundNotes] = useState('');
  const [processingConnectRefund, setProcessingConnectRefund] = useState(false);

  useEffect(() => {
    if (organizer?.id) loadRefunds();
  }, [organizer]);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      // Fetch refund requests
      const { data: refundData, error: refundError } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      if (refundError) throw refundError;

      // Batch fetch related data instead of per-refund queries
      const refunds = refundData || [];
      const ticketIds = [...new Set(refunds.map(r => r.ticket_id).filter(Boolean))];
      const eventIds = [...new Set(refunds.map(r => r.event_id).filter(Boolean))];
      const userIds = [...new Set(refunds.map(r => r.user_id).filter(Boolean))];
      const orderIds = [...new Set(refunds.map(r => r.order_id).filter(Boolean))];

      const [ticketsRes, eventsRes, usersRes, ordersRes] = await Promise.all([
        ticketIds.length > 0
          ? supabase.from('tickets').select('id, ticket_code, attendee_name, attendee_email, total_price, order_id').in('id', ticketIds)
          : { data: [] },
        eventIds.length > 0
          ? supabase.from('events').select('id, title, start_date, image_url').in('id', eventIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : { data: [] },
        orderIds.length > 0
          ? supabase.from('orders').select('id, is_stripe_connect, stripe_account_id, payment_reference').in('id', orderIds)
          : { data: [] },
      ]);

      const ticketMap = {};
      (ticketsRes.data || []).forEach(t => { ticketMap[t.id] = t; });
      const eventMap = {};
      (eventsRes.data || []).forEach(e => { eventMap[e.id] = e; });
      const userMap = {};
      (usersRes.data || []).forEach(u => { userMap[u.id] = u; });
      const orderMap = {};
      (ordersRes.data || []).forEach(o => { orderMap[o.id] = o; });

      // Fetch any orders referenced via ticket.order_id that weren't in refund.order_id
      const ticketOrderIds = [...new Set(
        (ticketsRes.data || []).map(t => t.order_id).filter(id => id && !orderMap[id])
      )];
      if (ticketOrderIds.length > 0) {
        const { data: extraOrders } = await supabase.from('orders').select('id, is_stripe_connect, stripe_account_id, payment_reference').in('id', ticketOrderIds);
        (extraOrders || []).forEach(o => { orderMap[o.id] = o; });
      }

      const enrichedRefunds = refunds.map(refund => {
        const ticket = ticketMap[refund.ticket_id] || null;
        const event = eventMap[refund.event_id] || null;
        const user = userMap[refund.user_id] || null;
        const order = orderMap[refund.order_id] || (ticket ? orderMap[ticket.order_id] : null) || null;
        return {
          ...refund,
          ticket,
          event,
          user,
          order,
          isStripeConnect: order?.is_stripe_connect || refund.is_stripe_connect || false,
        };
      });

      setRefunds(enrichedRefunds);

      // Calculate stats
      const pending = enrichedRefunds?.filter(r =>
        r.organizer_decision !== 'approved' &&
        r.organizer_decision !== 'rejected' &&
        r.status !== 'completed' &&
        r.status !== 'rejected' &&
        !r.refund_reference &&
        !r.stripe_refund_id
      ).length || 0;
      const approved = enrichedRefunds?.filter(r =>
        r.organizer_decision === 'approved' || r.refund_reference || r.stripe_refund_id || r.status === 'completed'
      ).length || 0;
      const rejected = enrichedRefunds?.filter(r => r.status === 'rejected' || r.organizer_decision === 'rejected').length || 0;
      setStats({ pending, approved, rejected, total: enrichedRefunds?.length || 0 });
    } catch (error) {
      console.error('Error loading refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  // Standard approve/reject action (for non-Connect orders)
  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('refund_requests')
        .update({
          organizer_decision: action,
          organizer_notes: actionNotes.trim() || null,
          organizer_decided_at: new Date().toISOString(),
          organizer_decided_by: organizer.user_id,
          status: action === 'approved' ? 'approved' : 'rejected'
        })
        .eq('id', actionModal.refund.id);

      if (error) throw error;

      // Send email notification to attendee
      try {
        const refund = actionModal.refund;
        const session = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': 'Bearer ' + session.data.session?.access_token 
          },
          body: JSON.stringify({
            type: action === 'approved' ? 'refund_approved' : 'refund_rejected',
            to: refund.ticket?.attendee_email,
            data: {
              attendeeName: refund.ticket?.attendee_name,
              eventTitle: refund.event?.title,
              refundAmount: refund.amount,
              organizerNotes: actionNotes.trim() || null,
              appUrl: window.location.origin
            }
          })
        });
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
      }

      setActionModal({ open: false, refund: null, action: null });
      setActionNotes('');
      loadRefunds();
    } catch (error) {
      console.error('Error updating refund:', error);
      toast.error('Failed to update refund request');
    } finally {
      setActionLoading(false);
    }
  };

  // Process Connect refund directly
  const handleConnectRefund = async () => {
    setProcessingConnectRefund(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-stripe-connect-refund', {
        body: {
          refundRequestId: connectRefundModal.refund.id,
          organizerId: organizer.id,
          notes: connectRefundNotes.trim() || null,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Send confirmation email to organizer
      const refund = connectRefundModal.refund;
      const organizerEmail = organizer.email || organizer.business_email;
      if (organizerEmail) {
        sendRefundCompletedOrganizerEmail(organizerEmail, {
          organizerName: organizer.business_name,
          attendeeName: refund.ticket?.attendee_name,
          eventTitle: refund.event?.title,
          refundAmount: refund.amount || refund.refund_amount,
          currency: refund.currency,
          refundReference: data.refundId,
        }, organizer.id);
      }

      // Success
      setConnectRefundModal({ open: false, refund: null });
      setConnectRefundNotes('');
      loadRefunds();

      toast.success(`Refund processed successfully! Refund ID: ${data.refundId}`);
    } catch (error) {
      console.error('Error processing Connect refund:', error);
      toast.error(`Failed to process refund: ${error.message}`);
    } finally {
      setProcessingConnectRefund(false);
    }
  };

  // Reject Connect refund (just update status, no Stripe action)
  const handleRejectConnectRefund = async () => {
    setProcessingConnectRefund(true);
    try {
      const { error } = await supabase
        .from('refund_requests')
        .update({
          organizer_decision: 'rejected',
          organizer_notes: connectRefundNotes.trim() || null,
          organizer_decided_at: new Date().toISOString(),
          organizer_decided_by: organizer.user_id,
          status: 'rejected'
        })
        .eq('id', connectRefundModal.refund.id);

      if (error) throw error;

      // Send rejection email
      try {
        const refund = connectRefundModal.refund;
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'refund_rejected',
            to: refund.ticket?.attendee_email,
            data: {
              attendeeName: refund.ticket?.attendee_name,
              eventTitle: refund.event?.title,
              refundAmount: refund.amount,
              organizerNotes: connectRefundNotes.trim() || null,
            }
          }
        });
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
      }

      setConnectRefundModal({ open: false, refund: null });
      setConnectRefundNotes('');
      loadRefunds();
    } catch (error) {
      console.error('Error rejecting refund:', error);
      toast.error('Failed to reject refund request');
    } finally {
      setProcessingConnectRefund(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getStatusBadge = (refund) => {
    if (refund.stripe_refund_id || refund.status === 'completed') {
      return <Badge className="bg-green-100 text-green-700">Refunded</Badge>;
    }
    if (refund.refund_reference) {
      return <Badge className="bg-green-100 text-green-700">Processed</Badge>;
    }
    switch (refund.organizer_decision || refund.status) {
      case 'approved': return <Badge className="bg-blue-100 text-blue-700">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
    }
  };

  const isPending = (refund) => {
    return !refund.stripe_refund_id &&
           !refund.refund_reference &&
           refund.status !== 'completed' &&
           refund.status !== 'rejected' &&
           refund.organizer_decision !== 'rejected' &&
           refund.organizer_decision !== 'approved';
  };

  const filteredRefunds = refunds.filter(r => {
    if (filter === 'pending' && !isPending(r)) return false;
    if (filter === 'approved' && !r.stripe_refund_id && !r.refund_reference && r.organizer_decision !== 'approved') return false;
    if (filter === 'rejected' && r.organizer_decision !== 'rejected' && r.status !== 'rejected') return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.ticket?.attendee_name?.toLowerCase().includes(s) ||
        r.ticket?.attendee_email?.toLowerCase().includes(s) ||
        r.event?.title?.toLowerCase().includes(s) ||
        r.reason?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Pagination
  const { 
    currentPage, totalPages, totalItems, itemsPerPage, 
    paginatedItems: paginatedRefunds, handlePageChange, setCurrentPage 
  } = usePagination(filteredRefunds, 20);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            Refund Requests
            <HelpTip>Attendees can request refunds for tickets. Review each request and approve or reject. Approved refunds are processed automatically.</HelpTip>
          </h1>
          <p className="text-muted-foreground mt-1">Review and manage refund requests from attendees</p>
        </div>
        <Button variant="outline" onClick={loadRefunds} className="rounded-xl">
          <RotateCcw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <RotateCcw className="w-8 h-8 text-foreground/10" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Processed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Refund List */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-0">
          {filteredRefunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RotateCcw className="w-12 h-12 text-foreground/20 mb-4" />
              <p className="text-muted-foreground">No refund requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#0F0F0F]/10">
              {paginatedRefunds.map(refund => (
                <div key={refund.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Event Image */}
                    <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                      {refund.event?.image_url ? (
                        <img src={refund.event.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <RotateCcw className="w-6 h-6 text-foreground/20" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-foreground truncate">{refund.event?.title}</h3>
                          <p className="text-sm text-muted-foreground">{refund.ticket?.attendee_name} • {refund.ticket?.attendee_email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {refund.isStripeConnect && (
                            <Badge className="bg-purple-100 text-purple-700">
                              <CreditCard className="w-3 h-3 mr-1" />Connect
                            </Badge>
                          )}
                          {getStatusBadge(refund)}
                        </div>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Requested: {formatDate(refund.created_at)}</span>
                        <span className="text-muted-foreground">Amount: <span className="text-foreground font-medium">{formatPrice(refund.amount || refund.refund_amount, refund.currency)}</span></span>
                      </div>

                      {/* Reason */}
                      <div className="mt-2 p-2 bg-muted rounded-lg">
                        <p className="text-sm text-foreground/80 line-clamp-2">
                          <span className="font-medium">Reason:</span> {refund.reason}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {isPending(refund) && (
                      <div className="flex gap-2 flex-shrink-0">
                        {refund.isStripeConnect ? (
                          // Connect organizer: Process refund directly
                          <>
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                              onClick={() => setConnectRefundModal({ open: true, refund, action: 'process' })}
                            >
                              <Zap className="w-4 h-4 mr-1" /> Process Refund
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                              onClick={() => setConnectRefundModal({ open: true, refund, action: 'reject' })}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        ) : (
                          // Non-Connect: Standard approve/reject flow
                          <>
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white rounded-xl"
                              onClick={() => setActionModal({ open: true, refund, action: 'approved' })}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                              onClick={() => setActionModal({ open: true, refund, action: 'rejected' })}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    {!isPending(refund) && (refund.organizer_notes || refund.admin_notes) && (
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-muted-foreground"
                          onClick={() => toast.info('Notes: ' + (refund.organizer_notes || refund.admin_notes))}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" /> View Notes
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {filteredRefunds.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>

      {/* Standard Action Modal (Non-Connect) */}
      <Dialog open={actionModal.open} onOpenChange={(o) => { if(!o) { setActionModal({ open: false, refund: null, action: null }); setActionNotes(''); }}}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionModal.action === 'approved' ? (
                <><CheckCircle className="w-5 h-5 text-green-500" /> Approve Refund</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-500" /> Reject Refund</>
              )}
            </DialogTitle>
          </DialogHeader>

          {actionModal.refund && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-xl">
                <p className="font-medium">{actionModal.refund.ticket?.attendee_name}</p>
                <p className="text-sm text-muted-foreground">{actionModal.refund.event?.title}</p>
                <p className="text-sm font-medium text-[#2969FF] mt-1">
                  Refund: {formatPrice(actionModal.refund.amount || actionModal.refund.refund_amount, actionModal.refund.currency)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  Notes {actionModal.action === 'rejected' ? '(recommended)' : '(optional)'}
                </label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={actionModal.action === 'approved' 
                    ? "Any notes for the attendee..." 
                    : "Please explain why this refund was rejected..."}
                  className="mt-1 rounded-xl resize-none"
                  rows={3}
                />
              </div>

              {actionModal.action === 'approved' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Approving this request will mark it for processing. The actual refund will be processed by the finance team.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionModal({ open: false, refund: null, action: null }); setActionNotes(''); }} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => handleAction(actionModal.action)}
              disabled={actionLoading}
              className={actionModal.action === 'approved' 
                ? "bg-green-500 hover:bg-green-600 text-white rounded-xl"
                : "bg-red-500 hover:bg-red-600 text-white rounded-xl"}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionModal.action === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Refund Modal */}
      <Dialog open={connectRefundModal.open} onOpenChange={(o) => { if(!o) { setConnectRefundModal({ open: false, refund: null }); setConnectRefundNotes(''); }}}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectRefundModal.action === 'process' ? (
                <><Zap className="w-5 h-5 text-purple-500" /> Process Refund</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-500" /> Reject Refund</>
              )}
            </DialogTitle>
            <DialogDescription>
              {connectRefundModal.action === 'process' 
                ? "This will immediately refund the customer from your Stripe Connect balance."
                : "This will reject the refund request without processing a refund."}
            </DialogDescription>
          </DialogHeader>

          {connectRefundModal.refund && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-xl">
                <p className="font-medium">{connectRefundModal.refund.ticket?.attendee_name}</p>
                <p className="text-sm text-muted-foreground">{connectRefundModal.refund.event?.title}</p>
                <p className="text-sm font-medium text-purple-600 mt-1">
                  Refund: {formatPrice(connectRefundModal.refund.amount || connectRefundModal.refund.refund_amount, connectRefundModal.refund.currency)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  Notes {connectRefundModal.action === 'reject' ? '(recommended)' : '(optional)'}
                </label>
                <Textarea
                  value={connectRefundNotes}
                  onChange={(e) => setConnectRefundNotes(e.target.value)}
                  placeholder={connectRefundModal.action === 'process' 
                    ? "Any notes for the attendee..." 
                    : "Please explain why this refund was rejected..."}
                  className="mt-1 rounded-xl resize-none"
                  rows={3}
                />
              </div>

              {connectRefundModal.action === 'process' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-sm text-purple-800">
                    <strong>⚡ Stripe Connect:</strong> This refund will be processed immediately from your Stripe balance. The platform fee will also be refunded. This action cannot be undone.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setConnectRefundModal({ open: false, refund: null }); setConnectRefundNotes(''); }} 
              className="rounded-xl"
              disabled={processingConnectRefund}
            >
              Cancel
            </Button>
            <Button
              onClick={connectRefundModal.action === 'process' ? handleConnectRefund : handleRejectConnectRefund}
              disabled={processingConnectRefund}
              className={connectRefundModal.action === 'process'
                ? "bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                : "bg-red-500 hover:bg-red-600 text-white rounded-xl"}
            >
              {processingConnectRefund && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {connectRefundModal.action === 'process' ? 'Process Refund' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
