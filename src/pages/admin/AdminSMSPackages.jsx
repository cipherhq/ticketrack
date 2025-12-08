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
    credits: '',
    price: '',
    bonus_credits: '0',
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
        .from('sms_credit_packages')
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
    setForm({ name: '', credits: '', price: '', bonus_credits: '0', is_popular: false, is_active: true, sort_order: String(packages.length + 1) });
    setDialogOpen(true);
  };

  const openEditDialog = (pkg) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      credits: String(pkg.credits),
      price: String(pkg.price),
      bonus_credits: String(pkg.bonus_credits || 0),
      is_popular: pkg.is_popular,
      is_active: pkg.is_active,
      sort_order: String(pkg.sort_order || 0),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.credits || !form.price) {
      alert('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const packageData = {
        name: form.name,
        credits: parseInt(form.credits),
        price: parseFloat(form.price),
        bonus_credits: parseInt(form.bonus_credits) || 0,
        is_popular: form.is_popular,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order) || 0,
      };

      if (editingPackage) {
        await supabase.from('sms_credit_packages').update(packageData).eq('id', editingPackage.id);
        await logAdminAction('sms_package_updated', 'sms_credit_packages', editingPackage.id, packageData);
      } else {
        await supabase.from('sms_credit_packages').insert(packageData);
        await logAdminAction('sms_package_created', 'sms_credit_packages', null, packageData);
      }
      setDialogOpen(false);
      loadPackages();
    } catch (error) {
      alert('Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg) => {
    if (!confirm(`Delete "${pkg.name}" package?`)) return;
    try {
      await supabase.from('sms_credit_packages').delete().eq('id', pkg.id);
      loadPackages();
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const toggleActive = async (pkg) => {
    await supabase.from('sms_credit_packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id);
    loadPackages();
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount || 0);

  const calculateProfit = (pkg) => {
    const totalCredits = pkg.credits + (pkg.bonus_credits || 0);
    return pkg.price - (totalCredits * 4);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">SMS Packages</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Set prices for SMS credit packages</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadPackages} className="rounded-xl"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={openCreateDialog} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" />Add Package</Button>
        </div>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl bg-blue-50">
        <CardContent className="p-4">
          <p className="text-blue-800 font-medium">Pricing Info</p>
          <p className="text-sm text-blue-700 mt-1">Your cost from Termii: <strong>₦4 per SMS</strong>. Set higher prices to profit.</p>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle>All Packages</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0F0F0F]/10">
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Package</th>
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Credits</th>
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Bonus</th>
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Price</th>
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Per SMS</th>
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Profit</th>
                  <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Active</th>
                  <th className="text-right py-3 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => {
                  const profit = calculateProfit(pkg);
                  return (
                    <tr key={pkg.id} className="border-b border-[#0F0F0F]/5">
                      <td className="py-3 px-4">
                        <span className="font-medium">{pkg.name}</span>
                        {pkg.is_popular && <Badge className="ml-2 bg-[#2969FF] text-white text-xs"><Sparkles className="w-3 h-3 mr-1" />Popular</Badge>}
                      </td>
                      <td className="py-3 px-4">{pkg.credits}</td>
                      <td className="py-3 px-4 text-green-600">+{pkg.bonus_credits || 0}</td>
                      <td className="py-3 px-4 font-medium">{formatCurrency(pkg.price)}</td>
                      <td className="py-3 px-4">₦{parseFloat(pkg.price_per_sms || 0).toFixed(2)}</td>
                      <td className={`py-3 px-4 font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</td>
                      <td className="py-3 px-4"><Switch checked={pkg.is_active} onCheckedChange={() => toggleActive(pkg)} /></td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(pkg)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(pkg)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{editingPackage ? 'Edit' : 'Create'} Package</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Credits *</Label><Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} className="rounded-xl mt-1" /></div>
              <div><Label>Bonus</Label><Input type="number" value={form.bonus_credits} onChange={(e) => setForm({ ...form, bonus_credits: e.target.value })} className="rounded-xl mt-1" /></div>
            </div>
            <div><Label>Price (₦) *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-xl mt-1" /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="rounded-xl mt-1" /></div>
            <div className="flex items-center justify-between"><Label>Popular</Label><Switch checked={form.is_popular} onCheckedChange={(c) => setForm({ ...form, is_popular: c })} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} /></div>
            {form.credits && form.price && (
              <div className="p-3 bg-[#F4F6FA] rounded-xl">
                <p className="text-sm text-[#0F0F0F]/60">Profit per sale</p>
                <p className="font-medium">{formatCurrency(parseFloat(form.price) - (parseInt(form.credits) + parseInt(form.bonus_credits || 0)) * 4)}</p>
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
