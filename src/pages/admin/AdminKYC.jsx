import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Shield, Loader2, RefreshCw, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export function AdminKYC() {
  const { logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [kycList, setKycList] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [selectedKYC, setSelectedKYC] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadKYCs();
  }, [filter]);

  const loadKYCs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('kyc_verifications')
        .select(`
          *,
          organizers (
            id,
            business_name,
            email,
            phone,
            user_id
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setKycList(data || []);
    } catch (error) {
      console.error('Error loading KYCs:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = async (kyc) => {
    setSelectedKYC(kyc);
    setRejectionReason('');
    setReviewDialogOpen(true);
  };

  const handleApprove = async (level) => {
    if (!selectedKYC) return;
    setProcessing(true);

    try {
      const payoutLimits = {
        1: 500000,    // Level 1: ₦500K
        2: 5000000,   // Level 2: ₦5M
        3: null,      // Level 3: Unlimited
      };

      const updates = {
        status: 'verified',
        verification_level: level,
        monthly_payout_limit: payoutLimits[level],
        updated_at: new Date().toISOString(),
      };

      // Update level-specific verification flags
      if (level >= 1) {
        updates.bvn_verified = true;
        updates.bvn_verified_at = new Date().toISOString();
      }
      if (level >= 2) {
        updates.id_verified = true;
        updates.id_verified_at = new Date().toISOString();
      }
      if (level >= 3) {
        updates.cac_verified = true;
        updates.cac_verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('kyc_verifications')
        .update(updates)
        .eq('id', selectedKYC.id);

      if (error) throw error;

      // Also update organizers table so organizer shows as verified
      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'verified',
          kyc_verified: true,
          kyc_level: level,
          kyc_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedKYC.organizer_id);

      if (orgError) throw orgError;

      // Log admin action
      await logAdminAction('kyc_approved', 'kyc_verification', selectedKYC.id, { level });

      alert(`KYC approved at Level ${level}`);
      setReviewDialogOpen(false);
      loadKYCs();
    } catch (error) {
      console.error('Error approving KYC:', error);
      alert('Failed to approve KYC');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedKYC || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('kyc_verifications')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedKYC.id);

      if (error) throw error;

      // Also update organizers table
      const { error: orgError } = await supabase
        .from('organizers')
        .update({
          kyc_status: 'rejected',
          kyc_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedKYC.organizer_id);

      if (orgError) throw orgError;

      // Log admin action
      await logAdminAction('kyc_rejected', 'kyc_verification', selectedKYC.id, { reason: rejectionReason });

      alert('KYC rejected');
      setReviewDialogOpen(false);
      loadKYCs();
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      alert('Failed to reject KYC');
    } finally {
      setProcessing(false);
    }
  };

  const getDocumentUrl = async (path) => {
    if (!path) return null;
    
    // Check if it's already a full URL
    if (path.startsWith('http')) return path;

    // Get signed URL for private bucket
    const { data } = await supabase.storage
      .from('private')
      .createSignedUrl(path, 3600); // 1 hour expiry

    return data?.signedUrl;
  };

  const viewDocument = async (path) => {
    const url = await getDocumentUrl(path);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Document not available');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-700">Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'in_review':
        return <Badge className="bg-blue-100 text-blue-700">In Review</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLevelBadge = (level) => {
    const colors = {
      0: 'bg-muted text-foreground/80',
      1: 'bg-blue-100 text-blue-700',
      2: 'bg-purple-100 text-purple-700',
      3: 'bg-green-100 text-green-700',
    };
    return <Badge className={colors[level] || colors[0]}>Level {level}</Badge>;
  };

  const stats = {
    pending: kycList.filter(k => k.status === 'pending').length,
    inReview: kycList.filter(k => k.status === 'in_review').length,
    verified: kycList.filter(k => k.status === 'verified').length,
    rejected: kycList.filter(k => k.status === 'rejected').length,
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
          <h2 className="text-2xl font-semibold text-foreground">KYC Verification</h2>
          <p className="text-muted-foreground mt-1">Review and approve organizer verification requests</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadKYCs} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Review</p>
            <p className="text-2xl font-semibold text-blue-600">{stats.inReview}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Verified</p>
            <p className="text-2xl font-semibold text-green-600">{stats.verified}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-semibold text-red-600">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Applications</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KYC List */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">KYC Applications ({kycList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {kycList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No KYC applications found</p>
          ) : (
            <div className="space-y-4">
              {kycList.map((kyc) => (
                <div key={kyc.id} className="p-4 rounded-xl bg-muted">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-foreground font-medium">{kyc.organizers?.business_name || 'Unknown'}</h4>
                      <p className="text-sm text-muted-foreground">{kyc.organizers?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {new Date(kyc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getLevelBadge(kyc.verification_level)}
                      {getStatusBadge(kyc.status)}
                    </div>
                  </div>

                  {/* Documents Status */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="outline" className={kyc.bvn_verified ? 'bg-green-50 border-green-200' : ''}>
                      BVN {kyc.bvn_verified ? '✓' : kyc.bvn ? '•' : '✗'}
                    </Badge>
                    <Badge variant="outline" className={kyc.id_verified ? 'bg-green-50 border-green-200' : ''}>
                      ID {kyc.id_verified ? '✓' : kyc.id_document_url ? '•' : '✗'}
                    </Badge>
                    <Badge variant="outline" className={kyc.cac_verified ? 'bg-green-50 border-green-200' : ''}>
                      CAC {kyc.cac_verified ? '✓' : kyc.cac_document_url ? '•' : '✗'}
                    </Badge>
                  </div>

                  {kyc.rejection_reason && (
                    <p className="text-sm text-red-600 mb-3">Rejection: {kyc.rejection_reason}</p>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReviewDialog(kyc)}
                    className="rounded-xl"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>KYC Review: {selectedKYC?.organizers?.business_name}</DialogTitle>
          </DialogHeader>

          {selectedKYC && (
            <div className="space-y-6 py-4">
              {/* Organizer Info */}
              <div className="p-4 bg-muted rounded-xl">
                <h4 className="font-medium text-foreground mb-2">Organizer Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Business Name</p>
                    <p className="text-foreground">{selectedKYC.organizers?.business_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="text-foreground">{selectedKYC.organizers?.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="text-foreground">{selectedKYC.organizers?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Level</p>
                    <p className="text-foreground">Level {selectedKYC.verification_level}</p>
                  </div>
                </div>
              </div>

              {/* Documents Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* BVN */}
                <div className="p-4 rounded-xl border border-border/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-foreground">BVN Verification</span>
                    {selectedKYC.bvn_verified ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : selectedKYC.bvn ? (
                      <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">BVN:</span> {selectedKYC.bvn ? '••••••' + selectedKYC.bvn.slice(-4) : 'Not provided'}</p>
                    <p><span className="text-muted-foreground">Name:</span> {selectedKYC.bvn_first_name} {selectedKYC.bvn_last_name}</p>
                    <p><span className="text-muted-foreground">DOB:</span> {selectedKYC.bvn_dob || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {selectedKYC.bvn_phone || 'N/A'}</p>
                  </div>
                </div>

                {/* Government ID */}
                <div className="p-4 rounded-xl border border-border/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-foreground">Government ID</span>
                    {selectedKYC.id_verified ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : selectedKYC.id_document_url ? (
                      <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Type:</span> {selectedKYC.id_type || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Number:</span> {selectedKYC.id_number || 'N/A'}</p>
                  </div>
                  {selectedKYC.id_document_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewDocument(selectedKYC.id_document_url)}
                      className="mt-3 rounded-lg w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Document
                    </Button>
                  )}
                </div>

                {/* CAC Certificate */}
                <div className="p-4 rounded-xl border border-border/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-foreground">CAC Certificate</span>
                    {selectedKYC.cac_verified ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : selectedKYC.cac_document_url ? (
                      <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">CAC Number:</span> {selectedKYC.cac_number || 'N/A'}</p>
                  </div>
                  {selectedKYC.cac_document_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewDocument(selectedKYC.cac_document_url)}
                      className="mt-3 rounded-lg w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Document
                    </Button>
                  )}
                </div>

                {/* Payout Limits Info */}
                <div className="p-4 rounded-xl border border-border/10 bg-blue-50/50">
                  <h4 className="font-medium text-foreground mb-3">Payout Limits (NGN)</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-blue-600">Level 1:</span> 500,000/month</p>
                    <p><span className="text-purple-600">Level 2:</span> 5,000,000/month</p>
                    <p><span className="text-green-600">Level 3:</span> Unlimited</p>
                  </div>
                </div>
              </div>

              {/* Rejection Reason Input */}
              {selectedKYC.status !== 'verified' && (
                <div className="space-y-2">
                  <Label>Rejection Reason (if rejecting)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide a reason for rejection..."
                    className="rounded-xl"
                  />
                </div>
              )}

              {/* Action Buttons */}
              {selectedKYC.status !== 'verified' && (
                <div className="flex flex-wrap gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={processing || !rejectionReason.trim()}
                    className="rounded-xl border-red-500 text-red-500 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  
                  {selectedKYC.bvn && (
                    <Button
                      onClick={() => handleApprove(1)}
                      disabled={processing}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve Level 1
                    </Button>
                  )}
                  
                  {selectedKYC.bvn && selectedKYC.id_document_url && (
                    <Button
                      onClick={() => handleApprove(2)}
                      disabled={processing}
                      className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve Level 2
                    </Button>
                  )}
                  
                  {selectedKYC.bvn && selectedKYC.id_document_url && selectedKYC.cac_document_url && (
                    <Button
                      onClick={() => handleApprove(3)}
                      disabled={processing}
                      className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                    >
                      {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve Level 3
                    </Button>
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
