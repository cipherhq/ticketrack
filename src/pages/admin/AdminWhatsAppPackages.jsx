import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Plus, Edit2, Trash2, DollarSign, Package, TrendingUp } from 'lucide-react';

export default function AdminWhatsAppPackages() {
  const [packages, setPackages] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({ name: '', credits: '', price: '', description: '' });
  const [stats, setStats] = useState({ totalRevenue: 0, totalPurchases: 0, metaCost: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: pkgs } = await supabase.from('whatsapp_credit_packages').select('*').order('price');
      setPackages(pkgs || []);
      const { data: ratesData } = await supabase.from('whatsapp_message_rates').select('*').order('message_type');
      setRates(ratesData || []);
      const { data: purchases } = await supabase.from('whatsapp_credit_purchases').select('amount, credits').eq('payment_status', 'completed');
      const { data: usage } = await supabase.from('whatsapp_credit_usage').select('credits_used, meta_cost');
      setStats({
        totalRevenue: purchases?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0,
        totalPurchases: purchases?.length || 0,
        metaCost: usage?.reduce((sum, u) => sum + parseFloat(u.meta_cost || 0), 0) || 0
      });
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const packageData = { name: formData.name, credits: parseFloat(formData.credits), price: parseFloat(formData.price), description: formData.description, is_active: true };
    if (editingPackage) {
      await supabase.from('whatsapp_credit_packages').update(packageData).eq('id', editingPackage.id);
    } else {
      await supabase.from('whatsapp_credit_packages').insert(packageData);
    }
    setIsDialogOpen(false);
    setEditingPackage(null);
    setFormData({ name: '', credits: '', price: '', description: '' });
    loadData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this package?')) return;
    await supabase.from('whatsapp_credit_packages').delete().eq('id', id);
    loadData();
  };

  const profit = stats.totalRevenue - (stats.metaCost * 1600);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Credit Packages</h1>
          <p className="text-muted-foreground">Manage WhatsApp packages for organizers (95% markup)</p>
        </div>
        <button onClick={() => { setEditingPackage(null); setFormData({ name: '', credits: '', price: '', description: '' }); setIsDialogOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">
          <Plus className="w-4 h-4" /> Add Package
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-sm text-muted-foreground">Revenue</p><p className="text-xl font-bold">₦{stats.totalRevenue.toLocaleString()}</p></div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-sm text-muted-foreground">Purchases</p><p className="text-xl font-bold">{stats.totalPurchases}</p></div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><MessageSquare className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-sm text-muted-foreground">Meta Cost</p><p className="text-xl font-bold">${stats.metaCost.toFixed(4)}</p></div>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-sm text-muted-foreground">Est. Profit</p><p className="text-xl font-bold text-emerald-600">₦{profit.toLocaleString()}</p></div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Message Rates (95% markup on Meta)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {rates.map(rate => (
            <div key={rate.id} className="p-4 bg-background rounded-lg">
              <p className="font-medium capitalize">{rate.message_type}</p>
              <p className="text-sm text-muted-foreground">Meta: ${rate.meta_rate}</p>
              <p className="text-sm text-green-600 font-medium">You Sell: ${rate.selling_rate}</p>
              <p className="text-xs text-muted-foreground mt-1">Profit: ${(rate.selling_rate - rate.meta_rate).toFixed(4)}/msg</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border">
        <div className="p-4 border-b"><h2 className="text-lg font-semibold">Credit Packages</h2></div>
        <div className="divide-y">
          {packages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No packages yet. Click "Add Package" to create one.</div>
          ) : packages.map(pkg => (
            <div key={pkg.id} className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">{pkg.name}</h3>
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className="text-green-600 font-medium">${pkg.credits} credits</span>
                  <span className="text-muted-foreground">₦{parseFloat(pkg.price).toLocaleString()}</span>
                  <span className="text-muted-foreground">≈ {Math.floor(pkg.credits / 0.0156)} utility msgs</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingPackage(pkg); setFormData({ name: pkg.name, credits: pkg.credits.toString(), price: pkg.price.toString(), description: pkg.description || '' }); setIsDialogOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(pkg.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingPackage ? 'Edit' : 'Create'} Package</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Package Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Starter Pack" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Credits (USD value)</label>
                <input type="number" step="0.01" value={formData.credits} onChange={e => setFormData({ ...formData, credits: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 5.00" required />
                <p className="text-xs text-muted-foreground mt-1">At $0.0156/msg, ${formData.credits || 0} = ~{Math.floor((parseFloat(formData.credits) || 0) / 0.0156)} utility messages</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price (NGN)</label>
                <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., 5000" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Package description..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-background">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{editingPackage ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
