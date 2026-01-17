import { useState, useEffect } from 'react';
import { 
  DollarSign, Users, TrendingUp, Building2, CheckCircle, Clock, 
  Loader2, Search, Filter, ChevronDown, ChevronUp, ChevronRight,
  RefreshCw, Calendar, Banknote, User, Link2, Globe, 
  FileText, Download, Settings, Percent, PieChart, BarChart3,
  History, CreditCard, Receipt, Wallet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrency, currencies, getDefaultCurrency } from '@/config/currencies';
import { useAdmin } from '@/contexts/AdminContext';

// Country code to currency mapping (5 active countries)
const COUNTRY_CURRENCIES = {
  'NG': 'NGN',
  'GB': 'GBP',
  'US': 'USD',
  'CA': 'CAD',
  'GH': 'GHS',
};

// Country names for display
const COUNTRY_NAMES = {
  'NG': 'Nigeria',
  'GB': 'United Kingdom',
  'US': 'United States',
  'CA': 'Canada',
  'GH': 'Ghana',
};

// Sidebar navigation structure
const financeNavItems = [
  {
    id: 'payouts',
    label: 'Payouts',
    icon: Banknote,
    subItems: [
      { id: 'event-payouts', label: 'Event Payouts', icon: Calendar },
      { id: 'affiliate-payouts', label: 'Affiliate Payouts', icon: Link2 },
      { id: 'payout-history', label: 'Payout History', icon: History },
    ]
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    subItems: [
      { id: 'revenue-overview', label: 'Overview', icon: BarChart3 },
      { id: 'revenue-country', label: 'By Country', icon: Globe },
      { id: 'revenue-category', label: 'By Category', icon: PieChart },
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    subItems: [
      { id: 'financial-summary', label: 'Financial Summary', icon: Receipt },
      { id: 'tax-reports', label: 'Tax Reports', icon: Percent },
      { id: 'export-data', label: 'Export Data', icon: Download },
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    subItems: [
      { id: 'platform-fees', label: 'Platform Fees', icon: CreditCard },
      { id: 'payout-rules', label: 'Payout Rules', icon: Wallet },
    ]
  },
];

export function AdminFinance() {
  const { logAdminAction } = useAdmin();
  
  // Navigation state
  const [activeSection, setActiveSection] = useState('event-payouts');
  const [expandedGroups, setExpandedGroups] = useState({ payouts: true });
  
  // Data state
  const [loading, setLoading] = useState(true);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [affiliatePayouts, setAffiliatePayouts] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [platformStats, setPlatformStats] = useState({ 
    revenueByCurrency: {},  // { NGN: 5000, GBP: 200, USD: 300 }
    paidOutByCurrency: {},
    pendingByCurrency: {},
    revenueByMonth: [],     // [{ month: 'Jan', byCurrency: { NGN: 1000, GBP: 50 } }]
    revenueByCountry: [],   // [{ country: 'NG', countryName: 'Nigeria', currency: 'NGN', revenue: 5000 }]
    revenueByCategory: []   // [{ category: 'Music', byCurrency: { NGN: 3000, GBP: 100 } }]
  });
  const [expandedEvents, setExpandedEvents] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [currencyFilter, setCurrencyFilter] = useState('all'); // 'all' or specific currency code
  const [paymentDialog, setPaymentDialog] = useState({ open: false, type: null, recipient: null, event: null });
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadData(); }, [activeSection, statusFilter, currencyFilter]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeSection === 'event-payouts') await loadEventPayouts();
      else if (activeSection === 'affiliate-payouts') await loadAffiliatePayouts();
      else if (activeSection === 'payout-history') await loadPayoutHistory();
      else if (activeSection.startsWith('revenue')) await loadPlatformRevenue();
    } catch (error) { console.error('Error loading data:', error); }
    finally { setLoading(false); }
  };

  const loadEventPayouts = async () => {
    const now = new Date().toISOString();
    const { data: events, error } = await supabase.from('events').select(`
      id, title, slug, start_date, end_date, currency, payout_status, organizer_id,
      organizers ( id, business_name, email, bank_accounts (id, bank_name, account_number_encrypted, account_name, is_default) ),
      orders (id, total_amount, status, platform_fee)
    `).lt('end_date', now).order('end_date', { ascending: false });

    if (error) throw error;

    let filteredEvents = events || [];
    if (statusFilter === 'pending') filteredEvents = filteredEvents.filter(e => e.payout_status !== 'paid');
    else if (statusFilter === 'paid') filteredEvents = filteredEvents.filter(e => e.payout_status === 'paid');
    
    // Apply currency filter
    if (currencyFilter !== 'all') {
      filteredEvents = filteredEvents.filter(e => e.currency === currencyFilter);
    }

    const eventsWithPayouts = await Promise.all(filteredEvents.map(async (event) => {
      const { data: promoterSales } = await supabase.from('promoter_sales').select(`
        id, commission_amount, status,
        promoters ( id, full_name, email, promoter_bank_accounts (id, bank_name, account_number, account_name, is_verified) )
      `).eq('event_id', event.id);

      const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
      const totalSales = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
      const platformFees = completedOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0);

      const promoterEarnings = {};
      promoterSales?.forEach(sale => {
        const promoterId = sale.promoters?.id;
        if (!promoterId) return;
        if (!promoterEarnings[promoterId]) {
          promoterEarnings[promoterId] = { promoter: sale.promoters, totalCommission: 0, isPaid: sale.status === 'paid', sales: [] };
        }
        promoterEarnings[promoterId].totalCommission += parseFloat(sale.commission_amount || 0);
        promoterEarnings[promoterId].sales.push(sale);
      });

      const totalPromoterCommission = Object.values(promoterEarnings).reduce((sum, p) => sum + p.totalCommission, 0);
      const organizerNet = totalSales - platformFees - totalPromoterCommission;

      return {
        ...event, totalSales, platformFees, organizerNet,
        promoterEarnings: Object.values(promoterEarnings), totalPromoterCommission,
        primaryBankAccount: event.organizers?.bank_accounts?.find(b => b.is_default) || event.organizers?.bank_accounts?.[0]
      };
    }));

    setCompletedEvents(eventsWithPayouts.filter(e => e.totalSales > 0));
  };

  const loadAffiliatePayouts = async () => {
    const { data: earnings, error } = await supabase.from('referral_earnings').select(`
      id, commission_amount, status, currency, created_at, event_id,
      profiles!referral_earnings_user_id_fkey ( id, first_name, last_name, email, referral_code ),
      event:event_id (id, title, end_date, currency)
    `).order('created_at', { ascending: false });

    if (error) throw error;

    const now = new Date();
    let completedEarnings = earnings?.filter(e => e.event?.end_date && new Date(e.event.end_date) < now) || [];
    
    // Apply currency filter
    if (currencyFilter !== 'all') {
      completedEarnings = completedEarnings.filter(e => (e.currency || e.event?.currency) === currencyFilter);
    }

    const affiliateMap = {};
    completedEarnings.forEach(earning => {
      const affiliateId = earning.profiles?.id;
      if (!affiliateId) return;
      const earnCurrency = earning.currency || earning.event?.currency || getDefaultCurrency(earning.event?.country_code || earning.event?.country);
      
      if (!affiliateMap[affiliateId]) {
        affiliateMap[affiliateId] = { 
          affiliate: earning.profiles, 
          earnings: [], 
          totalEarned: 0, 
          totalPending: 0, 
          totalPaid: 0, 
          currency: earnCurrency 
        };
      }
      affiliateMap[affiliateId].earnings.push(earning);
      affiliateMap[affiliateId].totalEarned += parseFloat(earning.commission_amount || 0);
      if (earning.status === 'available' || earning.status === 'pending') {
        affiliateMap[affiliateId].totalPending += parseFloat(earning.commission_amount || 0);
      } else if (earning.status === 'paid') {
        affiliateMap[affiliateId].totalPaid += parseFloat(earning.commission_amount || 0);
      }
    });

    let affiliates = Object.values(affiliateMap);
    if (statusFilter === 'pending') affiliates = affiliates.filter(a => a.totalPending > 0);
    else if (statusFilter === 'paid') affiliates = affiliates.filter(a => a.totalPaid > 0 && a.totalPending === 0);

    setAffiliatePayouts(affiliates);
  };

  const loadPayoutHistory = async () => {
    const [organizerPayouts, promoterPayouts, affiliateEarnings] = await Promise.all([
      supabase.from('payouts').select('*, organizers(business_name, email)').eq('status', 'completed').order('processed_at', { ascending: false }).limit(100),
      supabase.from('promoter_payouts').select('*, promoters(full_name, email)').eq('status', 'completed').order('created_at', { ascending: false }).limit(100),
      supabase.from('referral_earnings').select('*, profiles!referral_earnings_user_id_fkey(first_name, last_name, email)').eq('status', 'paid').order('paid_at', { ascending: false }).limit(100)
    ]);

    let history = [
      ...(organizerPayouts.data || []).map(p => ({ ...p, type: 'organizer', recipientName: p.organizers?.business_name, recipientEmail: p.organizers?.email, paidAt: p.processed_at })),
      ...(promoterPayouts.data || []).map(p => ({ ...p, type: 'promoter', recipientName: p.promoters?.full_name, recipientEmail: p.promoters?.email, paidAt: p.completed_at || p.created_at })),
      ...(affiliateEarnings.data || []).map(p => ({ ...p, type: 'affiliate', recipientName: `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.trim(), recipientEmail: p.profiles?.email, amount: p.commission_amount, paidAt: p.paid_at }))
    ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    // Apply currency filter
    if (currencyFilter !== 'all') {
      history = history.filter(p => p.currency === currencyFilter);
    }

    setPayoutHistory(history);
  };

  const loadPlatformRevenue = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('platform_fee, created_at, currency, events(category, country_code)')
      .eq('status', 'completed');
    
    // Calculate revenue by currency
    const revenueByCurrency = {};
    orders?.forEach(o => {
      const currency = o.currency || o.event?.currency || getDefaultCurrency(o.event?.country_code || o.event?.country);
      revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + parseFloat(o.platform_fee || 0);
    });

    // Calculate paid out by currency
    const { data: payouts } = await supabase.from('payouts').select('net_amount, currency').eq('status', 'completed');
    const paidOutByCurrency = {};
    payouts?.forEach(p => {
      const currency = p.currency || getDefaultCurrency(p.country_code || p.country);
      paidOutByCurrency[currency] = (paidOutByCurrency[currency] || 0) + parseFloat(p.net_amount || 0);
    });

    // Calculate pending by currency
    const { data: pendingPayouts } = await supabase.from('payouts').select('net_amount, currency').in('status', ['pending', 'processing']);
    const pendingByCurrency = {};
    pendingPayouts?.forEach(p => {
      const currency = p.currency || getDefaultCurrency(p.country_code || p.country);
      pendingByCurrency[currency] = (pendingByCurrency[currency] || 0) + parseFloat(p.net_amount || 0);
    });

    // Revenue by month (grouped by currency)
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const monthOrders = orders?.filter(o => { 
        const d = new Date(o.created_at); 
        return d >= monthStart && d <= monthEnd; 
      }) || [];
      
      const byCurrency = {};
      monthOrders.forEach(o => {
        const currency = o.currency || o.events?.currency || getDefaultCurrency(o.events?.country_code || o.events?.country);
        byCurrency[currency] = (byCurrency[currency] || 0) + parseFloat(o.platform_fee || 0);
      });
      
      revenueByMonth.push({ 
        month: monthStart.toLocaleString('default', { month: 'short' }), 
        byCurrency,
        total: monthOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0)
      });
    }

    // Revenue by country (each country in its LOCAL currency)
    const countryMap = {};
    orders?.forEach(o => {
      const countryCode = o.events?.country_code || 'Unknown';
      const currency = COUNTRY_CURRENCIES[countryCode] || o.currency || o.events?.currency || getDefaultCurrency(countryCode);
      
      if (!countryMap[countryCode]) {
        countryMap[countryCode] = {
          country: countryCode,
          countryName: COUNTRY_NAMES[countryCode] || countryCode,
          currency: currency,
          revenue: 0
        };
      }
      countryMap[countryCode].revenue += parseFloat(o.platform_fee || 0);
    });
    const revenueByCountry = Object.values(countryMap).sort((a, b) => b.revenue - a.revenue);

    // Revenue by category (grouped by currency)
    const categoryMap = {};
    orders?.forEach(o => {
      const category = o.events?.category || 'Other';
      const currency = o.currency || o.events?.currency || getDefaultCurrency(o.events?.country_code || o.events?.country);
      
      if (!categoryMap[category]) {
        categoryMap[category] = { category, byCurrency: {} };
      }
      categoryMap[category].byCurrency[currency] = (categoryMap[category].byCurrency[currency] || 0) + parseFloat(o.platform_fee || 0);
    });
    const revenueByCategory = Object.values(categoryMap).sort((a, b) => {
      const totalA = Object.values(a.byCurrency).reduce((s, v) => s + v, 0);
      const totalB = Object.values(b.byCurrency).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });

    setPlatformStats({ revenueByCurrency, paidOutByCurrency, pendingByCurrency, revenueByMonth, revenueByCountry, revenueByCategory });
  };

  const toggleEventExpanded = (eventId) => { setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] })); };
  const openPaymentDialog = (type, recipient, event = null) => { setPaymentDialog({ open: true, type, recipient, event }); setTransactionRef(''); setPaymentNotes(''); };

  const processPayment = async () => {
    if (!paymentDialog.type || !paymentDialog.recipient) return;
    setProcessing(true);
    try {
      const { type, recipient, event } = paymentDialog;

      if (type === 'organizer') {
        await supabase.from('payouts').insert({
          organizer_id: event.organizers?.id, event_id: event.id, amount: event.totalSales,
          fee: event.platformFees, net_amount: event.organizerNet, currency: event.currency,
          status: 'completed', reference: transactionRef || `PAY-${Date.now().toString(36).toUpperCase()}`,
          processed_at: new Date().toISOString(), notes: paymentNotes
        });
        await supabase.from('events').update({ payout_status: 'paid' }).eq('id', event.id);
        await logAdminAction('organizer_payout', 'event', event.id, { amount: event.organizerNet, currency: event.currency });

      } else if (type === 'promoter') {
        await supabase.from('promoter_payouts').insert({
          promoter_id: recipient.promoter.id, event_id: event.id, amount: recipient.totalCommission,
          currency: event.currency, bank_name: recipient.promoter.promoter_bank_accounts?.[0]?.bank_name,
          account_number: recipient.promoter.promoter_bank_accounts?.[0]?.account_number,
          account_name: recipient.promoter.promoter_bank_accounts?.[0]?.account_name,
          status: 'completed', completed_at: new Date().toISOString(), transaction_reference: transactionRef, admin_notes: paymentNotes
        });
        await supabase.from('promoter_sales').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('event_id', event.id).eq('promoter_id', recipient.promoter.id);
        await logAdminAction('promoter_payout', 'promoter', recipient.promoter.id, { amount: recipient.totalCommission, currency: event.currency });

      } else if (type === 'affiliate') {
        const earningIds = recipient.earnings.filter(e => e.status === 'available' || e.status === 'pending').map(e => e.id);
        await supabase.from('referral_earnings').update({ status: 'paid', paid_at: new Date().toISOString(), transaction_reference: transactionRef }).in('id', earningIds);
        await logAdminAction('affiliate_payout', 'profile', recipient.affiliate.id, { amount: recipient.totalPending, currency: recipient.currency });
      }

      setPaymentDialog({ open: false, type: null, recipient: null, event: null });
      loadData();
    } catch (error) { console.error('Error processing payment:', error); alert('Failed to process payment.'); }
    finally { setProcessing(false); }
  };

  const payAllForEvent = async (event) => {
    if (!confirm(`Pay all pending amounts for "${event.title}"?`)) return;
    setProcessing(true);
    try {
      if (event.organizerNet > 0 && event.payout_status !== 'paid') {
        await supabase.from('payouts').insert({
          organizer_id: event.organizers?.id, event_id: event.id, amount: event.totalSales,
          fee: event.platformFees, net_amount: event.organizerNet, currency: event.currency,
          status: 'completed', reference: `PAY-${Date.now().toString(36).toUpperCase()}`, processed_at: new Date().toISOString()
        });
        await supabase.from('events').update({ payout_status: 'paid' }).eq('id', event.id);
      }
      for (const promo of event.promoterEarnings) {
        if (promo.isPaid) continue;
        await supabase.from('promoter_payouts').insert({
          promoter_id: promo.promoter.id, event_id: event.id, amount: promo.totalCommission, currency: event.currency,
          bank_name: promo.promoter.promoter_bank_accounts?.[0]?.bank_name,
          account_number: promo.promoter.promoter_bank_accounts?.[0]?.account_number,
          account_name: promo.promoter.promoter_bank_accounts?.[0]?.account_name,
          status: 'completed', completed_at: new Date().toISOString()
        });
        await supabase.from('promoter_sales').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('event_id', event.id).eq('promoter_id', promo.promoter.id);
      }
      await logAdminAction('bulk_payout', 'event', event.id);
      loadData();
    } catch (error) { console.error('Error:', error); alert('Failed to process payments.'); }
    finally { setProcessing(false); }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'organizer': return <Badge className="bg-blue-100 text-blue-800"><Building2 className="w-3 h-3 mr-1" />Organizer</Badge>;
      case 'promoter': return <Badge className="bg-purple-100 text-purple-800"><Users className="w-3 h-3 mr-1" />Promoter</Badge>;
      case 'affiliate': return <Badge className="bg-green-100 text-green-800"><Link2 className="w-3 h-3 mr-1" />Affiliate</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  // Get currency badge color (5 active currencies)
  const getCurrencyColor = (currency) => {
    const colors = {
      'NGN': 'bg-green-100 text-green-800',
      'GBP': 'bg-purple-100 text-purple-800',
      'USD': 'bg-blue-100 text-blue-800',
      'CAD': 'bg-red-100 text-red-800',
      'GHS': 'bg-yellow-100 text-yellow-800',
    };
    return colors[currency] || 'bg-gray-100 text-gray-800';
  };

  const filteredEvents = completedEvents.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return event.title?.toLowerCase().includes(query) || event.organizers?.business_name?.toLowerCase().includes(query);
  });

  const getCurrentTitle = () => {
    for (const group of financeNavItems) {
      const found = group.subItems.find(item => item.id === activeSection);
      if (found) return found.label;
    }
    return 'Finance';
  };

  // Currency filter dropdown
  const renderCurrencyFilter = () => (
    <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
      <SelectTrigger className="w-full md:w-40 rounded-xl">
        <Globe className="w-4 h-4 mr-2" />
        <SelectValue placeholder="Currency" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Currencies</SelectItem>
        {Object.entries(currencies).map(([code, curr]) => (
          <SelectItem key={code} value={code}>
            {curr.symbol} {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // ============ RENDER CONTENT SECTIONS ============

  const renderEventPayouts = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input placeholder="Search events or organizers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48 rounded-xl">
            <Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="pending">Pending Payout</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        {renderCurrencyFilter()}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">No completed events with pending payouts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map(event => (
            <Card key={event.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between hover:bg-[#F4F6FA]/50 transition-colors cursor-pointer"
                onClick={() => toggleEventExpanded(event.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-[#2969FF]" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-[#0F0F0F]">{event.title}</h3>
                    <p className="text-sm text-[#0F0F0F]/60">{event.organizers?.business_name} • {new Date(event.end_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className={getCurrencyColor(event.currency)}>{event.currency}</Badge>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#0F0F0F]">{formatPrice(event.totalSales, event.currency)}</p>
                    <p className="text-sm text-[#0F0F0F]/60">Total Sales</p>
                  </div>
                  {event.payout_status === 'paid' ? (
                    <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
                  )}
                  {expandedEvents[event.id] ? <ChevronUp className="w-5 h-5 text-[#0F0F0F]/40" /> : <ChevronDown className="w-5 h-5 text-[#0F0F0F]/40" />}
                </div>
              </div>

              {expandedEvents[event.id] && (
                <div className="px-4 pb-4 border-t border-[#0F0F0F]/10">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b border-[#0F0F0F]/10">
                    <div className="text-center p-3 bg-[#F4F6FA] rounded-xl">
                      <p className="text-lg font-bold text-[#0F0F0F]">{formatPrice(event.totalSales, event.currency)}</p>
                      <p className="text-xs text-[#0F0F0F]/60">Total Sales</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <p className="text-lg font-bold text-blue-600">{formatPrice(event.platformFees, event.currency)}</p>
                      <p className="text-xs text-[#0F0F0F]/60">Platform Fees</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-xl">
                      <p className="text-lg font-bold text-purple-600">{formatPrice(event.totalPromoterCommission, event.currency)}</p>
                      <p className="text-xs text-[#0F0F0F]/60">Promoter Commission</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <p className="text-lg font-bold text-green-600">{formatPrice(event.organizerNet, event.currency)}</p>
                      <p className="text-xs text-[#0F0F0F]/60">Organizer Net</p>
                    </div>
                  </div>

                  <div className="py-4 border-b border-[#0F0F0F]/10">
                    <h4 className="font-medium text-[#0F0F0F] mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />Organizer
                    </h4>
                    <div className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                      <div>
                        <p className="font-medium text-[#0F0F0F]">{event.organizers?.business_name}</p>
                        <p className="text-sm text-[#0F0F0F]/60">{event.organizers?.email}</p>
                        {event.primaryBankAccount && (
                          <p className="text-xs text-[#0F0F0F]/40 mt-1">
                            {event.primaryBankAccount.bank_name} - ****{event.primaryBankAccount.account_number_encrypted?.slice(-4)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-[#0F0F0F]">{formatPrice(event.organizerNet, event.currency)}</p>
                        {event.payout_status === 'paid' ? (
                          <Badge className="bg-green-100 text-green-800">Paid</Badge>
                        ) : (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); openPaymentDialog('organizer', event, event); }} className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-lg">
                            <Banknote className="w-4 h-4 mr-1" />Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {event.promoterEarnings.length > 0 && (
                    <div className="py-4">
                      <h4 className="font-medium text-[#0F0F0F] mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />Promoters ({event.promoterEarnings.length})
                      </h4>
                      <div className="space-y-2">
                        {event.promoterEarnings.map((promo, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-xl">
                            <div>
                              <p className="font-medium text-[#0F0F0F]">{promo.promoter?.full_name}</p>
                              <p className="text-sm text-[#0F0F0F]/60">{promo.promoter?.email}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-[#0F0F0F]">{formatPrice(promo.totalCommission, event.currency)}</p>
                              {promo.isPaid ? (
                                <Badge className="bg-green-100 text-green-800">Paid</Badge>
                              ) : (
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); openPaymentDialog('promoter', promo, event); }} className="bg-purple-600 hover:bg-purple-700 rounded-lg">
                                  <Banknote className="w-4 h-4 mr-1" />Pay
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {event.payout_status !== 'paid' && (
                    <div className="pt-4 border-t border-[#0F0F0F]/10">
                      <Button onClick={(e) => { e.stopPropagation(); payAllForEvent(event); }} disabled={processing} className="w-full bg-green-600 hover:bg-green-700 rounded-xl">
                        {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Mark All as Paid
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAffiliatePayouts = () => (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input placeholder="Search affiliates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48 rounded-xl">
            <Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending Payout</SelectItem>
            <SelectItem value="paid">Fully Paid</SelectItem>
          </SelectContent>
        </Select>
        {renderCurrencyFilter()}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : affiliatePayouts.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <Link2 className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">No affiliate payouts found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {affiliatePayouts.map((affiliate, idx) => (
            <Card key={idx} className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F0F0F]">{affiliate.affiliate?.first_name} {affiliate.affiliate?.last_name}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{affiliate.affiliate?.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-[#2969FF]">Code: {affiliate.affiliate?.referral_code}</p>
                        <Badge className={getCurrencyColor(affiliate.currency)}>{affiliate.currency}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-right">
                      <p className="text-sm text-[#0F0F0F]/60">Total Earned</p>
                      <p className="font-semibold text-[#0F0F0F]">{formatPrice(affiliate.totalEarned, affiliate.currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#0F0F0F]/60">Pending</p>
                      <p className="font-bold text-yellow-600">{formatPrice(affiliate.totalPending, affiliate.currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#0F0F0F]/60">Paid</p>
                      <p className="font-semibold text-green-600">{formatPrice(affiliate.totalPaid, affiliate.currency)}</p>
                    </div>
                    {affiliate.totalPending > 0 && (
                      <Button size="sm" onClick={() => openPaymentDialog('affiliate', affiliate)} className="bg-green-600 hover:bg-green-700 rounded-lg">
                        <Banknote className="w-4 h-4 mr-1" />Pay {formatPrice(affiliate.totalPending, affiliate.currency)}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderPayoutHistory = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        {renderCurrencyFilter()}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : payoutHistory.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">No payout history yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-0">
            <div className="divide-y divide-[#0F0F0F]/10">
              {payoutHistory.map((payout, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {getTypeBadge(payout.type)}
                    <div>
                      <p className="font-medium text-[#0F0F0F]">{payout.recipientName}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{payout.recipientEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Badge className={getCurrencyColor(payout.currency)}>{payout.currency || getDefaultCurrency(payout.country_code || payout.country)}</Badge>
                    <div className="text-right">
                      <p className="font-bold text-[#0F0F0F]">{formatPrice(payout.amount || payout.net_amount, payout.currency)}</p>
                      <p className="text-xs text-[#0F0F0F]/40">{payout.paidAt ? new Date(payout.paidAt).toLocaleDateString() : '-'}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderRevenueOverview = () => (
    <div className="space-y-6">
      {/* Revenue Summary Cards - By Currency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Platform Revenue</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(platformStats.revenueByCurrency || {}).length === 0 ? (
                <p className="text-[#0F0F0F]/40 text-sm">No revenue yet</p>
              ) : (
                Object.entries(platformStats.revenueByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <Badge className={getCurrencyColor(currency)}>{currency}</Badge>
                    <p className="text-lg font-bold text-[#0F0F0F]">{formatPrice(amount, currency)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Paid Out</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(platformStats.paidOutByCurrency || {}).length === 0 ? (
                <p className="text-[#0F0F0F]/40 text-sm">No payouts yet</p>
              ) : (
                Object.entries(platformStats.paidOutByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <Badge className={getCurrencyColor(currency)}>{currency}</Badge>
                    <p className="text-lg font-bold text-[#0F0F0F]">{formatPrice(amount, currency)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Pending Payouts</p>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(platformStats.pendingByCurrency || {}).length === 0 ? (
                <p className="text-[#0F0F0F]/40 text-sm">No pending payouts</p>
              ) : (
                Object.entries(platformStats.pendingByCurrency).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between">
                    <Badge className={getCurrencyColor(currency)}>{currency}</Badge>
                    <p className="text-lg font-bold text-[#0F0F0F]">{formatPrice(amount, currency)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Monthly Revenue (Last 6 Months)</CardTitle>
          <CardDescription>Platform fees collected by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-56 gap-4">
            {platformStats.revenueByMonth.map((month, idx) => {
              const maxTotal = Math.max(...platformStats.revenueByMonth.map(m => m.total), 1);
              const height = (month.total / maxTotal) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-[#F4F6FA] rounded-t-lg relative" style={{ height: '180px' }}>
                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-[#2969FF] to-[#2969FF]/70 rounded-t-lg transition-all" 
                         style={{ height: `${Math.max(height, 5)}%` }} />
                  </div>
                  <p className="text-xs font-medium text-[#0F0F0F]">{month.month}</p>
                  <div className="text-center">
                    {Object.entries(month.byCurrency || {}).slice(0, 2).map(([curr, amt]) => (
                      <p key={curr} className="text-xs text-[#0F0F0F]/60">{formatPrice(amt, curr)}</p>
                    ))}
                    {Object.keys(month.byCurrency || {}).length > 2 && (
                      <p className="text-xs text-[#0F0F0F]/40">+{Object.keys(month.byCurrency).length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRevenueByCountry = () => (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />Revenue by Country</CardTitle>
            <CardDescription>Each country shown in its local currency</CardDescription>
          </CardHeader>
          <CardContent>
            {platformStats.revenueByCountry.length === 0 ? (
              <p className="text-center text-[#0F0F0F]/60 py-8">No data available</p>
            ) : (
              <div className="space-y-3">
                {platformStats.revenueByCountry.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl hover:bg-[#F4F6FA]/70 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {item.country === 'NG' && '🇳🇬'}
                        {item.country === 'GB' && '🇬🇧'}
                        {item.country === 'US' && '🇺🇸'}
                        {item.country === 'CA' && '🇨🇦'}
                        {item.country === 'GH' && '🇬🇭'}
                        {!['NG', 'GB', 'US', 'CA', 'GH'].includes(item.country) && '🌍'}
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F0F0F]">{item.countryName}</p>
                        <Badge className={getCurrencyColor(item.currency)}>{item.currency}</Badge>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-[#0F0F0F]">{formatPrice(item.revenue, item.currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderRevenueByCategory = () => (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="w-5 h-5" />Revenue by Category</CardTitle>
            <CardDescription>Breakdown by event category with currency details</CardDescription>
          </CardHeader>
          <CardContent>
            {platformStats.revenueByCategory.length === 0 ? (
              <p className="text-center text-[#0F0F0F]/60 py-8">No data available</p>
            ) : (
              <div className="space-y-4">
                {platformStats.revenueByCategory.map((item, idx) => (
                  <div key={idx} className="p-4 bg-[#F4F6FA] rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-[#0F0F0F] text-lg">{item.category}</p>
                      <p className="text-sm text-[#0F0F0F]/60">
                        {Object.keys(item.byCurrency).length} {Object.keys(item.byCurrency).length === 1 ? 'currency' : 'currencies'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      {Object.entries(item.byCurrency).map(([currency, amount]) => (
                        <div key={currency} className="bg-white rounded-lg p-2 text-center shadow-sm">
                          <Badge className={`${getCurrencyColor(currency)} mb-1`}>{currency}</Badge>
                          <p className="font-bold text-[#0F0F0F]">{formatPrice(amount, currency)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4">
      <Card className="border-yellow-200 bg-yellow-50 rounded-2xl">
        <CardContent className="p-6 text-center">
          <FileText className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="font-semibold text-[#0F0F0F] mb-2">Coming Soon</h3>
          <p className="text-sm text-[#0F0F0F]/60">Financial reports and export features are under development.</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Platform Fee Settings</CardTitle>
          <CardDescription>Configure platform fees by country</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#0F0F0F]/60">Fee settings are managed in Admin Settings → Countries</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.location.href = '/admin/settings'}>
            <Settings className="w-4 h-4 mr-2" />Go to Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'event-payouts': return renderEventPayouts();
      case 'affiliate-payouts': return renderAffiliatePayouts();
      case 'payout-history': return renderPayoutHistory();
      case 'revenue-overview': return renderRevenueOverview();
      case 'revenue-country': return renderRevenueByCountry();
      case 'revenue-category': return renderRevenueByCategory();
      case 'financial-summary':
      case 'tax-reports':
      case 'export-data': return renderReports();
      case 'platform-fees':
      case 'payout-rules': return renderSettings();
      default: return renderEventPayouts();
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#0F0F0F]/10 bg-white overflow-y-auto">
        <div className="p-4 border-b border-[#0F0F0F]/10">
          <h2 className="text-lg font-bold text-[#0F0F0F] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#2969FF]" />
            Finance
          </h2>
        </div>
        <nav className="p-2">
          {financeNavItems.map((group) => (
            <div key={group.id} className="mb-1">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-[#0F0F0F] hover:bg-[#F4F6FA] rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <group.icon className="w-4 h-4 text-[#0F0F0F]/60" />
                  {group.label}
                </div>
                <ChevronRight className={`w-4 h-4 text-[#0F0F0F]/40 transition-transform ${expandedGroups[group.id] ? 'rotate-90' : ''}`} />
              </button>
              
              {expandedGroups[group.id] && (
                <div className="ml-4 mt-1 space-y-1">
                  {group.subItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-[#2969FF] text-white'
                          : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#0F0F0F]">{getCurrentTitle()}</h1>
              <p className="text-sm text-[#0F0F0F]/60">Manage your financial operations</p>
            </div>
            <Button onClick={loadData} variant="outline" className="rounded-xl">
              <RefreshCw className="w-4 h-4 mr-2" />Refresh
            </Button>
          </div>

          {renderContent()}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, type: null, recipient: null, event: null })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>Record payment to {paymentDialog.type}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-[#F4F6FA] rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#0F0F0F]/60">Recipient</p>
                  <p className="font-medium text-[#0F0F0F]">
                    {paymentDialog.type === 'organizer' && paymentDialog.event?.organizers?.business_name}
                    {paymentDialog.type === 'promoter' && paymentDialog.recipient?.promoter?.full_name}
                    {paymentDialog.type === 'affiliate' && `${paymentDialog.recipient?.affiliate?.first_name} ${paymentDialog.recipient?.affiliate?.last_name}`}
                  </p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Amount</p>
                  <p className="font-bold text-[#0F0F0F]">
                    {paymentDialog.type === 'organizer' && formatPrice(paymentDialog.event?.organizerNet, paymentDialog.event?.currency)}
                    {paymentDialog.type === 'promoter' && formatPrice(paymentDialog.recipient?.totalCommission, paymentDialog.event?.currency)}
                    {paymentDialog.type === 'affiliate' && formatPrice(paymentDialog.recipient?.totalPending, paymentDialog.recipient?.currency)}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Transaction Reference (optional)</Label>
              <Input placeholder="e.g., Bank transfer reference" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Add any notes..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="rounded-xl" rows={2} />
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-800">Make sure you have transferred the funds before marking as paid.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, type: null, recipient: null, event: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={processPayment} disabled={processing} className="bg-green-600 hover:bg-green-700 rounded-xl">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
