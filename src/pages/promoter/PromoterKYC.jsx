import { useState, useEffect, useRef } from 'react';
import {
  Upload, CheckCircle, AlertCircle, FileText, User,
  Loader2, Shield, CreditCard, Clock, XCircle, Info, Lock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePromoter } from '@/contexts/PromoterContext';
import { supabase } from '@/lib/supabase';

const verificationLevels = [
  {
    level: 1,
    name: 'Basic',
    description: 'Identity Verification',
    limit: '₦200,000/month',
    requirements: ['Government ID'],
    color: 'blue',
  },
  {
    level: 2,
    name: 'Standard',
    description: 'Full Verification',
    limit: '₦1,000,000/month',
    requirements: ['Government ID', 'Proof of Address'],
    color: 'purple',
  },
];

const idTypes = [
  { value: 'national_id', label: 'National ID Card' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'International Passport' },
  { value: 'voters_card', label: "Voter's Card" },
];

export function PromoterKYC() {
  const { promoter, refreshPromoter } = usePromoter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [kyc, setKyc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ID Dialog
  const [isIdDialogOpen, setIsIdDialogOpen] = useState(false);
  const [idForm, setIdForm] = useState({
    idType: '',
    idNumber: '',
  });
  const [idFile, setIdFile] = useState(null);

  useEffect(() => {
    if (promoter?.id) {
      loadKycData();
    }
  }, [promoter?.id]);

  const loadKycData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promoter_kyc')
        .select('*')
        .eq('promoter_id', promoter.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading KYC:', error);
      }

      setKyc(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-gray-600"><AlertCircle className="w-3 h-3 mr-1" />Not Started</Badge>;
    }
  };

  const handleIdFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setIdFile(file);
    }
  };

  const handleSubmitId = async () => {
    if (!idForm.idType || !idForm.idNumber || !idFile) {
      setError('Please fill all fields and upload your ID');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload file
      const fileExt = idFile.name.split('.').pop();
      const fileName = `${promoter.id}/id_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, idFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);

      // Save KYC record
      const kycData = {
        promoter_id: promoter.id,
        id_type: idForm.idType,
        id_number: idForm.idNumber,
        id_document_url: publicUrl,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      };

      if (kyc?.id) {
        await supabase.from('promoter_kyc').update(kycData).eq('id', kyc.id);
      } else {
        await supabase.from('promoter_kyc').insert(kycData);
      }

      setSuccess('Your ID has been submitted for verification. This usually takes 1-2 business days.');
      setIsIdDialogOpen(false);
      loadKycData();
    } catch (err) {
      setError(err.message || 'Failed to submit verification');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  const currentLevel = kyc?.verification_level || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">KYC Verification</h2>
        <p className="text-gray-600">Verify your identity to unlock higher payout limits</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <p>{success}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Status */}
      <Card className="border-gray-200 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#2969FF]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Verification Status</h3>
                <p className="text-sm text-gray-600">Level {currentLevel} - {verificationLevels[currentLevel]?.name || 'Unverified'}</p>
              </div>
            </div>
            {getStatusBadge(kyc?.status)}
          </div>

          {kyc?.status === 'rejected' && kyc?.rejection_reason && (
            <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700 mt-4">
              <strong>Rejection Reason:</strong> {kyc.rejection_reason}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Levels */}
      <div className="grid md:grid-cols-2 gap-4">
        {verificationLevels.map((level) => (
          <Card
            key={level.level}
            className={`border-gray-200 rounded-2xl ${currentLevel >= level.level ? 'border-green-500 border-2' : ''}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-${level.color}-100 flex items-center justify-center`}>
                    {currentLevel >= level.level ? (
                      <CheckCircle className={`w-5 h-5 text-green-600`} />
                    ) : (
                      <Lock className={`w-5 h-5 text-${level.color}-600`} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Level {level.level}: {level.name}</h4>
                    <p className="text-sm text-gray-600">{level.description}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">Payout Limit: <span className="font-semibold text-gray-900">{level.limit}</span></p>
                <div className="text-sm text-gray-600">
                  Requirements:
                  <ul className="list-disc list-inside mt-1">
                    {level.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {currentLevel < level.level && (
                <Button
                  onClick={() => setIsIdDialogOpen(true)}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  disabled={kyc?.status === 'pending'}
                >
                  {kyc?.status === 'pending' ? 'Verification Pending' : 'Start Verification'}
                </Button>
              )}

              {currentLevel >= level.level && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Why verify?</h4>
              <p className="text-sm text-gray-600">
                KYC verification helps us comply with financial regulations and protects you from fraud.
                Higher verification levels unlock higher payout limits for your commissions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ID Submission Dialog */}
      <Dialog open={isIdDialogOpen} onOpenChange={setIsIdDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Submit Identity Document</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>ID Type *</Label>
              <Select value={idForm.idType} onValueChange={(v) => setIdForm({ ...idForm, idType: v })}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue placeholder="Select ID type" />
                </SelectTrigger>
                <SelectContent>
                  {idTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>ID Number *</Label>
              <Input
                value={idForm.idNumber}
                onChange={(e) => setIdForm({ ...idForm, idNumber: e.target.value })}
                placeholder="Enter your ID number"
                className="rounded-xl mt-1"
              />
            </div>

            <div>
              <Label>Upload ID Document *</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#2969FF] transition-colors"
              >
                {idFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <FileText className="w-5 h-5" />
                    <span>{idFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to upload your ID</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG or PDF (max 5MB)</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleIdFileChange}
                className="hidden"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIdDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitId}
              disabled={uploading}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
