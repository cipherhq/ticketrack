import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Loader2, ArrowLeft, AlertTriangle, Clock, FileText,
  Upload, Send, CheckCircle, XCircle, MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function ChargebackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chargeback, setChargeback] = useState(null);
  const [activities, setActivities] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);

  useEffect(() => {
    loadChargeback();
    logFinanceAction('view_chargeback_detail', { chargeback_id: id });
  }, [id]);

  const loadChargeback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chargebacks')
        .select(`
          *,
          organizers (id, business_name, email),
          events (id, title),
          orders (id, order_number, buyer_email, buyer_name, total_amount)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setChargeback(data);

      // Load activity log
      const { data: activityData } = await supabase
        .from('chargeback_activity_log')
        .select('*')
        .eq('chargeback_id', id)
        .order('created_at', { ascending: false });

      setActivities(activityData || []);
    } catch (error) {
      console.error('Error loading chargeback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from('chargeback_activity_log').insert({
        chargeback_id: id,
        action: 'note_added',
        notes: newNote
      });

      logFinanceAction('add_chargeback_note', { chargeback_id: id });
      setNewNote('');
      loadChargeback();
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadEvidence = async () => {
    if (!evidenceFile) return;
    setSubmitting(true);
    try {
      const fileName = `${id}/${Date.now()}_${evidenceFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chargeback-evidence')
        .upload(fileName, evidenceFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chargeback-evidence')
        .getPublicUrl(fileName);

      // Update chargeback with new evidence
      const currentEvidence = chargeback.evidence_documents || [];
      await supabase
        .from('chargebacks')
        .update({
          evidence_documents: [...currentEvidence, {
            name: evidenceFile.name,
            url: urlData.publicUrl,
            uploaded_at: new Date().toISOString()
          }]
        })
        .eq('id', id);

      await supabase.from('chargeback_activity_log').insert({
        chargeback_id: id,
        action: 'evidence_uploaded',
        notes: `Uploaded: ${evidenceFile.name}`
      });

      logFinanceAction('upload_chargeback_evidence', { chargeback_id: id });
      setEvidenceFile(null);
      loadChargeback();
    } catch (error) {
      console.error('Error uploading evidence:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitEvidence = async () => {
    setSubmitting(true);
    try {
      await supabase
        .from('chargebacks')
        .update({ status: 'under_review' })
        .eq('id', id);

      await supabase.from('chargeback_activity_log').insert({
        chargeback_id: id,
        action: 'evidence_submitted',
        notes: 'Evidence submitted to payment provider'
      });

      logFinanceAction('submit_chargeback_evidence', { chargeback_id: id });
      loadChargeback();
    } catch (error) {
      console.error('Error submitting evidence:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptChargeback = async () => {
    if (!confirm('Are you sure you want to accept this chargeback? The disputed amount will be deducted from the organizer balance.')) return;

    setSubmitting(true);
    try {
      await supabase
        .from('chargebacks')
        .update({
          status: 'lost',
          resolution: 'accepted',
          resolved_at: new Date().toISOString(),
          deducted_from_balance: true
        })
        .eq('id', id);

      await supabase.from('chargeback_activity_log').insert({
        chargeback_id: id,
        action: 'chargeback_accepted',
        notes: 'Chargeback accepted, amount deducted from organizer balance'
      });

      logFinanceAction('accept_chargeback', { chargeback_id: id });
      loadChargeback();
    } catch (error) {
      console.error('Error accepting chargeback:', error);
    } finally {
      setSubmitting(false);
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
    return <Badge className={styles[status] || 'bg-gray-100'}>{status?.replace('_', ' ')}</Badge>;
  };

  const getEvidenceDueStatus = (dueDate) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return <Badge className="bg-red-100 text-red-800">Overdue by {Math.abs(daysLeft)} days</Badge>;
    } else if (daysLeft <= 3) {
      return <Badge className="bg-orange-100 text-orange-800">{daysLeft} days left</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">{daysLeft} days left</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (!chargeback) {
    return (
      <div className="text-center py-12">
        <p className="text-[#0F0F0F]/60">Chargeback not found</p>
        <Button onClick={() => navigate('/finance/chargebacks')} className="mt-4">
          Back to Chargebacks
        </Button>
      </div>
    );
  }

  const isActive = ['opened', 'needs_response', 'under_review'].includes(chargeback.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/finance/chargebacks')}
          className="rounded-lg"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Chargeback Details</h1>
          <p className="text-[#0F0F0F]/60">Dispute ID: {chargeback.provider_dispute_id || 'N/A'}</p>
        </div>
      </div>

      {/* Status Alert */}
      {chargeback.status === 'needs_response' && (
        <Card className="border-orange-200 bg-orange-50 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-orange-800 font-semibold">Response Required</p>
                <p className="text-orange-600 text-sm">
                  Evidence due by: {chargeback.evidence_due_by
                    ? new Date(chargeback.evidence_due_by).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
            </div>
            {getEvidenceDueStatus(chargeback.evidence_due_by)}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Dispute Information
                {getStatusBadge(chargeback.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Disputed Amount</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatPrice(chargeback.disputed_amount, chargeback.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Fee Amount</p>
                  <p className="text-lg font-semibold">
                    {formatPrice(chargeback.fee_amount || 0, chargeback.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Payment Provider</p>
                  <Badge variant="outline">{chargeback.payment_provider}</Badge>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Opened</p>
                  <p className="font-medium">{new Date(chargeback.opened_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Reason</p>
                <p className="font-medium">{chargeback.reason || 'Not specified'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Order Number</p>
                  <p className="font-mono font-medium">{chargeback.orders?.order_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Order Total</p>
                  <p className="font-medium">
                    {formatPrice(chargeback.orders?.total_amount || 0, chargeback.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Buyer Name</p>
                  <p className="font-medium">{chargeback.orders?.buyer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Buyer Email</p>
                  <p className="font-medium">{chargeback.orders?.buyer_email || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evidence Section */}
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Evidence Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {chargeback.evidence_documents?.length > 0 ? (
                <div className="space-y-2">
                  {chargeback.evidence_documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0F0F0F]/60" />
                        <span>{doc.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#0F0F0F]/60 text-center py-4">No evidence uploaded yet</p>
              )}

              {isActive && (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      onChange={(e) => setEvidenceFile(e.target.files?.[0])}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUploadEvidence}
                      disabled={!evidenceFile || submitting}
                      className="rounded-lg"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  {chargeback.status === 'needs_response' && (
                    <Button
                      onClick={handleSubmitEvidence}
                      disabled={submitting || !chargeback.evidence_documents?.length}
                      className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit Evidence to Provider
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isActive && (
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="rounded-xl"
                    rows={2}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || submitting}
                    className="rounded-lg"
                  >
                    Add
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-4 h-4 text-[#0F0F0F]/40 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {activity.action?.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-[#0F0F0F]/50">
                          {new Date(activity.created_at).toLocaleString()}
                        </span>
                      </div>
                      {activity.notes && (
                        <p className="text-sm mt-1">{activity.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-center text-[#0F0F0F]/60 py-4">No activity yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Organizer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{chargeback.organizers?.business_name || 'Unknown'}</p>
              <p className="text-sm text-[#0F0F0F]/60">{chargeback.organizers?.email}</p>
            </CardContent>
          </Card>

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Event</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{chargeback.events?.title || 'N/A'}</p>
            </CardContent>
          </Card>

          {isActive && (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleAcceptChargeback}
                  disabled={submitting}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Accept Chargeback
                </Button>
                <p className="text-xs text-[#0F0F0F]/50 text-center">
                  Accepting will deduct the disputed amount from organizer balance
                </p>
              </CardContent>
            </Card>
          )}

          {chargeback.status === 'won' && (
            <Card className="border-green-200 bg-green-50 rounded-2xl">
              <CardContent className="p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="font-semibold text-green-800">Dispute Won</p>
                <p className="text-sm text-green-600 mt-1">
                  Resolved on {chargeback.resolved_at
                    ? new Date(chargeback.resolved_at).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </CardContent>
            </Card>
          )}

          {chargeback.status === 'lost' && (
            <Card className="border-red-200 bg-red-50 rounded-2xl">
              <CardContent className="p-6 text-center">
                <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                <p className="font-semibold text-red-800">Dispute Lost</p>
                <p className="text-sm text-red-600 mt-1">
                  {chargeback.deducted_from_balance
                    ? 'Amount deducted from organizer balance'
                    : 'Pending balance deduction'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
