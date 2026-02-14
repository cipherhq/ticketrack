import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Percent,
  Calendar,
  Users,
  Copy,
  Edit2,
  Trash2,
  MoreVertical,
  Tag,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { HelpTip } from '@/components/HelpTip';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { toast } from 'sonner';

export function PromoCodes() {
  const { organizer } = useOrganizer();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    maxUses: '',
    startsAt: '',
    expiresAt: '',
    eventId: 'all',
    isActive: true,
  });

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPromoCodes(), loadEvents()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPromoCodes = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*, events (id, title)')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading promo codes:', error);
      return;
    }

    const now = new Date();
    const codesWithStatus = data?.map(promo => {
      let status = 'active';
      if (!promo.is_active) {
        status = 'disabled';
      } else if (promo.expires_at && new Date(promo.expires_at) < now) {
        status = 'expired';
      } else if (promo.max_uses && promo.times_used >= promo.max_uses) {
        status = 'exhausted';
      } else if (promo.starts_at && new Date(promo.starts_at) > now) {
        status = 'scheduled';
      }
      return { ...promo, status };
    }) || [];

    setPromoCodes(codesWithStatus);
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title')
      .eq('organizer_id', organizer.id)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error loading events:', error);
      return;
    }
    setEvents(data || []);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      maxUses: '',
      startsAt: '',
      expiresAt: '',
      eventId: 'all',
      isActive: true,
    });
    setEditingPromo(null);
    setError('');
  };

  const openEditDialog = (promo) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      discountType: promo.discount_type,
      discountValue: promo.discount_value?.toString() || '',
      maxUses: promo.max_uses?.toString() || '',
      startsAt: promo.starts_at?.split('T')[0] || '',
      expiresAt: promo.expires_at?.split('T')[0] || '',
      eventId: promo.event_id || 'all',
      isActive: promo.is_active,
    });
    setIsCreateDialogOpen(true);
  };

  const handleStartsAtChange = (e) => {
    const newStartsAt = e.target.value;
    setFormData(prev => {
      if (prev.expiresAt && prev.expiresAt < newStartsAt) {
        return { ...prev, startsAt: newStartsAt, expiresAt: '' };
      }
      return { ...prev, startsAt: newStartsAt };
    });
  };

  const handleExpiresAtChange = (e) => {
    const newExpiresAt = e.target.value;
    setFormData(prev => ({ ...prev, expiresAt: newExpiresAt }));
  };

  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      setError('Promo code is required');
      return;
    }
    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      setError('Valid discount value is required');
      return;
    }
    if (formData.discountType === 'percentage' && parseFloat(formData.discountValue) > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }
    
    if (formData.expiresAt && formData.expiresAt < today && !editingPromo) {
      setError('Expiry date cannot be in the past');
      return;
    }
    if (formData.startsAt && formData.expiresAt && formData.expiresAt < formData.startsAt) {
      setError('Expiry date must be after start date');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const promoData = {
        organizer_id: organizer.id,
        code: formData.code.toUpperCase().trim(),
        discount_type: formData.discountType,
        discount_value: parseFloat(formData.discountValue),
        max_uses: formData.maxUses ? parseInt(formData.maxUses) : null,
        starts_at: formData.startsAt || null,
        expires_at: formData.expiresAt || null,
        event_id: formData.eventId === 'all' ? null : formData.eventId,
        
        is_active: formData.isActive,
      };

      if (editingPromo) {
        const { error: updateError } = await supabase
          .from('promo_codes')
          .update(promoData)
          .eq('id', editingPromo.id);
        if (updateError) throw updateError;
      } else {
        const { data: existing } = await supabase
          .from('promo_codes')
          .select('id')
          .eq('organizer_id', organizer.id)
          .eq('code', promoData.code)
          .single();

        if (existing) {
          setError('This promo code already exists');
          setSaving(false);
          return;
        }

        const { error: insertError } = await supabase
          .from('promo_codes')
          .insert({ ...promoData, times_used: 0 });
        if (insertError) throw insertError;
      }

      await loadPromoCodes();
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving promo code:', error);
      setError('Failed to save promo code. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (promoId, currentActive) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !currentActive })
        .eq('id', promoId);
      if (error) throw error;
      await loadPromoCodes();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update promo code status');
    }
  };

  const deletePromoCode = async (promoId) => {
    if (!(await confirm('Delete Promo Code', 'Are you sure you want to delete this promo code?', { variant: 'destructive' }))) return;
    try {
      const { error } = await supabase.from('promo_codes').delete().eq('id', promoId);
      if (error) throw error;
      await loadPromoCodes();
    } catch (error) {
      console.error('Error deleting promo code:', error);
      toast.error('Failed to delete promo code');
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
  };

  const filteredPromoCodes = promoCodes.filter(promo => {
    const matchesSearch = promo.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || promo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: promoCodes.length,
    active: promoCodes.filter(p => p.status === 'active').length,
    totalUses: promoCodes.reduce((sum, p) => sum + (p.times_used || 0), 0),
    expired: promoCodes.filter(p => p.status === 'expired' || p.status === 'exhausted').length,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'expired':
        return <Badge className="bg-muted text-foreground/80 hover:bg-muted"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'exhausted':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100"><Users className="w-3 h-3 mr-1" />Exhausted</Badge>;
      case 'disabled':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" />Disabled</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>;
      default:
        return null;
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            Promo Codes
            <HelpTip>Create discount codes to boost sales. Share codes on social media or with partners. You can set percentage or fixed discounts, usage limits, and expiration dates.</HelpTip>
          </h2>
          <p className="text-muted-foreground mt-1">Create and manage discount codes for your events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl border-border/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Create Promo Code
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Codes</p>
                <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-semibold text-green-600">{stats.active}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Uses</p>
                <p className="text-2xl font-semibold text-foreground">{stats.totalUses}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Expired</p>
                <p className="text-2xl font-semibold text-foreground">{stats.expired}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-border/10 rounded-2xl">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input placeholder="Search promo codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 bg-muted border-0 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-40 h-12 rounded-xl border-border/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="exhausted">Exhausted</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {filteredPromoCodes.length === 0 ? (
        <Card className="border-border/10 rounded-2xl">
          <div className="p-12 text-center">
            <Tag className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{promoCodes.length === 0 ? 'No promo codes yet' : 'No promo codes match your filters'}</p>
            {promoCodes.length === 0 && (
              <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Promo Code
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPromoCodes.map((promo) => (
            <Card key={promo.id} className="border-border/10 rounded-2xl hover:shadow-md transition-shadow">
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg font-mono font-medium text-foreground">{promo.code}</h3>
                      {getStatusBadge(promo.status)}
                      {promo.events && <Badge variant="outline" className="rounded-lg">{promo.events.title}</Badge>}
                      {!promo.event_id && <Badge variant="outline" className="rounded-lg bg-[#2969FF]/5 text-[#2969FF] border-[#2969FF]/20">All Events</Badge>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {promo.discount_type === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                        <span>{promo.discount_value}% off</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{promo.times_used || 0}{promo.max_uses ? `/${promo.max_uses}` : ''} used</span>
                      </div>
                      {promo.expires_at && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Until {new Date(promo.expires_at).toLocaleDateString()}</span>
                        </div>
                      )}
                      {promo.min_purchase_amount > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          
                        </div>
                      )}
                    </div>
                    {promo.max_uses && (
                      <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all ${(promo.times_used / promo.max_uses) >= 1 ? 'bg-orange-500' : 'bg-[#2969FF]'}`} style={{ width: `${Math.min((promo.times_used / promo.max_uses) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(promo.code)} className="rounded-xl border-border/10">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => openEditDialog(promo)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(promo.id, promo.is_active)}>
                          {promo.is_active ? <><XCircle className="w-4 h-4 mr-2" />Disable</> : <><CheckCircle className="w-4 h-4 mr-2" />Enable</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deletePromoCode(promo.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsCreateDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promo Code' : 'Create New Promo Code'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="code">Promo Code *</Label>
              <div className="flex gap-2">
                <Input id="code" placeholder="e.g., SUMMER2024" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="rounded-xl uppercase font-mono" disabled={!!editingPromo} />
                {!editingPromo && (
                  <Button type="button" variant="outline" onClick={generateCode} className="rounded-xl border-border/10">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                )}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select value={formData.discountType} onValueChange={(value) => setFormData({ ...formData, discountType: value })}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <Input type="number" placeholder="e.g., 20" value={formData.discountValue} onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })} className="rounded-xl h-12" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usage Limit</Label>
                <Input type="number" placeholder="Unlimited if empty" value={formData.maxUses} onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })} className="rounded-xl h-12" />
              </div>
              <div className="space-y-2">
                <Label>Applicable Event</Label>
                <Select value={formData.eventId} onValueChange={(value) => setFormData({ ...formData, eventId: value })}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Events</SelectItem>
                    {events.map(event => <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input 
                  type="date" 
                  value={formData.startsAt} 
                  onChange={handleStartsAtChange} 
                  min={editingPromo ? undefined : today}
                  className="rounded-xl h-12" 
                />
                <p className="text-xs text-muted-foreground">Leave empty for immediate start</p>
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input 
                  type="date" 
                  value={formData.expiresAt} 
                  onChange={handleExpiresAtChange} 
                  min={formData.startsAt || (editingPromo ? undefined : today)}
                  className="rounded-xl h-12" 
                />
                <p className="text-xs text-muted-foreground">Leave empty for no expiry</p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }} className="flex-1 rounded-xl h-12">Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : editingPromo ? 'Update Promo Code' : 'Create Promo Code'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
