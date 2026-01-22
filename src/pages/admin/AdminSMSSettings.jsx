import { useState, useEffect } from 'react';
import {
  Smartphone,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Key,
  RefreshCw,
  Wallet,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';
import { getBalance } from '@/lib/termii';
import { formatPrice, currencies } from '@/config/currencies';

export function AdminSMSSettings() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    provider: 'termii',
    api_key: '',
    secret_key: '',
    sender_id: 'Ticketrack',
    is_active: true,
    balance: 0,
    cost_per_sms: 0.85,
    selling_price: 4.00,
    currency: 'NGN',
  });
  const [saved, setSaved] = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('platform_sms_config')
        .select('*')
        .single();

      if (data) {
        setConfig({
          provider: data.provider || 'termii',
          api_key: data.api_key || '',
          secret_key: data.secret_key || '',
          sender_id: data.sender_id || 'Ticketrack',
          is_active: data.is_active !== false,
          balance: data.balance || 0,
          cost_per_sms: data.cost_per_sms || 0.85,
          selling_price: data.selling_price || 4.00,
          currency: data.currency || 'NGN',
        });
        setBalance(data.balance);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const { data: existing } = await supabase
        .from('platform_sms_config')
        .select('id')
        .single();

      const updateData = {
        provider: config.provider,
        api_key: config.api_key,
        secret_key: config.secret_key,
        sender_id: config.sender_id,
        is_active: config.is_active,
        cost_per_sms: parseFloat(config.cost_per_sms),
        selling_price: parseFloat(config.selling_price),
        currency: config.currency,
        updated_by: admin?.id,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('platform_sms_config')
          .update(updateData)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('platform_sms_config')
          .insert(updateData);
      }

      await logAdminAction('sms_config_updated', 'settings', null, { provider: config.provider });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!config.api_key) {
      alert('Please enter API key first');
      return;
    }

    setTesting(true);
    try {
      const result = await getBalance(config.api_key);
      
      if (result.success) {
        setBalance(result.balance);
        
        const { data: existing } = await supabase
          .from('platform_sms_config')
          .select('id')
          .single();

        if (existing) {
          await supabase
            .from('platform_sms_config')
            .update({ balance: result.balance })
            .eq('id', existing.id);
        }

        alert('Balance: ' + result.currency + ' ' + result.balance);
      } else {
        alert('Failed to check balance: ' + result.error);
      }
    } catch (error) {
      alert('Error checking balance');
    } finally {
      setTesting(false);
    }
  };

  // Calculate profit and markup
  const profitPerSms = (parseFloat(config.selling_price) || 0) - (parseFloat(config.cost_per_sms) || 0);
  const markupPercent = config.cost_per_sms > 0 
    ? (((config.selling_price - config.cost_per_sms) / config.cost_per_sms) * 100).toFixed(0)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">SMS Settings</h1>
          <p className="text-[#0F0F0F]/60">Configure SMS provider and pricing</p>
        </div>
        {saved && (
          <Badge className="bg-green-100 text-green-700 gap-1">
            <CheckCircle className="w-3 h-3" /> Saved
          </Badge>
        )}
      </div>

      {/* Pricing Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Your Cost</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{formatPrice(parseFloat(config.cost_per_sms), config.currency)}</p>
                <p className="text-xs text-[#0F0F0F]/40">per SMS</p>
              </div>
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Selling Price</p>
                <p className="text-2xl font-bold text-[#0F0F0F]">{formatPrice(parseFloat(config.selling_price), config.currency)}</p>
                <p className="text-xs text-[#0F0F0F]/40">per SMS</p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Profit</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(profitPerSms, config.currency)}</p>
                <p className="text-xs text-[#0F0F0F]/40">per SMS</p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Markup</p>
                <p className="text-2xl font-bold text-purple-600">{markupPercent}%</p>
                <p className="text-xs text-[#0F0F0F]/40">profit margin</p>
              </div>
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Configuration */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            SMS Pricing
          </CardTitle>
          <CardDescription>
            Set your cost and selling price per SMS. Organizers will pay the selling price when buying credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cost_per_sms">Your Cost per SMS ({currencies[config.currency]?.symbol || config.currency})</Label>
              <Input
                id="cost_per_sms"
                type="number"
                step="0.01"
                min="0"
                value={config.cost_per_sms}
                onChange={(e) => setConfig({ ...config, cost_per_sms: e.target.value })}
                className="h-12 rounded-xl"
                placeholder="0.85"
              />
              <p className="text-xs text-[#0F0F0F]/40">What you pay your SMS provider per message</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling_price">Selling Price per SMS ({currencies[config.currency]?.symbol || config.currency})</Label>
              <Input
                id="selling_price"
                type="number"
                step="0.01"
                min="0"
                value={config.selling_price}
                onChange={(e) => setConfig({ ...config, selling_price: e.target.value })}
                className="h-12 rounded-xl"
                placeholder="4.00"
              />
              <p className="text-xs text-[#0F0F0F]/40">What organizers pay per SMS credit</p>
            </div>
          </div>

          {/* Profit Calculator */}
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="font-medium text-green-800 mb-2">Profit Calculator</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-green-600">1,000 SMS</p>
                <p className="font-bold text-green-800">{formatPrice(profitPerSms * 1000, config.currency)} profit</p>
              </div>
              <div>
                <p className="text-green-600">10,000 SMS</p>
                <p className="font-bold text-green-800">{formatPrice(profitPerSms * 10000, config.currency)} profit</p>
              </div>
              <div>
                <p className="text-green-600">100,000 SMS</p>
                <p className="font-bold text-green-800">{formatPrice(profitPerSms * 100000, config.currency)} profit</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Configuration */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#2969FF]" />
                SMS Provider
              </CardTitle>
              <CardDescription>
                Configure your Termii API credentials
              </CardDescription>
            </div>
            {balance !== null && (
              <Badge className="bg-green-100 text-green-700 gap-1">
                <Wallet className="w-3 h-3" /> Balance: {formatPrice(parseFloat(balance), config.currency)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
                <Input
                  id="api_key"
                  type="password"
                  value={config.api_key}
                  onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  className="pl-10 h-12 rounded-xl"
                  placeholder="Enter Termii API Key"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender_id">Sender ID</Label>
              <Input
                id="sender_id"
                value={config.sender_id}
                onChange={(e) => setConfig({ ...config, sender_id: e.target.value })}
                className="h-12 rounded-xl"
                placeholder="Ticketrack"
                maxLength={11}
              />
              <p className="text-xs text-[#0F0F0F]/40">Max 11 characters, no spaces</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleCheckBalance}
              variant="outline"
              disabled={testing || !config.api_key}
              className="rounded-xl"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check Balance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12 px-8"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

export default AdminSMSSettings;
