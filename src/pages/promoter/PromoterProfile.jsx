import { useState, useEffect } from 'react';
import { UserCircle, Mail, Phone, Calendar, Edit2, Save, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { usePromoter } from '@/contexts/PromoterContext';
import { supabase } from '@/lib/supabase';
import { formatMultiCurrencyCompact } from '@/config/currencies';

export function PromoterProfile() {
  const { promoter, refreshPromoter, loading: promoterLoading } = usePromoter();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ full_name: '', email: '', phone: '', bio: '' });
  const [earningsByCurrency, setEarningsByCurrency] = useState({});
  const [paidByCurrency, setPaidByCurrency] = useState({});

  useEffect(() => { 
    if (promoter) {
      setEditedProfile({ full_name: promoter.full_name || '', email: promoter.email || '', phone: promoter.phone || '', bio: promoter.bio || '' });
      loadCurrencyData();
    }
  }, [promoter]);

  const loadCurrencyData = async () => {
    try {
      // Get earnings grouped by currency
      const { data: salesData } = await supabase
        .from('promoter_sales')
        .select('commission_amount, events(currency)')
        .eq('promoter_id', promoter.id);

      const earnings = {};
      salesData?.forEach(sale => {
        const currency = sale.events?.currency;
        if (!currency) {
          console.warn('Sale missing currency:', sale);
          return;
        }
        earnings[currency] = (earnings[currency] || 0) + parseFloat(sale.commission_amount || 0);
      });
      setEarningsByCurrency(earnings);

      // Get payouts grouped by currency
      const { data: payoutsData } = await supabase
        .from('promoter_payouts')
        .select('amount, currency')
        .eq('promoter_id', promoter.id)
        .eq('status', 'completed');

      const paid = {};
      payoutsData?.forEach(payout => {
        const currency = payout.currency;
        if (!currency) {
          console.warn('Payout missing currency:', payout);
          return;
        }
        paid[currency] = (paid[currency] || 0) + parseFloat(payout.amount || 0);
      });
      setPaidByCurrency(paid);
    } catch (error) { 
      console.error('Error loading currency data:', error); 
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('promoters').update({ ...editedProfile, updated_at: new Date().toISOString() }).eq('id', promoter.id);
    await refreshPromoter();
    setIsEditing(false);
    setSaving(false);
    alert('Profile updated!');
  };

  if (promoterLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  if (!promoter) return <Card className="border-border/10 rounded-2xl"><CardContent className="p-8 text-center"><UserCircle className="w-16 h-16 text-foreground/20 mx-auto mb-4" /><h3 className="text-lg">Profile Not Found</h3></CardContent></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl text-foreground mb-2">Promoter Profile</h2><p className="text-muted-foreground">Manage your information</p></div>
        {!isEditing ? <Button onClick={() => setIsEditing(true)} className="bg-[#2969FF] text-white rounded-xl"><Edit2 className="w-4 h-4 mr-2" />Edit</Button> : (
          <div className="flex gap-2"><Button onClick={() => { setEditedProfile({ full_name: promoter.full_name || '', email: promoter.email || '', phone: promoter.phone || '', bio: promoter.bio || '' }); setIsEditing(false); }} variant="outline" className="rounded-xl"><X className="w-4 h-4 mr-2" />Cancel</Button><Button onClick={handleSave} disabled={saving} className="bg-green-600 text-white rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save</Button></div>
        )}
      </div>

      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-2xl bg-[#2969FF] flex items-center justify-center text-white text-3xl font-bold">{promoter.full_name?.charAt(0) || 'P'}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2"><h2 className="text-2xl text-foreground">{promoter.full_name}</h2><Badge className={promoter.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'}>{promoter.status}</Badge></div>
              <p className="text-muted-foreground mb-3">{promoter.bio || 'No bio added yet.'}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-4 h-4" /><span>{promoter.email}</span></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4" /><span>{promoter.phone || 'Not provided'}</span></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-4 h-4" /><span>Joined {new Date(promoter.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground mb-1">Promo Code</p><p className="text-2xl text-[#2969FF] font-bold">{promoter.short_code}</p></CardContent></Card>
        <Card className="border-border/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground mb-1">Commission Rate</p><p className="text-2xl text-green-600">{promoter.commission_rate}%</p></CardContent></Card>
        <Card className="border-border/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground mb-1">Total Earned</p><p className="text-xl text-foreground">{formatMultiCurrencyCompact(earningsByCurrency)}</p></CardContent></Card>
      </div>

      <Card className="border-border/10 rounded-2xl">
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Full Name</Label><Input value={editedProfile.full_name} onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })} className="rounded-xl mt-1" /></div>
                <div><Label>Email</Label><Input value={editedProfile.email} onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })} className="rounded-xl mt-1" type="email" /></div>
                <div><Label>Phone</Label><Input value={editedProfile.phone} onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })} className="rounded-xl mt-1" /></div>
              </div>
              <div><Label>Bio</Label><Textarea value={editedProfile.bio} onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })} className="rounded-xl mt-1" rows={4} /></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-xl"><p className="text-sm text-muted-foreground mb-1">Full Name</p><p>{promoter.full_name}</p></div>
              <div className="p-4 bg-muted rounded-xl"><p className="text-sm text-muted-foreground mb-1">Email</p><p>{promoter.email}</p></div>
              <div className="p-4 bg-muted rounded-xl"><p className="text-sm text-muted-foreground mb-1">Phone</p><p>{promoter.phone || 'Not provided'}</p></div>
              <div className="p-4 bg-muted rounded-xl"><p className="text-sm text-muted-foreground mb-1">Status</p><p className="capitalize">{promoter.status}</p></div>
              <div className="p-4 bg-muted rounded-xl md:col-span-2"><p className="text-sm text-muted-foreground mb-1">Bio</p><p>{promoter.bio || 'No bio added yet.'}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/10 rounded-2xl">
        <CardHeader><CardTitle>Account Statistics</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-xl text-center"><p className="text-2xl font-bold text-foreground">{promoter.total_clicks || 0}</p><p className="text-sm text-muted-foreground">Total Clicks</p></div>
            <div className="p-4 bg-muted rounded-xl text-center"><p className="text-2xl font-bold text-green-600">{promoter.total_sales || 0}</p><p className="text-sm text-muted-foreground">Tickets Sold</p></div>
            <div className="p-4 bg-muted rounded-xl text-center"><p className="text-2xl font-bold text-[#2969FF]">{formatMultiCurrencyCompact(earningsByCurrency)}</p><p className="text-sm text-muted-foreground">Total Earned</p></div>
            <div className="p-4 bg-muted rounded-xl text-center"><p className="text-2xl font-bold text-orange-600">{formatMultiCurrencyCompact(paidByCurrency)}</p><p className="text-sm text-muted-foreground">Total Paid</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
