import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Building2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePromoter } from '@/contexts/PromoterContext';
import { supabase } from '@/lib/supabase';

const nigerianBanks = ['Access Bank', 'GTBank', 'First Bank', 'Zenith Bank', 'UBA', 'Fidelity Bank', 'Union Bank', 'Sterling Bank', 'Stanbic IBTC', 'Polaris Bank', 'Wema Bank', 'FCMB', 'Ecobank'];

export function BankAccountManagement() {
  const { promoter } = usePromoter();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ bank_name: '', account_number: '', account_name: '', country: 'Nigeria' });

  useEffect(() => { if (promoter) loadAccounts(); }, [promoter]);

  const loadAccounts = async () => {
    const { data } = await supabase.from('promoter_bank_accounts').select('*').eq('promoter_id', promoter.id).order('is_primary', { ascending: false });
    setAccounts(data || []);
    setLoading(false);
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('promoter_bank_accounts').insert({ promoter_id: promoter.id, ...newAccount, currency: 'NGN', is_primary: accounts.length === 0, is_verified: false });
    alert('Bank account added!');
    setIsAddOpen(false);
    setNewAccount({ bank_name: '', account_number: '', account_name: '', country: 'Nigeria' });
    loadAccounts();
    setSaving(false);
  };

  const handleSetPrimary = async (id) => {
    await supabase.from('promoter_bank_accounts').update({ is_primary: false }).eq('promoter_id', promoter.id);
    await supabase.from('promoter_bank_accounts').update({ is_primary: true }).eq('id', id);
    loadAccounts();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this account?')) return;
    await supabase.from('promoter_bank_accounts').delete().eq('id', id);
    loadAccounts();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl text-foreground mb-2">Bank Account Management</h2><p className="text-muted-foreground">Manage your bank accounts for receiving payments</p></div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" />Add Account</Button>
      </div>

      <Card className="border-blue-200 bg-blue-50 rounded-2xl"><CardContent className="p-4"><div className="flex items-start gap-3"><Building2 className="w-5 h-5 text-blue-600 mt-0.5" /><div><h3 className="text-foreground mb-1">Payment Information</h3><p className="text-sm text-muted-foreground">Your commission payments will be sent to your primary bank account.</p></div></div></CardContent></Card>

      {accounts.length === 0 ? (
        <Card className="border-border/10 rounded-2xl"><CardContent className="p-12 text-center"><Building2 className="w-16 h-16 text-foreground/20 mx-auto mb-4" /><h3 className="text-lg text-foreground mb-2">No Bank Accounts Added</h3><p className="text-muted-foreground mb-4">Add your bank account to receive payments</p><Button onClick={() => setIsAddOpen(true)} className="bg-[#2969FF] text-white rounded-xl"><Plus className="w-4 h-4 mr-2" />Add Account</Button></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((acc) => (
            <Card key={acc.id} className={`border-border/10 rounded-2xl ${acc.is_primary ? 'border-[#2969FF] border-2' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div><div className="flex items-center gap-2 mb-2"><h3 className="text-lg text-foreground">{acc.bank_name}</h3>{acc.is_primary && <Badge className="bg-[#2969FF]">Primary</Badge>}{acc.is_verified ? <Badge className="bg-green-600">Verified</Badge> : <Badge className="bg-yellow-600">Pending</Badge>}</div></div>
                  {acc.is_verified && <CheckCircle className="w-6 h-6 text-green-600" />}
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground mb-1">Account Number</p><p>{acc.account_number}</p></div>
                  <div className="p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground mb-1">Account Name</p><p>{acc.account_name}</p></div>
                </div>
                <div className="flex gap-2">
                  {!acc.is_primary && acc.is_verified && <Button size="sm" onClick={() => handleSetPrimary(acc.id)} className="bg-[#2969FF] text-white rounded-xl">Set as Primary</Button>}
                  <Button size="sm" variant="outline" onClick={() => handleDelete(acc.id)} className="border-red-600 text-red-600 rounded-xl"><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div><Label>Bank Name *</Label><Select value={newAccount.bank_name} onValueChange={(v) => setNewAccount({ ...newAccount, bank_name: v })}><SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger><SelectContent>{nigerianBanks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Account Number *</Label><Input value={newAccount.account_number} onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })} className="rounded-xl mt-1" maxLength={10} required /></div>
            <div><Label>Account Name *</Label><Input value={newAccount.account_name} onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })} className="rounded-xl mt-1" required /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">Cancel</Button><Button type="submit" disabled={saving} className="bg-[#2969FF] text-white rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Account'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
