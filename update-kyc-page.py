#!/usr/bin/env python3
"""
Update KYCVerification.jsx to support country-based verification methods:
- Nigeria/Ghana: Paystack BVN
- US/UK/CA: Stripe Identity
"""

file_path = '/Users/bajideace/Desktop/ticketrack/src/pages/organizer/KYCVerification.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add Zap icon to imports
old_import = "import { \n  Upload, CheckCircle, AlertCircle, FileText, User, Building2, \n  Loader2, Shield, CreditCard, Phone, Calendar, Eye, EyeOff,\n  BadgeCheck, Clock, XCircle, Info, ChevronRight, Lock\n} from 'lucide-react';"
new_import = "import { \n  Upload, CheckCircle, AlertCircle, FileText, User, Building2, \n  Loader2, Shield, CreditCard, Phone, Calendar, Eye, EyeOff,\n  BadgeCheck, Clock, XCircle, Info, ChevronRight, Lock, Zap, Globe\n} from 'lucide-react';"
content = content.replace(old_import, new_import)

# 2. Add state for Stripe Identity after existing states
old_cac_state = "  // CAC Dialog\n  const [isCacDialogOpen, setIsCacDialogOpen] = useState(false);\n  const [cacNumber, setCacNumber] = useState('');\n  const [cacFile, setCacFile] = useState(null);"
new_cac_state = """  // CAC Dialog
  const [isCacDialogOpen, setIsCacDialogOpen] = useState(false);
  const [cacNumber, setCacNumber] = useState('');
  const [cacFile, setCacFile] = useState(null);
  
  // Stripe Identity (for US/UK/CA)
  const [stripeIdentityLoading, setStripeIdentityLoading] = useState(false);
  
  // Manual upload fallback
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [manualIdFile, setManualIdFile] = useState(null);
  const [manualIdType, setManualIdType] = useState('');
  const manualFileInputRef = useRef(null);"""
content = content.replace(old_cac_state, new_cac_state)

# 3. Add country detection helper and Stripe Identity function after loadKycData
old_load_kyc_end = """      setKyc(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };"""

new_load_kyc_end = """      setKyc(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Country-based verification method detection
  const getVerificationMethod = () => {
    const country = organizer?.country_code;
    if (['NG', 'GH'].includes(country)) return 'paystack';
    if (['US', 'GB', 'CA'].includes(country)) return 'stripe_identity';
    return 'manual';
  };

  const isStripeIdentityCountry = ['US', 'GB', 'CA'].includes(organizer?.country_code);
  const isPaystackCountry = ['NG', 'GH'].includes(organizer?.country_code);
  
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
  };"""
content = content.replace(old_load_kyc_end, new_load_kyc_end)

# 4. Add Stripe Identity UI section before the verification levels
# Find the return statement and add the stripe identity section
old_return_start = """  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F0F0F]">KYC Verification</h2>
        <p className="text-[#0F0F0F]/60 mt-1">Complete verification to unlock higher payout limits</p>
      </div>"""

new_return_start = """  // If Stripe Connect is active, show verified status
  if (isConnectVerified) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">KYC Verification</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Your identity has been verified</p>
        </div>
        
        <Card className="border-green-200 bg-green-50/50 rounded-2xl overflow-hidden">
          <div className="h-2 bg-green-500" />
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#0F0F0F]">Verified via Stripe Connect</h3>
                <p className="text-[#0F0F0F]/60">Your identity was verified when you connected your Stripe account.</p>
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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Identity Verification</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Verify your identity to receive payouts</p>
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
                  <h3 className="text-lg font-semibold text-[#0F0F0F]">Identity Verified</h3>
                  <p className="text-[#0F0F0F]/60">You're all set to receive payouts.</p>
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
                  <h3 className="text-lg font-semibold text-[#0F0F0F]">Verification in Progress</h3>
                  <p className="text-[#0F0F0F]/60">We're reviewing your documents. This usually takes a few minutes.</p>
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
                  <h3 className="text-lg font-semibold text-[#0F0F0F]">Additional Information Needed</h3>
                  <p className="text-[#0F0F0F]/60 mb-3">We need more information to complete your verification.</p>
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
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#0F0F0F]">Verify Your Identity</h3>
                  <p className="text-[#0F0F0F]/60">Quick and secure verification powered by Stripe</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-[#F4F6FA] rounded-xl">
                  <CreditCard className="w-6 h-6 text-[#2969FF] mb-2" />
                  <p className="font-medium text-sm">Government ID</p>
                  <p className="text-xs text-[#0F0F0F]/60">Passport, Driver's License, or ID Card</p>
                </div>
                <div className="p-4 bg-[#F4F6FA] rounded-xl">
                  <User className="w-6 h-6 text-[#2969FF] mb-2" />
                  <p className="font-medium text-sm">Selfie Verification</p>
                  <p className="text-xs text-[#0F0F0F]/60">Quick photo to match your ID</p>
                </div>
                <div className="p-4 bg-[#F4F6FA] rounded-xl">
                  <Shield className="w-6 h-6 text-[#2969FF] mb-2" />
                  <p className="font-medium text-sm">Instant Results</p>
                  <p className="text-xs text-[#0F0F0F]/60">Usually verified in minutes</p>
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

              <p className="text-xs text-[#0F0F0F]/60 text-center">
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
                  className="mt-1 border-2 border-dashed border-[#0F0F0F]/20 rounded-xl p-6 text-center cursor-pointer hover:border-[#2969FF] transition-colors"
                >
                  {manualIdFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="text-sm">{manualIdFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-[#0F0F0F]/40 mb-2" />
                      <p className="text-sm text-[#0F0F0F]/60">Click to upload</p>
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

  // Original Paystack/Nigeria flow continues below...
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F0F0F]">KYC Verification</h2>
        <p className="text-[#0F0F0F]/60 mt-1">Complete verification to unlock higher payout limits</p>
      </div>"""

content = content.replace(old_return_start, new_return_start)

with open(file_path, 'w') as f:
    f.write(content)

print("✅ KYCVerification.jsx updated:")
print("   - Added country detection")
print("   - Added Stripe Identity flow for US/UK/CA")
print("   - Added manual upload fallback")
print("   - Connect verified = auto KYC verified")
print("   - Preserved existing Nigeria/Paystack flow")
