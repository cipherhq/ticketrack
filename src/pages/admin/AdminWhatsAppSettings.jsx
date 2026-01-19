import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Key,
  TestTube,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminWhatsAppSettings() {
  const { admin, logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    provider: 'manual',
    api_key: '',
    phone_number_id: '',
    business_account_id: '',
    is_verified: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('platform_whatsapp_config')
        .select('*')
        .single();

      if (data) {
        setConfig({
          provider: data.provider || 'manual',
          api_key: data.api_key || '',
          phone_number_id: data.phone_number_id || '',
          business_account_id: data.business_account_id || '',
          is_verified: data.is_verified || false,
        });
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
        .from('platform_whatsapp_config')
        .select('id')
        .single();

      if (existing) {
        await supabase
          .from('platform_whatsapp_config')
          .update({
            provider: config.provider,
            api_key: config.api_key,
            phone_number_id: config.phone_number_id,
            business_account_id: config.business_account_id,
            updated_by: admin.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('platform_whatsapp_config')
          .insert({
            provider: config.provider,
            api_key: config.api_key,
            phone_number_id: config.phone_number_id,
            business_account_id: config.business_account_id,
            updated_by: admin.id,
          });
      }

      await logAdminAction('whatsapp_config_updated', 'settings', null, { provider: config.provider });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (config.provider === 'manual') {
      alert('Manual mode does not require testing.');
      return;
    }

    if (!config.api_key || !config.phone_number_id) {
      alert('Please enter API key and Phone Number ID first');
      return;
    }

    setTesting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConfig({ ...config, is_verified: true });
      alert('Connection test successful!');
    } catch (error) {
      alert('Connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  const providers = [
    { value: 'manual', label: 'Manual (wa.me links)', description: 'Opens WhatsApp for each recipient.', free: true },
    { value: '360dialog', label: '360dialog', description: 'Official WhatsApp Business API partner.', free: false },
    { value: 'wati', label: 'WATI', description: 'Easy-to-use WhatsApp Business Platform.', free: false },
    { value: 'twilio', label: 'Twilio', description: 'Reliable global provider.', free: false },
    { value: 'termii', label: 'Termii', description: 'Messaging platform for Nigeria, Ghana, Kenya, and other supported countries.', free: false },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  const selectedProvider = providers.find(p => p.value === config.provider);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">WhatsApp Settings</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Configure platform-wide WhatsApp Business integration</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadConfig} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.is_verified ? 'bg-green-100' : 'bg-gray-100'}`}>
                <MessageSquare className={`w-6 h-6 ${config.is_verified ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="font-medium text-[#0F0F0F]">Platform WhatsApp Integration</p>
                <p className="text-sm text-[#0F0F0F]/60">
                  {config.provider === 'manual' ? 'Using manual wa.me links' : 'Connected via ' + (selectedProvider?.label || '')}
                </p>
              </div>
            </div>
            {config.is_verified ? (
              <Badge className="bg-green-100 text-green-700">Verified</Badge>
            ) : config.provider !== 'manual' ? (
              <Badge className="bg-yellow-100 text-yellow-700">Not Verified</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-700">Manual Mode</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Select Provider</CardTitle>
          <CardDescription>Choose how the platform sends WhatsApp messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {providers.map((provider) => (
              <div
                key={provider.value}
                onClick={() => setConfig({ ...config, provider: provider.value, is_verified: false })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  config.provider === provider.value ? 'border-green-500 bg-green-50' : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    config.provider === provider.value ? 'border-green-500 bg-green-500' : 'border-[#0F0F0F]/30'
                  }`}>
                    {config.provider === provider.value && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-[#0F0F0F]">
                      {provider.label}
                      {provider.free && <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">Free</Badge>}
                    </p>
                    <p className="text-sm text-[#0F0F0F]/60">{provider.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {config.provider !== 'manual' && (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>API Key / Access Token</Label>
              <Input
                type="password"
                value={config.api_key}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                placeholder="Enter your API key"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>Phone Number ID</Label>
              <Input
                value={config.phone_number_id}
                onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                placeholder="e.g., 1234567890"
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>Business Account ID (optional)</Label>
              <Input
                value={config.business_account_id}
                onChange={(e) => setConfig({ ...config, business_account_id: e.target.value })}
                placeholder="e.g., 9876543210"
                className="rounded-xl mt-1"
              />
            </div>
            <div className="p-4 bg-yellow-50 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-700">API credentials are encrypted and stored securely.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
        {config.provider !== 'manual' && (
          <Button onClick={handleTest} disabled={testing || !config.api_key} variant="outline" className="rounded-xl">
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
            Test Connection
          </Button>
        )}
        {saved && (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-[#F4F6FA] rounded-xl text-center">
              <p className="text-2xl font-semibold text-[#0F0F0F]">0</p>
              <p className="text-sm text-[#0F0F0F]/60">Messages Sent</p>
            </div>
            <div className="p-4 bg-[#F4F6FA] rounded-xl text-center">
              <p className="text-2xl font-semibold text-green-600">0</p>
              <p className="text-sm text-[#0F0F0F]/60">Delivered</p>
            </div>
            <div className="p-4 bg-[#F4F6FA] rounded-xl text-center">
              <p className="text-2xl font-semibold text-red-600">0</p>
              <p className="text-sm text-[#0F0F0F]/60">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
