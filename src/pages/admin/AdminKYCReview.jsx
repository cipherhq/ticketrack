import { useState, useEffect } from 'react';
import {
  Search, Loader2, RefreshCw, CheckCircle, XCircle, Clock,
  FileText, User, Eye, Shield, MessageSquare, Building2, Globe,
  ChevronDown, ExternalLink, CreditCard, Zap, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { brand } from '@/config/brand';

const DOCUMENT_TYPE_LABELS = {
  passport: 'Passport',
  drivers_license: "Driver's License",
  national_id: 'National ID Card',
  voters_card: "Voter's Card",
  ghana_card: 'Ghana Card',
  utility_bill: 'Utility Bill',
  bank_statement: 'Bank Statement',
  cac_certificate: 'CAC Certificate',
};

const getCountryFlag = (code) => {
  const flags = { US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', NG: '🇳🇬', GH: '🇬🇭', KE: '🇰🇪', ZA: '🇿🇦' };
  return flags[code] || '🌍';
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

// Determine effective KYC status from organizer data
const getEffectiveKycStatus = (org) => {
  if (org.stripe_connect_status === 'active') return 'verified';
  if (org.stripe_identity_status === 'verified' || org.kyc_verified) return 'verified';
  if (org.stripe_identity_status === 'processing') return 'in_review';
  if (org.kyc_status === 'verified') return 'verified';
  if (org.kyc_status === 'in_review') return 'in_review';
  if (org.kyc_status === 'rejected') return 'rejected';
  // Check if they have pending documents
  if (org.kyc_documents?.some(d => d.status === 'pending')) return 'pending';
  if (org.kyc_documents?.some(d => d.status === 'awaiting_info')) return 'awaiting_info';
  // Check if they have a kyc_verification record in_review
  if (org.kyc_verifications?.some(v => v.status === 'in_review')) return 'in_review';
  if (org.kyc_verifications?.some(v => v.status === 'pending')) return 'pending';
  return 'not_started';
};

// Determine verification method
const getVerificationMethod = (org) => {
  if (org.stripe_connect_status === 'active') return { label: 'Stripe Connect', icon: CreditCard, color: 'purple' };
  if (org.stripe_identity_status) return { label: 'Stripe Identity', icon: Zap, color: 'blue' };
  if (org.country_code === 'NG' && org.kyc_verifications?.length > 0) return { label: 'BVN/ID/CAC', icon: Shield, color: 'blue' };
  if (org.kyc_documents?.length > 0) return { label: 'Manual Upload', icon: FileText, color: 'orange' };
  return null;
};

export function AdminKYCReview() {
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const [reviewModal, setReviewModal] = useState({ open: false, organizer: null });
  const [viewDocModal, setViewDocModal] = useState({ open: false, document: null, signedUrl: null });
  const [processing, setProcessing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => { loadOrganizers(); }, []);

  const loadOrganizers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizers')
        .select(`
          id, business_name, user_id, country_code,
          kyc_status, kyc_verified, kyc_level, kyc_verified_at,
          stripe_connect_status, stripe_identity_status, stripe_identity_session_id,
          created_at, updated_at,
          profiles:user_id(full_name, email),
          kyc_documents(*),
          kyc_verifications(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrganizers(data || []);
    } catch (error) {
      console.error('Error loading organizers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Compute stats from organizer data
  const stats = organizers.reduce((acc, org) => {
    const status = getEffectiveKycStatus(org);
    acc[status] = (acc[status] || 0) + 1;
    acc.total++;
    return acc;
  }, { verified: 0, in_review: 0, pending: 0, rejected: 0, not_started: 0, awaiting_info: 0, total: 0 });

  const filteredOrganizers = organizers.filter(org => {
    const effectiveStatus = getEffectiveKycStatus(org);
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
    if (countryFilter !== 'all' && org.country_code !== countryFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        org.business_name?.toLowerCase().includes(s) ||
        org.profiles?.email?.toLowerCase().includes(s) ||
        org.profiles?.full_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'in_review':
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />In Review</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'awaiting_info':
        return <Badge className="bg-orange-100 text-orange-700"><MessageSquare className="w-3 h-3 mr-1" />Awaiting Info</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'not_started':
      default:
        return <Badge className="bg-muted text-foreground/60"><AlertCircle className="w-3 h-3 mr-1" />Not Started</Badge>;
    }
  };

  const getSignedUrl = async (documentUrl, bucket = 'kyc-documents') => {
    try {
      let path = documentUrl;
      if (documentUrl.includes(`${bucket}/`)) {
        path = documentUrl.split(`${bucket}/`).pop();
      }
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 300);
      if (error) {
        // Try the other bucket as fallback
        const fallbackBucket = bucket === 'kyc-documents' ? 'private' : 'kyc-documents';
        const { data: fallbackData } = await supabase.storage
          .from(fallbackBucket)
          .createSignedUrl(path, 300);
        return fallbackData?.signedUrl || documentUrl;
      }
      return data.signedUrl;
    } catch {
      return documentUrl;
    }
  };

  const viewDocument = async (doc) => {
    setViewDocModal({ open: true, document: doc, signedUrl: null });
    const signedUrl = await getSignedUrl(doc.document_url);
    setViewDocModal(prev => ({ ...prev, signedUrl }));
  };

  const openReviewModal = (org) => {
    setReviewModal({ open: true, organizer: org });
    setReviewNotes('');
    setRejectionReason('');
  };

  const approveOrganizer = async () => {
    const org = reviewModal.organizer;
    if (!org) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update organizer KYC status
      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'verified',
          kyc_verified: true,
          kyc_level: 1,
          kyc_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id);

      if (orgError) throw orgError;

      // If there are pending kyc_documents, approve them
      const pendingDocs = org.kyc_documents?.filter(d => d.status === 'pending' || d.status === 'awaiting_info') || [];
      for (const doc of pendingDocs) {
        await supabase
          .from('kyc_documents')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || null,
          })
          .eq('id', doc.id);
      }

      // Audit log
      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'kyc_approved',
        entity_type: 'organizer',
        entity_id: org.id,
        details: { notes: reviewNotes || null, method: 'manual_admin_review' },
      });

      // Send notification email
      try {
        if (org.profiles?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'kyc_verified',
              to: org.profiles.email,
              data: { organizerName: org.business_name, appUrl: brand.urls.website },
            },
          });
        }
      } catch (emailErr) {
        console.error('Failed to send approval email:', emailErr);
      }

      alert('Organizer KYC verified successfully!');
      setReviewModal({ open: false, organizer: null });
      loadOrganizers();
    } catch (error) {
      console.error('Error approving:', error);
      alert('Failed to approve: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const rejectOrganizer = async () => {
    const org = reviewModal.organizer;
    if (!org || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'rejected',
          kyc_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', org.id);

      if (orgError) throw orgError;

      // Reject any pending documents
      const pendingDocs = org.kyc_documents?.filter(d => d.status === 'pending' || d.status === 'awaiting_info') || [];
      for (const doc of pendingDocs) {
        await supabase
          .from('kyc_documents')
          .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: rejectionReason,
            review_notes: reviewNotes || null,
          })
          .eq('id', doc.id);
      }

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'kyc_rejected',
        entity_type: 'organizer',
        entity_id: org.id,
        details: { rejection_reason: rejectionReason, notes: reviewNotes || null },
      });

      try {
        if (org.profiles?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'kyc_rejected',
              to: org.profiles.email,
              data: { organizerName: org.business_name, reason: rejectionReason, appUrl: brand.urls.website },
            },
          });
        }
      } catch (emailErr) {
        console.error('Failed to send rejection email:', emailErr);
      }

      alert('Organizer KYC rejected. They have been notified.');
      setReviewModal({ open: false, organizer: null });
      loadOrganizers();
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Failed to reject: ' + error.message);
    } finally {
      setProcessing(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">KYC Review</h1>
          <p className="text-muted-foreground mt-1">Review organizer identity verification status</p>
        </div>
        <Button variant="outline" onClick={loadOrganizers} className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { key: 'all', label: 'All', count: stats.total, color: '[#2969FF]' },
          { key: 'verified', label: 'Verified', count: stats.verified, color: 'green-600' },
          { key: 'in_review', label: 'In Review', count: stats.in_review, color: 'blue-600' },
          { key: 'pending', label: 'Pending', count: stats.pending, color: 'yellow-600' },
          { key: 'awaiting_info', label: 'Awaiting Info', count: stats.awaiting_info, color: 'orange-600' },
          { key: 'rejected', label: 'Rejected', count: stats.rejected, color: 'red-600' },
          { key: 'not_started', label: 'Not Started', count: stats.not_started, color: 'gray-500' },
        ].map(s => (
          <Card
            key={s.key}
            className={`border-border/10 rounded-2xl cursor-pointer transition-all ${statusFilter === s.key ? 'ring-2 ring-[#2969FF]' : ''}`}
            onClick={() => setStatusFilter(s.key)}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold text-${s.color}`}>{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email..."
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

      {/* Organizer List */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-0">
          {filteredOrganizers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <User className="w-12 h-12 text-foreground/20 mb-4" />
              <p className="text-muted-foreground">No organizers found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#0F0F0F]/10">
              {filteredOrganizers.map(org => {
                const effectiveStatus = getEffectiveKycStatus(org);
                const method = getVerificationMethod(org);
                const kycVerification = org.kyc_verifications?.[0];
                const pendingDocs = org.kyc_documents?.filter(d => d.status === 'pending') || [];

                return (
                  <div key={org.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-[#2969FF]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-foreground">
                                {org.business_name || 'Unnamed Organizer'}
                              </h3>
                              <span className="text-lg">{getCountryFlag(org.country_code)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {org.profiles?.full_name} {org.profiles?.email ? `• ${org.profiles.email}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {method && (
                              <Badge variant="outline" className="text-xs">
                                <method.icon className="w-3 h-3 mr-1" />
                                {method.label}
                              </Badge>
                            )}
                            {getStatusBadge(effectiveStatus)}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {kycVerification && (
                            <span className="text-muted-foreground">
                              Level: <span className="text-foreground font-medium">{kycVerification.verification_level || 0}</span>
                            </span>
                          )}
                          {org.kyc_verified_at && (
                            <span className="text-muted-foreground">
                              Verified: <span className="text-foreground">{formatDate(org.kyc_verified_at)}</span>
                            </span>
                          )}
                          {org.kyc_documents?.length > 0 && (
                            <span className="text-muted-foreground">
                              Documents: <span className="text-foreground font-medium">{org.kyc_documents.length}</span>
                              {pendingDocs.length > 0 && (
                                <span className="text-yellow-600 ml-1">({pendingDocs.length} pending)</span>
                              )}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            Joined: <span className="text-foreground">{formatDate(org.created_at)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {(effectiveStatus === 'pending' || effectiveStatus === 'in_review' || effectiveStatus === 'awaiting_info') && (
                          <Button
                            size="sm"
                            className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white rounded-xl"
                            onClick={() => openReviewModal(org)}
                          >
                            <Shield className="w-4 h-4 mr-1" /> Review
                          </Button>
                        )}
                        {effectiveStatus === 'rejected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-orange-300 text-orange-600"
                            onClick={() => openReviewModal(org)}
                          >
                            <Eye className="w-4 h-4 mr-1" /> Re-review
                          </Button>
                        )}
                        {effectiveStatus === 'not_started' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => openReviewModal(org)}
                          >
                            <Eye className="w-4 h-4 mr-1" /> Details
                          </Button>
                        )}
                        {effectiveStatus === 'verified' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-muted-foreground"
                            onClick={() => openReviewModal(org)}
                          >
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={reviewModal.open} onOpenChange={(o) => { if (!o) setReviewModal({ open: false, organizer: null }); }}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2969FF]" />
              KYC Review
            </DialogTitle>
            <DialogDescription>
              Review organizer identity verification
            </DialogDescription>
          </DialogHeader>

          {reviewModal.organizer && (() => {
            const org = reviewModal.organizer;
            const effectiveStatus = getEffectiveKycStatus(org);
            const method = getVerificationMethod(org);
            const kycVerification = org.kyc_verifications?.[0];

            return (
              <div className="space-y-6">
                {/* Organizer Info */}
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[#2969FF]" />
                    </div>
                    <div>
                      <p className="font-medium">{org.business_name}</p>
                      <p className="text-sm text-muted-foreground">{org.profiles?.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Country:</span>{' '}
                      <span>{getCountryFlag(org.country_code)} {org.country_code}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      {getStatusBadge(effectiveStatus)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Method:</span>{' '}
                      <span>{method?.label || 'None'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Connect:</span>{' '}
                      <span className="capitalize">{org.stripe_connect_status || 'N/A'}</span>
                    </div>
                    {org.stripe_identity_status && (
                      <div>
                        <span className="text-muted-foreground">Identity:</span>{' '}
                        <span className="capitalize">{org.stripe_identity_status}</span>
                      </div>
                    )}
                    {kycVerification && (
                      <div>
                        <span className="text-muted-foreground">KYC Level:</span>{' '}
                        <span>{kycVerification.verification_level}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* BVN/ID/CAC Status (Nigeria) */}
                {kycVerification && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-foreground">Verification Documents</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className={`p-3 rounded-xl border text-center ${kycVerification.bvn_verified ? 'border-green-200 bg-green-50' : 'border-border/10'}`}>
                        <p className="text-xs text-muted-foreground">BVN</p>
                        <p className="font-medium text-sm">{kycVerification.bvn_verified ? 'Verified' : kycVerification.bvn ? 'Submitted' : 'N/A'}</p>
                      </div>
                      <div className={`p-3 rounded-xl border text-center ${kycVerification.id_verified ? 'border-green-200 bg-green-50' : 'border-border/10'}`}>
                        <p className="text-xs text-muted-foreground">Gov ID</p>
                        <p className="font-medium text-sm">{kycVerification.id_verified ? 'Verified' : kycVerification.id_document_url ? 'Submitted' : 'N/A'}</p>
                        {kycVerification.id_document_url && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs p-0 h-auto"
                            onClick={() => {
                              const url = kycVerification.id_document_url;
                              if (url.startsWith('http')) window.open(url, '_blank');
                              else getSignedUrl(url, 'private').then(u => window.open(u, '_blank'));
                            }}
                          >
                            View
                          </Button>
                        )}
                      </div>
                      <div className={`p-3 rounded-xl border text-center ${kycVerification.cac_verified ? 'border-green-200 bg-green-50' : 'border-border/10'}`}>
                        <p className="text-xs text-muted-foreground">CAC</p>
                        <p className="font-medium text-sm">{kycVerification.cac_verified ? 'Verified' : kycVerification.cac_document_url ? 'Submitted' : 'N/A'}</p>
                        {kycVerification.cac_document_url && (
                          <Button
                            variant="link"
                            size="sm"
                            className="text-xs p-0 h-auto"
                            onClick={() => {
                              const url = kycVerification.cac_document_url;
                              if (url.startsWith('http')) window.open(url, '_blank');
                              else getSignedUrl(url, 'private').then(u => window.open(u, '_blank'));
                            }}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Uploaded Documents */}
                {org.kyc_documents?.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-foreground">Uploaded Documents</p>
                    <div className="space-y-2">
                      {org.kyc_documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-border/10">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-[#2969FF]" />
                            <div>
                              <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}</p>
                              <p className="text-xs text-muted-foreground">{doc.file_name} • {formatDate(doc.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.status === 'approved' && <Badge className="bg-green-100 text-green-700 text-xs">Approved</Badge>}
                            {doc.status === 'rejected' && <Badge className="bg-red-100 text-red-700 text-xs">Rejected</Badge>}
                            {doc.status === 'pending' && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending</Badge>}
                            {doc.status === 'awaiting_info' && <Badge className="bg-orange-100 text-orange-700 text-xs">Info Needed</Badge>}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => viewDocument(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No documents or verifications */}
                {!kycVerification && (!org.kyc_documents || org.kyc_documents.length === 0) && !org.stripe_identity_status && org.stripe_connect_status !== 'active' && (
                  <div className="p-4 bg-muted rounded-xl text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No verification documents submitted yet</p>
                  </div>
                )}

                {/* Admin Actions - only show if not already verified via Stripe */}
                {effectiveStatus !== 'verified' && (
                  <>
                    <div>
                      <Label>Review Notes (Optional)</Label>
                      <Textarea
                        placeholder="Add any internal notes..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="mt-1 rounded-xl"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 border border-green-200 bg-green-50 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-green-800">Approve KYC</p>
                            <p className="text-sm text-green-600">Verify organizer and enable payouts</p>
                          </div>
                          <Button
                            onClick={approveOrganizer}
                            disabled={processing}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-xl"
                          >
                            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Approve
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 border border-red-200 bg-red-50 rounded-xl">
                        <p className="font-medium text-red-800">Reject KYC</p>
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
                          onClick={rejectOrganizer}
                          disabled={processing || !rejectionReason.trim()}
                          className="w-full rounded-xl border-red-300 text-red-700 hover:bg-red-100"
                        >
                          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                          Reject
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Already verified message */}
                {effectiveStatus === 'verified' && (
                  <div className="p-4 bg-green-50 rounded-xl text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-700">Organizer is verified</p>
                    <p className="text-sm text-green-600">
                      {org.stripe_connect_status === 'active' ? 'Auto-verified via Stripe Connect' :
                       org.stripe_identity_status === 'verified' ? 'Verified via Stripe Identity' :
                       'Manually verified by admin'}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
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
                  <p className="text-muted-foreground">Document Type</p>
                  <p className="font-medium">{DOCUMENT_TYPE_LABELS[viewDocModal.document.document_type] || viewDocModal.document.document_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">File Name</p>
                  <p className="font-medium truncate">{viewDocModal.document.file_name}</p>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden bg-background">
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
                <div className="flex justify-end">
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
    </div>
  );
}
