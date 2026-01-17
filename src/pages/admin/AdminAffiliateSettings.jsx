import { useState, useEffect } from 'react';
import { 
  Save, Loader2, DollarSign, Users, TrendingUp, 
  AlertCircle, CheckCircle, Settings, Percent, Calendar, Clock, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';

export function AdminAffiliateSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    totalAffiliates: 0,
    totalEarnings: {},  // { NGN: 0, USD: 0, GBP: 0, GHS: 0, CAD: 0 }
    pendingPayouts: {}, // { NGN: 0, USD: 0, GBP: 0, GHS: 0, CAD: 0 }
    totalPaid: {},      // { NGN: 0, USD: 0, GBP: 0, GHS: 0, CAD: 0 }
  });
  const [settings, setSettings] = useState({
    is_enabled: true,
    commission_percent: 40,
    min_payout_ngn: 5000,
    min_payout_usd: 10,
    min_payout_gbp: 8,
    min_payout_ghs: 50,
    min_payout_cad: 15,
    cookie_days: 7,
    payout_delay_days: 7,
  });

  // Supported currencies
  const CURRENCIES = [
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
    { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load settings
      const { data: settingsData } = await supabase
        .from('affiliate_settings')
        .select('*')
        .single();

      if (settingsData) {
        setSettings({
          is_enabled: settingsData.is_enabled ?? true,
          commission_percent: settingsData.commission_percent || 40,
          min_payout_ngn: settingsData.min_payout_ngn || settingsData.min_payout || 5000,
          min_payout_usd: settingsData.min_payout_usd || 10,
          min_payout_gbp: settingsData.min_payout_gbp || 8,
          min_payout_ghs: settingsData.min_payout_ghs || 50,
          min_payout_cad: settingsData.min_payout_cad || 15,
          cookie_days: settingsData.cookie_days || 7,
          payout_delay_days: settingsData.payout_delay_days || 7,
        });
      }

      // Load stats
      const { data: affiliates } = await supabase
        .from('profiles')
        .select('id')
        .gt('referral_count', 0);

      // Load earnings with currency info
      const { data: earnings } = await supabase
        .from('referral_earnings')
        .select('commission_amount, status, currency, event:event_id(currency)');

      // Aggregate by currency
      const totalEarnings = {};
      const pendingPayouts = {};
      const totalPaid = {};

      CURRENCIES.forEach(c => {
        totalEarnings[c.code] = 0;
        pendingPayouts[c.code] = 0;
        totalPaid[c.code] = 0;
      });

      earnings?.forEach(e => {
        const currency = e.currency || e.event?.currency || getDefaultCurrency(e.event?.country_code || e.event?.country);
        const amount = parseFloat(e.commission_amount || 0);
        
        if (totalEarnings[currency] !== undefined) {
          totalEarnings[currency] += amount;
        } else {
          totalEarnings['NGN'] += amount; // Fallback
        }
        
        if (e.status === 'available') {
          if (pendingPayouts[currency] !== undefined) {
            pendingPayouts[currency] += amount;
          } else {
            pendingPayouts['NGN'] += amount;
          }
        }
        
        if (e.status === 'paid') {
          if (totalPaid[currency] !== undefined) {
            totalPaid[currency] += amount;
          } else {
            totalPaid['NGN'] += amount;
          }
        }
      });

      setStats({
        totalAffiliates: affiliates?.length || 0,
        totalEarnings,
        pendingPayouts,
        totalPaid,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format multi-currency stats
  const formatMultiCurrency = (amounts) => {
    const nonZero = Object.entries(amounts || {})
      .filter(([_, val]) => val > 0)
      .map(([currency, val]) => formatPrice(val, currency));
    
    if (nonZero.length === 0) return formatPrice(0, 'NGN');
    if (nonZero.length <= 2) return nonZero.join(' · ');
    return `${nonZero.slice(0, 2).join(' · ')} +${nonZero.length - 2}`;
  };

  // Get total across all currencies (for display count)
  const getTotalCount = (amounts) => {
    return Object.values(amounts || {}).reduce((sum, val) => sum + val, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get the settings ID first
      const { data: existingSettings } = await supabase
        .from('affiliate_settings')
        .select('id')
        .single();

      const updateData = {
        is_enabled: settings.is_enabled,
        commission_percent: settings.commission_percent,
        min_payout: settings.min_payout_ngn, // Keep for backward compatibility
        min_payout_ngn: settings.min_payout_ngn,
        min_payout_usd: settings.min_payout_usd,
        min_payout_gbp: settings.min_payout_gbp,
        min_payout_ghs: settings.min_payout_ghs,
        min_payout_cad: settings.min_payout_cad,
        cookie_days: settings.cookie_days,
        payout_delay_days: settings.payout_delay_days,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existingSettings?.id) {
        ({ error } = await supabase
          .from('affiliate_settings')
          .update(updateData)
          .eq('id', existingSettings.id));
      } else {
        // Insert if no settings exist
        ({ error } = await supabase
          .from('affiliate_settings')
          .insert(updateData));
      }

      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings: ' + error.message);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Affiliate Program Settings</h1>
          <p className="text-[#0F0F0F]/60 mt-1">Configure how users earn by sharing events</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-[#2969FF]">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2969FF]" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Active Affiliates</p>
                <h3 className="text-2xl font-semibold">{stats.totalAffiliates}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Commissions</p>
                <h3 className="text-lg font-semibold">{formatMultiCurrency(stats.totalEarnings)}</h3>
                {Object.keys(stats.totalEarnings || {}).filter(k => stats.totalEarnings[k] > 0).length > 2 && (
                  <Badge variant="outline" className="mt-1 text-xs">Multi-currency</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Payouts</p>
                <h3 className="text-lg font-semibold">{formatMultiCurrency(stats.pendingPayouts)}</h3>
                {Object.keys(stats.pendingPayouts || {}).filter(k => stats.pendingPayouts[k] > 0).length > 2 && (
                  <Badge variant="outline" className="mt-1 text-xs">Multi-currency</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Paid</p>
                <h3 className="text-lg font-semibold">{formatMultiCurrency(stats.totalPaid)}</h3>
                {Object.keys(stats.totalPaid || {}).filter(k => stats.totalPaid[k] > 0).length > 2 && (
                  <Badge variant="outline" className="mt-1 text-xs">Multi-currency</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Program Settings
          </CardTitle>
          <CardDescription>Configure affiliate commission and payout rules</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
            <div>
              <h4 className="font-medium">Enable Affiliate Program</h4>
              <p className="text-sm text-[#0F0F0F]/60">Allow users to earn by sharing events</p>
            </div>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
            />
          </div>

          {/* Commission Rate */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Commission Rate (% of platform fee)
              </Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={settings.commission_percent}
                onChange={(e) => setSettings({ ...settings, commission_percent: parseFloat(e.target.value) || 0 })}
                className="rounded-xl"
              />
              <p className="text-xs text-[#0F0F0F]/50">
                If your platform fee is 5%, and commission is 40%, affiliates earn 2% of ticket price
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cookie Duration (days)
              </Label>
              <Input
                type="number"
                min="1"
                max="90"
                value={settings.cookie_days}
                onChange={(e) => setSettings({ ...settings, cookie_days: parseInt(e.target.value) || 7 })}
                className="rounded-xl"
              />
              <p className="text-xs text-[#0F0F0F]/50">
                How long after clicking the link the referral is credited
              </p>
            </div>
          </div>

          {/* Payout Settings */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Payout Delay (days after event)
              </Label>
              <Input
                type="number"
                min="0"
                max="30"
                value={settings.payout_delay_days}
                onChange={(e) => setSettings({ ...settings, payout_delay_days: parseInt(e.target.value) || 7 })}
                className="rounded-xl"
              />
              <p className="text-xs text-[#0F0F0F]/50">
                Days after event ends before commission becomes withdrawable
              </p>
            </div>
          </div>

          {/* Minimum Payouts by Currency */}
          <div>
            <Label className="mb-3 block flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Minimum Payout Thresholds by Currency
            </Label>
            <p className="text-xs text-[#0F0F0F]/50 mb-3">
              Set the minimum balance required before an affiliate can request a payout in each currency
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                  <span className="font-semibold">₦</span> NGN
                </Label>
                <Input
                  type="number"
                  min="100"
                  value={settings.min_payout_ngn}
                  onChange={(e) => setSettings({ ...settings, min_payout_ngn: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl"
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                  <span className="font-semibold">$</span> USD
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.min_payout_usd}
                  onChange={(e) => setSettings({ ...settings, min_payout_usd: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl"
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                  <span className="font-semibold">£</span> GBP
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.min_payout_gbp}
                  onChange={(e) => setSettings({ ...settings, min_payout_gbp: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl"
                  placeholder="8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                  <span className="font-semibold">GH₵</span> GHS
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.min_payout_ghs}
                  onChange={(e) => setSettings({ ...settings, min_payout_ghs: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl"
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-[#0F0F0F]/60 flex items-center gap-1">
                  <span className="font-semibold">CA$</span> CAD
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={settings.min_payout_cad}
                  onChange={(e) => setSettings({ ...settings, min_payout_cad: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl"
                  placeholder="15"
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How affiliate earnings work:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>User shares event link with their unique code (e.g., ?aff=REF-XXXX)</li>
                <li>Someone buys a ticket through that link</li>
                <li>Affiliate earns {settings.commission_percent}% of the platform fee</li>
                <li>Commission becomes available {settings.payout_delay_days} days after the event</li>
                <li>User can withdraw once they reach the minimum threshold</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
