import { useState, useEffect } from 'react';
import { 
  Search, Loader2, RefreshCw, CheckCircle, XCircle, Clock, 
  FileText, User, Eye, Download, AlertTriangle, Shield,
  MessageSquare, Calendar, Building2, Globe, ChevronDown,
  ExternalLink, Filter, MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';

const DOCUMENT_TYPE_LABELS = {
  passport: 'Passport',
  drivers_license: "Driver's License",
  national_id: 'National ID Card',
  voters_card: "Voter's Card",
  utility_bill: 'Utility Bill',
  bank_statement: 'Bank Statement',
  cac_certificate: 'CAC Certificate',
};

export function AdminKYCReview() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ 
    pending: 0, 
    approved: 0, 
    rejected: 0, 
    total: 0,
    awaitingInfo: 0 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [countryFilter, setCountryFilter] = useState('all');
  
  const [reviewModal, setReviewModal] = useState({ open: false, document: null });
  const [viewDocModal, setViewDocModal] = useState({ open: false, document: null, signedUrl: null });
  const [processing, setProcessing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestInfoMessage, setRequestInfoMessage] = useState('');

  const [auditLog, setAuditLog] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  useEffect(() => { 
    loadDocuments(); 
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select(`
          *,
          organizer:organizers(
            id, 
            business_name, 
            user_id, 
            country_code, 
            kyc_status,
            kyc_verified,
            stripe_connect_status,
            created_at,
            profiles:user_id(full_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDocuments(data || []);

      const pending = data?.filter(d => d.status === 'pending').length || 0;
      const approved = data?.filter(d => d.status === 'approved').length || 0;
      const rejected = data?.filter(d => d.status === 'rejected').length || 0;
      const awaitingInfo = data?.filter(d => d.status === 'awaiting_info').length || 0;

      setStats({
        pending,
        approved,
        rejected,
        awaitingInfo,
        total: data?.length || 0,
      });
    } catch (error) {
      console.error('Error loading KYC documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async (organizerId) => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*, admin:profiles!admin_audit_logs_admin_id_fkey(full_name, email)')
        .eq('entity_type', 'kyc_document')
        .or(`entity_id.eq.${organizerId},details->organizer_id.eq.${organizerId}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAuditLog(data || []);
    } catch (error) {
      console.error('Error loading audit log:', error);
    }
  };

  const getSignedUrl = async (documentUrl) => {
    try {
      let path = documentUrl;
      if (documentUrl.includes('kyc-documents/')) {
        path = documentUrl.split('kyc-documents/').pop();
      }

      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(path, 300);

      if (error) {
        console.error('Signed URL error:', error);
        return documentUrl;
      }
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return documentUrl;
    }
  };

  const viewDocument = async (doc) => {
    setViewDocModal({ open: true, document: doc, signedUrl: null });
    const signedUrl = await getSignedUrl(doc.document_url);
    setViewDocModal(prev => ({ ...prev, signedUrl }));
  };

  const openReviewModal = async (doc) => {
    setReviewModal({ open: true, document: doc });
    setReviewNotes('');
    setRejectionReason('');
    setRequestInfoMessage('');
    await loadAuditLog(doc.organizer_id);
  };

  const approveDocument = async () => {
    if (!reviewModal.document) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const doc = reviewModal.document;

      const { error: docError } = await supabase
        .from('kyc_documents')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (docError) throw docError;

      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'verified',
          kyc_verified: true,
          kyc_level: 1,
          kyc_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.organizer_id);

      if (orgError) throw orgError;

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'kyc_document_approved',
        entity_type: 'kyc_document',
        entity_id: doc.id,
        details: {
          organizer_id: doc.organizer_id,
          document_type: doc.document_type,
          notes: reviewNotes || null,
        },
      });

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', doc.organizer?.user_id)
          .single();

        if (profile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'kyc_verified',
              to: profile.email,
              data: {
                organizerName: doc.organizer?.business_name,
                appUrl: 'https://ticketrack.com',
              },
            },
          });
        }
      } catch (emailErr) {
        console.error('Failed to send approval email:', emailErr);
      }

      alert('Document approved and organizer KYC verified successfully!');
      setReviewModal({ open: false, document: null });
      loadDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
      alert('Failed to approve document: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const rejectDocument = async () => {
    if (!reviewModal.document || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const doc = reviewModal.document;

      const { error: docError } = await supabase
        .from('kyc_documents')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          review_notes: reviewNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (docError) throw docError;

      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'rejected',
          kyc_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.organizer_id);

      if (orgError) throw orgError;

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'kyc_document_rejected',
        entity_type: 'kyc_document',
        entity_id: doc.id,
        details: {
          organizer_id: doc.organizer_id,
          document_type: doc.document_type,
          rejection_reason: rejectionReason,
          notes: reviewNotes || null,
        },
      });

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', doc.organizer?.user_id)
          .single();

        if (profile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'kyc_rejected',
              to: profile.email,
              data: {
                organizerName: doc.organizer?.business_name,
                reason: rejectionReason,
                appUrl: 'https://ticketrack.com',
              },
            },
          });
        }
      } catch (emailErr) {
        console.error('Failed to send rejection email:', emailErr);
      }

      alert('Document rejected. Organizer has been notified.');
      setReviewModal({ open: false, document: null });
      loadDocuments();
    } catch (error) {
      console.error('Error rejecting document:', error);
      alert('Failed to reject document: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const requestMoreInfo = async () => {
    if (!reviewModal.document || !requestInfoMessage.trim()) {
      alert('Please provide a message explaining what additional information is needed');
      return;
    }
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const doc = reviewModal.document;

      const { error: docError } = await supabase
        .from('kyc_documents')
        .update({
          status: 'awaiting_info',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: requestInfoMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (docError) throw docError;

      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'action_required',
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.organizer_id);

      if (orgError) throw orgError;

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'kyc_info_requested',
        entity_type: 'kyc_document',
        entity_id: doc.id,
        details: {
          organizer_id: doc.organizer_id,
          document_type: doc.document_type,
          message: requestInfoMessage,
        },
      });

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', doc.organizer?.user_id)
          .single();

        if (profile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'kyc_action_required',
              to: profile.email,
              data: {
                organizerName: doc.organizer?.business_name,
                message: requestInfoMessage,
                appUrl: 'https://ticketrack.com',
              },
            },
          });
        }
      } catch (emailErr) {
        console.error('Failed to send info request email:', emailErr);
      }

      alert('Request sent to organizer for additional information.');
      setReviewModal({ open: false, document: null });
      loadDocuments();
    } catch (error) {
      console.error('Error requesting info:', error);
      alert('Failed to send request: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'awaiting_info':
        return <Badge className="bg-orange-100 text-orange-700"><MessageSquare className="w-3 h-3 mr-1" />Awaiting Info</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
    }
  };

  const getCountryFlag = (code) => {
    const flags = { US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', NG: '🇳🇬', GH: '🇬🇭', KE: '🇰🇪', ZA: '🇿🇦' };
    return flags[code] || '🌍';
  };

  const filteredDocuments = documents.filter(doc => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (countryFilter !== 'all' && doc.organizer?.country_code !== countryFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        doc.organizer?.business_name?.toLowerCase().includes(s) ||
        doc.organizer?.profiles?.email?.toLowerCase().includes(s) ||
        doc.organizer?.profiles?.full_name?.toLowerCase().includes(s) ||
        doc.document_type?.toLowerCase().includes(s)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0F]">KYC Document Review</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Review and approve organizer identity documents</p>
        </div>
        <Button variant="outline" onClick={loadDocuments} className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className={`border-[#0F0F0F]/10 rounded-2xl cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="p-4">
            <p className="text-sm text-[#0F0F0F]/60">Pending Review</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card 
          className={`border-[#0F0F0F]/10 rounded-2xl cursor-pointer transition-all ${statusFilter === 'awaiting_info' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setStatusFilter('awaiting_info')}
        >
          <CardContent className="p-4">
            <p className="text-sm text-[#0F0F0F]/60">Awaiting Info</p>
            <p className="text-2xl font-bold text-orange-600">{stats.awaitingInfo}</p>
          </CardContent>
        </Card>
        <Card 
          className={`border-[#0F0F0F]/10 rounded-2xl cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setStatusFilter('approved')}
        >
          <CardContent className="p-4">
            <p className="text-sm text-[#0F0F0F]/60">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card 
          className={`border-[#0F0F0F]/10 rounded-2xl cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CardContent className="p-4">
            <p className="text-sm text-[#0F0F0F]/60">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card 
          className={`border-[#0F0F0F]/10 rounded-2xl cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-[#2969FF]' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <p className="text-sm text-[#0F0F0F]/60">Total Documents</p>
            <p className="text-2xl font-bold text-[#2969FF]">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input
            placeholder="Search by organizer name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <Globe className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="US">🇺🇸 United States</SelectItem>
            <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
            <SelectItem value="CA">🇨🇦 Canada</SelectItem>
            <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
            <SelectItem value="GH">🇬🇭 Ghana</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-0">
          {filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="w-12 h-12 text-[#0F0F0F]/20 mb-4" />
              <p className="text-[#0F0F0F]/60">No documents found</p>
              {statusFilter === 'pending' && (
                <p className="text-sm text-green-600 mt-2">All caught up! 🎉</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#0F0F0F]/10">
              {filteredDocuments.map(doc => (
                <div key={doc.id} className="p-4 hover:bg-[#F4F6FA]/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#F4F6FA] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-[#2969FF]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-[#0F0F0F]">
                              {doc.organizer?.business_name || 'Unknown Organizer'}
                            </h3>
                            <span className="text-lg">{getCountryFlag(doc.organizer?.country_code)}</span>
                          </div>
                          <p className="text-sm text-[#0F0F0F]/60">
                            {doc.organizer?.profiles?.full_name} • {doc.organizer?.profiles?.email}
                          </p>
                        </div>
                        {getStatusBadge(doc.status)}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-[#0F0F0F]/60">
                          Document: <span className="text-[#0F0F0F] font-medium">
                            {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                          </span>
                        </span>
                        <span className="text-[#0F0F0F]/60">
                          Submitted: <span className="text-[#0F0F0F]">{formatDate(doc.created_at)}</span>
                        </span>
                        {doc.reviewed_at && (
                          <span className="text-[#0F0F0F]/60">
                            Reviewed: <span className="text-[#0F0F0F]">{formatDate(doc.reviewed_at)}</span>
                          </span>
                        )}
                      </div>

                      {doc.rejection_reason && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                          <strong>Rejection reason:</strong> {doc.rejection_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => viewDocument(doc)}
                      >
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                      {doc.status === 'pending' && (
                        <Button
                          size="sm"
                          className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white rounded-xl"
                          onClick={() => openReviewModal(doc)}
                        >
                          <Shield className="w-4 h-4 mr-1" /> Review
                        </Button>
                      )}
                      {doc.status === 'awaiting_info' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-orange-300 text-orange-600"
                          onClick={() => openReviewModal(doc)}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" /> Check
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

      <Dialog open={viewDocModal.open} onOpenChange={(o) => { if (!o) setViewDocModal({ open: false, document: null, signedUrl: null }); }}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2969FF]" />
              Document Preview
            </DialogTitle>
          </DialogHeader>
          {viewDocModal.document && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#0F0F0F]/60">Document Type</p>
                  <p className="font-medium">{DOCUMENT_TYPE_LABELS[viewDocModal.document.document_type] || viewDocModal.document.document_type}</p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">File Name</p>
                  <p className="font-medium truncate">{viewDocModal.document.file_name}</p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Organizer</p>
                  <p className="font-medium">{viewDocModal.document.organizer?.business_name}</p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Status</p>
                  {getStatusBadge(viewDocModal.document.status)}
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden bg-gray-50">
                {viewDocModal.signedUrl ? (
                  viewDocModal.document.file_name?.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={viewDocModal.signedUrl}
                      className="w-full h-[400px]"
                      title="Document Preview"
                    />
                  ) : (
                    <img
                      src={viewDocModal.signedUrl}
                      alt="Document"
                      className="w-full h-auto max-h-[400px] object-contain"
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
                  </div>
                )}
              </div>

              {viewDocModal.signedUrl && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => window.open(viewDocModal.signedUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Open in New Tab
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reviewModal.open} onOpenChange={(o) => { if (!o) setReviewModal({ open: false, document: null }); }}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2969FF]" />
              Review KYC Document
            </DialogTitle>
            <DialogDescription>
              Review the submitted document and make a decision
            </DialogDescription>
          </DialogHeader>

          {reviewModal.document && (
            <div className="space-y-6">
              <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#2969FF]" />
                  </div>
                  <div>
                    <p className="font-medium">{reviewModal.document.organizer?.business_name}</p>
                    <p className="text-sm text-[#0F0F0F]/60">{reviewModal.document.organizer?.profiles?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[#0F0F0F]/60">Country:</span>{' '}
                    <span>{getCountryFlag(reviewModal.document.organizer?.country_code)} {reviewModal.document.organizer?.country_code}</span>
                  </div>
                  <div>
                    <span className="text-[#0F0F0F]/60">Document:</span>{' '}
                    <span>{DOCUMENT_TYPE_LABELS[reviewModal.document.document_type]}</span>
                  </div>
                  <div>
                    <span className="text-[#0F0F0F]/60">Submitted:</span>{' '}
                    <span>{formatDate(reviewModal.document.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-[#0F0F0F]/60">Connect Status:</span>{' '}
                    <span className="capitalize">{reviewModal.document.organizer?.stripe_connect_status || 'N/A'}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg"
                  onClick={() => viewDocument(reviewModal.document)}
                >
                  <Eye className="w-4 h-4 mr-2" /> View Document
                </Button>
              </div>

              <div>
                <Label>Review Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any internal notes about this review..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-1 rounded-xl"
                  rows={2}
                />
              </div>

              <div className="space-y-4">
                <div className="p-4 border border-green-200 bg-green-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">Approve Document</p>
                      <p className="text-sm text-green-600">Verify organizer identity and enable payouts</p>
                    </div>
                    <Button
                      onClick={approveDocument}
                      disabled={processing}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-xl"
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve
                    </Button>
                  </div>
                </div>

                <div className="p-4 border border-orange-200 bg-orange-50 rounded-xl">
                  <p className="font-medium text-orange-800">Request Additional Information</p>
                  <p className="text-sm text-orange-600 mb-3">Ask organizer to provide more details or resubmit</p>
                  <Textarea
                    placeholder="What additional information is needed?"
                    value={requestInfoMessage}
                    onChange={(e) => setRequestInfoMessage(e.target.value)}
                    className="rounded-xl mb-2"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    onClick={requestMoreInfo}
                    disabled={processing || !requestInfoMessage.trim()}
                    className="w-full rounded-xl border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                    Send Request
                  </Button>
                </div>

                <div className="p-4 border border-red-200 bg-red-50 rounded-xl">
                  <p className="font-medium text-red-800">Reject Document</p>
                  <p className="text-sm text-red-600 mb-3">Document is invalid or doesn't meet requirements</p>
                  <Textarea
                    placeholder="Reason for rejection (required)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="rounded-xl mb-2"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    onClick={rejectDocument}
                    disabled={processing || !rejectionReason.trim()}
                    className="w-full rounded-xl border-red-300 text-red-700 hover:bg-red-100"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    Reject Document
                  </Button>
                </div>
              </div>

              {auditLog.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowAuditLog(!showAuditLog)}
                    className="flex items-center gap-2 text-sm text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
                  >
                    <Clock className="w-4 h-4" />
                    Review History ({auditLog.length})
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAuditLog ? 'rotate-180' : ''}`} />
                  </button>
                  {showAuditLog && (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      {auditLog.map(log => (
                        <div key={log.id} className="text-xs p-2 bg-[#F4F6FA] rounded-lg">
                          <div className="flex justify-between">
                            <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                            <span className="text-[#0F0F0F]/40">{formatDate(log.created_at)}</span>
                          </div>
                          <p className="text-[#0F0F0F]/60">by {log.admin?.full_name || 'System'}</p>
                          {log.details?.rejection_reason && (
                            <p className="text-red-600 mt-1">Reason: {log.details.rejection_reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
