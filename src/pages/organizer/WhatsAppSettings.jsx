import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function WhatsAppSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizer, setOrganizer] = useState(null);
  const [config, setConfig] = useState({
    provider: 'manual',
    api_key: '',
    phone_number_id: '',
    business_account_id: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: org } = await supabase
        .from('organizers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setOrganizer(org);

      if (org) {
        const { data: whatsappConfig } = await supabase
          .from('organizer_whatsapp_config')
          .select('*')
          .eq('organizer_id', org.id)
          .single();

        if (whatsappConfig) {
          setConfig({
            provider: whatsappConfig.provider || 'manual',
            api_key: whatsappConfig.api_key || '',
            phone_number_id: whatsappConfig.phone_number_id || '',
            business_account_id: whatsappConfig.business_account_id || '',
            is_verified: whatsappConfig.is_verified,
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organizer) return;
    setSaving(true);
    setSaved(false);

    try {
      await supabase
        .from('organizer_whatsapp_config')
        .upsert({
          organizer_id: organizer.id,
          provider: config.provider,
          api_key: config.api_key,
          phone_number_id: config.phone_number_id,
          business_account_id: config.business_account_id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organizer_id'
        });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const providers = [
    { value: 'manual', label: 'Manual (wa.me links)', description: 'Opens WhatsApp for each recipient. No setup needed.', free: true },
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">WhatsApp Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your WhatsApp Business integration</p>
      </div>

      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.is_verified ? 'bg-green-100' : 'bg-muted'}`}>
                <MessageSquare className={`w-6 h-6 ${config.is_verified ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">WhatsApp Integration</p>
                <p className="text-sm text-muted-foreground">
                  {config.provider === 'manual' ? 'Using manual wa.me links' : 'Connected via ' + (providers.find(p => p.value === config.provider)?.label || '')}
                </p>
              </div>
            </div>
            {config.is_verified ? (
              <Badge className="bg-green-100 text-green-700">Verified</Badge>
            ) : config.provider !== 'manual' ? (
              <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
            ) : (
              <Badge className="bg-muted text-foreground/80">Manual Mode</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Select Provider</CardTitle>
          <CardDescription>Choose how you want to send WhatsApp messages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {providers.map((provider) => (
              <div
                key={provider.value}
                onClick={() => setConfig({ ...config, provider: provider.value })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  config.provider === provider.value ? 'border-green-500 bg-green-50' : 'border-border/10 hover:border-border/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    config.provider === provider.value ? 'border-green-500 bg-green-500' : 'border-[#0F0F0F]/30'
                  }`}>
                    {config.provider === provider.value && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {provider.label}
                      {provider.free && <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">Free</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {config.provider !== 'manual' && (
        <Card className="border-border/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Enter your credentials from {providers.find(p => p.value === config.provider)?.label}
            </CardDescription>
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
              <p className="text-sm text-yellow-700">Your API credentials are encrypted and stored securely.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          {config.provider === 'manual' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2969FF] text-white flex items-center justify-center text-sm font-medium">1</div>
                <p className="text-foreground/80">Go to Communications and select WhatsApp</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2969FF] text-white flex items-center justify-center text-sm font-medium">2</div>
                <p className="text-foreground/80">Select an event and compose your message</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2969FF] text-white flex items-center justify-center text-sm font-medium">3</div>
                <p className="text-foreground/80">Click Open for each attendee to send via WhatsApp</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">1</div>
                <p className="text-foreground/80">Configure your API credentials above</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">2</div>
                <p className="text-foreground/80">Messages will be sent automatically via the API</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium">3</div>
                <p className="text-foreground/80">Track delivery status in your Communications history</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
        {saved && (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
