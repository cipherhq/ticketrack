import { useState, useEffect } from 'react';
import {
  Plus, Search, Eye, Users, ShoppingCart, TrendingUp, DollarSign,
  Copy, ExternalLink, Edit2, Trash2, BarChart3, Loader2, X,
  Mail, Phone, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatMultiCurrency, formatMultiCurrencyCompact, formatPrice } from '@/config/currencies';
import { toast } from 'sonner';

export function OrganizerPromoters() {
  const { organizer } = useOrganizer();
  const confirm = useConfirm();
  const [promoters, setPromoters] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedPromoter, setSelectedPromoter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [statsByCurrency, setStatsByCurrency] = useState({ revenue: {}, commissions: {}, unpaid: {} });

  const [newPromoter, setNewPromoter] = useState({
    full_name: '',
    email: '',
    phone: '',
    short_code: '',
    commission_rate: 10,
    event_ids: []
  });

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    if (organizer) {
      loadData();
    }
  }, [organizer]);

  const loadData = async () => {
    try {
      // Load organizer's events
      const { data: eventData } = await supabase
        .from('events')
        .select('id, title, currency')
        .eq('organizer_id', organizer.id);
      setEvents(eventData || []);

      // Load promoters assigned to organizer's events
      const eventIds = eventData?.map(e => e.id) || [];
      if (eventIds.length === 0) {
        setPromoters([]);
        setLoading(false);
        return;
      }

      const { data: promoterEvents } = await supabase
        .from('promoter_events')
        .select('promoter_id, event_id, commission_rate')
        .in('event_id', eventIds);

      const promoterIds = [...new Set(promoterEvents?.map(pe => pe.promoter_id) || [])];
      
      if (promoterIds.length === 0) {
        setPromoters([]);
        setLoading(false);
        return;
      }

      const { data: promoterData } = await supabase
        .from('promoters')
        .select('*')
        .in('id', promoterIds);

      // Get sales data with currency for each promoter
      const { data: salesData } = await supabase
        .from('promoter_sales')
        .select('promoter_id, sale_amount, commission_amount, events(currency)')
        .in('promoter_id', promoterIds);

      // Build currency map per promoter
      const promoterCurrencyData = {};
      salesData?.forEach(sale => {
        const pid = sale.promoter_id;
        const currency = sale.events?.currency;
        if (!currency) {
          console.warn('Promoter sale missing currency:', sale);
          return;
        }
        if (!promoterCurrencyData[pid]) {
          promoterCurrencyData[pid] = { revenue: {}, earned: {} };
        }
        promoterCurrencyData[pid].revenue[currency] = (promoterCurrencyData[pid].revenue[currency] || 0) + parseFloat(sale.sale_amount || 0);
        promoterCurrencyData[pid].earned[currency] = (promoterCurrencyData[pid].earned[currency] || 0) + parseFloat(sale.commission_amount || 0);
      });

      // Get payouts per promoter (currently no currency column, default to NGN)
      const { data: payoutsData } = await supabase
        .from('promoter_payouts')
        .select('promoter_id, amount, status, currency')
        .in('promoter_id', promoterIds)
        .eq('status', 'completed');

      const promoterPaidData = {};
      payoutsData?.forEach(payout => {
        const pid = payout.promoter_id;
        const currency = payout.currency;
        if (!currency) {
          console.warn('Promoter payout missing currency:', payout);
          return;
        }
        if (!promoterPaidData[pid]) promoterPaidData[pid] = {};
        promoterPaidData[pid][currency] = (promoterPaidData[pid][currency] || 0) + parseFloat(payout.amount || 0);
      });

      // Calculate unpaid by currency per promoter
      const promoterUnpaidData = {};
      Object.keys(promoterCurrencyData).forEach(pid => {
        promoterUnpaidData[pid] = {};
        const earned = promoterCurrencyData[pid].earned || {};
        const paid = promoterPaidData[pid] || {};
        Object.keys(earned).forEach(currency => {
          const unpaid = (earned[currency] || 0) - (paid[currency] || 0);
          if (unpaid > 0) promoterUnpaidData[pid][currency] = unpaid;
        });
      });

      // Enrich with event assignments and currency data
      const enrichedPromoters = promoterData?.map(p => ({
        ...p,
        assigned_events: promoterEvents?.filter(pe => pe.promoter_id === p.id) || [],
        revenueByCurrency: promoterCurrencyData[p.id]?.revenue || {},
        earnedByCurrency: promoterCurrencyData[p.id]?.earned || {},
        paidByCurrency: promoterPaidData[p.id] || {},
        unpaidByCurrency: promoterUnpaidData[p.id] || {}
      })) || [];

      setPromoters(enrichedPromoters);

      // Calculate aggregate stats by currency
      const aggRevenue = {};
      const aggCommissions = {};
      const aggUnpaid = {};
      enrichedPromoters.forEach(p => {
        Object.entries(p.revenueByCurrency).forEach(([cur, amt]) => {
          aggRevenue[cur] = (aggRevenue[cur] || 0) + amt;
        });
        Object.entries(p.earnedByCurrency).forEach(([cur, amt]) => {
          aggCommissions[cur] = (aggCommissions[cur] || 0) + amt;
        });
        Object.entries(p.unpaidByCurrency).forEach(([cur, amt]) => {
          aggUnpaid[cur] = (aggUnpaid[cur] || 0) + amt;
        });
      });
      setStatsByCurrency({ revenue: aggRevenue, commissions: aggCommissions, unpaid: aggUnpaid });

    } catch (error) {
      console.error('Error loading promoters:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShortCode = (name) => {
    const base = name.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6);
    const num = Math.floor(Math.random() * 100);
    return `${base}${num}`;
  };

  const handleAddPromoter = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Check if user exists with this email
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newPromoter.email)
        .single();

      // Create promoter
      const { data: promoter, error: promoterError } = await supabase
        .from('promoters')
        .insert({
          user_id: existingUser?.id || null,
          full_name: newPromoter.full_name,
          email: newPromoter.email,
          phone: newPromoter.phone,
          short_code: newPromoter.short_code || generateShortCode(newPromoter.full_name),
          commission_rate: newPromoter.commission_rate,
          status: 'active'
        })
        .select()
        .single();

      if (promoterError) throw promoterError;

      // Assign to selected events
      if (newPromoter.event_ids.length > 0) {
        const eventAssignments = newPromoter.event_ids.map(eventId => ({
          promoter_id: promoter.id,
          event_id: eventId,
          commission_rate: newPromoter.commission_rate,
          is_active: true
        }));

        await supabase.from('promoter_events').insert(eventAssignments);
      }

      toast.success('Promoter added successfully!');
      setIsAddOpen(false);
      setNewPromoter({ full_name: '', email: '', phone: '', short_code: '', commission_rate: 10, event_ids: [] });
      loadData();
    } catch (error) {
      console.error('Error adding promoter:', error);
      toast.error('Error adding promoter: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditPromoter = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await supabase
        .from('promoters')
        .update({
          full_name: selectedPromoter.full_name,
          email: selectedPromoter.email,
          phone: selectedPromoter.phone,
          commission_rate: selectedPromoter.commission_rate,
          status: selectedPromoter.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPromoter.id);

      toast.success('Promoter updated!');
      setIsEditOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating promoter:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayCommission = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Create payout record
      await supabase.from('promoter_payouts').insert({
        promoter_id: selectedPromoter.id,
        amount: parseFloat(paymentAmount),
        status: 'completed',
        payment_reference: `PAY-${Date.now()}`,
        notes: paymentNotes,
        processed_at: new Date().toISOString()
      });

      // Update promoter total_paid
      await supabase
        .from('promoters')
        .update({
          total_paid: parseFloat(selectedPromoter.total_paid || 0) + parseFloat(paymentAmount)
        })
        .eq('id', selectedPromoter.id);

      toast.success('Payment recorded!');
      setIsPayOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      loadData();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePromoter = async (promoter) => {
    if (!(await confirm('Remove Promoter', `Remove ${promoter.full_name} as a promoter? This will remove them from all your events.`, { variant: 'destructive' }))) return;

    try {
      // Remove from organizer's events only
      const eventIds = events.map(e => e.id);
      await supabase
        .from('promoter_events')
        .delete()
        .eq('promoter_id', promoter.id)
        .in('event_id', eventIds);

      toast.success('Promoter removed from your events!');
      loadData();
    } catch (error) {
      console.error('Error removing promoter:', error);
      toast.error('Error: ' + error.message);
    }
  };

  const copyLink = (promoter) => {
    navigator.clipboard.writeText(`${window.location.origin}/events?ref=${promoter.short_code}`);
    setCopiedId(promoter.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPromoters = promoters.filter(p => {
    const matchesSearch = 
      p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.short_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate basic stats (non-currency)
  const stats = {
    total: promoters.length,
    active: promoters.filter(p => p.status === 'active').length,
    totalClicks: promoters.reduce((sum, p) => sum + (p.total_clicks || 0), 0),
    ticketsSold: promoters.reduce((sum, p) => sum + (p.total_sales || 0), 0)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-foreground mb-2">Event Promoters & Affiliates</h2>
          <p className="text-muted-foreground">Manage your event promoters and track their performance</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Add Promoter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Promoters</p>
            <p className="text-2xl text-foreground">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Active</p>
            <p className="text-2xl text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Clicks</p>
            <p className="text-2xl text-foreground">{stats.totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Tickets Sold</p>
            <p className="text-2xl text-foreground">{stats.ticketsSold}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-xl text-foreground">{formatMultiCurrencyCompact(statsByCurrency.revenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Commissions</p>
            <p className="text-xl text-foreground">{formatMultiCurrencyCompact(statsByCurrency.commissions)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Unpaid</p>
            <p className="text-xl text-red-600">{formatMultiCurrencyCompact(statsByCurrency.unpaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search by name, email, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promoters List */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle>All Promoters ({filteredPromoters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPromoters.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg text-foreground mb-2">No Promoters Found</h3>
              <p className="text-muted-foreground mb-4">Add promoters to help spread the word about your events</p>
              <Button onClick={() => setIsAddOpen(true)} className="bg-[#2969FF] text-white rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Add Promoter
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredPromoters.map((promoter) => {
                const convRate = promoter.total_clicks > 0 
                  ? ((promoter.total_sales / promoter.total_clicks) * 100).toFixed(2) 
                  : 0;
                const hasUnpaid = Object.keys(promoter.unpaidByCurrency || {}).length > 0;

                return (
                  <div key={promoter.id} className="p-6 border border-border/10 rounded-2xl">
                    {/* Promoter Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{promoter.full_name}</h3>
                          <Badge className={promoter.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'}>
                            {promoter.status}
                          </Badge>
                          {hasUnpaid ? (
                            <Badge className="bg-yellow-600">Pending</Badge>
                          ) : (
                            <Badge className="bg-green-600">Paid</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {promoter.email}
                          </span>
                          {promoter.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {promoter.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">{promoter.commission_rate}% Commission</p>
                        {hasUnpaid && (
                          <p className="text-sm text-red-600">Unpaid: {formatMultiCurrency(promoter.unpaidByCurrency)}</p>
                        )}
                      </div>
                    </div>

                    {/* Promo Link */}
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-xl mb-4">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <code className="flex-1 text-sm text-foreground truncate">
                        {window.location.origin}/events?ref={promoter.short_code}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyLink(promoter)}
                        className="rounded-lg"
                      >
                        {copiedId === promoter.id ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/events?ref=${promoter.short_code}`, '_blank')}
                        className="rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                      <div className="p-3 bg-blue-50 rounded-xl text-center">
                        <Eye className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Clicks</p>
                        <p className="text-lg font-semibold text-foreground">{promoter.total_clicks || 0}</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-xl text-center">
                        <Users className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Visitors</p>
                        <p className="text-lg font-semibold text-foreground">{Math.floor((promoter.total_clicks || 0) * 0.7)}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-xl text-center">
                        <ShoppingCart className="w-4 h-4 text-green-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Sold</p>
                        <p className="text-lg font-semibold text-green-600">{promoter.total_sales || 0}</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-xl text-center">
                        <TrendingUp className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Conv. Rate</p>
                        <p className="text-lg font-semibold text-orange-600">{convRate}%</p>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-xl text-center">
                        <DollarSign className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-lg font-semibold text-foreground">{formatMultiCurrencyCompact(promoter.revenueByCurrency)}</p>
                      </div>
                      <div className="p-3 bg-[#2969FF]/10 rounded-xl text-center">
                        <DollarSign className="w-4 h-4 text-[#2969FF] mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Commission</p>
                        <p className="text-lg font-semibold text-[#2969FF]">{formatMultiCurrencyCompact(promoter.earnedByCurrency)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        View Analytics
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-xl"
                        onClick={() => { setSelectedPromoter(promoter); setIsEditOpen(true); }}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      {hasUnpaid && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                          onClick={() => { 
                            setSelectedPromoter(promoter); 
                            // Set default amount to first currency unpaid amount
                            const firstCurrency = Object.keys(promoter.unpaidByCurrency)[0];
                            setPaymentAmount(promoter.unpaidByCurrency[firstCurrency]?.toString() || '');
                            setIsPayOpen(true); 
                          }}
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Pay Commission
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-red-600 text-red-600 rounded-xl"
                        onClick={() => handleRemovePromoter(promoter)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Promoter Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Promoter</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPromoter} className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={newPromoter.full_name}
                onChange={(e) => setNewPromoter({ ...newPromoter, full_name: e.target.value })}
                className="rounded-xl mt-1"
                required
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newPromoter.email}
                onChange={(e) => setNewPromoter({ ...newPromoter, email: e.target.value })}
                className="rounded-xl mt-1"
                required
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={newPromoter.phone}
                onChange={(e) => setNewPromoter({ ...newPromoter, phone: e.target.value })}
                className="rounded-xl mt-1"
                placeholder="+234 800 000 0000"
              />
            </div>
            <div>
              <Label>Promo Code (auto-generated if empty)</Label>
              <Input
                value={newPromoter.short_code}
                onChange={(e) => setNewPromoter({ ...newPromoter, short_code: e.target.value.toUpperCase() })}
                className="rounded-xl mt-1"
                placeholder="e.g., SARAH15"
                maxLength={20}
              />
            </div>
            <div>
              <Label>Commission Rate (%)</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={newPromoter.commission_rate}
                onChange={(e) => setNewPromoter({ ...newPromoter, commission_rate: parseFloat(e.target.value) })}
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>Assign to Events</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {events.map((event) => (
                  <label key={event.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPromoter.event_ids.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewPromoter({ ...newPromoter, event_ids: [...newPromoter.event_ids, event.id] });
                        } else {
                          setNewPromoter({ ...newPromoter, event_ids: newPromoter.event_ids.filter(id => id !== event.id) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{event.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#2969FF] text-white rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Promoter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Promoter Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Promoter</DialogTitle>
          </DialogHeader>
          {selectedPromoter && (
            <form onSubmit={handleEditPromoter} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={selectedPromoter.full_name}
                  onChange={(e) => setSelectedPromoter({ ...selectedPromoter, full_name: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={selectedPromoter.email}
                  onChange={(e) => setSelectedPromoter({ ...selectedPromoter, email: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={selectedPromoter.phone || ''}
                  onChange={(e) => setSelectedPromoter({ ...selectedPromoter, phone: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Commission Rate (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={selectedPromoter.commission_rate}
                  onChange={(e) => setSelectedPromoter({ ...selectedPromoter, commission_rate: parseFloat(e.target.value) })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select 
                  value={selectedPromoter.status} 
                  onValueChange={(v) => setSelectedPromoter({ ...selectedPromoter, status: v })}
                >
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#2969FF] text-white rounded-xl">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Commission Dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Commission</DialogTitle>
          </DialogHeader>
          {selectedPromoter && (
            <form onSubmit={handlePayCommission} className="space-y-4">
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground">Paying commission to</p>
                <p className="text-lg font-semibold text-foreground">{selectedPromoter.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedPromoter.email}</p>
                <p className="text-sm text-red-600 mt-2">Unpaid: {formatMultiCurrency(selectedPromoter.unpaidByCurrency)}</p>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="rounded-xl mt-1"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Note: Payouts are currently processed in the local currency</p>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="e.g., Bank transfer, Paystack payout"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPayOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white rounded-xl">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
