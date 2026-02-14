import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Save,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminSMSPackages() {
  const { logAdminAction } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    credits: '',
    price_ngn: '',
    price_ghs: '',
    price_usd: '',
    price_gbp: '',
    price_cad: '',
    bonus_credits: '0',
    badge_text: '',
    is_popular: false,
    is_active: true,
    sort_order: '0',
  });

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('communication_credit_packages')
        .select('*')
        .order('sort_order');
      setPackages(data || []);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingPackage(null);
    setForm({ name: '', description: '', credits: '', price_ngn: '', price_ghs: '', price_usd: '', price_gbp: '', price_cad: '', bonus_credits: '0', badge_text: '', is_popular: false, is_active: true, sort_order: String(packages.length + 1) });
    setDialogOpen(true);
  };

  const openEditDialog = (pkg) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      credits: String(pkg.credits),
      price_ngn: String(pkg.price_ngn),
      price_ghs: String(pkg.price_ghs || ''),
      price_usd: String(pkg.price_usd || ''),
      price_gbp: String(pkg.price_gbp || ''),
      price_cad: String(pkg.price_cad || ''),
      bonus_credits: String(pkg.bonus_credits || 0),
      badge_text: pkg.badge_text || '',
      is_popular: pkg.is_popular,
      is_active: pkg.is_active,
      sort_order: String(pkg.sort_order || 0),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.credits || !form.price_ngn) {
      alert('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const totalCredits = parseInt(form.credits) + (parseInt(form.bonus_credits) || 0);
      const pricePerCredit = totalCredits > 0 ? parseFloat(form.price_ngn) / totalCredits : 0;

      const packageData = {
        name: form.name,
        description: form.description || null,
        credits: parseInt(form.credits),
        price_ngn: parseFloat(form.price_ngn),
        price_ghs: form.price_ghs ? parseFloat(form.price_ghs) : null,
        price_usd: form.price_usd ? parseFloat(form.price_usd) : null,
        price_gbp: form.price_gbp ? parseFloat(form.price_gbp) : null,
        price_cad: form.price_cad ? parseFloat(form.price_cad) : null,
        price_per_credit: pricePerCredit,
        bonus_credits: parseInt(form.bonus_credits) || 0,
        badge_text: form.badge_text || null,
        is_popular: form.is_popular,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
      };

      if (editingPackage) {
        await supabase.from('communication_credit_packages').update(packageData).eq('id', editingPackage.id);
        await logAdminAction('credit_package_updated', 'communication_credit_packages', editingPackage.id, packageData);
      } else {
        await supabase.from('communication_credit_packages').insert(packageData);
        await logAdminAction('credit_package_created', 'communication_credit_packages', null, packageData);
      }
      setDialogOpen(false);
      loadPackages();
    } catch (error) {
      console.error('Error saving package:', error);
      alert('Failed to save package: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg) => {
    if (!confirm(`Delete "${pkg.name}" package?`)) return;
    try {
      await supabase.from('communication_credit_packages').delete().eq('id', pkg.id);
      loadPackages();
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const toggleActive = async (pkg) => {
    await supabase.from('communication_credit_packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id);
    loadPackages();
  };

  const formatCurrency = (amount, currency = 'NGN') => {
    const symbols = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', CAD: 'C$', AUD: 'A$' };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const calculateProfit = (pkg) => {
    const totalCredits = pkg.credits + (pkg.bonus_credits || 0);
    return pkg.price_ngn - (totalCredits * 4);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Message Credit Packages</h2>
          <p className="text-muted-foreground mt-1">Create packages for organizers to buy SMS, WhatsApp, and email credits</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadPackages} className="rounded-xl"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={openCreateDialog} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" />Add Package</Button>
        </div>
      </div>

      <Card className="border-border/10 rounded-2xl bg-blue-50">
        <CardContent className="p-4">
          <p className="text-blue-800 font-medium">Multi-Currency Pricing</p>
          <p className="text-sm text-blue-700 mt-1">Set prices for each region. Organizers only see their local currency.</p>
          <div className="text-xs text-blue-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>NGN</strong> → Nigeria (Paystack)</span>
            <span><strong>GHS</strong> → Ghana (Paystack)</span>
            <span><strong>USD</strong> → USA (Stripe)</span>
            <span><strong>GBP</strong> → UK (Stripe)</span>
            <span><strong>CAD</strong> → Canada (Stripe)</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/10 rounded-2xl">
        <CardHeader><CardTitle>All Packages</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">Package</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">Credits</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">NGN</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">GHS</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">USD</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">GBP</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">CAD</th>
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium text-sm">Active</th>
                  <th className="text-right py-3 px-2 text-muted-foreground font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b border-border/5">
                    <td className="py-3 px-2">
                      <span className="font-medium">{pkg.name}</span>
                      {pkg.is_popular && <Badge className="ml-2 bg-[#2969FF] text-white text-xs"><Sparkles className="w-3 h-3 mr-1" />Popular</Badge>}
                    </td>
                    <td className="py-3 px-2">{pkg.credits}{pkg.bonus_credits > 0 && <span className="text-green-600 text-xs ml-1">+{pkg.bonus_credits}</span>}</td>
                    <td className="py-3 px-2 font-medium">₦{pkg.price_ngn?.toLocaleString()}</td>
                    <td className="py-3 px-2">{pkg.price_ghs ? `GH₵${pkg.price_ghs}` : <span className="text-foreground/30">—</span>}</td>
                    <td className="py-3 px-2">{pkg.price_usd ? `$${pkg.price_usd}` : <span className="text-foreground/30">—</span>}</td>
                    <td className="py-3 px-2">{pkg.price_gbp ? `£${pkg.price_gbp}` : <span className="text-foreground/30">—</span>}</td>
                    <td className="py-3 px-2">{pkg.price_cad ? `C$${pkg.price_cad}` : <span className="text-foreground/30">—</span>}</td>
                    <td className="py-3 px-2"><Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} /></td>
                    <td className="py-3 px-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(pkg)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(pkg)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{editingPackage ? 'Edit' : 'Create'} Package</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl mt-1" placeholder="e.g., Starter Pack" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl mt-1" placeholder="e.g., Perfect for small events" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Credits *</Label><Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Bonus</Label><Input type="number" value={form.bonus_credits} onChange={(e) => setForm({ ...form, bonus_credits: e.target.value })} className="rounded-xl mt-1" /></div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Pricing by Region</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>NGN (₦) * <span className="text-xs text-muted-foreground">Nigeria</span></Label><Input type="number" value={form.price_ngn} onChange={(e) => setForm({ ...form, price_ngn: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>GHS (GH₵) <span className="text-xs text-muted-foreground">Ghana</span></Label><Input type="number" step="0.01" value={form.price_ghs} onChange={(e) => setForm({ ...form, price_ghs: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>USD ($) <span className="text-xs text-muted-foreground">USA</span></Label><Input type="number" step="0.01" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>GBP (£) <span className="text-xs text-muted-foreground">UK</span></Label><Input type="number" step="0.01" value={form.price_gbp} onChange={(e) => setForm({ ...form, price_gbp: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>CAD (C$) <span className="text-xs text-muted-foreground">Canada</span></Label><Input type="number" step="0.01" value={form.price_cad} onChange={(e) => setForm({ ...form, price_cad: e.target.value })} className="rounded-xl mt-1" /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Badge Text</Label><Input value={form.badge_text} onChange={(e) => setForm({ ...form, badge_text: e.target.value })} className="rounded-xl mt-1" placeholder="e.g., Best Value" /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="rounded-xl mt-1" /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Popular (highlighted)</Label><Switch checked={form.is_popular} onCheckedChange={(c) => setForm({ ...form, is_popular: c })} /></div>
            <div className="flex items-center justify-between"><Label>Active (visible to organizers)</Label><Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} /></div>
            {form.credits && form.price_ngn && (
              <div className="p-3 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground">NGN Profit per sale (cost {formatCurrency(4)}/credit)</p>
                <p className="font-medium">{formatCurrency(parseFloat(form.price_ngn) - (parseInt(form.credits) + parseInt(form.bonus_credits || 0)) * 4)}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#2969FF] text-white rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
