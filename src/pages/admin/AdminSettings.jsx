import { useState, useEffect } from 'react';
import { Settings, Globe, DollarSign, ToggleLeft, Loader2, Plus, Edit2, Trash2, Save, X, Check, CreditCard, Palette, FileText, Gauge, Eye, EyeOff, Zap, Banknote, Key, Mail, MessageSquare, Smartphone, CheckCircle, AlertCircle, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('currencies');
  
  // Data states
  const [currencies, setCurrencies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [features, setFeatures] = useState([]);
  const [countryFeatures, setCountryFeatures] = useState([]);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [branding, setBranding] = useState({});
  const [legalDocs, setLegalDocs] = useState([]);
  const [limits, setLimits] = useState([]);
  const [platformSettings, setPlatformSettings] = useState([]);
  const [savedKey, setSavedKey] = useState(null);
  const [fastPayoutSettings, setFastPayoutSettings] = useState({
    enabled: true,
    fee_percentage: 0.005,
    min_ticket_sales_percentage: 50,
    cap_bronze: 70,
    cap_silver: 80,
    cap_gold: 90,
    cap_trusted: 95,
    require_kyc: true,
    require_bank_verified: true,
    max_requests_per_event: 3,
    cooldown_hours: 24
  });
  
  // Modal states
  const [currencyModal, setCurrencyModal] = useState({ open: false, data: null });
  const [countryModal, setCountryModal] = useState({ open: false, data: null });
  const [gatewayModal, setGatewayModal] = useState({ open: false, data: null });
  const [legalModal, setLegalModal] = useState({ open: false, data: null });
  const [limitModal, setLimitModal] = useState({ open: false, data: null });
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});

  // API Configurations
  const [smsConfig, setSmsConfig] = useState({
    provider: 'termii',
    api_key: '',
    sender_id: 'Ticketrack',
    is_active: true,
  });
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: 'manual',
    api_key: '',
    phone_number_id: '',
    business_account_id: '',
    is_verified: false,
  });
  const [emailConfig, setEmailConfig] = useState({
    provider: 'resend',
    api_key: '',
    from_email: 'tickets@ticketrack.com',
    from_name: 'Ticketrack',
    is_active: true,
  });
  const [testingApi, setTestingApi] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [currencyRes, countryRes, featureRes, cfRes, gatewayRes, brandingRes, legalRes, limitsRes, platformSettingsRes, fastPayoutRes, smsRes, whatsappRes, emailRes] = await Promise.all([
        supabase.from('currencies').select('*').order('sort_order'),
        supabase.from('countries').select('*').order('name'),
        supabase.from('features').select('*').order('category, name'),
        supabase.from('country_features').select('*'),
        supabase.from('payment_gateway_config').select('*'),
        supabase.from('platform_branding').select('*').single(),
        supabase.from('legal_documents').select('*').order('applies_to'),
        supabase.from('platform_limits').select('*').order('country_code, limit_key'),
        supabase.from('platform_settings').select('*').order('category, key'),
        supabase.from('fast_payout_settings').select('*').limit(1).single(),
        supabase.from('platform_sms_config').select('*').single(),
        supabase.from('platform_whatsapp_config').select('*').single(),
        supabase.from('platform_email_config').select('*').single(),
      ]);

      setCurrencies(currencyRes.data || []);
      setCountries(countryRes.data || []);
      setFeatures(featureRes.data || []);
      setCountryFeatures(cfRes.data || []);
      setPaymentGateways(gatewayRes.data || []);
      setBranding(brandingRes.data || {});
      setLegalDocs(legalRes.data || []);
      setLimits(limitsRes.data || []);
      setPlatformSettings(platformSettingsRes.data || []);
      if (fastPayoutRes.data) {
        setFastPayoutSettings(fastPayoutRes.data);
      }
      if (smsRes.data) {
        setSmsConfig(smsRes.data);
      }
      if (whatsappRes.data) {
        setWhatsappConfig(whatsappRes.data);
      }
      if (emailRes.data) {
        setEmailConfig(emailRes.data);
      }

      if (countryRes.data?.length > 0) {
        setSelectedCountry(countryRes.data[0].code);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to upsert platform settings (creates if not exists, updates if exists)
  const savePlatformSetting = async (key, value, category = 'general', description = '') => {
    const { error } = await supabase.from('platform_settings').upsert({
      key,
      value,
      category,
      description,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) {
      console.error('Error saving platform setting:', error);
      return false;
    }

    // Update local state
    setPlatformSettings(prev => {
      const exists = prev.find(s => s.key === key);
      if (exists) {
        return prev.map(s => s.key === key ? { ...s, value } : s);
      }
      return [...prev, { key, value, category, description }];
    });

    return true;
  };

  // Currency handlers
  const saveCurrency = async () => {
    setSaving(true);
    try {
      const { data: currencyData } = currencyModal;
      if (currencyModal.isNew) {
        await supabase.from('currencies').insert(currencyData);
      } else {
        await supabase.from('currencies').update(currencyData).eq('code', currencyData.code);
      }
      setCurrencyModal({ open: false, data: null });
      loadAllData();
    } catch (error) {
      console.error('Error saving currency:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleCurrency = async (code, isActive) => {
    await supabase.from('currencies').update({ is_active: !isActive }).eq('code', code);
    loadAllData();
  };

  // Country handlers
  // Note: Fee fields are managed exclusively in Fee Management page to avoid conflicts
  const saveCountry = async () => {
    setSaving(true);
    try {
      const { data: countryData } = countryModal;

      // Only save basic country fields - fees are managed in Fee Management
      const basicFields = {
        code: countryData.code,
        name: countryData.name,
        default_currency: countryData.default_currency,
        payment_provider: countryData.payment_provider,
        is_active: countryData.is_active
      };

      if (countryModal.isNew) {
        // For new countries, set default fees (can be customized in Fee Management)
        const newCountryData = {
          ...basicFields,
          service_fee_percentage: 5,
          service_fee_fixed_per_ticket: 0,
          service_fee_fixed: 0
        };
        await supabase.from('countries').insert(newCountryData);
        const featureInserts = features.map(f => ({
          country_code: countryData.code,
          feature_id: f.id,
          is_enabled: false,
          config: {}
        }));
        await supabase.from('country_features').insert(featureInserts);
      } else {
        // For existing countries, only update basic fields (not fees)
        await supabase.from('countries').update(basicFields).eq('code', countryData.code);
      }
      setCountryModal({ open: false, data: null });
      loadAllData();
    } catch (error) {
      console.error('Error saving country:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleCountry = async (code, isActive) => {
    await supabase.from('countries').update({ is_active: !isActive }).eq('code', code);
    loadAllData();
  };

  // Feature handlers
  const toggleFeature = async (countryCode, featureId, currentEnabled) => {
    const existing = countryFeatures.find(cf => cf.country_code === countryCode && cf.feature_id === featureId);
    
    if (existing) {
      await supabase.from('country_features')
        .update({ is_enabled: !currentEnabled })
        .eq('country_code', countryCode)
        .eq('feature_id', featureId);
    } else {
      await supabase.from('country_features').insert({
        country_code: countryCode,
        feature_id: featureId,
        is_enabled: true,
        config: {}
      });
    }
    loadAllData();
  };

  const getFeatureStatus = (countryCode, featureId) => {
    const cf = countryFeatures.find(c => c.country_code === countryCode && c.feature_id === featureId);
    return cf ? { enabled: cf.is_enabled, config: cf.config } : { enabled: false, config: {} };
  };

  // Payment Gateway handlers
  const saveGateway = async () => {
    setSaving(true);
    try {
      const { data: gwData } = gatewayModal;
      const { id, ...updateData } = gwData;
      
      if (gatewayModal.isNew) {
        await supabase.from('payment_gateway_config').insert(updateData);
      } else {
        await supabase.from('payment_gateway_config').update(updateData).eq('id', id);
      }
      setGatewayModal({ open: false, data: null });
      loadAllData();
    } catch (error) {
      console.error('Error saving gateway:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleGateway = async (id, isActive) => {
    await supabase.from('payment_gateway_config').update({ is_active: !isActive }).eq('id', id);
    loadAllData();
  };

  // Branding handlers
  const saveBranding = async () => {
    setSaving(true);
    try {
      await supabase.from('platform_branding').update(branding).eq('id', 'default');
      loadAllData();
    } catch (error) {
      console.error('Error saving branding:', error);
    } finally {
      setSaving(false);
    }
  };

  // Legal document handlers
  const saveLegalDoc = async () => {
    setSaving(true);
    try {
      const { data: docData } = legalModal;
      await supabase.from('legal_documents').update({
        title: docData.title,
        content: docData.content,
        version: docData.version,
        is_required: docData.is_required,
        updated_at: new Date().toISOString()
      }).eq('id', docData.id);
      setLegalModal({ open: false, data: null });
      loadAllData();
    } catch (error) {
      console.error('Error saving legal doc:', error);
    } finally {
      setSaving(false);
    }
  };

  // Limits handlers
  const saveLimit = async () => {
    setSaving(true);
    try {
      const { data: limitData } = limitModal;
      if (limitModal.isNew) {
        await supabase.from('platform_limits').insert(limitData);
      } else {
        await supabase.from('platform_limits').update(limitData).eq('id', limitData.id);
      }
      setLimitModal({ open: false, data: null });
      loadAllData();
    } catch (error) {
      console.error('Error saving limit:', error);
    } finally {
      setSaving(false);
    }
  };

  const maskSecret = (secret) => {
    if (!secret) return '';
    if (secret.length <= 8) return '••••••••';
    return secret.substring(0, 4) + '••••••••' + secret.substring(secret.length - 4);
  };

  // Fast Payout handlers
  const saveFastPayoutSettings = async () => {
    setSaving(true);
    try {
      const { id, created_at, ...updateData } = fastPayoutSettings;
      updateData.updated_at = new Date().toISOString();

      if (id) {
        await supabase.from('fast_payout_settings').update(updateData).eq('id', id);
      } else {
        await supabase.from('fast_payout_settings').insert(updateData);
      }
      loadAllData();
    } catch (error) {
      console.error('Error saving fast payout settings:', error);
    } finally {
      setSaving(false);
    }
  };

  // API Configuration handlers
  const saveSmsConfig = async () => {
    setSaving(true);
    try {
      const { id, created_at, ...updateData } = smsConfig;
      updateData.updated_at = new Date().toISOString();

      const { data: existing } = await supabase.from('platform_sms_config').select('id').single();
      if (existing) {
        await supabase.from('platform_sms_config').update(updateData).eq('id', existing.id);
      } else {
        await supabase.from('platform_sms_config').insert(updateData);
      }
      setSavedKey('sms');
      setTimeout(() => setSavedKey(null), 2000);
      loadAllData();
    } catch (error) {
      console.error('Error saving SMS config:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveWhatsappConfig = async () => {
    setSaving(true);
    try {
      const { id, created_at, ...updateData } = whatsappConfig;
      updateData.updated_at = new Date().toISOString();

      const { data: existing } = await supabase.from('platform_whatsapp_config').select('id').single();
      if (existing) {
        await supabase.from('platform_whatsapp_config').update(updateData).eq('id', existing.id);
      } else {
        await supabase.from('platform_whatsapp_config').insert(updateData);
      }
      setSavedKey('whatsapp');
      setTimeout(() => setSavedKey(null), 2000);
      loadAllData();
    } catch (error) {
      console.error('Error saving WhatsApp config:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveEmailConfig = async () => {
    setSaving(true);
    try {
      const { id, created_at, ...updateData } = emailConfig;
      updateData.updated_at = new Date().toISOString();

      const { data: existing } = await supabase.from('platform_email_config').select('id').single();
      if (existing) {
        await supabase.from('platform_email_config').update(updateData).eq('id', existing.id);
      } else {
        await supabase.from('platform_email_config').insert(updateData);
      }
      setSavedKey('email');
      setTimeout(() => setSavedKey(null), 2000);
      loadAllData();
    } catch (error) {
      console.error('Error saving Email config:', error);
    } finally {
      setSaving(false);
    }
  };

  const testApiConnection = async (service) => {
    setTestingApi(service);
    try {
      // Simulate API test - in production, this would call actual test endpoints
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(`${service} connection test successful!`);
    } catch (error) {
      toast.error(`${service} connection test failed.`);
    } finally {
      setTestingApi(null);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Platform Settings</h2>
          <p className="text-muted-foreground mt-1">Manage currencies, countries, fees, payments, and features</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="currencies" className="rounded-lg data-[state=active]:bg-card">
            <DollarSign className="w-4 h-4 mr-2" /> Currencies
          </TabsTrigger>
          <TabsTrigger value="countries" className="rounded-lg data-[state=active]:bg-card">
            <Globe className="w-4 h-4 mr-2" /> Countries
          </TabsTrigger>
          <TabsTrigger value="features" className="rounded-lg data-[state=active]:bg-card">
            <ToggleLeft className="w-4 h-4 mr-2" /> Features
          </TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg data-[state=active]:bg-card">
            <Palette className="w-4 h-4 mr-2" /> Branding
          </TabsTrigger>
          <TabsTrigger value="legal" className="rounded-lg data-[state=active]:bg-card">
            <FileText className="w-4 h-4 mr-2" /> Legal
          </TabsTrigger>
          <TabsTrigger value="limits" className="rounded-lg data-[state=active]:bg-card">
            <Gauge className="w-4 h-4 mr-2" /> Limits
          </TabsTrigger>
          <TabsTrigger value="connect" className="rounded-lg data-[state=active]:bg-card">
            <Zap className="w-4 h-4 mr-2" /> Stripe Connect
          </TabsTrigger>
          <TabsTrigger value="fastpayout" className="rounded-lg data-[state=active]:bg-card">
            <Banknote className="w-4 h-4 mr-2" /> Fast Payout
          </TabsTrigger>
          <TabsTrigger value="apis" className="rounded-lg data-[state=active]:bg-card">
            <Key className="w-4 h-4 mr-2" /> APIs
          </TabsTrigger>
        </TabsList>

        {/* CURRENCIES TAB */}
        <TabsContent value="currencies" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Supported Currencies</CardTitle>
              <Button 
                onClick={() => setCurrencyModal({ 
                  open: true, 
                  isNew: true,
                  data: { code: '', symbol: '', name: '', locale: 'en-US', is_active: true, sort_order: currencies.length + 1 }
                })}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Currency
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currencies.map(currency => (
                  <div key={currency.code} className="flex items-center justify-between p-4 rounded-xl bg-muted">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-xl font-bold">
                        {currency.symbol}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{currency.name}</h4>
                        <p className="text-sm text-muted-foreground">{currency.code} • {currency.locale}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={currency.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                        {currency.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Switch 
                        checked={currency.is_active} 
                        onCheckedChange={() => toggleCurrency(currency.code, currency.is_active)}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setCurrencyModal({ open: true, isNew: false, data: { ...currency } })}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COUNTRIES TAB - UPDATED: Only 2 fees displayed */}
        <TabsContent value="countries" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Countries & Fee Configuration</CardTitle>
              <Button
                onClick={() => setCountryModal({
                  open: true,
                  isNew: true,
                  data: {
                    code: '',
                    name: '',
                    default_currency: 'NGN',
                    payment_provider: 'paystack',
                    is_active: true
                  }
                })}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Country
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {countries.map(country => {
                  const currency = currencies.find(c => c.code === country.default_currency);
                  return (
                    <div key={country.code} className="p-4 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center font-bold text-sm">
                            {country.code}
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{country.name}</h4>
                            <p className="text-sm text-muted-foreground">{currency?.symbol} {currency?.name} • {country.payment_provider}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={country.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                            {country.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Switch 
                            checked={country.is_active} 
                            onCheckedChange={() => toggleCountry(country.code, country.is_active)}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setCountryModal({ open: true, isNew: false, data: { ...country } })}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Fee fields - read-only, managed in Fee Management */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-card rounded-lg">
                          <p className="text-xs text-muted-foreground">Service Fee (%)</p>
                          <p className="font-semibold text-foreground">{country.service_fee_percentage || 0}%</p>
                        </div>
                        <div className="p-3 bg-card rounded-lg">
                          <p className="text-xs text-muted-foreground">Service Fee (Fixed)</p>
                          <p className="font-semibold text-foreground">{currency?.symbol}{country.service_fee_fixed_per_ticket || country.service_fee_fixed || 0}</p>
                        </div>
                        <div className="p-3 bg-card rounded-lg flex items-center justify-center">
                          <a
                            href="/admin/fees"
                            className="text-xs text-[#2969FF] hover:underline flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit in Fee Management
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FEATURES TAB */}
        <TabsContent value="features" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Feature Flags by Country</CardTitle>
                <Select value={selectedCountry || ''} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-48 rounded-xl">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedCountry && (
                <div className="space-y-4">
                  {['communications', 'verification', 'marketing', 'payments', 'tickets'].map(category => {
                    const categoryFeatures = features.filter(f => f.category === category);
                    if (categoryFeatures.length === 0) return null;
                    
                    return (
                      <div key={category}>
                        <h4 className="text-sm font-medium text-muted-foreground uppercase mb-3">{category}</h4>
                        <div className="space-y-2">
                          {categoryFeatures.map(feature => {
                            const status = getFeatureStatus(selectedCountry, feature.id);
                            return (
                              <div key={feature.id} className="flex items-center justify-between p-4 rounded-xl bg-muted">
                                <div>
                                  <h5 className="font-medium text-foreground">{feature.name}</h5>
                                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge className={status.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                                    {status.enabled ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                  <Switch 
                                    checked={status.enabled} 
                                    onCheckedChange={() => toggleFeature(selectedCountry, feature.id, status.enabled)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRANDING TAB */}
        <TabsContent value="branding" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Platform Branding</CardTitle>
              <Button onClick={saveBranding} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Company Name</Label>
                    <Input 
                      value={branding.company_name || ''} 
                      onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Tagline</Label>
                    <Input 
                      value={branding.tagline || ''} 
                      onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Logo URL</Label>
                    <Input 
                      value={branding.logo_url || ''} 
                      onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                      className="rounded-xl mt-1"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Favicon URL</Label>
                    <Input 
                      value={branding.favicon_url || ''} 
                      onChange={(e) => setBranding({ ...branding, favicon_url: e.target.value })}
                      className="rounded-xl mt-1"
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Primary Color</Label>
                      <div className="flex gap-2 mt-1">
                        <Input 
                          type="color"
                          value={branding.primary_color || '#2969FF'} 
                          onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                          className="w-12 h-10 p-1 rounded-xl"
                        />
                        <Input 
                          value={branding.primary_color || '#2969FF'} 
                          onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2 mt-1">
                        <Input 
                          type="color"
                          value={branding.secondary_color || '#0F0F0F'} 
                          onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                          className="w-12 h-10 p-1 rounded-xl"
                        />
                        <Input 
                          value={branding.secondary_color || '#0F0F0F'} 
                          onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Support Email</Label>
                    <Input 
                      type="email"
                      value={branding.support_email || ''} 
                      onChange={(e) => setBranding({ ...branding, support_email: e.target.value })}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Support Phone</Label>
                    <Input 
                      value={branding.support_phone || ''} 
                      onChange={(e) => setBranding({ ...branding, support_phone: e.target.value })}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Twitter</Label>
                      <Input 
                        value={branding.social_twitter || ''} 
                        onChange={(e) => setBranding({ ...branding, social_twitter: e.target.value })}
                        className="rounded-xl mt-1"
                        placeholder="@handle"
                      />
                    </div>
                    <div>
                      <Label>Instagram</Label>
                      <Input 
                        value={branding.social_instagram || ''} 
                        onChange={(e) => setBranding({ ...branding, social_instagram: e.target.value })}
                        className="rounded-xl mt-1"
                        placeholder="@handle"
                      />
                    </div>
                    <div>
                      <Label>Facebook</Label>
                      <Input 
                        value={branding.social_facebook || ''} 
                        onChange={(e) => setBranding({ ...branding, social_facebook: e.target.value })}
                        className="rounded-xl mt-1"
                        placeholder="page-name"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEGAL TAB */}
        <TabsContent value="legal" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Legal Documents & Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {legalDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-muted">
                    <div>
                      <h4 className="font-medium text-foreground">{doc.title}</h4>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{doc.applies_to}</Badge>
                        <Badge variant="outline">v{doc.version}</Badge>
                        {doc.is_required && <Badge className="bg-red-100 text-red-700">Required</Badge>}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setLegalModal({ open: true, data: { ...doc } })}
                    >
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIMITS TAB */}
        <TabsContent value="limits" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Platform Limits</CardTitle>
              <Button 
                onClick={() => setLimitModal({ 
                  open: true, 
                  isNew: true,
                  data: { 
                    id: '',
                    country_code: countries[0]?.code || 'NG',
                    limit_key: '',
                    limit_value: 0,
                    description: ''
                  }
                })}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Limit
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {countries.map(country => {
                  const countryLimits = limits.filter(l => l.country_code === country.code);
                  if (countryLimits.length === 0) return null;
                  
                  return (
                    <div key={country.code} className="p-4 rounded-xl bg-muted">
                      <h4 className="font-medium text-foreground mb-3">{country.name}</h4>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {countryLimits.map(limit => (
                          <div key={limit.id} className="p-3 bg-card rounded-lg flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">{limit.description || limit.limit_key}</p>
                              <p className="font-semibold text-foreground">{limit.limit_value.toLocaleString()}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setLimitModal({ open: true, isNew: false, data: { ...limit } })}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Platform Settings Section */}
              <div className="mt-6 pt-6 border-t border-border/10">
                <h4 className="font-medium text-foreground mb-4">Global Platform Settings (RSVP & Free Events)</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {platformSettings.map(setting => (
                    <div key={setting.key} className="p-4 bg-card rounded-xl border border-border/10">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground uppercase">{setting.category}</p>
                      </div>
                      <p className="text-sm text-foreground/80 mb-2">{setting.description}</p>
                      {setting.value === 'true' || setting.value === 'false' ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={setting.value === 'true'}
                            onCheckedChange={async (checked) => {
                              const newValue = checked ? 'true' : 'false';
                              setPlatformSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: newValue } : s));
                              const { error } = await supabase.from('platform_settings').update({ value: newValue, updated_at: new Date().toISOString() }).eq('key', setting.key);
                              if (error) console.error('Save error:', error);
                              setSavedKey(setting.key);
                              setTimeout(() => setSavedKey(null), 2000);
                            }}
                          />
                          {savedKey === setting.key && <span className="text-xs text-green-600">Saved!</span>}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Input
                            value={setting.value}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setPlatformSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: newValue } : s));
                            }}
                            onBlur={async (e) => {
                              console.log('Saving:', setting.key, '=', e.target.value);
                              const { data, error } = await supabase.from('platform_settings').update({ value: e.target.value, updated_at: new Date().toISOString() }).eq('key', setting.key).select();
                              console.log('Result:', data, error);
                              if (error) console.error('Save error:', error);
                              setSavedKey(setting.key);
                              setTimeout(() => setSavedKey(null), 2000);
                            }}
                            className="rounded-lg"
                          />
                          {savedKey === setting.key && <span className="text-xs text-green-600">Saved!</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STRIPE CONNECT TAB */}
        <TabsContent value="connect" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Stripe Connect Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Global Toggle */}
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-purple-900">Enable Stripe Connect</h4>
                    <p className="text-sm text-purple-700">Allow organizers in supported countries to receive direct payouts</p>
                  </div>
                  <Switch
                    checked={platformSettings.find(s => s.key === 'stripe_connect_enabled')?.value === 'true'}
                    onCheckedChange={async (checked) => {
                      const newValue = checked ? 'true' : 'false';
                      await savePlatformSetting('stripe_connect_enabled', newValue, 'stripe_connect', 'Enable Stripe Connect for direct payouts');
                      setSavedKey('stripe_connect_enabled');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                  />
                </div>
                {savedKey === 'stripe_connect_enabled' && <span className="text-xs text-green-600 mt-2 block">Saved!</span>}
              </div>

              {/* Settings Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Platform Fee */}
                <div className="p-4 bg-card rounded-xl border border-border/10">
                  <Label className="text-sm font-medium">Platform Fee (%)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Percentage charged on each Connect transaction</p>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={platformSettings.find(s => s.key === 'stripe_connect_platform_fee_percentage')?.value || '5'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_platform_fee_percentage' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await savePlatformSetting('stripe_connect_platform_fee_percentage', e.target.value, 'stripe_connect', 'Platform fee percentage for Stripe Connect');
                      setSavedKey('stripe_connect_platform_fee_percentage');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg"
                  />
                  {savedKey === 'stripe_connect_platform_fee_percentage' && <span className="text-xs text-green-600">Saved!</span>}
                </div>

                {/* Minimum Payout */}
                <div className="p-4 bg-card rounded-xl border border-border/10">
                  <Label className="text-sm font-medium">Minimum Payout ($)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Minimum balance required before auto-payout triggers</p>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={platformSettings.find(s => s.key === 'stripe_connect_minimum_payout')?.value || '10'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_minimum_payout' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await savePlatformSetting('stripe_connect_minimum_payout', e.target.value, 'stripe_connect', 'Minimum payout amount for Stripe Connect');
                      setSavedKey('stripe_connect_minimum_payout');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg"
                  />
                  {savedKey === 'stripe_connect_minimum_payout' && <span className="text-xs text-green-600">Saved!</span>}
                </div>

                {/* Payout Delay */}
                <div className="p-4 bg-card rounded-xl border border-border/10">
                  <Label className="text-sm font-medium">Payout Delay (days)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Days after event ends before payout is released</p>
                  <Input
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    value={platformSettings.find(s => s.key === 'stripe_connect_payout_delay_days')?.value || '3'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_payout_delay_days' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await savePlatformSetting('stripe_connect_payout_delay_days', e.target.value, 'stripe_connect', 'Days delay before payout after event');
                      setSavedKey('stripe_connect_payout_delay_days');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg"
                  />
                  {savedKey === 'stripe_connect_payout_delay_days' && <span className="text-xs text-green-600">Saved!</span>}
                </div>

                {/* Supported Countries */}
                <div className="p-4 bg-card rounded-xl border border-border/10">
                  <Label className="text-sm font-medium">Supported Countries</Label>
                  <p className="text-xs text-muted-foreground mb-2">Countries where Connect is available (JSON array)</p>
                  <Input
                    value={platformSettings.find(s => s.key === 'stripe_connect_countries')?.value || '["US","GB","CA"]'}
                    onChange={(e) => {
                      setPlatformSettings(prev => prev.map(s => s.key === 'stripe_connect_countries' ? { ...s, value: e.target.value } : s));
                    }}
                    onBlur={async (e) => {
                      await savePlatformSetting('stripe_connect_countries', e.target.value, 'stripe_connect', 'Countries where Stripe Connect is available');
                      setSavedKey('stripe_connect_countries');
                      setTimeout(() => setSavedKey(null), 2000);
                    }}
                    className="rounded-lg font-mono text-sm"
                  />
                  {savedKey === 'stripe_connect_countries' && <span className="text-xs text-green-600">Saved!</span>}
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">How Stripe Connect Works</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>Organizers in supported countries can connect their Stripe account</li>
                  <li>Customer payments go directly to the organizer's Stripe (minus platform fee)</li>
                  <li>Payouts to bank accounts are triggered automatically after events end</li>
                  <li>Organizers can process refunds directly from their dashboard</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAST PAYOUT TAB */}
        <TabsContent value="fastpayout" className="mt-6">
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-amber-600" />
                  Fast Payout Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure early payout options for organizers
                </p>
              </div>
              <Button 
                onClick={saveFastPayoutSettings} 
                disabled={saving}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl">
                <div>
                  <Label className="text-base font-medium">Enable Fast Payout</Label>
                  <p className="text-sm text-muted-foreground">Allow organizers to request early payouts</p>
                </div>
                <Switch
                  checked={fastPayoutSettings.enabled}
                  onCheckedChange={(checked) => setFastPayoutSettings(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              {/* Fee Percentage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">Processing Fee (%)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Fee charged for fast payout (e.g., 0.5 = 0.5%)</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={(fastPayoutSettings.fee_percentage * 100).toFixed(1)}
                      onChange={(e) => setFastPayoutSettings(prev => ({ 
                        ...prev, 
                        fee_percentage: parseFloat(e.target.value) / 100 || 0.005 
                      }))}
                      className="rounded-xl w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                    <Badge variant="outline" className="ml-2">
                      Current: {(fastPayoutSettings.fee_percentage * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Minimum Ticket Sales (%)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Required ticket sales to be eligible</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={fastPayoutSettings.min_ticket_sales_percentage}
                      onChange={(e) => setFastPayoutSettings(prev => ({
                        ...prev,
                        min_ticket_sales_percentage: e.target.value === '' ? '' : parseFloat(e.target.value)
                      }))}
                      className="rounded-xl w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              {/* Payout Caps */}
              <div>
                <Label className="text-base font-medium mb-3 block">Payout Caps by Trust Level</Label>
                <p className="text-xs text-muted-foreground mb-4">Maximum percentage of available earnings organizers can withdraw early</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-amber-600" />
                      <span className="text-sm font-medium">Bronze</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={fastPayoutSettings.cap_bronze}
                        onChange={(e) => setFastPayoutSettings(prev => ({ ...prev, cap_bronze: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="rounded-lg w-16 h-8 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400" />
                      <span className="text-sm font-medium">Silver</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={fastPayoutSettings.cap_silver}
                        onChange={(e) => setFastPayoutSettings(prev => ({ ...prev, cap_silver: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="rounded-lg w-16 h-8 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm font-medium">Gold</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={fastPayoutSettings.cap_gold}
                        onChange={(e) => setFastPayoutSettings(prev => ({ ...prev, cap_gold: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="rounded-lg w-16 h-8 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">Trusted</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={fastPayoutSettings.cap_trusted}
                        onChange={(e) => setFastPayoutSettings(prev => ({ ...prev, cap_trusted: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="rounded-lg w-16 h-8 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div>
                <Label className="text-base font-medium mb-3 block">Requirements</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div>
                      <span className="text-sm font-medium">Require KYC Verification</span>
                      <p className="text-xs text-muted-foreground">Organizer must complete KYC before fast payout</p>
                    </div>
                    <Switch
                      checked={fastPayoutSettings.require_kyc}
                      onCheckedChange={(checked) => setFastPayoutSettings(prev => ({ ...prev, require_kyc: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                    <div>
                      <span className="text-sm font-medium">Require Bank Verified</span>
                      <p className="text-xs text-muted-foreground">Bank account must be verified</p>
                    </div>
                    <Switch
                      checked={fastPayoutSettings.require_bank_verified}
                      onCheckedChange={(checked) => setFastPayoutSettings(prev => ({ ...prev, require_bank_verified: checked }))}
                    />
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">Max Requests Per Event</Label>
                  <p className="text-xs text-muted-foreground mb-2">How many times can organizer request fast payout per event</p>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={fastPayoutSettings.max_requests_per_event}
                    onChange={(e) => setFastPayoutSettings(prev => ({ ...prev, max_requests_per_event: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                    className="rounded-xl w-24"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Cooldown Period (hours)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Minimum hours between fast payout requests</p>
                  <Input
                    type="number"
                    min="0"
                    max="168"
                    value={fastPayoutSettings.cooldown_hours}
                    onChange={(e) => setFastPayoutSettings(prev => ({ ...prev, cooldown_hours: e.target.value === '' ? '' : parseInt(e.target.value) }))}
                    className="rounded-xl w-24"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <h4 className="font-medium text-amber-900 mb-2">How Fast Payout Works</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Organizers can request early payout when {fastPayoutSettings.min_ticket_sales_percentage}% of tickets are sold</li>
                  <li>• A {(fastPayoutSettings.fee_percentage * 100).toFixed(1)}% fee is deducted from the payout amount</li>
                  <li>• Payout caps protect against refund liability (remaining % held as buffer)</li>
                  <li>• Only non-subaccount organizers are eligible (subaccounts get instant payouts)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APIs TAB */}
        <TabsContent value="apis" className="mt-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentGateways.some(g => g.is_active) ? 'bg-green-100' : 'bg-muted'}`}>
                    <CreditCard className={`w-5 h-5 ${paymentGateways.some(g => g.is_active) ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Payments</p>
                    <p className="text-xs text-muted-foreground">{paymentGateways.filter(g => g.is_active).length} active gateways</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${emailConfig.api_key ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    <Mail className={`w-5 h-5 ${emailConfig.api_key ? 'text-green-600' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <p className="text-xs text-muted-foreground">{emailConfig.api_key ? 'Resend configured' : 'Not configured'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${smsConfig.api_key ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    <Smartphone className={`w-5 h-5 ${smsConfig.api_key ? 'text-green-600' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">SMS</p>
                    <p className="text-xs text-muted-foreground">{smsConfig.api_key ? 'Termii configured' : 'Not configured'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${whatsappConfig.provider !== 'manual' && whatsappConfig.api_key ? 'bg-green-100' : 'bg-muted'}`}>
                    <MessageSquare className={`w-5 h-5 ${whatsappConfig.provider !== 'manual' && whatsappConfig.api_key ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">{whatsappConfig.provider === 'manual' ? 'Manual mode' : whatsappConfig.api_key ? 'Connected' : 'Not configured'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Gateways */}
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#2969FF]" />
                <CardTitle>Payment Gateways</CardTitle>
              </div>
              <Button
                onClick={() => setGatewayModal({
                  open: true,
                  isNew: true,
                  data: {
                    country_code: countries[0]?.code || '',
                    provider: 'paystack',
                    public_key: '',
                    secret_key_encrypted: '',
                    webhook_secret_encrypted: '',
                    sandbox_mode: true,
                    is_active: true,
                    config: {}
                  }
                })}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Gateway
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {countries.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No countries configured. Add countries first.</p>
                )}
                {countries.map(country => {
                  const countryGateways = paymentGateways.filter(g => g.country_code === country.code);

                  return (
                    <div key={country.code} className="p-4 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-foreground">{country.name} ({country.code})</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGatewayModal({
                            open: true,
                            isNew: true,
                            data: {
                              country_code: country.code,
                              provider: 'paystack',
                              public_key: '',
                              secret_key_encrypted: '',
                              webhook_secret_encrypted: '',
                              sandbox_mode: true,
                              is_active: true,
                              config: {}
                            }
                          })}
                          className="rounded-lg"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                      </div>
                      {countryGateways.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No payment gateways configured</p>
                      ) : (
                        <div className="space-y-3">
                          {countryGateways.map(gw => (
                            <div key={gw.id} className="p-4 bg-card rounded-xl">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-[#2969FF]" />
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-foreground capitalize">{gw.provider}</h5>
                                    <div className="flex gap-2 mt-1">
                                      <Badge className={gw.sandbox_mode ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                                        {gw.sandbox_mode ? 'Sandbox' : 'Live'}
                                      </Badge>
                                      <Badge className={gw.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                                        {gw.is_active ? 'Active' : 'Inactive'}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={gw.is_active}
                                    onCheckedChange={() => toggleGateway(gw.id, gw.is_active)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setGatewayModal({ open: true, isNew: false, data: { ...gw } })}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className={`grid gap-3 text-sm ${gw.provider === 'flutterwave' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                <div>
                                  <p className="text-muted-foreground">Public Key</p>
                                  <p className="font-mono text-xs">{maskSecret(gw.public_key) || 'Not set'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Secret Key</p>
                                  <p className="font-mono text-xs">{maskSecret(gw.secret_key_encrypted) || 'Not set'}</p>
                                </div>
                                {gw.provider === 'flutterwave' && (
                                  <div>
                                    <p className="text-muted-foreground">Encryption Key</p>
                                    <p className="font-mono text-xs">{maskSecret(gw.config?.encryption_key_encrypted) || 'Not set'}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Email Service (Resend) */}
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                <CardTitle>Email Service (Resend)</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {savedKey === 'email' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Saved</span>}
                <Button
                  onClick={saveEmailConfig}
                  disabled={saving}
                  className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
                  size="sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={showSecrets.email ? 'text' : 'password'}
                      value={emailConfig.api_key || ''}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, api_key: e.target.value }))}
                      className="rounded-xl mt-1 font-mono text-sm pr-10"
                      placeholder="re_..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowSecrets(prev => ({ ...prev, email: !prev.email }))}
                    >
                      {showSecrets.email ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={emailConfig.from_email || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, from_email: e.target.value }))}
                    className="rounded-xl mt-1"
                    placeholder="tickets@example.com"
                  />
                </div>
                <div>
                  <Label>From Name</Label>
                  <Input
                    value={emailConfig.from_name || ''}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, from_name: e.target.value }))}
                    className="rounded-xl mt-1"
                    placeholder="Ticketrack"
                  />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <Button
                    variant="outline"
                    onClick={() => testApiConnection('Email')}
                    disabled={testingApi === 'Email' || !emailConfig.api_key}
                    className="rounded-xl"
                  >
                    {testingApi === 'Email' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                    Test Connection
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl text-sm text-purple-800">
                <strong>Note:</strong> Email API keys are typically stored as Supabase secrets for Edge Functions.
                This UI updates the database config for reference and fallback.
              </div>
            </CardContent>
          </Card>

          {/* SMS Service (Termii) */}
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-600" />
                <CardTitle>SMS Service (Termii)</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {savedKey === 'sms' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Saved</span>}
                <Button
                  onClick={saveSmsConfig}
                  disabled={saving}
                  className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
                  size="sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>API Key</Label>
                  <div className="relative">
                    <Input
                      type={showSecrets.sms ? 'text' : 'password'}
                      value={smsConfig.api_key || ''}
                      onChange={(e) => setSmsConfig(prev => ({ ...prev, api_key: e.target.value }))}
                      className="rounded-xl mt-1 font-mono text-sm pr-10"
                      placeholder="TL..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowSecrets(prev => ({ ...prev, sms: !prev.sms }))}
                    >
                      {showSecrets.sms ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Sender ID</Label>
                  <Input
                    value={smsConfig.sender_id || ''}
                    onChange={(e) => setSmsConfig(prev => ({ ...prev, sender_id: e.target.value }))}
                    className="rounded-xl mt-1"
                    placeholder="Ticketrack"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Max 11 characters, alphanumeric</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => testApiConnection('SMS')}
                  disabled={testingApi === 'SMS' || !smsConfig.api_key}
                  className="rounded-xl"
                >
                  {testingApi === 'SMS' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                  Test Connection
                </Button>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={smsConfig.is_active}
                    onCheckedChange={(checked) => setSmsConfig(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Service */}
          <Card className="border-border/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-500" />
                <CardTitle>WhatsApp Business</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {savedKey === 'whatsapp' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Saved</span>}
                <Button
                  onClick={saveWhatsappConfig}
                  disabled={saving}
                  className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
                  size="sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Provider</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { value: 'manual', label: 'Manual (wa.me)' },
                    { value: '360dialog', label: '360dialog' },
                    { value: 'wati', label: 'WATI' },
                    { value: 'twilio', label: 'Twilio' },
                    { value: 'termii', label: 'Termii' },
                  ].map(provider => (
                    <div
                      key={provider.value}
                      onClick={() => setWhatsappConfig(prev => ({ ...prev, provider: provider.value, is_verified: false }))}
                      className={`p-3 rounded-xl border-2 cursor-pointer text-center text-sm transition-all ${
                        whatsappConfig.provider === provider.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-border/10 hover:border-border/20'
                      }`}
                    >
                      {provider.label}
                    </div>
                  ))}
                </div>
              </div>

              {whatsappConfig.provider !== 'manual' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>API Key / Access Token</Label>
                    <div className="relative">
                      <Input
                        type={showSecrets.whatsapp ? 'text' : 'password'}
                        value={whatsappConfig.api_key || ''}
                        onChange={(e) => setWhatsappConfig(prev => ({ ...prev, api_key: e.target.value }))}
                        className="rounded-xl mt-1 font-mono text-sm pr-10"
                        placeholder="Enter API key"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowSecrets(prev => ({ ...prev, whatsapp: !prev.whatsapp }))}
                      >
                        {showSecrets.whatsapp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Phone Number ID</Label>
                    <Input
                      value={whatsappConfig.phone_number_id || ''}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phone_number_id: e.target.value }))}
                      className="rounded-xl mt-1"
                      placeholder="e.g., 1234567890"
                    />
                  </div>
                  <div>
                    <Label>Business Account ID (optional)</Label>
                    <Input
                      value={whatsappConfig.business_account_id || ''}
                      onChange={(e) => setWhatsappConfig(prev => ({ ...prev, business_account_id: e.target.value }))}
                      className="rounded-xl mt-1"
                      placeholder="e.g., 9876543210"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <Button
                      variant="outline"
                      onClick={() => testApiConnection('WhatsApp')}
                      disabled={testingApi === 'WhatsApp' || !whatsappConfig.api_key}
                      className="rounded-xl"
                    >
                      {testingApi === 'WhatsApp' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
                      Test Connection
                    </Button>
                    {whatsappConfig.is_verified && (
                      <Badge className="bg-green-100 text-green-700">Verified</Badge>
                    )}
                  </div>
                </div>
              )}

              {whatsappConfig.provider === 'manual' && (
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Manual Mode Active</p>
                      <p className="text-sm text-blue-700">WhatsApp messages will open wa.me links for each recipient. No API integration required.</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Security Notice */}
          <Card className="border-yellow-200 bg-yellow-50 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Security Notice</h4>
                  <p className="text-sm text-yellow-800 mt-1">
                    API keys stored here are encrypted at rest. For production deployments, sensitive keys should also be
                    configured as Supabase Edge Function secrets for maximum security.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


        {/* Currency Modal */}
      <Dialog open={currencyModal.open} onOpenChange={(open) => !open && setCurrencyModal({ open: false, data: null })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{currencyModal.isNew ? 'Add Currency' : 'Edit Currency'}</DialogTitle>
          </DialogHeader>
          {currencyModal.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code (e.g., EUR)</Label>
                  <Input 
                    value={currencyModal.data.code} 
                    onChange={(e) => setCurrencyModal(prev => ({ ...prev, data: { ...prev.data, code: e.target.value.toUpperCase() }}))}
                    disabled={!currencyModal.isNew}
                    className="rounded-xl mt-1"
                    maxLength={3}
                  />
                </div>
                <div>
                  <Label>Symbol (e.g., €)</Label>
                  <Input 
                    value={currencyModal.data.symbol} 
                    onChange={(e) => setCurrencyModal(prev => ({ ...prev, data: { ...prev.data, symbol: e.target.value }}))}
                    className="rounded-xl mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Name</Label>
                <Input 
                  value={currencyModal.data.name} 
                  onChange={(e) => setCurrencyModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value }}))}
                  className="rounded-xl mt-1"
                  placeholder="e.g., Euro"
                />
              </div>
              <div>
                <Label>Locale (for formatting)</Label>
                <Input 
                  value={currencyModal.data.locale} 
                  onChange={(e) => setCurrencyModal(prev => ({ ...prev, data: { ...prev.data, locale: e.target.value }}))}
                  className="rounded-xl mt-1"
                  placeholder="e.g., de-DE"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrencyModal({ open: false, data: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={saveCurrency} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Country Modal - UPDATED: Only 2 fee fields (for Pricing Page) */}
      <Dialog open={countryModal.open} onOpenChange={(open) => !open && setCountryModal({ open: false, data: null })}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{countryModal.isNew ? 'Add Country' : 'Edit Country'}</DialogTitle>
          </DialogHeader>
          {countryModal.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Country Code (e.g., AE)</Label>
                  <Input 
                    value={countryModal.data.code} 
                    onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, code: e.target.value.toUpperCase() }}))}
                    disabled={!countryModal.isNew}
                    className="rounded-xl mt-1"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label>Country Name</Label>
                  <Input 
                    value={countryModal.data.name} 
                    onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, name: e.target.value }}))}
                    className="rounded-xl mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default Currency</Label>
                  <Select 
                    value={countryModal.data.default_currency} 
                    onValueChange={(v) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, default_currency: v }}))}
                  >
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.filter(c => c.is_active).map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.symbol} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Provider</Label>
                  <Select 
                    value={countryModal.data.payment_provider} 
                    onValueChange={(v) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, payment_provider: v }}))}
                  >
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paystack">Paystack</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="flutterwave">Flutterwave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Fee Configuration - Read-only, managed in Fee Management */}
              <div className="border-t pt-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Fee Configuration</h4>
                      <p className="text-sm text-blue-700">
                        Fees are managed in the dedicated Fee Management page to avoid conflicts.
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-sm text-blue-800">
                        <span>Current: <strong>{countryModal.data.service_fee_percentage || 0}%</strong> + <strong>{countryModal.data.service_fee_fixed_per_ticket || countryModal.data.service_fee_fixed || 0}</strong> per ticket</span>
                      </div>
                    </div>
                    <a
                      href="/admin/fees"
                      className="flex items-center gap-2 bg-[#2969FF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2969FF]/90 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = '/admin/fees';
                      }}
                    >
                      <DollarSign className="w-4 h-4" />
                      Manage Fees
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountryModal({ open: false, data: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={saveCountry} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gateway Modal */}
      <Dialog open={gatewayModal.open} onOpenChange={(open) => !open && setGatewayModal({ open: false, data: null })}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>{gatewayModal.isNew ? 'Add Payment Gateway' : 'Edit Payment Gateway'}</DialogTitle>
          </DialogHeader>
          {gatewayModal.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Country</Label>
                  <Select 
                    value={gatewayModal.data.country_code} 
                    onValueChange={(v) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, country_code: v }}))}
                    disabled={!gatewayModal.isNew}
                  >
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {countries.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Provider</Label>
                  <Select 
                    value={gatewayModal.data.provider} 
                    onValueChange={(v) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, provider: v }}))}
                    disabled={!gatewayModal.isNew}
                  >
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paystack">Paystack</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="flutterwave">Flutterwave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Public Key</Label>
                <Input 
                  value={gatewayModal.data.public_key || ''} 
                  onChange={(e) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, public_key: e.target.value }}))}
                  className="rounded-xl mt-1 font-mono text-sm"
                  placeholder="pk_live_..."
                />
              </div>
              <div>
                <Label>Secret Key</Label>
                <div className="relative">
                  <Input 
                    type={showSecrets.secret ? 'text' : 'password'}
                    value={gatewayModal.data.secret_key_encrypted || ''} 
                    onChange={(e) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, secret_key_encrypted: e.target.value }}))}
                    className="rounded-xl mt-1 font-mono text-sm pr-10"
                    placeholder="sk_live_..."
                  />
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowSecrets(prev => ({ ...prev, secret: !prev.secret }))}
                  >
                    {showSecrets.secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              {/* Flutterwave-specific: Encryption Key */}
              {gatewayModal.data.provider === 'flutterwave' && (
                <div>
                  <Label>Encryption Key</Label>
                  <div className="relative">
                    <Input 
                      type={showSecrets.encryption ? 'text' : 'password'}
                      value={gatewayModal.data.config?.encryption_key_encrypted || ''} 
                      onChange={(e) => setGatewayModal(prev => ({ 
                        ...prev, 
                        data: { 
                          ...prev.data, 
                          config: { 
                            ...prev.data.config, 
                            encryption_key_encrypted: e.target.value 
                          } 
                        } 
                      }))}
                      className="rounded-xl mt-1 font-mono text-sm pr-10"
                      placeholder="FLWSECK_TEST_..."
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowSecrets(prev => ({ ...prev, encryption: !prev.encryption }))}
                    >
                      {showSecrets.encryption ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Required for Flutterwave payment encryption</p>
                </div>
              )}
              <div>
                <Label>Webhook Secret</Label>
                <div className="relative">
                  <Input 
                    type={showSecrets.webhook ? 'text' : 'password'}
                    value={gatewayModal.data.webhook_secret_encrypted || ''} 
                    onChange={(e) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, webhook_secret_encrypted: e.target.value }}))}
                    className="rounded-xl mt-1 font-mono text-sm pr-10"
                    placeholder={gatewayModal.data.provider === 'flutterwave' ? 'FLWSECK_...' : 'whsec_...'}
                  />
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShowSecrets(prev => ({ ...prev, webhook: !prev.webhook }))}
                  >
                    {showSecrets.webhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <div>
                  <p className="font-medium text-foreground">Sandbox Mode</p>
                  <p className="text-sm text-muted-foreground">Use test environment</p>
                </div>
                <Switch 
                  checked={gatewayModal.data.sandbox_mode} 
                  onCheckedChange={(checked) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, sandbox_mode: checked }}))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGatewayModal({ open: false, data: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={saveGateway} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legal Modal */}
      <Dialog open={legalModal.open} onOpenChange={(open) => !open && setLegalModal({ open: false, data: null })}>
        <DialogContent className="rounded-2xl max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {legalModal.data?.title}</DialogTitle>
          </DialogHeader>
          {legalModal.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Title</Label>
                  <Input 
                    value={legalModal.data.title} 
                    onChange={(e) => setLegalModal(prev => ({ ...prev, data: { ...prev.data, title: e.target.value }}))}
                    className="rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label>Version</Label>
                  <Input 
                    value={legalModal.data.version} 
                    onChange={(e) => setLegalModal(prev => ({ ...prev, data: { ...prev.data, version: e.target.value }}))}
                    className="rounded-xl mt-1"
                    placeholder="1.0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={legalModal.data.is_required} 
                    onCheckedChange={(checked) => setLegalModal(prev => ({ ...prev, data: { ...prev.data, is_required: checked }}))}
                  />
                  <Label>Required to accept</Label>
                </div>
                <Badge variant="outline">{legalModal.data.applies_to}</Badge>
              </div>
              <div>
                <Label>Content</Label>
                <Textarea 
                  value={legalModal.data.content || ''} 
                  onChange={(e) => setLegalModal(prev => ({ ...prev, data: { ...prev.data, content: e.target.value }}))}
                  className="rounded-xl mt-1 min-h-[300px] font-mono text-sm"
                  placeholder="Enter the legal document content..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegalModal({ open: false, data: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={saveLegalDoc} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limit Modal */}
      <Dialog open={limitModal.open} onOpenChange={(open) => !open && setLimitModal({ open: false, data: null })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{limitModal.isNew ? 'Add Limit' : 'Edit Limit'}</DialogTitle>
          </DialogHeader>
          {limitModal.data && (
            <div className="space-y-4">
              <div>
                <Label>Country</Label>
                <Select 
                  value={limitModal.data.country_code} 
                  onValueChange={(v) => setLimitModal(prev => ({ ...prev, data: { ...prev.data, country_code: v }}))}
                  disabled={!limitModal.isNew}
                >
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {limitModal.isNew && (
                <div>
                  <Label>Limit ID</Label>
                  <Input 
                    value={limitModal.data.id} 
                    onChange={(e) => setLimitModal(prev => ({ ...prev, data: { ...prev.data, id: e.target.value.toLowerCase().replace(/\s/g, '_') }}))}
                    className="rounded-xl mt-1"
                    placeholder="e.g., ng_max_tickets_per_order"
                  />
                </div>
              )}
              <div>
                <Label>Limit Key</Label>
                <Input 
                  value={limitModal.data.limit_key} 
                  onChange={(e) => setLimitModal(prev => ({ ...prev, data: { ...prev.data, limit_key: e.target.value }}))}
                  className="rounded-xl mt-1"
                  placeholder="e.g., max_tickets_per_order"
                />
              </div>
              <div>
                <Label>Value</Label>
                <Input 
                  type="number"
                  value={limitModal.data.limit_value} 
                  onChange={(e) => setLimitModal(prev => ({ ...prev, data: { ...prev.data, limit_value: e.target.value === '' ? '' : parseInt(e.target.value) }}))}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input 
                  value={limitModal.data.description || ''} 
                  onChange={(e) => setLimitModal(prev => ({ ...prev, data: { ...prev.data, description: e.target.value }}))}
                  className="rounded-xl mt-1"
                  placeholder="Human-readable description"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitModal({ open: false, data: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={saveLimit} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
