import { useState, useEffect, useRef } from 'react';
import { 
  Camera, Mail, Phone, Globe, MapPin, Save, Building2, 
  Loader2, CheckCircle, Instagram, Twitter, Facebook, Linkedin,
  Upload, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PhoneInput } from '../../components/ui/phone-input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

export function OrganizerProfile() {
  const { organizer, refreshOrganizer } = useOrganizer();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    business_name: '',
    email: '',
    phone: '',
    website: '',
    location: '',
    description: '',
    logo_url: '',
    instagram: '',
    twitter: '',
    facebook: '',
    linkedin: '',
  });

  useEffect(() => {
    if (organizer) {
      setFormData({
        business_name: organizer.business_name || '',
        email: organizer.email || '',
        phone: organizer.phone || '',
        website: organizer.website || '',
        location: organizer.location || '',
        description: organizer.description || '',
        logo_url: organizer.logo_url || '',
        instagram: organizer.instagram || '',
        twitter: organizer.twitter || '',
        facebook: organizer.facebook || '',
        linkedin: organizer.linkedin || '',
      });
      setLoading(false);
    }
  }, [organizer]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${organizer.id}-logo-${Date.now()}.${fileExt}`;
      const filePath = `organizer-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      setFormData({ ...formData, logo_url: publicUrl });
    } catch (error) {
      console.error('Error uploading logo:', error);
      setError('Failed to upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setFormData({ ...formData, logo_url: '' });
  };

  const handleSave = async () => {
    if (!formData.business_name.trim()) {
      setError('Business name is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('organizers')
        .update({
          business_name: formData.business_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          website: formData.website.trim() || null,
          location: formData.location.trim() || null,
          description: formData.description.trim() || null,
          logo_url: formData.logo_url || null,
          instagram: formData.instagram.trim() || null,
          twitter: formData.twitter.trim() || null,
          facebook: formData.facebook.trim() || null,
          linkedin: formData.linkedin.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organizer.id);

      if (updateError) throw updateError;

      if (refreshOrganizer) {
        await refreshOrganizer();
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F0F0F]">Organizer Profile</h2>
        <p className="text-[#0F0F0F]/60 mt-1">Manage your public profile and business information</p>
      </div>

      {saved && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Profile saved successfully!
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Business Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-[#2969FF]/10 flex items-center justify-center overflow-hidden relative">
              {formData.logo_url ? (
                <>
                  <img 
                    src={formData.logo_url} 
                    alt="Logo" 
                    className="w-full h-full object-cover" 
                  />
                  <button
                    onClick={removeLogo}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <Building2 className="w-10 h-10 text-[#2969FF]" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-[#0F0F0F]/60 mb-3">
                Upload a logo for your business. Recommended size: 200x200px. Max 2MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="rounded-xl"
              >
                {uploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              className="h-12 rounded-xl"
              placeholder="Your business or organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">About Your Business</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="rounded-xl min-h-[120px]"
              placeholder="Tell attendees about your organization..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Business Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 rounded-xl"
                placeholder="contact@business.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              <PhoneInput value={formData.phone} onChange={(phone) => setFormData({ ...formData, phone })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="h-12 rounded-xl"
                placeholder="https://yourbusiness.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="h-12 rounded-xl"
                placeholder="City, Country"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Social Media Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                Instagram
              </Label>
              <Input
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                placeholder="@yourbusiness"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="w-4 h-4" />
                Twitter / X
              </Label>
              <Input
                value={formData.twitter}
                onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                placeholder="@yourbusiness"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="w-4 h-4" />
                Facebook
              </Label>
              <Input
                value={formData.facebook}
                onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                placeholder="facebook.com/yourbusiness"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </Label>
              <Input
                value={formData.linkedin}
                onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                placeholder="linkedin.com/company/yourbusiness"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl px-8 h-12"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
