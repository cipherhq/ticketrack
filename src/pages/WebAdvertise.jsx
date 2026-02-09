import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import {
  Megaphone, Upload, CheckCircle, Eye, MousePointer, Globe,
  ChevronDown, ChevronUp, X, Loader2, ImageIcon, Video,
  ArrowRight, Zap, BarChart3, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [currency, setCurrency] = useState('NGN');
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [activeSection, setActiveSection] = useState('packages'); // packages | form
  const [openFaq, setOpenFaq] = useState(null);

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

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    if (user) {
      setAdvertiserEmail(user.email || '');
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
  };

  const toggleCountry = (code) => {
    setTargetCountries(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleSelectPackage = (pkg) => {
    if (!user) {
      navigate('/login', { state: { from: '/advertise' } });
      return;
    }
    setSelectedPackage(pkg);
    setActiveSection('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      navigate('/login', { state: { from: '/advertise' } });
      return;
    }

    if (!selectedPackage || !creativeUrl || !advertiserName || !advertiserEmail) {
      alert('Please fill in all required fields and upload your ad creative.');
      return;
    }

    setSubmitting(true);

    try {
      // Determine payment provider based on currency
      const provider = ['NGN', 'GHS', 'KES', 'ZAR'].includes(selectedPackage.currency)
        ? 'paystack'
        : 'stripe';

      if (provider === 'paystack') {
        // Create the ad record first
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

        // Initialize Paystack inline
        const reference = `AD-${adRecord.id.substring(0, 8)}-${Date.now()}`;

        // Use Paystack inline payment
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
          callback: async (response) => {
            // Update ad record with payment reference
            await supabase
              .from('platform_adverts')
              .update({
                payment_status: 'paid',
                payment_reference: response.reference,
              })
              .eq('id', adRecord.id);

            setSubmitted(true);
          },
          onClose: () => {
            setSubmitting(false);
          },
        });

        if (handler) {
          handler.openIframe();
        } else {
          // Paystack inline not loaded, use redirect
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
        // Stripe: create ad record and redirect to checkout
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
      // Clean URL
      window.history.replaceState({}, '', '/advertise');
    }
  }, []);

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">Ad Submitted Successfully!</h1>
          <p className="text-muted-foreground mb-2">
            Your advertisement has been submitted and payment received.
          </p>
          <p className="text-muted-foreground mb-8">
            Our team will review your ad and approve it within 24 hours. You'll receive an email notification at <strong>{advertiserEmail || 'your email'}</strong> once it's live.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/')} variant="outline" className="rounded-xl">
              Back to Home
            </Button>
            <Button onClick={() => { setSubmitted(false); setActiveSection('packages'); setSelectedPackage(null); setCreativeUrl(''); }} className="rounded-xl bg-blue-600 hover:bg-blue-700">
              Submit Another Ad
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a1628] via-[#0f2847] to-[#1a3a5c] text-white py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Megaphone className="w-4 h-4" />
            Reach Thousands of Event-Goers
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Advertise on <span className="text-blue-400">Ticketrack</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Put your brand in front of an engaged audience actively looking for events. Simple pricing, instant setup, real-time analytics.
          </p>
          <Button
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-xl text-lg"
          >
            View Packages <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">1. Choose a Package</h3>
            <p className="text-muted-foreground text-sm">Pick your ad position, duration, and target audience. Transparent pricing with no hidden fees.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">2. Upload & Pay</h3>
            <p className="text-muted-foreground text-sm">Upload your creative, set your destination link, and complete payment securely.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">3. Go Live</h3>
            <p className="text-muted-foreground text-sm">After quick approval, your ad goes live automatically. Track impressions and clicks in real-time.</p>
          </div>
        </div>
      </section>

      {/* Ad Positions Preview */}
      <section className="py-12 bg-muted/50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Where Your Ads Appear</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <div className="w-full h-20 bg-blue-100 rounded-lg mb-4 flex items-center justify-center text-blue-600 font-medium text-sm">
                1200 x 300 px
              </div>
              <h3 className="font-semibold mb-1">Homepage Top Banner</h3>
              <p className="text-sm text-muted-foreground">Premium placement below the hero section. First thing visitors see.</p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <div className="w-full h-20 bg-blue-100 rounded-lg mb-4 flex items-center justify-center text-blue-600 font-medium text-sm">
                1200 x 300 px
              </div>
              <h3 className="font-semibold mb-1">Homepage Bottom Banner</h3>
              <p className="text-sm text-muted-foreground">Placed above the app download section. High visibility placement.</p>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-sm">
              <div className="w-24 h-24 bg-blue-100 rounded-lg mb-4 flex items-center justify-center text-blue-600 font-medium text-sm">
                300 x 250
              </div>
              <h3 className="font-semibold mb-1">Event Page Sidebar</h3>
              <p className="text-sm text-muted-foreground">Shown on every event detail page alongside ticket info. Highly engaged audience.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 max-w-5xl mx-auto px-4">
        {activeSection === 'packages' ? (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground mb-6">Choose the package that fits your campaign goals</p>

              {/* Currency Selector */}
              <div className="inline-flex bg-muted rounded-xl p-1 gap-1 flex-wrap justify-center">
                {['NGN', 'USD', 'GBP', 'GHS', 'CAD'].map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currency === c
                        ? 'bg-blue-600 text-white'
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
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-10">
                {Object.entries(groupedPackages).map(([position, pkgs]) => (
                  <div key={position}>
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      {POSITION_LABELS[position] || position}
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {pkgs.map(pkg => (
                        <div
                          key={pkg.id}
                          className="bg-card rounded-xl p-6 shadow-sm border hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">{pkg.duration_days} days</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {formatPrice(pkg.price, pkg.currency)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
                          <Button
                            onClick={() => handleSelectPackage(pkg)}
                            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                          >
                            Get Started
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Submission Form */
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setActiveSection('packages')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-6 flex items-center gap-1"
            >
              <ChevronDown className="w-4 h-4 rotate-90" /> Back to Packages
            </button>

            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 text-center">
                <p className="text-blue-800 mb-3">Please log in to submit your advertisement</p>
                <Button
                  onClick={() => navigate('/login', { state: { from: '/advertise' } })}
                  className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Log In to Continue
                </Button>
              </div>
            )}

            <div className="bg-card rounded-xl shadow-sm p-6 mb-6">
              <h3 className="font-semibold text-lg mb-1">Selected Package</h3>
              <p className="text-muted-foreground text-sm mb-2">
                {POSITION_LABELS[selectedPackage?.position]} - {selectedPackage?.duration_days} days
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {formatPrice(selectedPackage?.price, selectedPackage?.currency)}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Advertiser Details */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Advertiser / Business Name *</label>
                <input
                  type="text"
                  value={advertiserName}
                  onChange={(e) => setAdvertiserName(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  placeholder="Your company name"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={advertiserEmail}
                    onChange={(e) => setAdvertiserEmail(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                    placeholder="you@company.com"
                    required
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

              {/* Creative Upload */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Ad Creative *</label>
                <div className="border-2 border-dashed border-border/30 rounded-xl p-6">
                  {creativeUrl ? (
                    <div className="relative">
                      {mediaType === 'video' ? (
                        <video src={creativeUrl} className="max-h-48 mx-auto rounded-lg" controls />
                      ) : (
                        <img src={creativeUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                      )}
                      <button
                        type="button"
                        onClick={() => setCreativeUrl('')}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer py-4">
                      <Upload className="text-muted-foreground mb-2" size={32} />
                      <span className="text-sm text-muted-foreground">Click to upload image or video</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {selectedPackage?.position === 'right'
                          ? 'Recommended: 300 x 250 px'
                          : 'Recommended: 1200 x 300 px'}
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
                    <div className="text-center py-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination URL */}
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

              {/* Target Countries */}
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
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-background text-foreground border-border hover:border-blue-300'
                      }`}
                    >
                      {country.label}
                    </button>
                  ))}
                </div>
                {targetCountries.length === 0 && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Global - shown to all visitors
                  </p>
                )}
              </div>

              {/* Live Preview */}
              {creativeUrl && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Preview</label>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="relative">
                      <div className="absolute -top-1 right-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded z-10">
                        Ad
                      </div>
                      <div className={`bg-muted rounded-lg overflow-hidden ${
                        selectedPackage?.position === 'right'
                          ? 'w-[300px] h-[250px] mx-auto'
                          : 'w-full h-[150px] md:h-[200px]'
                      }`}>
                        {mediaType === 'video' ? (
                          <video src={creativeUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                        ) : (
                          <img src={creativeUrl} alt="Ad preview" className="w-full h-full object-cover" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitting || uploading || !creativeUrl || !advertiserName || !user}
                className="w-full py-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-lg"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
                ) : (
                  <>Pay {formatPrice(selectedPackage?.price, selectedPackage?.currency)} & Submit</>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your ad will be reviewed within 24 hours. Payment is processed securely via {
                  ['NGN', 'GHS', 'KES', 'ZAR'].includes(selectedPackage?.currency) ? 'Paystack' : 'Stripe'
                }.
              </p>
            </form>
          </div>
        )}
      </section>

      {/* Stats / Social Proof */}
      <section className="py-12 bg-muted/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">50K+</div>
              <div className="text-sm text-muted-foreground mt-1">Monthly Visitors</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">7+</div>
              <div className="text-sm text-muted-foreground mt-1">Countries</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">85%</div>
              <div className="text-sm text-muted-foreground mt-1">Engagement Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">24h</div>
              <div className="text-sm text-muted-foreground mt-1">Avg. Approval Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 max-w-3xl mx-auto px-4">
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

      {/* CTA */}
      <section className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Grow Your Brand?</h2>
          <p className="text-blue-100 mb-8">
            Start your advertising campaign today and reach thousands of event enthusiasts.
          </p>
          <Button
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 rounded-xl text-lg font-semibold"
          >
            Get Started Now
          </Button>
        </div>
      </section>
    </div>
  );
}
