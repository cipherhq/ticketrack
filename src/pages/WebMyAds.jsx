import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import {
  Megaphone, Loader2, Eye, MousePointer, TrendingUp,
  ExternalLink, Globe, Calendar, Clock,
  Video, Plus, ChevronDown, ChevronUp, RefreshCw, RotateCcw,
  CheckCircle, X as XIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const AD_POSITIONS = {
  top: { label: 'Top Banner', size: '1200 x 300 px' },
  bottom: { label: 'Bottom Banner', size: '1200 x 300 px' },
  right: { label: 'Right Sidebar', size: '300 x 250 px' },
};

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'expired', label: 'Expired' },
  { id: 'rejected', label: 'Rejected' },
];

const calculateCTR = (clicks, impressions) => {
  if (!impressions || impressions === 0) return '0.00';
  return ((clicks / impressions) * 100).toFixed(2);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function WebMyAds() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedAds, setExpandedAds] = useState(new Set());
  const [showPaymentBanner, setShowPaymentBanner] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/my-ads' } });
      return;
    }
    loadAds();
  }, [user, navigate]);

  // Payment success banner
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setShowPaymentBanner(true);
      window.history.replaceState({}, '', '/my-ads');
      const timer = setTimeout(() => setShowPaymentBanner(false), 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  const loadAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_adverts')
        .select('*')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (error) {
      console.error('Error loading ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  const getAdStatus = (ad) => {
    if (ad.approval_status === 'rejected') return 'rejected';
    if (!ad.is_active && ad.approval_status === 'pending') return 'pending';
    if (!ad.is_active && ad.approval_status !== 'rejected') return 'pending';
    const start = new Date(ad.start_date);
    const end = new Date(ad.end_date);
    if (now < start) return 'pending';
    if (now > end) return 'expired';
    return 'active';
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'active': return { label: 'Active', badgeClass: 'bg-green-500/10 text-green-500', borderClass: 'border-l-green-500' };
      case 'pending': return { label: 'Pending', badgeClass: 'bg-yellow-500/10 text-yellow-500', borderClass: 'border-l-yellow-500' };
      case 'expired': return { label: 'Expired', badgeClass: 'bg-gray-500/10 text-gray-400', borderClass: 'border-l-gray-400' };
      case 'rejected': return { label: 'Rejected', badgeClass: 'bg-red-500/10 text-red-500', borderClass: 'border-l-red-500' };
      default: return { label: 'Unknown', badgeClass: 'bg-muted text-muted-foreground', borderClass: 'border-l-gray-300' };
    }
  };

  const getDaysRemaining = (endDate) => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const toggleExpanded = (adId) => {
    setExpandedAds(prev => {
      const next = new Set(prev);
      if (next.has(adId)) {
        next.delete(adId);
      } else {
        next.add(adId);
      }
      return next;
    });
  };

  // Filter ads
  const filteredAds = ads.filter(ad => {
    if (activeFilter === 'all') return true;
    return getAdStatus(ad) === activeFilter;
  });

  const activeAds = ads.filter(ad => getAdStatus(ad) === 'active');
  const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Payment Success Banner */}
      {showPaymentBanner && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-700 dark:text-green-400 font-medium">
              Ad submitted successfully! We'll review it within 24 hours.
            </p>
          </div>
          <button onClick={() => setShowPaymentBanner(false)} className="text-green-600 hover:text-green-700">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-[#2969FF]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Ads</h1>
            <p className="text-muted-foreground text-sm">Track your advertising campaigns</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/advertise')}
          className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Submit New Ad
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Megaphone className="text-blue-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Ads</p>
              <p className="text-xl font-bold text-foreground">{ads.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Eye className="text-green-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Now</p>
              <p className="text-xl font-bold text-foreground">{activeAds.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="text-purple-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impressions</p>
              <p className="text-xl font-bold text-foreground">{totalImpressions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <MousePointer className="text-orange-500 w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clicks</p>
              <p className="text-xl font-bold text-foreground">{totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      {ads.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_TABS.map(tab => {
            const count = tab.id === 'all'
              ? ads.length
              : ads.filter(ad => getAdStatus(ad) === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-[#2969FF] text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {ads.length === 0 ? (
        <div className="bg-card border border-border/10 rounded-2xl">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <Megaphone className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No ads yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Promote your brand to thousands of event-goers. Submit your first ad campaign today.
            </p>
            <Button
              onClick={() => navigate('/advertise')}
              className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl"
            >
              Submit Your First Ad
            </Button>
          </div>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="bg-card border border-border/10 rounded-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No {activeFilter} ads found.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAds.map(ad => {
            const posInfo = AD_POSITIONS[ad.position] || AD_POSITIONS.top;
            const status = getAdStatus(ad);
            const statusDisplay = getStatusDisplay(status);
            const daysLeft = getDaysRemaining(ad.end_date);
            const isExpanded = expandedAds.has(ad.id);
            const durationDays = ad.duration_days || 30;
            const elapsed = durationDays - daysLeft;
            const progressValue = status === 'active' ? Math.min((elapsed / durationDays) * 100, 100) : 0;

            return (
              <div
                key={ad.id}
                className={`bg-card border border-border/10 rounded-xl overflow-hidden hover:shadow-md transition-shadow border-l-4 ${statusDisplay.borderClass}`}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Preview */}
                    <div className="w-full sm:w-32 h-24 sm:h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {ad.media_type === 'video' ? (
                        <div className="relative w-full h-full">
                          <video src={ad.image_url} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Video className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      ) : (
                        <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-foreground text-lg">{ad.advertiser_name || 'Untitled Ad'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {posInfo.label} &middot; {posInfo.size}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusDisplay.badgeClass}`}>
                            {statusDisplay.label}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            ad.payment_status === 'paid'
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {ad.payment_status === 'paid' ? 'Paid' : 'Payment Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Duration, price, performance */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Duration</p>
                          <p className="text-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(ad.start_date)} - {formatDate(ad.end_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Price</p>
                          <p className="text-foreground font-medium">
                            {formatPrice(ad.price || 0, ad.currency || 'NGN')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Performance</p>
                          <p className="text-foreground">
                            {(ad.impressions || 0).toLocaleString()} views &middot; {(ad.clicks || 0).toLocaleString()} clicks
                          </p>
                          <p className="text-xs text-muted-foreground">
                            CTR: {calculateCTR(ad.clicks, ad.impressions)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.badgeClass}`}>
                            {statusDisplay.label}
                          </span>
                        </div>
                      </div>

                      {/* Active ad progress bar */}
                      {status === 'active' && daysLeft > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {daysLeft} of {durationDays} days remaining
                            </span>
                            <span className="text-muted-foreground">{Math.round(progressValue)}%</span>
                          </div>
                          <Progress value={progressValue} className="h-2" />
                        </div>
                      )}

                      {/* Rejection reason */}
                      {status === 'rejected' && ad.rejection_reason && (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg mb-3">
                          <p className="text-sm text-red-500">
                            <strong>Rejection reason:</strong> {ad.rejection_reason}
                          </p>
                        </div>
                      )}

                      {/* Target countries and link (compact) */}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {ad.target_countries && ad.target_countries.length > 0
                            ? ad.target_countries.join(', ')
                            : 'Global'}
                        </span>
                        {ad.link_url && (
                          <a
                            href={ad.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2969FF] flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {ad.link_url.length > 30 ? ad.link_url.substring(0, 30) + '...' : ad.link_url}
                          </a>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {(status === 'active' || status === 'expired') && (
                          <Button
                            size="sm"
                            onClick={() => navigate('/advertise', { state: { renewAd: ad } })}
                            className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-lg text-xs flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Renew
                          </Button>
                        )}
                        {status === 'rejected' && (
                          <Button
                            size="sm"
                            onClick={() => navigate('/advertise', { state: { renewAd: ad, resubmit: true } })}
                            className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-lg text-xs flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Resubmit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleExpanded(ad.id)}
                          className="rounded-lg text-xs flex items-center gap-1.5"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3.5 h-3.5" /> Less</>
                          ) : (
                            <><ChevronDown className="w-3.5 h-3.5" /> More</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/10">
                      <div className="grid sm:grid-cols-2 gap-6">
                        {/* Full creative preview */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 font-medium">Full Creative Preview</p>
                          <div className={`bg-muted rounded-lg overflow-hidden ${
                            ad.position === 'right'
                              ? 'w-[300px] h-[250px]'
                              : 'w-full h-[150px]'
                          }`}>
                            {ad.media_type === 'video' ? (
                              <video src={ad.image_url} className="w-full h-full object-cover" controls muted />
                            ) : (
                              <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                        </div>

                        {/* Extra details */}
                        <div className="space-y-3 text-sm">
                          {ad.package_id && (
                            <div>
                              <p className="text-xs text-muted-foreground">Package ID</p>
                              <p className="text-foreground font-mono text-xs">{ad.package_id}</p>
                            </div>
                          )}
                          {ad.payment_reference && (
                            <div>
                              <p className="text-xs text-muted-foreground">Payment Reference</p>
                              <p className="text-foreground font-mono text-xs">{ad.payment_reference}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">Created</p>
                            <p className="text-foreground">{formatDate(ad.created_at)}</p>
                          </div>
                          {ad.link_url && (
                            <div>
                              <p className="text-xs text-muted-foreground">Full Link URL</p>
                              <a
                                href={ad.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#2969FF] hover:underline break-all text-xs"
                              >
                                {ad.link_url}
                              </a>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">Target Countries</p>
                            <p className="text-foreground">
                              {ad.target_countries && ad.target_countries.length > 0
                                ? ad.target_countries.join(', ')
                                : 'Global (all countries)'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-foreground">{ad.advertiser_email || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
