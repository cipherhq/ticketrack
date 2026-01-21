import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Link2,
  TrendingUp,
  DollarSign,
  Eye,
  ShoppingCart,
  CheckCircle,
  Clock,
  Copy,
  Percent,
  Mail,
  Loader2,
  RefreshCw,
  XCircle,
  Send,
  Trash2,
  MoreVertical,
  UserPlus,
  Banknote,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { HelpTip } from '@/components/HelpTip';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { sendPromoterInviteEmail } from '@/lib/emailService';



export function PromoterManagement() {
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [promoters, setPromoters] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [selectedPromoter, setSelectedPromoter] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [payingOut, setPayingOut] = useState(false);
  const [error, setError] = useState('');
  
  const [inviteForm, setInviteForm] = useState({
    email: '',
    commissionType: 'percentage',
    commissionValue: '10',
    eventId: 'all',
  });

  const [payoutAmount, setPayoutAmount] = useState('');

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPromoters(), loadEvents()]);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPromoters = async () => {
    const { data, error: loadError } = await supabase
      .from('promoters')
      .select('*')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false });

    if (loadError) {
      console.error('Error loading promoters:', loadError);
      return;
    }

    setPromoters(data || []);
  };

  const loadEvents = async () => {
    const { data, error: loadError } = await supabase
      .from('events')
      .select('id, title, currency')
      .eq('organizer_id', organizer.id)
      .eq('status', 'published')
      .order('start_date', { ascending: false });

    if (loadError) {
      console.error('Error loading events:', loadError);
      return;
    }

    setEvents(data || []);
  };

  const generatePromoCode = (name) => {
    const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${cleanName}${random}`;
  };

  const generateReferralLink = (promoCode, eventId, organizerId) => {
    const baseUrl = window.location.origin;
    if (eventId && eventId !== 'all') {
      return `${baseUrl}/events/${eventId}?ref=${promoCode}`;
    }
    return `${baseUrl}/organizer/${organizerId}/events?ref=${promoCode}`;
  };

  const invitePromoter = async () => {
    if (!inviteForm.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!inviteForm.commissionValue || parseFloat(inviteForm.commissionValue) <= 0) {
      setError('Valid commission value is required');
      return;
    }

    setInviting(true);
    setError('');

    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', inviteForm.email.toLowerCase().trim())
        .single();

      const promoCode = generatePromoCode(existingUser?.full_name || inviteForm.email.split('@')[0]);
      
      const { data: existingPromoter } = await supabase
        .from('promoters')
        .select('id')
        .eq('organizer_id', organizer.id)
        .eq('email', inviteForm.email.toLowerCase().trim())
        .single();

      if (existingPromoter) {
        setError('This person has already been invited as a promoter');
        setInviting(false);
        return;
      }

      const promoterName = existingUser?.full_name || inviteForm.email.split('@')[0];
      const promoterData = {
        organizer_id: organizer.id,
        user_id: existingUser?.id || null,
        full_name: promoterName,
        short_code: promoCode,
        email: inviteForm.email.toLowerCase().trim(),
        name: promoterName,
        referral_code: promoCode,
        referral_link: generateReferralLink(promoCode, inviteForm.eventId, organizer.id),
        commission_type: inviteForm.commissionType,
        commission_value: parseFloat(inviteForm.commissionValue),
        commission_rate: parseFloat(inviteForm.commissionValue),
        event_id: inviteForm.eventId === 'all' ? null : inviteForm.eventId,
        status: 'pending',
        is_active: false,
        total_clicks: 0,
        total_sales: 0,
        total_revenue: 0,
        total_commission: 0,
        paid_commission: 0,
        total_earned: 0,
        total_paid: 0,
      };

      const { error: insertError } = await supabase
        .from('promoters')
        .insert(promoterData);

      if (insertError) throw insertError;

      // Send invitation email to the promoter using proper email service
      const selectedEvent = events.find(e => e.id === inviteForm.eventId);
      const emailData = {
        organizerName: organizer.business_name || organizer.name,
        eventTitle: selectedEvent?.title || 'All Events',
        commissionType: inviteForm.commissionType,
        commissionValue: inviteForm.commissionValue,
        promoCode: promoCode,
        isNewUser: !existingUser,
        appUrl: window.location.origin,
        currency: selectedEvent?.currency || getDefaultCurrency(organizer?.country_code || organizer?.country),
        eventId: selectedEvent?.id
      };
      
      console.log('📧 Sending promoter invite email:', {
        to: inviteForm.email.toLowerCase().trim(),
        data: emailData,
        organizerId: organizer.id
      });
      
      const emailResult = await sendPromoterInviteEmail(
        inviteForm.email.toLowerCase().trim(),
        emailData,
        organizer.id
      );
      
      console.log('📧 Email result:', emailResult);

      if (emailResult?.success) {
        alert(`✅ Invitation sent to ${inviteForm.email}!\n\nPromo Code: ${promoCode}`);
      } else {
        console.error('Email failed:', emailResult);
        alert(`⚠️ Promoter added but email may not have been sent.\n\nPromo Code: ${promoCode}\n\nError: ${emailResult?.error || 'Unknown'}\n\nPlease share the code manually or try resending.`);
      }

      await loadPromoters();
      setIsInviteOpen(false);
      setInviteForm({
        email: '',
        commissionType: 'percentage',
        commissionValue: '10',
        eventId: 'all',
      });
    } catch (err) {
      console.error('Error inviting promoter:', err);
      setError('Failed to invite promoter. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const activatePromoter = async (promoterId) => {
    try {
      const { error: updateError } = await supabase
        .from('promoters')
        .update({ status: 'active', is_active: true })
        .eq('id', promoterId);

      if (updateError) throw updateError;
      await loadPromoters();
    } catch (err) {
      console.error('Error activating promoter:', err);
      alert('Failed to activate promoter');
    }
  };

  const deactivatePromoter = async (promoterId) => {
    try {
      const { error: updateError } = await supabase
        .from('promoters')
        .update({ status: 'inactive', is_active: false })
        .eq('id', promoterId);

      if (updateError) throw updateError;
      await loadPromoters();
    } catch (err) {
      console.error('Error deactivating promoter:', err);
      alert('Failed to deactivate promoter');
    }
  };

  const deletePromoter = async (promoterId) => {
    if (!confirm('Are you sure you want to remove this promoter?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('promoters')
        .delete()
        .eq('id', promoterId);

      if (deleteError) throw deleteError;
      await loadPromoters();
    } catch (err) {
      console.error('Error deleting promoter:', err);
      alert('Failed to remove promoter');
    }
  };

  const resendInvitation = async (promoter) => {
    try {
      const selectedEvent = promoter.event_id ? events.find(e => e.id === promoter.event_id) : null;
      const emailResult = await sendPromoterInviteEmail(
        promoter.email,
        {
          organizerName: organizer.business_name || organizer.name,
          eventTitle: selectedEvent?.title || 'All Events',
          commissionType: promoter.commission_type,
          commissionValue: promoter.commission_value || promoter.commission_rate,
          promoCode: promoter.short_code || promoter.referral_code,
          isNewUser: !promoter.user_id,
          appUrl: window.location.origin,
          currency: selectedEvent?.currency || events[0]?.currency || getDefaultCurrency(organizer?.country_code || organizer?.country),
          eventId: selectedEvent?.id
        },
        organizer.id
      );

      if (emailResult?.success) {
        alert(`✅ Invitation resent to ${promoter.email}!`);
      } else {
        console.error('Email failed:', emailResult?.error);
        alert(`❌ Failed to send email. Error: ${emailResult?.error || 'Unknown error'}\n\nPlease share the promo code manually: ${promoter.short_code || promoter.referral_code}`);
      }
    } catch (err) {
      console.error('Error resending invitation:', err);
      alert('Failed to resend invitation. Please try again.');
    }
  };

  const openPayoutDialog = (promoter) => {
    setSelectedPromoter(promoter);
    const unpaid = (promoter.total_commission || 0) - (promoter.paid_commission || 0);
    setPayoutAmount(unpaid.toString());
    setIsPayoutOpen(true);
  };

  const processPromoterPayout = async () => {
    if (!selectedPromoter) return;
    
    const amount = parseFloat(payoutAmount);
    const unpaid = (selectedPromoter.total_commission || 0) - (selectedPromoter.paid_commission || 0);

    if (!amount || amount <= 0) {
      setError('Enter a valid amount');
      return;
    }

    if (amount > unpaid) {
      setError('Amount exceeds unpaid balance');
      return;
    }

    setPayingOut(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('promoters')
        .update({ paid_commission: (selectedPromoter.paid_commission || 0) + amount })
        .eq('id', selectedPromoter.id);

      if (updateError) throw updateError;

      await loadPromoters();
      setIsPayoutOpen(false);
      setSelectedPromoter(null);
      setPayoutAmount('');
      alert('Payout recorded successfully!');
    } catch (err) {
      console.error('Error processing payout:', err);
      setError('Failed to process payout');
    } finally {
      setPayingOut(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const filteredPromoters = promoters.filter((p) => {
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.referral_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: promoters.length,
    active: promoters.filter((p) => p.status === 'active').length,
    pending: promoters.filter((p) => p.status === 'pending').length,
    totalSales: promoters.reduce((sum, p) => sum + (p.total_sales || 0), 0),
    totalRevenue: promoters.reduce((sum, p) => sum + (p.total_revenue || 0), 0),
    totalCommission: promoters.reduce((sum, p) => sum + (p.total_commission || 0), 0),
    unpaidCommission: promoters.reduce((sum, p) => sum + ((p.total_commission || 0) - (p.paid_commission || 0)), 0),
  };

  // Get organizer's default currency from their events or use NGN
  const getOrganizerCurrency = () => {
    // Try to get currency from first event, fallback to NGN
    const firstEvent = events?.[0];
    return firstEvent?.currency || getDefaultCurrency(organizer?.country_code || organizer?.country);
  };

  const formatCurrency = (amount, currency = null) => {
    const curr = currency || getOrganizerCurrency();
    return formatPrice(amount || 0, curr);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-700"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
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
          <h2 className="text-2xl font-semibold text-[#0F0F0F] flex items-center gap-2">
            Event Promoters
            <HelpTip>Promoters earn commission by selling tickets with unique links. Set commission rates per event and track each promoter's sales. Great for influencers and partners!</HelpTip>
          </h2>
          <p className="text-[#0F0F0F]/60 mt-1">Invite affiliates and track their performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl border-[#0F0F0F]/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setIsInviteOpen(true)} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Promoter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Active Promoters</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.active}</p>
                {stats.pending > 0 && <p className="text-xs text-yellow-600">{stats.pending} pending</p>}
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Tickets Sold</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalSales}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Revenue Generated</p>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60 mb-1">Unpaid Commission</p>
                <p className="text-2xl font-semibold text-orange-600">{formatCurrency(stats.unpaidCommission)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input placeholder="Search by name, email, or code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 bg-[#F4F6FA] border-0 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-40 h-12 rounded-xl border-[#0F0F0F]/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredPromoters.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60 mb-4">
              {promoters.length === 0 ? 'No promoters yet' : 'No promoters match your filters'}
            </p>
            {promoters.length === 0 && (
              <Button onClick={() => setIsInviteOpen(true)} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Your First Promoter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPromoters.map((promoter) => {
            const unpaidBalance = (promoter.total_commission || 0) - (promoter.paid_commission || 0);
            
            return (
              <Card key={promoter.id} className="border-[#0F0F0F]/10 rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium flex-shrink-0">
                        {promoter.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'P'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-[#0F0F0F] truncate">{promoter.name}</h3>
                          {getStatusBadge(promoter.status)}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#0F0F0F]/60">
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            {promoter.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {promoter.commission_type === 'percentage' 
                              ? `${promoter.commission_value}%` 
                              : formatCurrency(promoter.commission_value)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="p-2 bg-[#F4F6FA] rounded-lg">
                        <p className="text-xs text-[#0F0F0F]/60">Clicks</p>
                        <p className="font-semibold text-[#0F0F0F]">{(promoter.total_clicks || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-[#F4F6FA] rounded-lg">
                        <p className="text-xs text-[#0F0F0F]/60">Sales</p>
                        <p className="font-semibold text-[#0F0F0F]">{promoter.total_sales || 0}</p>
                      </div>
                      <div className="p-2 bg-[#F4F6FA] rounded-lg">
                        <p className="text-xs text-[#0F0F0F]/60">Revenue</p>
                        <p className="font-semibold text-[#0F0F0F]">{formatCurrency(promoter.total_revenue)}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600">Earned</p>
                        <p className="font-semibold text-green-600">{formatCurrency(promoter.total_commission)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {unpaidBalance > 0 && (
                        <Button variant="outline" size="sm" onClick={() => openPayoutDialog(promoter)} className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50">
                          <Banknote className="w-4 h-4 mr-1" />
                          Pay {formatCurrency(unpaidBalance)}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(promoter.referral_link)} className="rounded-xl border-[#0F0F0F]/10">
                        <Copy className="w-4 h-4 mr-1" />
                        Copy Link
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => copyToClipboard(promoter.referral_code)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Promo Code
                          </DropdownMenuItem>
                          {promoter.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => resendInvitation(promoter)}>
                                <Send className="w-4 h-4 mr-2" />
                                Resend Invitation
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => activatePromoter(promoter.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve & Activate
                              </DropdownMenuItem>
                            </>
                          )}
                          {promoter.status === 'active' && (
                            <DropdownMenuItem onClick={() => deactivatePromoter(promoter.id)}>
                              <XCircle className="w-4 h-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                          {promoter.status === 'inactive' && (
                            <DropdownMenuItem onClick={() => activatePromoter(promoter.id)}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => deletePromoter(promoter.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-[#F4F6FA] rounded-xl flex items-center gap-3">
                    <Link2 className="w-4 h-4 text-[#0F0F0F]/40 flex-shrink-0" />
                    <code className="text-sm text-[#0F0F0F]/60 flex-1 truncate">{promoter.referral_link}</code>
                    <Badge className="bg-[#2969FF]/10 text-[#2969FF] flex-shrink-0">{promoter.referral_code}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Invite Promoter</DialogTitle>
            <DialogDescription>Send an invitation to become an affiliate promoter for your events</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input type="email" placeholder="promoter@example.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="rounded-xl h-12" />
              <p className="text-xs text-[#0F0F0F]/40">The promoter will receive an email invitation to accept</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission Type</Label>
                <Select value={inviteForm.commissionType} onValueChange={(value) => setInviteForm({ ...inviteForm, commissionType: value })}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Commission Value *</Label>
                <Input type="number" placeholder={inviteForm.commissionType === 'percentage' ? '10' : '500'} value={inviteForm.commissionValue} onChange={(e) => setInviteForm({ ...inviteForm, commissionValue: e.target.value })} className="rounded-xl h-12" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Applicable Event</Label>
              <Select value={inviteForm.eventId} onValueChange={(value) => setInviteForm({ ...inviteForm, eventId: value })}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setIsInviteOpen(false); setError(''); }} className="flex-1 rounded-xl h-12">Cancel</Button>
              <Button onClick={invitePromoter} disabled={inviting} className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12">
                {inviting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Invitation</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pay Promoter Commission</DialogTitle>
            <DialogDescription>Record a commission payment to {selectedPromoter?.name}</DialogDescription>
          </DialogHeader>
          
          {selectedPromoter && (
            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
              )}

              <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#0F0F0F]/60">Total Earned</span>
                  <span className="font-medium">{formatCurrency(selectedPromoter.total_commission)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#0F0F0F]/60">Already Paid</span>
                  <span className="font-medium">{formatCurrency(selectedPromoter.paid_commission)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#0F0F0F]/10 pt-2">
                  <span className="text-[#0F0F0F]/60">Unpaid Balance</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency((selectedPromoter.total_commission || 0) - (selectedPromoter.paid_commission || 0))}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount ({getOrganizerCurrency()})</Label>
                <Input type="number" placeholder="0" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="rounded-xl h-12" />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => { setIsPayoutOpen(false); setError(''); }} className="flex-1 rounded-xl h-12">Cancel</Button>
                <Button onClick={processPromoterPayout} disabled={payingOut} className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12">
                  {payingOut ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Banknote className="w-4 h-4 mr-2" />Record Payment</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
