import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Plus, Edit2, Trash2, Eye, EyeOff, Upload, X, 
  Image as ImageIcon, Video, ExternalLink, BarChart3,
  Monitor, Smartphone, Calendar, DollarSign, MousePointer,
  TrendingUp
} from 'lucide-react';

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
    value: 'left', 
    label: 'Left Sidebar', 
    size: '300 x 600 px',
    description: 'Fixed half-page ad on left side',
    icon: '▮'
  },
  { 
    value: 'right', 
    label: 'Right Sidebar', 
    size: '300 x 600 px',
    description: 'Fixed half-page ad on right side',
    icon: '▮'
  },
];

const getAdStatus = (ad) => {
  const now = new Date();
  const start = new Date(ad.start_date);
  const end = new Date(ad.end_date);
  
  if (!ad.is_active) return { label: 'Inactive', color: 'bg-gray-100 text-gray-600' };
  if (now < start) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-600' };
  if (now > end) return { label: 'Expired', color: 'bg-red-100 text-red-600' };
  return { label: 'Active', color: 'bg-green-100 text-green-600' };
};

export default function AdminAdverts() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [stats, setStats] = useState({
    totalAds: 0,
    activeAds: 0,
    totalClicks: 0,
    totalImpressions: 0
  });

  const [formData, setFormData] = useState({
    position: 'top',
    advertiser_name: '',
    image_url: '',
    media_type: 'image',
    link_url: '',
    price: '',
    start_date: '',
    end_date: '',
    is_active: true
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
      
      setStats({
        totalAds: data.length,
        activeAds: activeAds.length,
        totalClicks: data.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
        totalImpressions: data.reduce((sum, ad) => sum + (ad.impressions || 0), 0)
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
      alert('Please upload an image or video file');
      return;
    }

    // Validate file size (max 10MB for images, 50MB for videos)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large. Max size: ${isVideo ? '50MB' : '10MB'}`);
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
      alert('Upload failed: ' + uploadError.message);
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
      alert('Please upload an ad image or video');
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      alert('Please set start and end dates');
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
      alert('Error saving ad: ' + error.message);
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
      start_date: '',
      end_date: '',
      is_active: true
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
      start_date: ad.start_date?.split('T')[0] || '',
      end_date: ad.end_date?.split('T')[0] || '',
      is_active: ad.is_active
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Adverts</h1>
          <p className="text-gray-500">Manage homepage advertisements</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add New Ad
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Monitor className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Ads</p>
              <p className="text-xl font-bold">{stats.totalAds}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Eye className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Now</p>
              <p className="text-xl font-bold">{stats.activeAds}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Impressions</p>
              <p className="text-xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <MousePointer className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Clicks</p>
              <p className="text-xl font-bold">{stats.totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Size Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-3">Ad Specifications</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {AD_POSITIONS.map(pos => (
            <div key={pos.value} className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{pos.icon}</span>
                <span className="font-medium text-sm">{pos.label}</span>
              </div>
              <p className="text-blue-600 font-mono text-sm">{pos.size}</p>
              <p className="text-xs text-gray-500 mt-1">{pos.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ads Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Preview</th>
              <th className="text-left p-4 font-medium text-gray-600">Advertiser</th>
              <th className="text-left p-4 font-medium text-gray-600">Position</th>
              <th className="text-left p-4 font-medium text-gray-600">Duration</th>
              <th className="text-left p-4 font-medium text-gray-600">Performance</th>
              <th className="text-left p-4 font-medium text-gray-600">Status</th>
              <th className="text-left p-4 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No advertisements yet. Click "Add New Ad" to create one.
                </td>
              </tr>
            ) : (
              ads.map(ad => {
                const status = getAdStatus(ad);
                const posInfo = getPositionInfo(ad.position);
                return (
                  <tr key={ad.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      <div className="w-20 h-16 bg-gray-100 rounded overflow-hidden">
                        {ad.media_type === 'video' ? (
                          <video src={ad.image_url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{ad.advertiser_name || 'Unknown'}</p>
                        {ad.link_url && (
                          <a 
                            href={ad.link_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink size={12} />
                            Visit Link
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{posInfo.label}</p>
                        <p className="text-xs text-gray-500">{posInfo.size}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <p>{new Date(ad.start_date).toLocaleDateString()}</p>
                        <p className="text-gray-500">to {new Date(ad.end_date).toLocaleDateString()}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <p><span className="text-gray-500">Impressions:</span> {(ad.impressions || 0).toLocaleString()}</p>
                        <p><span className="text-gray-500">Clicks:</span> {(ad.clicks || 0).toLocaleString()}</p>
                        <p><span className="text-gray-500">CTR:</span> {calculateCTR(ad.clicks, ad.impressions)}%</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(ad)}
                          className={`p-2 rounded-lg ${ad.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} hover:opacity-80`}
                          title={ad.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {ad.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          onClick={() => handleEdit(ad)}
                          className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:opacity-80"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(ad.id)}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:opacity-80"
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingAd ? 'Edit Advertisement' : 'New Advertisement'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Position Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Ad Position *</label>
                <div className="grid grid-cols-2 gap-3">
                  {AD_POSITIONS.map(pos => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, position: pos.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        formData.position === pos.value 
                          ? 'border-blue-600 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{pos.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{pos.label}</p>
                          <p className="text-xs text-blue-600">{pos.size}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advertiser Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Advertiser Name</label>
                <input
                  type="text"
                  value={formData.advertiser_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, advertiser_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Coca-Cola, MTN, etc."
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Ad Creative *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {previewUrl ? (
                    <div className="relative">
                      {formData.media_type === 'video' ? (
                        <video src={previewUrl} className="max-h-48 mx-auto rounded" controls />
                      ) : (
                        <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded" />
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
                      <Upload className="text-gray-400 mb-2" size={32} />
                      <span className="text-sm text-gray-600">Click to upload image or video</span>
                      <span className="text-xs text-gray-400 mt-1">
                        {formData.position === 'left' || formData.position === 'right' 
                          ? 'Recommended: 300 x 600 px' 
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
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium mb-2">Click-through URL</label>
                <input
                  type="url"
                  value={formData.link_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium mb-2">Price (₦)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Active (ad will be displayed if within date range)
                </label>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !formData.image_url}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
