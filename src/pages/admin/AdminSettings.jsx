import { useState, useEffect } from 'react';
import { Settings, Globe, DollarSign, ToggleLeft, Loader2, Plus, Edit2, Trash2, Save, X, Check, CreditCard, Palette, FileText, Gauge, Eye, EyeOff } from 'lucide-react';
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
  
  // Modal states
  const [currencyModal, setCurrencyModal] = useState({ open: false, data: null });
  const [countryModal, setCountryModal] = useState({ open: false, data: null });
  const [gatewayModal, setGatewayModal] = useState({ open: false, data: null });
  const [legalModal, setLegalModal] = useState({ open: false, data: null });
  const [limitModal, setLimitModal] = useState({ open: false, data: null });
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [currencyRes, countryRes, featureRes, cfRes, gatewayRes, brandingRes, legalRes, limitsRes] = await Promise.all([
        supabase.from('currencies').select('*').order('sort_order'),
        supabase.from('countries').select('*').order('name'),
        supabase.from('features').select('*').order('category, name'),
        supabase.from('country_features').select('*'),
        supabase.from('payment_gateway_config').select('*'),
        supabase.from('platform_branding').select('*').single(),
        supabase.from('legal_documents').select('*').order('applies_to'),
        supabase.from('platform_limits').select('*').order('country_code, limit_key'),
      ]);
      
      setCurrencies(currencyRes.data || []);
      setCountries(countryRes.data || []);
      setFeatures(featureRes.data || []);
      setCountryFeatures(cfRes.data || []);
      setPaymentGateways(gatewayRes.data || []);
      setBranding(brandingRes.data || {});
      setLegalDocs(legalRes.data || []);
      setLimits(limitsRes.data || []);
      
      if (countryRes.data?.length > 0) {
        setSelectedCountry(countryRes.data[0].code);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
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
  const saveCountry = async () => {
    setSaving(true);
    try {
      const { data: countryData } = countryModal;
      if (countryModal.isNew) {
        await supabase.from('countries').insert(countryData);
        const featureInserts = features.map(f => ({
          country_code: countryData.code,
          feature_id: f.id,
          is_enabled: false,
          config: {}
        }));
        await supabase.from('country_features').insert(featureInserts);
      } else {
        await supabase.from('countries').update(countryData).eq('code', countryData.code);
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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Platform Settings</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Manage currencies, countries, fees, payments, and features</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F4F6FA] p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="currencies" className="rounded-lg data-[state=active]:bg-white">
            <DollarSign className="w-4 h-4 mr-2" /> Currencies
          </TabsTrigger>
          <TabsTrigger value="countries" className="rounded-lg data-[state=active]:bg-white">
            <Globe className="w-4 h-4 mr-2" /> Countries
          </TabsTrigger>
          <TabsTrigger value="features" className="rounded-lg data-[state=active]:bg-white">
            <ToggleLeft className="w-4 h-4 mr-2" /> Features
          </TabsTrigger>
          <TabsTrigger value="gateways" className="rounded-lg data-[state=active]:bg-white">
            <CreditCard className="w-4 h-4 mr-2" /> Payments
          </TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg data-[state=active]:bg-white">
            <Palette className="w-4 h-4 mr-2" /> Branding
          </TabsTrigger>
          <TabsTrigger value="legal" className="rounded-lg data-[state=active]:bg-white">
            <FileText className="w-4 h-4 mr-2" /> Legal
          </TabsTrigger>
          <TabsTrigger value="limits" className="rounded-lg data-[state=active]:bg-white">
            <Gauge className="w-4 h-4 mr-2" /> Limits
          </TabsTrigger>
        </TabsList>

        {/* CURRENCIES TAB */}
        <TabsContent value="currencies" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
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
                  <div key={currency.code} className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-xl font-bold">
                        {currency.symbol}
                      </div>
                      <div>
                        <h4 className="font-medium text-[#0F0F0F]">{currency.name}</h4>
                        <p className="text-sm text-[#0F0F0F]/60">{currency.code} • {currency.locale}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={currency.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
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

        {/* COUNTRIES TAB */}
        <TabsContent value="countries" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
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
                    platform_fee_percentage: 10,
                    service_fee_percentage: 5,
                    service_fee_fixed: 0,
                    payment_processing_fee_percentage: 1.5,
                    payout_fee: 50,
                    min_payout_amount: 5000,
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
                    <div key={country.code} className="p-4 rounded-xl bg-[#F4F6FA]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-sm">
                            {country.code}
                          </div>
                          <div>
                            <h4 className="font-medium text-[#0F0F0F]">{country.name}</h4>
                            <p className="text-sm text-[#0F0F0F]/60">{currency?.symbol} {currency?.name} • {country.payment_provider}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={country.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
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
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-[#0F0F0F]/60">Platform Fee</p>
                          <p className="font-semibold text-[#0F0F0F]">{country.platform_fee_percentage}%</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-[#0F0F0F]/60">Service Fee</p>
                          <p className="font-semibold text-[#0F0F0F]">{country.service_fee_percentage}%</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-[#0F0F0F]/60">Processing Fee</p>
                          <p className="font-semibold text-[#0F0F0F]">{country.payment_processing_fee_percentage}%</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-[#0F0F0F]/60">Payout Fee</p>
                          <p className="font-semibold text-[#0F0F0F]">{currency?.symbol}{country.payout_fee}</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-xs text-[#0F0F0F]/60">Min Payout</p>
                          <p className="font-semibold text-[#0F0F0F]">{currency?.symbol}{country.min_payout_amount?.toLocaleString()}</p>
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
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
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
                        <h4 className="text-sm font-medium text-[#0F0F0F]/60 uppercase mb-3">{category}</h4>
                        <div className="space-y-2">
                          {categoryFeatures.map(feature => {
                            const status = getFeatureStatus(selectedCountry, feature.id);
                            return (
                              <div key={feature.id} className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                                <div>
                                  <h5 className="font-medium text-[#0F0F0F]">{feature.name}</h5>
                                  <p className="text-sm text-[#0F0F0F]/60">{feature.description}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge className={status.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
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

        {/* PAYMENT GATEWAYS TAB */}
        <TabsContent value="gateways" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Payment Gateway Configuration</CardTitle>
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
                    is_active: true
                  }
                })}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Gateway
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {countries.length === 0 && (
                  <p className="text-[#0F0F0F]/60 text-center py-8">No countries configured. Add countries first.</p>
                )}
                {countries.map(country => {
                  const countryGateways = paymentGateways.filter(g => g.country_code === country.code);
                  
                  return (
                    <div key={country.code} className="p-4 rounded-xl bg-[#F4F6FA]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-[#0F0F0F]">{country.name} ({country.code})</h4>
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
                              is_active: true
                            }
                          })}
                          className="rounded-lg"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                      </div>
                      {countryGateways.length === 0 ? (
                        <p className="text-[#0F0F0F]/40 text-sm">No payment gateways configured</p>
                      ) : (
                        <div className="space-y-3">
                          {countryGateways.map(gw => (
                            <div key={gw.id} className="p-4 bg-white rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#F4F6FA] flex items-center justify-center">
                                  <CreditCard className="w-5 h-5 text-[#2969FF]" />
                                </div>
                                <div>
                                  <h5 className="font-medium text-[#0F0F0F] capitalize">{gw.provider}</h5>
                                  <div className="flex gap-2 mt-1">
                                    <Badge className={gw.sandbox_mode ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                                      {gw.sandbox_mode ? 'Sandbox' : 'Live'}
                                    </Badge>
                                    <Badge className={gw.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
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
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-[#0F0F0F]/60">Public Key</p>
                                <p className="font-mono text-xs">{maskSecret(gw.public_key) || 'Not set'}</p>
                              </div>
                              <div>
                                <p className="text-[#0F0F0F]/60">Secret Key</p>
                                <p className="font-mono text-xs">{maskSecret(gw.secret_key_encrypted) || 'Not set'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>)}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRANDING TAB */}
        <TabsContent value="branding" className="mt-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
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
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle>Legal Documents & Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {legalDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                    <div>
                      <h4 className="font-medium text-[#0F0F0F]">{doc.title}</h4>
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
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
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
                    <div key={country.code} className="p-4 rounded-xl bg-[#F4F6FA]">
                      <h4 className="font-medium text-[#0F0F0F] mb-3">{country.name}</h4>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {countryLimits.map(limit => (
                          <div key={limit.id} className="p-3 bg-white rounded-lg flex items-center justify-between">
                            <div>
                              <p className="text-xs text-[#0F0F0F]/60">{limit.description || limit.limit_key}</p>
                              <p className="font-semibold text-[#0F0F0F]">{limit.limit_value.toLocaleString()}</p>
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

      {/* Country Modal */}
      <Dialog open={countryModal.open} onOpenChange={(open) => !open && setCountryModal({ open: false, data: null })}>
        <DialogContent className="rounded-2xl max-w-2xl">
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
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Fee Configuration</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Platform Fee (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={countryModal.data.platform_fee_percentage} 
                      onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, platform_fee_percentage: parseFloat(e.target.value) || 0 }}))}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Service Fee (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={countryModal.data.service_fee_percentage} 
                      onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, service_fee_percentage: parseFloat(e.target.value) || 0 }}))}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Processing Fee (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={countryModal.data.payment_processing_fee_percentage} 
                      onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, payment_processing_fee_percentage: parseFloat(e.target.value) || 0 }}))}
                      className="rounded-xl mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Payout Fee (fixed)</Label>
                    <Input 
                      type="number"
                      value={countryModal.data.payout_fee} 
                      onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, payout_fee: parseFloat(e.target.value) || 0 }}))}
                      className="rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Minimum Payout</Label>
                    <Input 
                      type="number"
                      value={countryModal.data.min_payout_amount} 
                      onChange={(e) => setCountryModal(prev => ({ ...prev, data: { ...prev.data, min_payout_amount: parseFloat(e.target.value) || 0 }}))}
                      className="rounded-xl mt-1"
                    />
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
                      <SelectItem value="paypal">PayPal</SelectItem>
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
              <div>
                <Label>Webhook Secret</Label>
                <div className="relative">
                  <Input 
                    type={showSecrets.webhook ? 'text' : 'password'}
                    value={gatewayModal.data.webhook_secret_encrypted || ''} 
                    onChange={(e) => setGatewayModal(prev => ({ ...prev, data: { ...prev.data, webhook_secret_encrypted: e.target.value }}))}
                    className="rounded-xl mt-1 font-mono text-sm pr-10"
                    placeholder="whsec_..."
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
              <div className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                <div>
                  <p className="font-medium text-[#0F0F0F]">Sandbox Mode</p>
                  <p className="text-sm text-[#0F0F0F]/60">Use test environment</p>
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
                  onChange={(e) => setLimitModal(prev => ({ ...prev, data: { ...prev.data, limit_value: parseInt(e.target.value) || 0 }}))}
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
