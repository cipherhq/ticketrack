import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Upload, X,
  Image as ImageIcon, Video, ExternalLink, BarChart3,
  Monitor, Smartphone, Calendar, DollarSign, MousePointer,
  TrendingUp, CheckCircle, Clock, XCircle, AlertCircle,
  Globe, Mail, Phone, User
} from 'lucide-react';
import { formatPrice, currencies } from '@/config/currencies';
import { toast } from 'sonner';

// Helper to get currency symbol
const getCurrencySymbol = (code) => currencies[code]?.symbol || code;

const AD_POSITIONS = [
  {
    value: 'top',
    label: 'Top Banner',
    size: '1200 x 300 px',
    description: 'Horizontal banner below hero section',
    icon: '▬'
  },
  {
    value: 'bottom',
    label: 'Bottom Banner',
    size: '1200 x 300 px',
    description: 'Horizontal banner above download section',
    icon: '▬'
  },
  {
    value: 'right',
    label: 'Right Sidebar',
    size: '300 x 250 px',
    description: 'Sidebar ad on event detail pages',
    icon: '▮'
  },
];

const getAdStatus = (ad) => {
  const now = new Date();
  const start = new Date(ad.start_date);
  const end = new Date(ad.end_date);

  if (!ad.is_active) return { label: 'Inactive', color: 'bg-muted text-muted-foreground' };
  if (now < start) return { label: 'Scheduled', color: 'bg-blue-500/10 text-blue-500' };
  if (now > end) return { label: 'Expired', color: 'bg-red-500/10 text-red-500' };
  return { label: 'Active', color: 'bg-green-500/10 text-green-500' };
};

