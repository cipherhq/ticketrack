import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getCurrencyFromCountryCode } from '@/config/currencies';
import {
  Megaphone, Upload, CheckCircle, Eye, Globe,
  ChevronDown, ChevronUp, X, Loader2,
  ArrowRight, ArrowLeft, Zap, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountryPickerDialog } from '@/components/CountryPickerDialog';
import { AdStepIndicator } from '@/components/AdStepIndicator';

const COUNTRY_OPTIONS = [
  { code: 'NG', label: 'Nigeria' },
  { code: 'GH', label: 'Ghana' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'KE', label: 'Kenya' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'CA', label: 'Canada' },
];

const POSITION_LABELS = {
  top: 'Homepage Banner (Top)',
  bottom: 'Homepage Banner (Bottom)',
  right: 'Event Page Sidebar',
};

const POSITION_DIMENSIONS = {
  top: '1200 x 300 px',
  bottom: '1200 x 300 px',
  right: '300 x 250 px',
};

const FAQ_ITEMS = [
  {
    q: 'How long does approval take?',
    a: 'Most ads are reviewed and approved within 24 hours. You\'ll receive an email notification once your ad is approved or if we need any changes.',
  },
  {
    q: 'What ad formats are supported?',
    a: 'We support JPEG, PNG, GIF images and MP4 videos. For banners, we recommend 1200x300px. For sidebar ads, 300x250px works best.',
  },
  {
    q: 'Can I target specific countries?',
    a: 'Yes! You can select one or more countries to target, or leave it as Global to show your ad to all visitors worldwide.',
  },
  {
    q: 'What happens when my ad expires?',
    a: 'Your ad automatically stops showing after the duration ends. No action needed. You can purchase a new package anytime to run another campaign.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Refunds are available for ads that haven\'t been approved yet. Once an ad is approved and live, refunds are not available.',
  },
  {
    q: 'How are impressions and clicks tracked?',
    a: 'We track impressions when your ad is visible on screen and clicks when users interact with it. You can view real-time stats in your dashboard.',
  },
];

