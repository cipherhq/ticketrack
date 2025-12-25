import { useState, useEffect } from 'react';
import { Loader2, RotateCcw, CheckCircle, XCircle, AlertCircle, Search, Filter, Eye, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';

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

  useEffect(() => {
    if (organizer?.id) loadRefunds();
  }, [organizer]);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('refund_requests')
        .select(`
          *,
          ticket:tickets(id, ticket_code, attendee_name, attendee_email, total_price),
          event:events(id, title, start_date, image_url),
          user:profiles(full_name, email)
        `)
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRefunds(data || []);

      // Calculate stats
      const pending = data?.filter(r => r.organizer_decision === 'pending').length || 0;
      const approved = data?.filter(r => r.organizer_decision === 'approved').length || 0;
      const rejected = data?.filter(r => r.organizer_decision === 'rejected').length || 0;
      setStats({ pending, approved, rejected, total: data?.length || 0 });
    } catch (error) {
      console.error('Error loading refunds:', error);
    } finally {
      setLoading(false);
    }
  };

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
        await fetch('https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-email', {
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
      alert('Failed to update refund request');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const getStatusBadge = (decision) => {
    switch (decision) {
      case 'approved': return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
    }
  };

  const filteredRefunds = refunds.filter(r => {
    if (filter !== 'all' && r.organizer_decision !== filter) return false;
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
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">Refund Requests</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Review and manage refund requests from attendees</p>
        </div>
        <Button variant="outline" onClick={loadRefunds} className="rounded-xl">
          <RotateCcw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{stats.total}</p>
              </div>
              <RotateCcw className="w-8 h-8 text-[#0F0F0F]/10" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
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
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Refund List */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-0">
          {filteredRefunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RotateCcw className="w-12 h-12 text-[#0F0F0F]/20 mb-4" />
              <p className="text-[#0F0F0F]/60">No refund requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#0F0F0F]/10">
              {filteredRefunds.map(refund => (
                <div key={refund.id} className="p-4 hover:bg-[#F4F6FA]/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Event Image */}
                    <div className="w-16 h-16 rounded-xl bg-[#F4F6FA] overflow-hidden flex-shrink-0">
                      {refund.event?.image_url ? (
                        <img src={refund.event.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <RotateCcw className="w-6 h-6 text-[#0F0F0F]/20" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-[#0F0F0F] truncate">{refund.event?.title}</h3>
                          <p className="text-sm text-[#0F0F0F]/60">{refund.ticket?.attendee_name} • {refund.ticket?.attendee_email}</p>
                        </div>
                        {getStatusBadge(refund.organizer_decision)}
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-[#0F0F0F]/60">Requested: {formatDate(refund.created_at)}</span>
                        <span className="text-[#0F0F0F]/60">Amount: <span className="text-[#0F0F0F] font-medium">{formatPrice(refund.amount, refund.currency)}</span></span>
                      </div>

                      {/* Reason */}
                      <div className="mt-2 p-2 bg-[#F4F6FA] rounded-lg">
                        <p className="text-sm text-[#0F0F0F]/80 line-clamp-2">
                          <span className="font-medium">Reason:</span> {refund.reason}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {refund.organizer_decision === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
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
                      </div>
                    )}

                    {refund.organizer_decision !== 'pending' && refund.organizer_notes && (
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-[#0F0F0F]/60"
                          onClick={() => alert('Notes: ' + refund.organizer_notes)}
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
        </CardContent>
      </Card>

      {/* Action Modal */}
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
              <div className="p-3 bg-[#F4F6FA] rounded-xl">
                <p className="font-medium">{actionModal.refund.ticket?.attendee_name}</p>
                <p className="text-sm text-[#0F0F0F]/60">{actionModal.refund.event?.title}</p>
                <p className="text-sm font-medium text-[#2969FF] mt-1">
                  Refund: {formatPrice(actionModal.refund.amount, actionModal.refund.currency)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-[#0F0F0F]">
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
                    <strong>Note:</strong> Approving this request will mark it for processing. The actual refund will be processed by the platform admin.
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
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                actionModal.action === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
