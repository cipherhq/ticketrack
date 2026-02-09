import { useState, useEffect, useRef } from 'react';
import { 
  Upload, CheckCircle, AlertCircle, FileText, User, Building2, 
  Loader2, Shield, CreditCard, Phone, Calendar, Eye, EyeOff,
  BadgeCheck, Clock, XCircle, Info, ChevronRight, Lock, Zap, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

// Paystack BVN verification is handled securely via Edge Function

const verificationLevels = [
  {
    level: 1,
    name: 'Basic',
    description: 'BVN Verification',
    limit: '₦500,000/month',
    requirements: ['BVN'],
    color: 'blue',
  },
  {
    level: 2,
    name: 'Standard',
    description: 'BVN + ID Document',
    limit: '₦5,000,000/month',
    requirements: ['BVN', 'Government ID'],
    color: 'purple',
  },
  {
    level: 3,
    name: 'Business',
    description: 'Full Business Verification',
    limit: 'Unlimited',
    requirements: ['BVN', 'Government ID', 'CAC Certificate'],
    color: 'green',
  },
];

const idTypes = [
  { value: 'national_id', label: 'National ID Card' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'International Passport' },
  { value: 'voters_card', label: "Voter's Card" },
];

export function KYCVerification() {
  const { organizer } = useOrganizer();
  const fileInputRef = useRef(null);
  const cacFileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [kyc, setKyc] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // BVN Dialog
  const [isBvnDialogOpen, setIsBvnDialogOpen] = useState(false);
  const [bvnForm, setBvnForm] = useState({
    bvn: '',
    firstName: '',
    lastName: '',
    dob: '',
    phone: '',
  });
  const [showBvn, setShowBvn] = useState(false);
  
  // ID Dialog
  const [isIdDialogOpen, setIsIdDialogOpen] = useState(false);
  const [idForm, setIdForm] = useState({
    idType: '',
    idNumber: '',
  });
  const [idFile, setIdFile] = useState(null);
  
  // CAC Dialog
  const [isCacDialogOpen, setIsCacDialogOpen] = useState(false);
  const [cacNumber, setCacNumber] = useState('');
  const [cacFile, setCacFile] = useState(null);
  
  // Stripe Identity (for US/UK/CA)
  const [stripeIdentityLoading, setStripeIdentityLoading] = useState(false);
  
  // Manual upload fallback
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [manualIdFile, setManualIdFile] = useState(null);
  const [manualIdType, setManualIdType] = useState('');
  const manualFileInputRef = useRef(null);

  useEffect(() => {
    if (organizer?.id) {
      loadKycData();
    }
  }, [organizer?.id]);

  const loadKycData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('organizer_id', organizer.id)
        .single();

      if (error && error.code !== 'PGRST116' && error.code !== 'PGRST204' && error.code !== '42P01') {
        // PGRST116 = no rows, PGRST204/42P01 = table not found - all expected when KYC not started
        console.warn('KYC load notice:', error.message);
      }

      setKyc(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Country-based verification method detection
  const getVerificationMethod = () => {
    const country = organizer?.country_code;
    if (country === 'NG') return 'paystack';
    if (['US', 'GB', 'CA'].includes(country)) return 'stripe_identity';
    return 'manual';
  };

  const isStripeIdentityCountry = ['US', 'GB', 'CA'].includes(organizer?.country_code);
  const isNigeria = organizer?.country_code === 'NG';
  
  // Check if already verified via Stripe Connect (auto KYC)
  const isConnectVerified = organizer?.stripe_connect_status === 'active';

  // Start Stripe Identity verification
  const startStripeIdentityVerification = async () => {
    setStripeIdentityLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-stripe-identity-session', {
        body: {
          organizer_id: organizer.id,
          return_url: window.location.href,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create verification session');
      }

      if (response.data?.url) {
        // Redirect to Stripe Identity
        window.location.href = response.data.url;
      } else {
        throw new Error('No verification URL returned');
      }
    } catch (error) {
      console.error('Stripe Identity error:', error);
      setError(error.message || 'Failed to start verification. Please try again.');
    } finally {
      setStripeIdentityLoading(false);
    }
  };

  // Manual document upload for fallback
  const handleManualUpload = async () => {
    if (!manualIdFile || !manualIdType) {
      setError('Please select an ID type and upload a document');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload to Supabase Storage
      const fileExt = manualIdFile.name.split('.').pop();
      const fileName = `${organizer.user_id}/${Date.now()}_${manualIdType}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, manualIdFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);

      // Save to kyc_documents table
      const { error: docError } = await supabase
        .from('kyc_documents')
        .insert({
          organizer_id: organizer.id,
          document_type: manualIdType,
          document_url: publicUrl,
          file_name: manualIdFile.name,
          status: 'pending',
        });

      if (docError) throw docError;

      // Update organizer status
      await supabase
        .from('organizers')
        .update({
          kyc_status: 'in_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizer.id);

      setSuccess('Document uploaded successfully! Our team will review it within 24-48 hours.');
      setIsManualUploadOpen(false);
      setManualIdFile(null);
      setManualIdType('');
      
      // Reload to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Manual upload error:', error);
      setError('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const initializeKyc = async () => {
    const { data, error } = await supabase
      .from('kyc_verifications')
      .insert({
        organizer_id: organizer.id,
        verification_level: 0,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const verifyBvn = async () => {
    if (!bvnForm.bvn || bvnForm.bvn.length !== 11) {
      setError('Please enter a valid 11-digit BVN');
      return;
    }
    if (!bvnForm.firstName || !bvnForm.lastName) {
      setError('Please enter your first and last name as registered with your BVN');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      // Call BVN verification via secure Edge Function
      const { data: result, error: verifyError } = await supabase.functions.invoke('verify-bvn', {
        body: {
          bvn: bvnForm.bvn,
          firstName: bvnForm.firstName,
          lastName: bvnForm.lastName,
        },
      });

      if (verifyError) {
        throw new Error(verifyError.message || 'BVN verification failed');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'BVN verification failed');
      }

      // BVN verified successfully
      let kycRecord = kyc;
      if (!kycRecord) {
        kycRecord = await initializeKyc();
      }

      const newLevel = Math.max(kycRecord.verification_level || 0, 1);

      await supabase
        .from('kyc_verifications')
        .update({
          bvn: bvnForm.bvn,
          bvn_verified: true,
          bvn_first_name: bvnForm.firstName,
          bvn_last_name: bvnForm.lastName,
          bvn_dob: bvnForm.dob || null,
          bvn_phone: bvnForm.phone || null,
          bvn_verified_at: new Date().toISOString(),
          verification_level: newLevel,
          monthly_payout_limit: 500000,
          status: 'verified',
          updated_at: new Date().toISOString(),
        })
        .eq('id', kycRecord.id);

      setSuccess('BVN verified successfully! You can now receive payouts up to ₦500,000/month.');
      setIsBvnDialogOpen(false);
      setBvnForm({ bvn: '', firstName: '', lastName: '', dob: '', phone: '' });
      await loadKycData();
    } catch (error) {
      console.error('BVN verification error:', error);
      setError(error.message || 'BVN verification failed. Please check your details and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleIdFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setIdFile(file);
    }
  };

  const submitIdDocument = async () => {
    if (!idForm.idType || !idForm.idNumber) {
      setError('Please select ID type and enter ID number');
      return;
    }
    if (!idFile) {
      setError('Please upload your ID document');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = idFile.name.split('.').pop();
      const fileName = `${organizer.id}-id-${Date.now()}.${fileExt}`;
      const filePath = `kyc-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('private')
        .upload(filePath, idFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('private')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      let kycRecord = kyc;
      if (!kycRecord) {
        kycRecord = await initializeKyc();
      }

      const newLevel = kycRecord.bvn_verified ? 2 : kycRecord.verification_level;

      await supabase
        .from('kyc_verifications')
        .update({
          id_type: idForm.idType,
          id_number: idForm.idNumber,
          id_document_url: urlData?.signedUrl || filePath,
          id_verified: false,
          verification_level: newLevel,
          monthly_payout_limit: newLevel >= 2 ? 5000000 : (kycRecord.monthly_payout_limit || 0),
          status: 'in_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', kycRecord.id);

      setSuccess('ID document submitted for review. You will be notified once verified.');
      setIsIdDialogOpen(false);
      setIdForm({ idType: '', idNumber: '' });
      setIdFile(null);
      await loadKycData();
    } catch (error) {
      console.error('ID submission error:', error);
      setError('Failed to submit ID document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCacFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setCacFile(file);
    }
  };

  const submitCacDocument = async () => {
    if (!cacNumber) {
      setError('Please enter your CAC registration number');
      return;
    }
    if (!cacFile) {
      setError('Please upload your CAC certificate');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = cacFile.name.split('.').pop();
      const fileName = `${organizer.id}-cac-${Date.now()}.${fileExt}`;
      const filePath = `kyc-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('private')
        .upload(filePath, cacFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('private')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      let kycRecord = kyc;
      if (!kycRecord) {
        kycRecord = await initializeKyc();
      }

      const newLevel = (kycRecord.bvn_verified && kycRecord.id_verified) ? 3 : kycRecord.verification_level;

      await supabase
        .from('kyc_verifications')
        .update({
          cac_number: cacNumber,
          cac_document_url: urlData?.signedUrl || filePath,
          cac_verified: false,
          verification_level: newLevel,
          monthly_payout_limit: newLevel >= 3 ? 999999999 : (kycRecord.monthly_payout_limit || 0),
          status: 'in_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', kycRecord.id);

      setSuccess('CAC document submitted for review.');
      setIsCacDialogOpen(false);
      setCacNumber('');
      setCacFile(null);
      await loadKycData();
    } catch (error) {
      console.error('CAC submission error:', error);
      setError('Failed to submit CAC document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const currentLevel = kyc?.verification_level || 0;
  const progress = Math.round((currentLevel / 3) * 100);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'in_review':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />In Review</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-muted text-foreground/80"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    if (amount >= 999999999) return 'Unlimited';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  // If Stripe Connect is active, show verified status
  if (isConnectVerified) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">KYC Verification</h2>
          <p className="text-muted-foreground mt-1">Your identity has been verified</p>
        </div>
        
        <Card className="border-green-200 bg-green-50/50 rounded-2xl overflow-hidden">
          <div className="h-2 bg-green-500" />
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Verified via Stripe Connect</h3>
                <p className="text-muted-foreground">Your identity was verified when you connected your Stripe account.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Stripe Identity flow for US/UK/CA
  if (isStripeIdentityCountry) {
    const identityStatus = organizer?.stripe_identity_status;
    const isVerified = organizer?.kyc_verified || identityStatus === 'verified';
    
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Identity Verification</h2>
          <p className="text-muted-foreground mt-1">Verify your identity to receive payouts</p>
        </div>

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {isVerified ? (
          <Card className="border-green-200 bg-green-50/50 rounded-2xl overflow-hidden">
            <div className="h-2 bg-green-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Identity Verified</h3>
                  <p className="text-muted-foreground">You're all set to receive payouts.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : identityStatus === 'processing' ? (
          <Card className="border-yellow-200 bg-yellow-50/50 rounded-2xl overflow-hidden">
            <div className="h-2 bg-yellow-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Verification in Progress</h3>
                  <p className="text-muted-foreground">We're reviewing your documents. This usually takes a few minutes.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : identityStatus === 'requires_input' ? (
          <Card className="border-orange-200 bg-orange-50/50 rounded-2xl overflow-hidden">
            <div className="h-2 bg-orange-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">Additional Information Needed</h3>
                  <p className="text-muted-foreground mb-3">We need more information to complete your verification.</p>
                  <Button 
                    onClick={startStripeIdentityVerification}
                    disabled={stripeIdentityLoading}
                    className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white rounded-xl"
                  >
                    {stripeIdentityLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                    Continue Verification
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Verify Your Identity</h3>
                  <p className="text-muted-foreground">Quick and secure verification powered by Stripe</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-xl">
                  <CreditCard className="w-6 h-6 text-[#2969FF] mb-2" />
                  <p className="font-medium text-sm">Government ID</p>
                  <p className="text-xs text-muted-foreground">Passport, Driver's License, or ID Card</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <User className="w-6 h-6 text-[#2969FF] mb-2" />
                  <p className="font-medium text-sm">Selfie Verification</p>
                  <p className="text-xs text-muted-foreground">Quick photo to match your ID</p>
                </div>
                <div className="p-4 bg-muted rounded-xl">
                  <Shield className="w-6 h-6 text-[#2969FF] mb-2" />
                  <p className="font-medium text-sm">Instant Results</p>
                  <p className="text-xs text-muted-foreground">Usually verified in minutes</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={startStripeIdentityVerification}
                  disabled={stripeIdentityLoading}
                  className="bg-[#2969FF] hover:bg-[#1e4fd6] text-white rounded-xl flex-1"
                >
                  {stripeIdentityLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Start Verification
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setIsManualUploadOpen(true)}
                  className="rounded-xl"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Manually
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Your information is securely processed by Stripe and never stored on our servers.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Manual Upload Dialog */}
        <Dialog open={isManualUploadOpen} onOpenChange={setIsManualUploadOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Manual Document Upload</DialogTitle>
              <DialogDescription>
                Upload a government-issued ID for manual review. This may take 24-48 hours.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ID Type</Label>
                <Select value={manualIdType} onValueChange={setManualIdType}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="national_id">National ID Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Upload Document</Label>
                <input
                  ref={manualFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setManualIdFile(e.target.files?.[0] || null)}
                />
                <div 
                  onClick={() => manualFileInputRef.current?.click()}
                  className="mt-1 border-2 border-dashed border-border/20 rounded-xl p-6 text-center cursor-pointer hover:border-[#2969FF] transition-colors"
                >
                  {manualIdFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="text-sm">{manualIdFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload</p>
                    </>
                  )}
                </div>
              </div>
              <Button 
                onClick={handleManualUpload} 
                disabled={uploading || !manualIdFile || !manualIdType}
                className="w-full bg-[#2969FF] hover:bg-[#1e4fd6] text-white rounded-xl"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Submit for Review
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Manual document verification for Ghana and other countries
  if (!isNigeria && !isStripeIdentityCountry) {
    const countryName = organizer?.country_code === 'GH' ? 'Ghana' :
                        organizer?.country_code === 'KE' ? 'Kenya' :
                        organizer?.country_code === 'ZA' ? 'South Africa' : 'your country';
    const isGhana = organizer?.country_code === 'GH';
    const manualIdTypes = isGhana
      ? [
          { value: 'ghana_card', label: 'Ghana Card' },
          { value: 'passport', label: 'International Passport' },
          { value: 'drivers_license', label: "Driver's License" },
          { value: 'voters_card', label: "Voter's ID" },
        ]
      : idTypes;

    const manualVerified = organizer?.kyc_verified || organizer?.kyc_status === 'verified';
    const manualInReview = organizer?.kyc_status === 'in_review';

    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Identity Verification</h2>
          <p className="text-muted-foreground mt-1">Verify your identity to receive payouts in {countryName}</p>
        </div>

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {manualVerified ? (
          <Card className="border-green-200 bg-green-50/50 rounded-2xl overflow-hidden">
            <div className="h-2 bg-green-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Identity Verified</h3>
                  <p className="text-muted-foreground">You're all set to receive payouts.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : manualInReview ? (
          <Card className="border-yellow-200 bg-yellow-50/50 rounded-2xl overflow-hidden">
            <div className="h-2 bg-yellow-500" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Verification In Review</h3>
                  <p className="text-muted-foreground">Our team is reviewing your documents. This usually takes 24-48 hours.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/10 rounded-2xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Verify Your Identity</h3>
                  <p className="text-muted-foreground">Upload a valid government-issued ID to get verified</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>ID Type *</Label>
                  <Select value={manualIdType} onValueChange={setManualIdType}>
                    <SelectTrigger className="h-12 rounded-xl mt-1">
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {manualIdTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Upload Document *</Label>
                  <input
                    ref={manualFileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setManualIdFile(e.target.files?.[0] || null)}
                  />
                  <div
                    onClick={() => manualFileInputRef.current?.click()}
                    className="mt-1 border-2 border-dashed border-border/20 rounded-xl p-8 text-center cursor-pointer hover:border-[#2969FF] transition-colors"
                  >
                    {manualIdFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium">{manualIdFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload (PNG, JPG, PDF - Max 5MB)</p>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleManualUpload}
                  disabled={uploading || !manualIdFile || !manualIdType}
                  className="w-full h-12 bg-[#2969FF] hover:bg-[#1e4fd6] text-white rounded-xl"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" />Submit for Review</>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Your documents are stored securely and reviewed by our team within 24-48 hours.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-blue-200 bg-blue-50 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-2">Why verify your identity?</h3>
                <ul className="text-sm text-foreground/70 space-y-1">
                  <li>• <strong>Security:</strong> Protect your account and earnings</li>
                  <li>• <strong>Payouts:</strong> Required to receive event proceeds</li>
                  <li>• <strong>Trust:</strong> Build credibility with your attendees</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Nigeria BVN verification flow
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">KYC Verification</h2>
        <p className="text-muted-foreground mt-1">Complete verification to unlock higher payout limits</p>
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Current Status Card */}
      <Card className="border-border/10 rounded-2xl overflow-hidden">
        <div className={`h-2 ${currentLevel >= 3 ? 'bg-green-500' : currentLevel >= 2 ? 'bg-purple-500' : currentLevel >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                currentLevel >= 3 ? 'bg-green-100' : currentLevel >= 2 ? 'bg-purple-100' : currentLevel >= 1 ? 'bg-blue-100' : 'bg-muted'
              }`}>
                <Shield className={`w-8 h-8 ${
                  currentLevel >= 3 ? 'text-green-600' : currentLevel >= 2 ? 'text-purple-600' : currentLevel >= 1 ? 'text-blue-600' : 'text-muted-foreground'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {currentLevel === 0 ? 'Not Verified' : `Level ${currentLevel}: ${verificationLevels[currentLevel - 1]?.name}`}
                </h3>
                <p className="text-muted-foreground">
                  Monthly Payout Limit: <span className="font-medium">{formatCurrency(kyc?.monthly_payout_limit || 0)}</span>
                </p>
              </div>
            </div>
            {getStatusBadge(kyc?.status || 'pending')}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Verification Progress</span>
              <span className="font-medium">{currentLevel}/3 Levels</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  currentLevel >= 3 ? 'bg-green-500' : currentLevel >= 2 ? 'bg-purple-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Levels */}
      <div className="space-y-3">
        {verificationLevels.map((level) => {
          const isCompleted = currentLevel >= level.level;
          const isNext = currentLevel === level.level - 1;
          const isLocked = currentLevel < level.level - 1;

          return (
            <Card 
              key={level.level} 
              className={`border rounded-2xl transition-all ${
                isCompleted ? 'border-green-200 bg-green-50/50' : 
                isNext ? 'border-[#2969FF] bg-[#2969FF]/5' : 
                'border-border/10 opacity-60'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isCompleted ? 'bg-green-100' : 
                      isNext ? 'bg-blue-100' : 
                      'bg-muted'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : isLocked ? (
                        <Lock className="w-6 h-6 text-muted-foreground" />
                      ) : (
                        <span className="text-lg font-bold text-blue-600">{level.level}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">Level {level.level}: {level.name}</h4>
                        {isCompleted && (
                          <Badge className="bg-green-100 text-green-700 text-xs">Completed</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{level.description}</p>
                      <p className="text-sm text-muted-foreground">Limit: <span className="font-medium">{level.limit}</span></p>
                    </div>
                  </div>

                  {isNext && (
                    <Button
                      onClick={() => {
                        setError('');
                        setSuccess('');
                        if (level.level === 1) setIsBvnDialogOpen(true);
                        else if (level.level === 2) setIsIdDialogOpen(true);
                        else if (level.level === 3) setIsCacDialogOpen(true);
                      }}
                      className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                    >
                      Start Verification
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {level.requirements.map((req, i) => {
                    const isReqCompleted = 
                      (req === 'BVN' && kyc?.bvn_verified) ||
                      (req === 'Government ID' && kyc?.id_verified) ||
                      (req === 'CAC Certificate' && kyc?.cac_verified);

                    return (
                      <span
                        key={i}
                        className={`text-xs px-2 py-1 rounded-lg ${
                          isReqCompleted ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isReqCompleted && <CheckCircle className="w-3 h-3 inline mr-1" />}
                        {req}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground mb-2">Why verify your identity?</h3>
              <ul className="text-sm text-foreground/70 space-y-1">
                <li>• <strong>Security:</strong> Protect your account and earnings</li>
                <li>• <strong>Higher Limits:</strong> Unlock higher monthly payout limits</li>
                <li>• <strong>Trust:</strong> Build credibility with your attendees</li>
                <li>• <strong>Compliance:</strong> Meet CBN and NDIC financial regulations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BVN Verification Dialog */}
      <Dialog open={isBvnDialogOpen} onOpenChange={setIsBvnDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#2969FF]" />
              BVN Verification
            </DialogTitle>
            <DialogDescription>
              Enter your BVN details for instant verification via Paystack
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bank Verification Number (BVN) *</Label>
              <div className="relative">
                <Input
                  type={showBvn ? 'text' : 'password'}
                  placeholder="Enter 11-digit BVN"
                  value={bvnForm.bvn}
                  onChange={(e) => setBvnForm({ ...bvnForm, bvn: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  className="h-12 rounded-xl pr-10"
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={() => setShowBvn(!showBvn)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  {showBvn ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Your BVN is encrypted and secure</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  placeholder="As on BVN"
                  value={bvnForm.firstName}
                  onChange={(e) => setBvnForm({ ...bvnForm, firstName: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  placeholder="As on BVN"
                  value={bvnForm.lastName}
                  onChange={(e) => setBvnForm({ ...bvnForm, lastName: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={bvnForm.dob}
                  onChange={(e) => setBvnForm({ ...bvnForm, dob: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  placeholder="As on BVN"
                  value={bvnForm.phone}
                  onChange={(e) => setBvnForm({ ...bvnForm, phone: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>

            <div className="p-3 bg-muted rounded-xl text-sm text-muted-foreground">
              <p>🔒 Your data is verified securely via Paystack and is never stored in plain text.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsBvnDialogOpen(false)}
                className="flex-1 h-12 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={verifyBvn}
                disabled={verifying || !bvnForm.bvn || !bvnForm.firstName || !bvnForm.lastName}
                className="flex-1 h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4 mr-2" />
                    Verify BVN
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ID Document Dialog */}
      <Dialog open={isIdDialogOpen} onOpenChange={setIsIdDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2969FF]" />
              ID Document Verification
            </DialogTitle>
            <DialogDescription>
              Upload a valid government-issued ID
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ID Type *</Label>
              <Select value={idForm.idType} onValueChange={(v) => setIdForm({ ...idForm, idType: v })}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {idTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ID Number *</Label>
              <Input
                placeholder="Enter ID number"
                value={idForm.idNumber}
                onChange={(e) => setIdForm({ ...idForm, idNumber: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Upload ID Document *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleIdFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/20 rounded-xl p-6 text-center cursor-pointer hover:border-[#2969FF] transition-colors"
              >
                {idFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-[#2969FF]" />
                    <span className="text-sm font-medium">{idFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload (PNG, JPG, PDF - Max 5MB)</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsIdDialogOpen(false)}
                className="flex-1 h-12 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={submitIdDocument}
                disabled={uploading || !idForm.idType || !idForm.idNumber || !idFile}
                className="flex-1 h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CAC Dialog */}
      <Dialog open={isCacDialogOpen} onOpenChange={setIsCacDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#2969FF]" />
              Business Verification
            </DialogTitle>
            <DialogDescription>
              Upload your CAC registration certificate
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CAC Registration Number *</Label>
              <Input
                placeholder="e.g., RC123456"
                value={cacNumber}
                onChange={(e) => setCacNumber(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Upload CAC Certificate *</Label>
              <input
                ref={cacFileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleCacFileChange}
                className="hidden"
              />
              <div
                onClick={() => cacFileInputRef.current?.click()}
                className="border-2 border-dashed border-border/20 rounded-xl p-6 text-center cursor-pointer hover:border-[#2969FF] transition-colors"
              >
                {cacFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-[#2969FF]" />
                    <span className="text-sm font-medium">{cacFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload (PNG, JPG, PDF - Max 5MB)</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsCacDialogOpen(false)}
                className="flex-1 h-12 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={submitCacDocument}
                disabled={uploading || !cacNumber || !cacFile}
                className="flex-1 h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
