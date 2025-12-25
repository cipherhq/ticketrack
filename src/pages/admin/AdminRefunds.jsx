import { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, CreditCard, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';

export function AdminRefunds() {
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, processed: 0, escalated: 0, total: 0, totalAmount: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processModal, setProcessModal] = useState({ open: false, refund: null });
  const [detailModal, setDetailModal] = useState({ open: false, refund: null });
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadRefunds(); }, []);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('refund_requests')
        .select(`
          *,
          ticket:tickets(id, ticket_code, attendee_name, attendee_email, total_price),
          event:events(id, title, start_date, image_url, country_code),
          order:orders(id, order_number, payment_reference, payment_provider),
          user:profiles(full_name, email),
          organizer:organizers(id, business_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefunds(data || []);

      // Calculate stats
      const pending = data?.filter(r => r.status === 'pending' || r.organizer_decision === 'pending').length || 0;
      const approved = data?.filter(r => r.status === 'approved' && !r.refund_reference).length || 0;
      const rejected = data?.filter(r => r.status === 'rejected').length || 0;
      const processed = data?.filter(r => r.refund_reference).length || 0;
      const escalated = data?.filter(r => r.escalated_to_admin && !r.refund_reference).length || 0;
      const totalAmount = data?.filter(r => r.refund_reference).reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      setStats({ pending, approved, rejected, processed, escalated, total: data?.length || 0, totalAmount });
    } catch (error) {
      console.error('Error loading refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  
  const overrideAndApprove = async (refund) => {
    if (!confirm('Override organizer decision and approve this refund?')) return;
    setProcessing(true);
    try {
      await supabase
        .from('refund_requests')
        .update({
          status: 'approved',
          organizer_decision: 'approved',
          organizer_notes: (refund.organizer_notes || '') + ' [Admin Override]',
          organizer_decided_at: new Date().toISOString()
        })
        .eq('id', refund.id);
      
      alert('Refund approved. You can now process it.');
      loadRefunds();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to override');
    } finally {
      setProcessing(false);
    }
  };

const processRefund = async () => {
    if (!processModal.refund) return;
    setProcessing(true);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch('https://bkvbvggngttrizbchygy.supabase.co/functions/v1/process-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.data.session?.access_token
        },
        body: JSON.stringify({ refundRequestId: processModal.refund.id })
      });
      const result = await response.json();
      if (result.success) {
        alert('Refund processed successfully! Reference: ' + result.refundReference);
        setProcessModal({ open: false, refund: null });
        loadRefunds();
      } else {
        alert('Failed: ' + result.error);
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const getStatusBadge = (refund) => {
    if (refund.refund_reference) return <Badge className="bg-green-100 text-green-700">Processed</Badge>;
    if (refund.escalated_to_admin && refund.status !== 'approved') return <Badge className="bg-purple-100 text-purple-700">⚠️ Escalated</Badge>;
    if (refund.status === 'approved') return <Badge className="bg-blue-100 text-blue-700">Approved - Pending Payment</Badge>;
    if (refund.status === 'rejected') return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
    if (refund.organizer_decision === 'pending') return <Badge className="bg-yellow-100 text-yellow-700">Awaiting Organizer</Badge>;
    return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>;
  };

  const filteredRefunds = refunds.filter(r => {
    if (statusFilter === 'pending' && r.status !== 'pending' && r.organizer_decision !== 'pending') return false;
    if (statusFilter === 'approved' && (r.status !== 'approved' || r.refund_reference)) return false;
    if (statusFilter === 'processed' && !r.refund_reference) return false;
    if (statusFilter === 'rejected' && r.status !== 'rejected') return false;
    if (statusFilter === 'escalated' && !r.escalated_to_admin) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return r.ticket?.attendee_name?.toLowerCase().includes(s) || r.ticket?.attendee_email?.toLowerCase().includes(s) || r.event?.title?.toLowerCase().includes(s) || r.order?.order_number?.toLowerCase().includes(s);
    }
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">Refund Management</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Review and process refund requests</p>
        </div>
        <Button variant="outline" onClick={loadRefunds} className="rounded-xl"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Pending</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Ready to Process</p><p className="text-2xl font-bold text-blue-600">{stats.approved}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Processed</p><p className="text-2xl font-bold text-green-600">{stats.processed}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Rejected</p><p className="text-2xl font-bold text-red-600">{stats.rejected}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl border-purple-300"><CardContent className="p-4"><p className="text-sm text-purple-600">Escalated</p><p className="text-2xl font-bold text-purple-600">{stats.escalated}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60">Total Refunded</p><p className="text-2xl font-bold text-[#2969FF]">{formatPrice(stats.totalAmount, 'NGN')}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input placeholder="Search by name, email, event..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-xl"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Ready to Process</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Refund List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-0">
          {filteredRefunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="w-12 h-12 text-[#0F0F0F]/20 mb-4" />
              <p className="text-[#0F0F0F]/60">No refund requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#0F0F0F]/10">
              {filteredRefunds.map(refund => (
                <div key={refund.id} className="p-4 hover:bg-[#F4F6FA]/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#F4F6FA] overflow-hidden flex-shrink-0">
                      {refund.event?.image_url ? <img src={refund.event.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#0F0F0F]/20" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-[#0F0F0F] truncate">{refund.event?.title}</h3>
                          <p className="text-sm text-[#0F0F0F]/60">{refund.ticket?.attendee_name} • {refund.ticket?.attendee_email}</p>
                        </div>
                        {getStatusBadge(refund)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-[#0F0F0F]/60">Order: <span className="font-mono">{refund.order?.order_number || 'N/A'}</span></span>
                        <span className="text-[#0F0F0F]/60">Amount: <span className="text-[#0F0F0F] font-medium">{formatPrice(refund.amount, refund.currency)}</span></span>
                        <span className="text-[#0F0F0F]/60">Provider: <span className="capitalize">{refund.order?.payment_provider || 'N/A'}</span></span>
                        <span className="text-[#0F0F0F]/60">{formatDate(refund.created_at)}</span>
                      </div>
                      {refund.reason && <p className="mt-2 text-sm text-[#0F0F0F]/70 bg-[#F4F6FA] p-2 rounded-lg line-clamp-1"><strong>Reason:</strong> {refund.reason}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setDetailModal({ open: true, refund })}><Eye className="w-4 h-4" /></Button>
                      {refund.status === 'approved' && !refund.refund_reference && (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white rounded-xl" onClick={() => setProcessModal({ open: true, refund })}>
                          <CreditCard className="w-4 h-4 mr-1" /> Process
                        </Button>
                      )}
                      {refund.escalated_to_admin && refund.status !== 'approved' && !refund.refund_reference && (
                        <Button size="sm" className="bg-purple-500 hover:bg-purple-600 text-white rounded-xl" onClick={() => overrideAndApprove(refund)}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve Override
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Modal */}
      <Dialog open={processModal.open} onOpenChange={(o) => { if(!o) setProcessModal({ open: false, refund: null }); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-green-500" /> Process Refund</DialogTitle></DialogHeader>
          {processModal.refund && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-2">
                <div className="flex justify-between"><span className="text-[#0F0F0F]/60">Attendee</span><span className="font-medium">{processModal.refund.ticket?.attendee_name}</span></div>
                <div className="flex justify-between"><span className="text-[#0F0F0F]/60">Event</span><span className="font-medium">{processModal.refund.event?.title}</span></div>
                <div className="flex justify-between"><span className="text-[#0F0F0F]/60">Original Amount</span><span>{formatPrice(processModal.refund.original_amount, processModal.refund.currency)}</span></div>
                <div className="flex justify-between"><span className="text-[#0F0F0F]/60">Processing Fee</span><span className="text-red-600">-{formatPrice(processModal.refund.refund_fee, processModal.refund.currency)}</span></div>
                <hr />
                <div className="flex justify-between font-bold"><span>Refund Amount</span><span className="text-green-600">{formatPrice(processModal.refund.amount, processModal.refund.currency)}</span></div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800"><strong>Payment Provider:</strong> {processModal.refund.order?.payment_provider || 'Unknown'}</p>
                <p className="text-sm text-yellow-800"><strong>Reference:</strong> {processModal.refund.order?.payment_reference || 'N/A'}</p>
              </div>
              <p className="text-sm text-[#0F0F0F]/60">This will initiate the refund via {processModal.refund.order?.payment_provider || 'the payment provider'}. The attendee will receive the funds within 5-10 business days.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessModal({ open: false, refund: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={processRefund} disabled={processing} className="bg-green-500 hover:bg-green-600 text-white rounded-xl">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4 mr-2" />Process Refund</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={detailModal.open} onOpenChange={(o) => { if(!o) setDetailModal({ open: false, refund: null }); }}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>Refund Details</DialogTitle></DialogHeader>
          {detailModal.refund && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-[#0F0F0F]/60">Attendee</p><p className="font-medium">{detailModal.refund.ticket?.attendee_name}</p></div>
                <div><p className="text-[#0F0F0F]/60">Email</p><p className="font-medium">{detailModal.refund.ticket?.attendee_email}</p></div>
                <div><p className="text-[#0F0F0F]/60">Event</p><p className="font-medium">{detailModal.refund.event?.title}</p></div>
                <div><p className="text-[#0F0F0F]/60">Organizer</p><p className="font-medium">{detailModal.refund.organizer?.business_name || 'N/A'}</p></div>
                <div><p className="text-[#0F0F0F]/60">Original Amount</p><p className="font-medium">{formatPrice(detailModal.refund.original_amount, detailModal.refund.currency)}</p></div>
                <div><p className="text-[#0F0F0F]/60">Refund Fee</p><p className="font-medium text-red-600">-{formatPrice(detailModal.refund.refund_fee, detailModal.refund.currency)}</p></div>
                <div><p className="text-[#0F0F0F]/60">Refund Amount</p><p className="font-medium text-green-600">{formatPrice(detailModal.refund.amount, detailModal.refund.currency)}</p></div>
                <div><p className="text-[#0F0F0F]/60">Status</p>{getStatusBadge(detailModal.refund)}</div>
                <div><p className="text-[#0F0F0F]/60">Requested</p><p className="font-medium">{formatDate(detailModal.refund.created_at)}</p></div>
                <div><p className="text-[#0F0F0F]/60">Payment Provider</p><p className="font-medium capitalize">{detailModal.refund.order?.payment_provider || 'N/A'}</p></div>
                {detailModal.refund.refund_reference && <div className="col-span-2"><p className="text-[#0F0F0F]/60">Refund Reference</p><p className="font-mono bg-green-50 p-2 rounded">{detailModal.refund.refund_reference}</p></div>}
              </div>
              {detailModal.refund.reason && <div><p className="text-[#0F0F0F]/60 text-sm">Reason</p><p className="bg-[#F4F6FA] p-3 rounded-xl text-sm">{detailModal.refund.reason}</p></div>}
              {detailModal.refund.organizer_notes && <div><p className="text-[#0F0F0F]/60 text-sm">Organizer Notes</p><p className="bg-[#F4F6FA] p-3 rounded-xl text-sm">{detailModal.refund.organizer_notes}</p></div>}
              {detailModal.refund.escalated_to_admin && <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl"><p className="text-sm text-purple-800 font-medium">⚠️ Escalated to Admin</p>{detailModal.refund.escalation_reason && <p className="text-sm text-purple-700 mt-1">{detailModal.refund.escalation_reason}</p>}</div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDetailModal({ open: false, refund: null })} className="rounded-xl">Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