export function WebAdvertise() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [currency, setCurrency] = useState('NGN');
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepErrors, setStepErrors] = useState({});

  // Form state
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserEmail, setAdvertiserEmail] = useState('');
  const [advertiserPhone, setAdvertiserPhone] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [targetCountries, setTargetCountries] = useState([]);
  const [creativeUrl, setCreativeUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Renewal/resubmit state from navigation
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPackages();
  }, []);

  // Handle renewal/resubmit from My Ads
  useEffect(() => {
    if (!location.state) return;
    const { renewAd, resubmit } = location.state;
    if (!renewAd) return;

    setAdvertiserName(renewAd.advertiser_name || '');
    setAdvertiserEmail(renewAd.advertiser_email || '');
    setAdvertiserPhone(renewAd.advertiser_phone || '');
    setLinkUrl(renewAd.link_url || '');
    setTargetCountries(renewAd.target_countries || []);

    if (resubmit) {
      setRejectionReason(renewAd.rejection_reason || '');
      // Clear creative for resubmit
      setCreativeUrl('');
    } else {
      setCreativeUrl(renewAd.image_url || '');
      setMediaType(renewAd.media_type || 'image');
    }

    // Try to pre-select the package once packages load
    if (renewAd.package_id) {
      // Will be handled after packages load
    }
  }, [location.state]);

  // Pre-select package for renewal after packages load
  useEffect(() => {
    if (!location.state?.renewAd?.package_id || packages.length === 0) return;
    const matchingPkg = packages.find(p => p.id === location.state.renewAd.package_id && p.is_active);
    if (matchingPkg) {
      setSelectedPackage(matchingPkg);
      setCurrency(matchingPkg.currency);
      setCompletedSteps(new Set([0]));
      setCurrentStep(1);
    }
    // If package not found/inactive, stay at step 0
  }, [packages, location.state]);

  // Check if user has country_code set
  useEffect(() => {
    const checkCountry = async () => {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('country_code')
          .eq('id', user.id)
          .single();
        if (profile?.country_code) {
          const detected = await getCurrencyFromCountryCode(supabase, profile.country_code);
          if (detected && ['NGN', 'USD', 'GBP', 'GHS', 'CAD'].includes(detected)) {
            setCurrency(detected);
          }
        } else {
          setShowCountryPicker(true);
        }
      } catch {
        // Fall back to default
      }
    };
    checkCountry();
  }, [user?.id]);

  const handleCountrySelected = async (countryCode) => {
    setShowCountryPicker(false);
    const detected = await getCurrencyFromCountryCode(supabase, countryCode);
    if (detected && ['NGN', 'USD', 'GBP', 'GHS', 'CAD'].includes(detected)) {
      setCurrency(detected);
    }
  };

  useEffect(() => {
    if (user) {
      setAdvertiserEmail(prev => prev || user.email || '');
    }
  }, [user]);

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from('ad_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!error && data) {
      setPackages(data);
    }
    setLoadingPackages(false);
  };

  const filteredPackages = packages.filter(p => p.currency === currency);

  const groupedPackages = filteredPackages.reduce((acc, pkg) => {
    const pos = pkg.position;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(pkg);
    return acc;
  }, {});

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Please upload an image or video file');
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large. Max size: ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `adverts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    setCreativeUrl(urlData.publicUrl);
    setMediaType(isVideo ? 'video' : 'image');
    setUploading(false);
    setStepErrors(prev => ({ ...prev, 1: null }));
  };

  const toggleCountry = (code) => {
    setTargetCountries(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  // Validation per step
  const validateStep = (step) => {
    switch (step) {
      case 0:
        if (!selectedPackage) {
          setStepErrors(prev => ({ ...prev, 0: 'Please select a package' }));
          return false;
        }
        break;
      case 1:
        if (!creativeUrl) {
          setStepErrors(prev => ({ ...prev, 1: 'Please upload your ad creative' }));
          return false;
        }
        break;
      case 2:
        if (!advertiserName.trim()) {
          setStepErrors(prev => ({ ...prev, 2: 'Advertiser name is required' }));
          return false;
        }
        if (!advertiserEmail.trim()) {
          setStepErrors(prev => ({ ...prev, 2: 'Email is required' }));
          return false;
        }
        break;
      default:
        break;
    }
    setStepErrors(prev => ({ ...prev, [step]: null }));
    return true;
  };

  const goToNextStep = () => {
    // Auth gate: require login to proceed past step 0
    if (currentStep === 0 && !user) {
      navigate('/login', { state: { from: '/advertise' } });
      return;
    }

    if (!validateStep(currentStep)) return;

    setCompletedSteps(prev => new Set([...prev, currentStep]));
    setCurrentStep(prev => Math.min(prev + 1, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (step) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setStepErrors(prev => ({ ...prev, 0: null }));
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/advertise' } });
      return;
    }

    if (!selectedPackage || !creativeUrl || !advertiserName || !advertiserEmail) {
      alert('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const provider = ['NGN', 'GHS', 'KES', 'ZAR'].includes(selectedPackage.currency)
        ? 'paystack'
        : 'stripe';

      if (provider === 'paystack') {
        const { data: adRecord, error: adError } = await supabase
          .from('platform_adverts')
          .insert({
            position: selectedPackage.position,
            advertiser_name: advertiserName,
            image_url: creativeUrl,
            media_type: mediaType,
            link_url: linkUrl,
            price: selectedPackage.price,
            currency: selectedPackage.currency,
            payment_status: 'pending',
            approval_status: 'pending',
            is_active: false,
            submitted_by: user.id,
            advertiser_email: advertiserEmail,
            advertiser_phone: advertiserPhone,
            duration_days: selectedPackage.duration_days,
            target_countries: targetCountries,
            package_id: selectedPackage.id,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + selectedPackage.duration_days * 86400000).toISOString(),
          })
          .select()
          .single();

        if (adError) throw adError;

        const reference = `AD-${adRecord.id.substring(0, 8)}-${Date.now()}`;

        const handler = window.PaystackPop?.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: advertiserEmail,
          amount: Math.round(selectedPackage.price * 100),
          currency: selectedPackage.currency,
          ref: reference,
          metadata: {
            type: 'ad_purchase',
            ad_id: adRecord.id,
            package_id: selectedPackage.id,
          },
          callback: function(response) {
            supabase
              .from('platform_adverts')
              .update({
                payment_status: 'paid',
                payment_reference: response.reference,
              })
              .eq('id', adRecord.id)
              .then(function() {
                setSubmitted(true);
              });
          },
          onClose: function() {
            setSubmitting(false);
          },
        });

        if (handler) {
          handler.openIframe();
        } else {
          const { data: result } = await supabase.functions.invoke('create-ad-checkout', {
            body: {
              packageId: selectedPackage.id,
              adId: adRecord.id,
              email: advertiserEmail,
              provider: 'paystack',
              callbackUrl: `${window.location.origin}/advertise?payment=success&ad_id=${adRecord.id}`,
            },
          });

          if (result?.authorization_url) {
            window.location.href = result.authorization_url;
            return;
          }
          throw new Error(result?.error || 'Payment initialization failed');
        }
      } else {
        const { data: adRecord, error: adError } = await supabase
          .from('platform_adverts')
          .insert({
            position: selectedPackage.position,
            advertiser_name: advertiserName,
            image_url: creativeUrl,
            media_type: mediaType,
            link_url: linkUrl,
            price: selectedPackage.price,
            currency: selectedPackage.currency,
            payment_status: 'pending',
            approval_status: 'pending',
            is_active: false,
            submitted_by: user.id,
            advertiser_email: advertiserEmail,
            advertiser_phone: advertiserPhone,
            duration_days: selectedPackage.duration_days,
            target_countries: targetCountries,
            package_id: selectedPackage.id,
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + selectedPackage.duration_days * 86400000).toISOString(),
          })
          .select()
          .single();

        if (adError) throw adError;

        const { data: result } = await supabase.functions.invoke('create-ad-checkout', {
          body: {
            packageId: selectedPackage.id,
            adId: adRecord.id,
            email: advertiserEmail,
            provider: 'stripe',
            callbackUrl: `${window.location.origin}/advertise?payment=success&ad_id=${adRecord.id}`,
          },
        });

        if (result?.url) {
          window.location.href = result.url;
          return;
        }
        throw new Error(result?.error || 'Payment initialization failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
      setSubmitting(false);
    }
  };

  // Check for payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setSubmitted(true);
      window.history.replaceState({}, '', '/advertise');
    }
  }, []);

  // Enhanced success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">Ad Submitted Successfully!</h1>

          {/* What happens next timeline */}
          <div className="bg-card border rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold text-foreground mb-4">What happens next?</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-blue-600">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Review (within 24 hours)</p>
                  <p className="text-sm text-muted-foreground">Our team reviews your ad creative and details.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-blue-600">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Email Notification</p>
                  <p className="text-sm text-muted-foreground">You'll receive an email at <strong>{advertiserEmail || 'your email'}</strong> once approved.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-green-600">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Goes Live</p>
                  <p className="text-sm text-muted-foreground">Your ad starts showing to your target audience automatically.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate('/my-ads')}
              className="rounded-xl bg-[#2969FF] hover:bg-[#1a4fd8]"
            >
              View My Ads
            </Button>
            <Button
              onClick={() => {
                setSubmitted(false);
                setCurrentStep(0);
                setCompletedSteps(new Set());
                setSelectedPackage(null);
                setCreativeUrl('');
                setAdvertiserName('');
                setLinkUrl('');
                setTargetCountries([]);
                setRejectionReason('');
              }}
              variant="outline"
              className="rounded-xl"
            >
              Submit Another Ad
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step content renderers
  const renderStep0 = () => (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-foreground mb-2">Choose a Package</h2>
        <p className="text-muted-foreground text-sm mb-4">Select the package that fits your campaign goals</p>

        {/* Currency Selector */}
        <div className="inline-flex bg-muted rounded-xl p-1 gap-1 flex-wrap justify-center">
          {['NGN', 'USD', 'GBP', 'GHS', 'CAD'].map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currency === c
                  ? 'bg-[#2969FF] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loadingPackages ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedPackages).map(([position, pkgs]) => (
            <div key={position}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {POSITION_LABELS[position] || position}
                </h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {POSITION_DIMENSIONS[position]}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {pkgs.map(pkg => {
                  const isSelected = selectedPackage?.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => handleSelectPackage(pkg)}
                      className={`text-left bg-card rounded-xl p-5 shadow-sm border-2 transition-all ${
                        isSelected
                          ? 'border-[#2969FF] ring-1 ring-[#2969FF]/20'
                          : 'border-transparent hover:border-blue-200 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">{pkg.duration_days} days</span>
                        <span className="text-xl font-bold text-[#2969FF]">
                          {formatPrice(pkg.price, pkg.currency)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>
                      <div className={`text-center py-1.5 rounded-lg text-sm font-medium ${
                        isSelected
                          ? 'bg-[#2969FF] text-white'
                          : 'bg-muted text-foreground'
                      }`}>
                        {isSelected ? 'Selected' : 'Select'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {stepErrors[0] && (
        <p className="text-red-500 text-sm text-center mt-4 flex items-center justify-center gap-1">
          <AlertCircle className="w-4 h-4" /> {stepErrors[0]}
        </p>
      )}
    </div>
  );

  const renderStep1 = () => (
    <div>
      {/* Selected package summary */}
      {selectedPackage && (
        <div className="bg-muted/50 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Selected Package</p>
            <p className="font-medium text-foreground">
              {POSITION_LABELS[selectedPackage.position]} &middot; {selectedPackage.duration_days} days
            </p>
          </div>
          <p className="text-lg font-bold text-[#2969FF]">
            {formatPrice(selectedPackage.price, selectedPackage.currency)}
          </p>
        </div>
      )}

      {/* Rejection reason for resubmissions */}
      {rejectionReason && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Previous ad was rejected</p>
              <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">{rejectionReason}</p>
              <p className="text-sm text-muted-foreground mt-2">Please upload a new creative that addresses the feedback above.</p>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold text-foreground mb-2">Upload Creative</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Upload your ad image or video. Recommended dimensions: <strong>{POSITION_DIMENSIONS[selectedPackage?.position] || '1200 x 300 px'}</strong>
      </p>

      <div className="border-2 border-dashed border-border/30 rounded-xl p-6">
        {creativeUrl ? (
          <div className="relative">
            <div className={`bg-muted rounded-lg overflow-hidden mx-auto ${
              selectedPackage?.position === 'right'
                ? 'w-[300px] h-[250px]'
                : 'w-full h-[150px] md:h-[200px]'
            }`}>
              {mediaType === 'video' ? (
                <video src={creativeUrl} className="w-full h-full object-cover" controls />
              ) : (
                <img src={creativeUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
            <button
              type="button"
              onClick={() => { setCreativeUrl(''); setStepErrors(prev => ({ ...prev, 1: null })); }}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center cursor-pointer py-8">
            <Upload className="text-muted-foreground mb-3" size={40} />
            <span className="text-foreground font-medium">Click to upload image or video</span>
            <span className="text-sm text-muted-foreground mt-1">
              JPEG, PNG, GIF or MP4 &middot; Max {selectedPackage?.position === 'right' ? '10MB' : '10MB'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              Recommended: {POSITION_DIMENSIONS[selectedPackage?.position] || '1200 x 300 px'}
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
        {uploading && (
          <div className="text-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-[#2969FF] mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
          </div>
        )}
      </div>

      {stepErrors[1] && (
        <p className="text-red-500 text-sm mt-4 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" /> {stepErrors[1]}
        </p>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-2">Ad Details</h2>
      <p className="text-muted-foreground text-sm mb-6">Tell us about your ad and where to send clicks</p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Advertiser / Business Name *</label>
          <input
            type="text"
            value={advertiserName}
            onChange={(e) => { setAdvertiserName(e.target.value); setStepErrors(prev => ({ ...prev, 2: null })); }}
            className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            placeholder="Your company name"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email *</label>
            <input
              type="email"
              value={advertiserEmail}
              onChange={(e) => { setAdvertiserEmail(e.target.value); setStepErrors(prev => ({ ...prev, 2: null })); }}
              className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone (optional)</label>
            <input
              type="tel"
              value={advertiserPhone}
              onChange={(e) => setAdvertiserPhone(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
              placeholder="+234..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Destination Link URL</label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            placeholder="https://yourwebsite.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Target Countries</label>
          <p className="text-xs text-muted-foreground mb-3">Select countries to target, or leave empty for global reach</p>
          <div className="flex flex-wrap gap-2">
            {COUNTRY_OPTIONS.map(country => (
              <button
                key={country.code}
                type="button"
                onClick={() => toggleCountry(country.code)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  targetCountries.includes(country.code)
                    ? 'bg-[#2969FF] text-white border-[#2969FF]'
                    : 'bg-background text-foreground border-border hover:border-blue-300'
                }`}
              >
                {country.label}
              </button>
            ))}
          </div>
          {targetCountries.length === 0 && (
            <p className="text-xs text-[#2969FF] mt-2 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Global - shown to all visitors
            </p>
          )}
        </div>
      </div>

      {stepErrors[2] && (
        <p className="text-red-500 text-sm mt-4 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" /> {stepErrors[2]}
        </p>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-2">Review & Pay</h2>
      <p className="text-muted-foreground text-sm mb-6">Review your ad details before submitting</p>

      <div className="space-y-4">
        {/* Package */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-foreground">Package</h3>
            <button onClick={() => goToStep(0)} className="text-sm text-[#2969FF] hover:underline">Edit</button>
          </div>
          <p className="text-sm text-muted-foreground">
            {POSITION_LABELS[selectedPackage?.position]} &middot; {selectedPackage?.duration_days} days
          </p>
          <p className="text-lg font-bold text-[#2969FF] mt-1">
            {formatPrice(selectedPackage?.price, selectedPackage?.currency)}
          </p>
        </div>

        {/* Creative */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-foreground">Creative</h3>
            <button onClick={() => goToStep(1)} className="text-sm text-[#2969FF] hover:underline">Edit</button>
          </div>
          {creativeUrl && (
            <div className={`bg-muted rounded-lg overflow-hidden ${
              selectedPackage?.position === 'right'
                ? 'w-[150px] h-[125px]'
                : 'w-full h-[100px] md:h-[120px]'
            }`}>
              {mediaType === 'video' ? (
                <video src={creativeUrl} className="w-full h-full object-cover" muted />
              ) : (
                <img src={creativeUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-foreground">Details</h3>
            <button onClick={() => goToStep(2)} className="text-sm text-[#2969FF] hover:underline">Edit</button>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {advertiserName}</p>
            <p><span className="text-muted-foreground">Email:</span> {advertiserEmail}</p>
            {advertiserPhone && <p><span className="text-muted-foreground">Phone:</span> {advertiserPhone}</p>}
            {linkUrl && <p><span className="text-muted-foreground">Link:</span> {linkUrl}</p>}
            <p>
              <span className="text-muted-foreground">Countries:</span>{' '}
              {targetCountries.length > 0
                ? targetCountries.map(c => COUNTRY_OPTIONS.find(co => co.code === c)?.label || c).join(', ')
                : 'Global'}
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="bg-[#2969FF]/5 border border-[#2969FF]/20 rounded-xl p-4 flex items-center justify-between">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-2xl font-bold text-[#2969FF]">
            {formatPrice(selectedPackage?.price, selectedPackage?.currency)}
          </span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || uploading}
          className="w-full py-6 rounded-xl bg-[#2969FF] hover:bg-[#1a4fd8] text-lg"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
          ) : (
            <>Pay {formatPrice(selectedPackage?.price, selectedPackage?.currency)} & Submit</>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Payment processed securely via {
            ['NGN', 'GHS', 'KES', 'ZAR'].includes(selectedPackage?.currency) ? 'Paystack' : 'Stripe'
          }. Your ad will be reviewed within 24 hours.
        </p>
      </div>
    </div>
  );

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3];

  return (
    <div className="min-h-screen bg-background">
      {user && (
        <CountryPickerDialog
          open={showCountryPicker}
          onComplete={handleCountrySelected}
          userId={user.id}
        />
      )}

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c] text-white py-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Megaphone className="w-4 h-4" />
            Reach Thousands of Event-Goers
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Advertise on <span className="text-blue-400">Ticketrack</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Put your brand in front of an engaged audience actively looking for events. Simple pricing, instant setup, real-time analytics.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Zap className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-1">1. Choose a Package</h3>
            <p className="text-muted-foreground text-sm">Pick your ad position, duration, and target audience.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Upload className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-1">2. Upload & Pay</h3>
            <p className="text-muted-foreground text-sm">Upload your creative, set your link, and pay securely.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Eye className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-1">3. Go Live</h3>
            <p className="text-muted-foreground text-sm">After quick approval, your ad goes live automatically.</p>
          </div>
        </div>
      </section>

      {/* Wizard Section */}
      <section id="pricing" className="py-8 max-w-3xl mx-auto px-4">
        <AdStepIndicator currentStep={currentStep} completedSteps={completedSteps} />

        <div className="mt-6 min-h-[300px]">
          {stepRenderers[currentStep]()}
        </div>

        {/* Navigation Footer */}
        {currentStep < 3 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <div>
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={goToPrevStep}
                  className="rounded-xl flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
            </div>
            <span className="text-sm text-muted-foreground">Step {currentStep + 1} of 4</span>
            <Button
              onClick={goToNextStep}
              className="rounded-xl bg-[#2969FF] hover:bg-[#1a4fd8] flex items-center gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
        {currentStep === 3 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={goToPrevStep}
              className="rounded-xl flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <span className="text-sm text-muted-foreground">Step 4 of 4</span>
            <div />
          </div>
        )}
      </section>

      {/* Stats / Social Proof */}
      <section className="py-12 bg-muted/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-[#2969FF]">50K+</div>
              <div className="text-sm text-muted-foreground mt-1">Monthly Visitors</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#2969FF]">7+</div>
              <div className="text-sm text-muted-foreground mt-1">Countries</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#2969FF]">85%</div>
              <div className="text-sm text-muted-foreground mt-1">Engagement Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#2969FF]">24h</div>
              <div className="text-sm text-muted-foreground mt-1">Avg. Approval Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-card rounded-xl shadow-sm border overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-5 py-4 text-left flex items-center justify-between"
              >
                <span className="font-medium text-foreground">{item.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