export default function AdminAdverts() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [stats, setStats] = useState({
    totalAds: 0,
    activeAds: 0,
    totalClicks: 0,
    totalImpressions: 0,
    totalRevenue: 0,
    paidRevenue: 0,
    unpaidRevenue: 0,
    primaryCurrency: 'NGN'
  });

  const [formData, setFormData] = useState({
    position: 'top',
    advertiser_name: '',
    image_url: '',
    media_type: 'image',
    link_url: '',
    price: '',
    currency: 'NGN',
    start_date: '',
    end_date: '',
    is_active: true,
    payment_status: 'pending'
  });

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_adverts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAds(data);

      // Calculate stats
      const now = new Date();
      const activeAds = data.filter(ad => {
        const start = new Date(ad.start_date);
        const end = new Date(ad.end_date);
        return ad.is_active && now >= start && now <= end;
      });

      // Calculate revenue stats
      const totalRevenue = data.reduce((sum, ad) => sum + (parseFloat(ad.price) || 0), 0);
      const paidRevenue = data
        .filter(ad => ad.payment_status === 'paid')
        .reduce((sum, ad) => sum + (parseFloat(ad.price) || 0), 0);
      const unpaidRevenue = totalRevenue - paidRevenue;

      // Find primary currency (most common)
      const currencyCounts = {};
      data.forEach(ad => {
        const curr = ad.currency || 'NGN';
        currencyCounts[curr] = (currencyCounts[curr] || 0) + 1;
      });
      const primaryCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NGN';

      setStats({
        totalAds: data.length,
        activeAds: activeAds.length,
        totalClicks: data.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
        totalImpressions: data.reduce((sum, ad) => sum + (ad.impressions || 0), 0),
        totalRevenue,
        paidRevenue,
        unpaidRevenue,
        primaryCurrency
      });
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast.error('Please upload an image or video file');
      return;
    }

    // Validate file size (max 10MB for images, 50MB for videos)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Max size: ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `ad_${Date.now()}.${fileExt}`;
    const filePath = `adverts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    setFormData(prev => ({
      ...prev,
      image_url: urlData.publicUrl,
      media_type: isVideo ? 'video' : 'image'
    }));
    setPreviewUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.image_url) {
      toast.error('Please upload an ad image or video');
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      toast.error('Please set start and end dates');
      return;
    }

    const adData = {
      ...formData,
      price: formData.price ? parseFloat(formData.price) : 0,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingAd) {
      const { error: updateError } = await supabase
        .from('platform_adverts')
        .update(adData)
        .eq('id', editingAd.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('platform_adverts')
        .insert([adData]);
      error = insertError;
    }

    if (error) {
      toast.error('Error saving ad: ' + error.message);
      return;
    }

    setShowModal(false);
    resetForm();
    fetchAds();
  };

  const resetForm = () => {
    setFormData({
      position: 'top',
      advertiser_name: '',
      image_url: '',
      media_type: 'image',
      link_url: '',
      price: '',
      currency: 'NGN',
      start_date: '',
      end_date: '',
      is_active: true,
      payment_status: 'pending'
    });
    setPreviewUrl('');
    setEditingAd(null);
  };

  const handleEdit = (ad) => {
    setEditingAd(ad);
    setFormData({
      position: ad.position,
      advertiser_name: ad.advertiser_name || '',
      image_url: ad.image_url,
      media_type: ad.media_type || 'image',
      link_url: ad.link_url || '',
      price: ad.price?.toString() || '',
      currency: ad.currency || 'NGN',
      start_date: ad.start_date?.split('T')[0] || '',
      end_date: ad.end_date?.split('T')[0] || '',
      is_active: ad.is_active,
      payment_status: ad.payment_status || 'pending'
    });
    setPreviewUrl(ad.image_url);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;

    const { error } = await supabase
      .from('platform_adverts')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchAds();
    }
  };

  const toggleActive = async (ad) => {
    const { error } = await supabase
      .from('platform_adverts')
      .update({ is_active: !ad.is_active, updated_at: new Date().toISOString() })
      .eq('id', ad.id);

    if (!error) {
      fetchAds();
    }
  };

  const handleApprove = async (ad) => {
    const now = new Date();
    const endDate = new Date(now.getTime() + (ad.duration_days || 30) * 86400000);

    const { error } = await supabase
      .from('platform_adverts')
      .update({
        approval_status: 'approved',
        is_active: true,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', ad.id);

    if (!error) {
      // Send approval notification email
      if (ad.advertiser_email) {
        const posInfo = getPositionInfo(ad.position);
        supabase.functions.invoke('send-email', {
          body: {
            type: 'ad_approved',
            to: ad.advertiser_email,
            data: {
              advertiserName: ad.advertiser_name || 'Advertiser',
              position: posInfo.label,
              durationDays: ad.duration_days || 30,
              startDate: now.toISOString(),
              endDate: endDate.toISOString(),
            },
          },
        }).catch((err) => {
          console.error('Failed to send approval email:', err);
          toast.error('Ad approved, but notification email failed to send.');
        });
      }
      fetchAds();
    } else {
      toast.error('Error approving ad: ' + error.message);
    }
  };

  const handleReject = async (adId) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    // Find the ad to get email and details
    const ad = ads.find(a => a.id === adId);

    const { error } = await supabase
      .from('platform_adverts')
      .update({
        approval_status: 'rejected',
        rejection_reason: rejectionReason,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adId);

    if (!error) {
      // Send rejection notification email
      if (ad?.advertiser_email) {
        const posInfo = getPositionInfo(ad.position);
        supabase.functions.invoke('send-email', {
          body: {
            type: 'ad_rejected',
            to: ad.advertiser_email,
            data: {
              advertiserName: ad.advertiser_name || 'Advertiser',
              position: posInfo.label,
              rejectionReason: rejectionReason,
            },
          },
        }).catch((err) => {
          console.error('Failed to send rejection email:', err);
          toast.error('Ad rejected, but notification email failed to send.');
        });
      }
      setShowRejectModal(null);
      setRejectionReason('');
      fetchAds();
    } else {
      toast.error('Error rejecting ad: ' + error.message);
    }
  };

  const filteredAds = approvalFilter === 'all'
    ? ads
    : ads.filter(ad => (ad.approval_status || 'pending') === approvalFilter);

  const getPositionInfo = (position) => {
    return AD_POSITIONS.find(p => p.value === position) || AD_POSITIONS[0];
  };

  const calculateCTR = (clicks, impressions) => {
    if (!impressions || impressions === 0) return '0.00';
    return ((clicks / impressions) * 100).toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2969FF]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Adverts</h1>
          <p className="text-muted-foreground">Manage homepage advertisements</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-[#2969FF] text-white px-4 py-2 rounded-xl hover:bg-[#2969FF]/90 transition-colors"
        >
          <Plus size={20} />
          Add New Ad
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Monitor className="text-blue-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Ads</p>
              <p className="text-xl font-bold text-foreground">{stats.totalAds}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Eye className="text-green-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Now</p>
              <p className="text-xl font-bold text-foreground">{stats.activeAds}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="text-emerald-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold text-foreground">{formatPrice(stats.totalRevenue, stats.primaryCurrency)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="text-green-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="text-xl font-bold text-green-500">{formatPrice(stats.paidRevenue, stats.primaryCurrency)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="text-yellow-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unpaid</p>
              <p className="text-xl font-bold text-yellow-500">{formatPrice(stats.unpaidRevenue, stats.primaryCurrency)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="text-purple-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impressions</p>
              <p className="text-xl font-bold text-foreground">{stats.totalImpressions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/10 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <MousePointer className="text-orange-500" size={20} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clicks</p>
              <p className="text-xl font-bold text-foreground">{stats.totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Size Reference */}
      <div className="bg-muted/50 border border-border/10 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-foreground mb-3">Ad Specifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AD_POSITIONS.map(pos => (
            <div key={pos.value} className="bg-card border border-border/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{pos.icon}</span>
                <span className="font-medium text-sm text-foreground">{pos.label}</span>
              </div>
              <p className="text-[#2969FF] font-mono text-sm">{pos.size}</p>
              <p className="text-xs text-muted-foreground mt-1">{pos.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Approval Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'all', label: 'All', count: ads.length },
          { value: 'pending', label: 'Pending', count: ads.filter(a => (a.approval_status || 'pending') === 'pending').length },
          { value: 'approved', label: 'Approved', count: ads.filter(a => (a.approval_status || 'pending') === 'approved').length },
          { value: 'rejected', label: 'Rejected', count: ads.filter(a => a.approval_status === 'rejected').length },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setApprovalFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              approvalFilter === tab.value
                ? 'bg-[#2969FF] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Ads Table */}
      <div className="bg-card border border-border/10 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium text-muted-foreground">Preview</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Advertiser</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Position</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Price</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Duration</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Performance</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Payment</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Approval</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAds.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                  {approvalFilter === 'all'
                    ? 'No advertisements yet. Click "Add New Ad" to create one.'
                    : `No ${approvalFilter} advertisements.`}
                </td>
              </tr>
            ) : (
              filteredAds.map(ad => {
                const status = getAdStatus(ad);
                const posInfo = getPositionInfo(ad.position);
                const approvalStatus = ad.approval_status || 'pending';
                return (
                  <tr key={ad.id} className="border-t border-border/10 hover:bg-muted/30">
                    <td className="p-4">
                      <div className="w-20 h-16 bg-muted rounded-lg overflow-hidden">
                        {ad.media_type === 'video' ? (
                          <video src={ad.image_url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-foreground">{ad.advertiser_name || 'Unknown'}</p>
                        {ad.advertiser_email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail size={10} /> {ad.advertiser_email}
                          </p>
                        )}
                        {ad.advertiser_phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone size={10} /> {ad.advertiser_phone}
                          </p>
                        )}
                        {ad.link_url && (
                          <a
                            href={ad.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#2969FF] flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink size={12} />
                            Visit Link
                          </a>
                        )}
                        {ad.target_countries && ad.target_countries.length > 0 && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Globe size={10} /> {ad.target_countries.join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-foreground">{posInfo.label}</p>
                        <p className="text-xs text-muted-foreground">{posInfo.size}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{formatPrice(ad.price || 0, ad.currency || 'NGN')}</p>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {ad.duration_days && (
                          <p className="text-muted-foreground">{ad.duration_days} days</p>
                        )}
                        <p className="text-foreground">{new Date(ad.start_date).toLocaleDateString()}</p>
                        <p className="text-muted-foreground">to {new Date(ad.end_date).toLocaleDateString()}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <p><span className="text-muted-foreground">Impressions:</span> <span className="text-foreground">{(ad.impressions || 0).toLocaleString()}</span></p>
                        <p><span className="text-muted-foreground">Clicks:</span> <span className="text-foreground">{(ad.clicks || 0).toLocaleString()}</span></p>
                        <p><span className="text-muted-foreground">CTR:</span> <span className="text-foreground">{calculateCTR(ad.clicks, ad.impressions)}%</span></p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ad.payment_status === 'paid'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {ad.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        approvalStatus === 'approved'
                          ? 'bg-green-500/10 text-green-500'
                          : approvalStatus === 'rejected'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                      </span>
                      {approvalStatus === 'rejected' && ad.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1 max-w-[120px] truncate" title={ad.rejection_reason}>
                          {ad.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {approvalStatus === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(ad)}
                              className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-xs font-medium flex items-center gap-1"
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button
                              onClick={() => setShowRejectModal(ad.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-xs font-medium flex items-center gap-1"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleActive(ad)}
                          className={`p-2 rounded-lg transition-colors ${ad.is_active ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                          title={ad.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {ad.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          onClick={() => handleEdit(ad)}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(ad.id)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground mb-4">Reject Advertisement</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Please provide a reason for rejecting this ad. The advertiser will be notified by email.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                'Image size does not match required dimensions',
                'Image quality too low or blurry',
                'Content violates our ad policy',
                'Inappropriate or misleading content',
                'Destination link is broken or unsafe',
              ].map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectionReason(reason)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    rejectionReason === reason
                      ? 'bg-red-500/10 border-red-500/30 text-red-500'
                      : 'border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 resize-none"
              rows={3}
              placeholder="Select a reason above or type a custom reason..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(null); setRejectionReason(''); }}
                className="flex-1 px-4 py-2 border border-border/20 rounded-xl text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Reject Ad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border/10">
              <h2 className="text-lg font-semibold text-foreground">
                {editingAd ? 'Edit Advertisement' : 'New Advertisement'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Position Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Ad Position *</label>
                <div className="grid grid-cols-3 gap-3">
                  {AD_POSITIONS.map(pos => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, position: pos.value }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        formData.position === pos.value
                          ? 'border-[#2969FF] bg-[#2969FF]/10'
                          : 'border-border/20 hover:border-border/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{pos.icon}</span>
                        <div>
                          <p className="font-medium text-sm text-foreground">{pos.label}</p>
                          <p className="text-xs text-[#2969FF]">{pos.size}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advertiser Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Advertiser Name</label>
                <input
                  type="text"
                  value={formData.advertiser_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, advertiser_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                  placeholder="e.g., Coca-Cola, MTN, etc."
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Ad Creative *</label>
                <div className="border-2 border-dashed border-border/30 rounded-xl p-4">
                  {previewUrl ? (
                    <div className="relative">
                      {formData.media_type === 'video' ? (
                        <video src={previewUrl} className="max-h-48 mx-auto rounded-lg" controls />
                      ) : (
                        <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                      )}
                      <button
                        type="button"
                        onClick={() => { setPreviewUrl(''); setFormData(prev => ({ ...prev, image_url: '' })); }}
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
                        {formData.position === 'right'
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
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2969FF] mx-auto"></div>
                      <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Click-through URL</label>
                <input
                  type="url"
                  value={formData.link_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                  placeholder="https://example.com"
                />
              </div>

              {/* Price and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Price</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                  >
                    <option value="NGN">NGN ({getCurrencySymbol('NGN')})</option>
                    <option value="GBP">GBP ({getCurrencySymbol('GBP')})</option>
                    <option value="USD">USD ({getCurrencySymbol('USD')})</option>
                    <option value="CAD">CAD ({getCurrencySymbol('CAD')})</option>
                    <option value="GHS">GHS ({getCurrencySymbol('GHS')})</option>
                    <option value="EUR">EUR ({getCurrencySymbol('EUR')})</option>
                  </select>
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Payment Status</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, payment_status: 'pending' }))}
                    className={`flex-1 px-4 py-2 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      formData.payment_status === 'pending'
                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                        : 'border-border/20 text-muted-foreground hover:border-border/40'
                    }`}
                  >
                    <Clock size={16} />
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, payment_status: 'paid' }))}
                    className={`flex-1 px-4 py-2 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      formData.payment_status === 'paid'
                        ? 'border-green-500 bg-green-500/10 text-green-500'
                        : 'border-border/20 text-muted-foreground hover:border-border/40'
                    }`}
                  >
                    <CheckCircle size={16} />
                    Paid
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border/20 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#2969FF]"
                    required
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-[#2969FF] rounded focus:ring-[#2969FF]"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-foreground">
                  Active (ad will be displayed if within date range)
                </label>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-border/20 rounded-xl text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !formData.image_url}
                  className="flex-1 px-4 py-2 bg-[#2969FF] text-white rounded-xl hover:bg-[#2969FF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingAd ? 'Update Ad' : 'Create Ad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
