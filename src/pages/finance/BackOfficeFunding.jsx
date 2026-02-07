import { useState, useEffect } from 'react';
import { 
  Building2, CheckCircle, Clock, Loader2, Search, RefreshCw,
  Banknote, Shield, AlertCircle, Star, History, ChevronDown, ChevronUp,
  CreditCard, DollarSign, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact, getDefaultCurrency, getCurrencySymbol } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function BackOfficeFunding() {
  const { logFinanceAction, financeUser } = useFinance();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [advanceHistory, setAdvanceHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrganizers, setExpandedOrganizers] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Advance payment dialog
  const [advanceDialog, setAdvanceDialog] = useState({ open: false, organizer: null });
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Trust dialog
  const [trustDialog, setTrustDialog] = useState({ open: false, organizer: null, action: 'trust' });

  useEffect(() => {
    loadData();
    logFinanceAction('view_backoffice_funding');
  }, [activeTab, refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOrganizers(),
        loadAdvanceHistory()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizers = async () => {
    // Get all organizers with their events and earnings
    const { data: orgs, error } = await supabase.from('organizers').select(`
      id, business_name, email, phone, is_trusted, trusted_at, user_id,
      events (
        id, title, start_date, end_date, currency, payout_status,
        orders (id, total_amount, platform_fee, status)
      )
    `).order('business_name');

    if (error) throw error;

    // Fetch decrypted bank accounts separately
    const organizerIds = orgs?.map(o => o.id).filter(Boolean) || [];
    const { data: bankAccounts } = await supabase
      .from('bank_accounts_decrypted')
      .select('*')
      .in('organizer_id', organizerIds);

    // Map bank accounts to organizers
    orgs?.forEach(org => {
      org.bank_accounts = bankAccounts?.filter(ba => ba.organizer_id === org.id) || [];
    });

    // Get all advance payments
    const { data: advances } = await supabase.from('advance_payments')
      .select('*')
      .eq('recipient_type', 'organizer')
      .eq('status', 'paid');

    // Calculate balances for each organizer
    const organizersWithBalances = (orgs || []).map(org => {
      let totalEarnings = 0;
      let pendingEarnings = 0;
      let paidOut = 0;
      const activeEvents = [];
      const completedUnpaidEvents = [];
      const now = new Date();

      org.events?.forEach(event => {
        const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
        const eventTotal = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        const platformFees = completedOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0);
        const netEarnings = eventTotal - platformFees;

        if (netEarnings <= 0) return;

        totalEarnings += netEarnings;
        const eventEnded = new Date(event.end_date) < now;
        
        if (eventEnded) {
          if (event.payout_status === 'paid') {
            paidOut += netEarnings;
          } else {
            pendingEarnings += netEarnings;
            completedUnpaidEvents.push({ ...event, netEarnings, totalSales: eventTotal, platformFees });
          }
        } else {
          // Active/upcoming event with sales - can get advance on this
          pendingEarnings += netEarnings;
          activeEvents.push({ ...event, netEarnings, totalSales: eventTotal, platformFees });
        }
      });

      // Calculate advances already paid
      const orgAdvances = advances?.filter(a => a.organizer_id === org.id) || [];
      const totalAdvancesPaid = orgAdvances.reduce((sum, a) => sum + parseFloat(a.advance_amount || 0), 0);
      
      // Available = pending earnings - advances already paid
      const availableForAdvance = Math.max(0, pendingEarnings - totalAdvancesPaid);

      const primaryBank = org.bank_accounts?.find(b => b.is_default) || org.bank_accounts?.[0];

      return {
        ...org,
        totalEarnings,
        pendingEarnings,
        paidOut,
        activeEvents,
        completedUnpaidEvents,
        primaryBank,
        currency: org.events?.[0]?.currency || getDefaultCurrency(org.events?.[0]?.country_code || org.events?.[0]?.country),
        totalAdvancesPaid,
        availableForAdvance,
        advanceHistory: orgAdvances
      };
    });

    // Filter based on tab
    let filtered = organizersWithBalances;
    if (activeTab === 'trusted') {
      filtered = organizersWithBalances.filter(o => o.is_trusted);
    } else if (activeTab === 'all') {
      // Show all organizers with any earnings (pending or active)
      filtered = organizersWithBalances.filter(o => o.pendingEarnings > 0 || o.totalEarnings > 0);
    }

    // Sort: trusted first, then by available balance
    filtered.sort((a, b) => {
      if (a.is_trusted && !b.is_trusted) return -1;
      if (!a.is_trusted && b.is_trusted) return 1;
      return b.availableForAdvance - a.availableForAdvance;
    });

    setOrganizers(filtered);
  };

  const loadAdvanceHistory = async () => {
    const { data, error } = await supabase.from('advance_payments')
      .select(`
        *,
        organizers (id, business_name, email),
        events (id, title)
      `)
      .eq('recipient_type', 'organizer')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    setAdvanceHistory(data || []);
  };

  const toggleOrganizerExpanded = (id) => {
    setExpandedOrganizers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTrustOrganizer = async () => {
    if (!trustDialog.organizer) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isTrusting = trustDialog.action === 'trust';

      const { error } = await supabase.from('organizers').update({
        is_trusted: isTrusting,
        trusted_at: isTrusting ? new Date().toISOString() : null,
        trusted_by: isTrusting ? user.id : null
      }).eq('id', trustDialog.organizer.id);

      if (error) throw error;

      await logFinanceAction(
        isTrusting ? 'trust_organizer' : 'untrust_organizer', 
        'organizer', 
        trustDialog.organizer.id,
        { business_name: trustDialog.organizer.business_name }
      );

      setTrustDialog({ open: false, organizer: null, action: 'trust' });
      
      // Force refresh
      setRefreshKey(prev => prev + 1);
      
      alert(isTrusting ? '✅ Organizer marked as trusted!' : '✅ Trust status removed.');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update trust status: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const openAdvanceDialog = (organizer) => {
    if (!organizer.is_trusted) {
      alert('⚠️ Please mark this organizer as trusted first before paying an advance.');
      return;
    }
    if (organizer.availableForAdvance <= 0) {
      alert('⚠️ This organizer has no available balance for advance payment.');
      return;
    }
    if (!organizer.primaryBank) {
      alert('⚠️ This organizer has not added bank account details.');
      return;
    }
    setAdvanceDialog({ open: true, organizer });
    setAdvanceAmount('');
    setTransactionRef('');
    setPaymentNotes('');
  };

  const processAdvancePayment = async () => {
    if (!advanceDialog.organizer || !advanceAmount) return;
    
    const amount = parseFloat(advanceAmount);
    const available = advanceDialog.organizer.availableForAdvance;
    
    if (amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    
    if (amount > available) {
      alert(`Amount exceeds available balance of ${formatPrice(available, advanceDialog.organizer.currency)}`);
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Create advance payment record
      const { error } = await supabase.from('advance_payments').insert({
        recipient_type: 'organizer',
        organizer_id: advanceDialog.organizer.id,
        available_balance: available,
        advance_amount: amount,
        currency: advanceDialog.organizer.currency,
        status: 'paid',
        transaction_reference: transactionRef || null,
        payment_notes: paymentNotes || null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        paid_by: user.id,
        paid_at: new Date().toISOString(),
        created_by: user.id
      });

      if (error) throw error;

      await logFinanceAction('advance_payment', 'organizer', advanceDialog.organizer.id, {
        amount,
        available_balance: available,
        business_name: advanceDialog.organizer.business_name,
        reference: transactionRef
      });

      setAdvanceDialog({ open: false, organizer: null });
      setRefreshKey(prev => prev + 1);
      
      alert(`✅ Advance payment of ${formatPrice(amount, advanceDialog.organizer.currency)} processed successfully!`);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to process advance payment: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredOrganizers = organizers.filter(org => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return org.business_name?.toLowerCase().includes(query) || 
           org.email?.toLowerCase().includes(query);
  });

  // Stats - group by currency
  const totalTrusted = organizers.filter(o => o.is_trusted).length;
  const availableBalanceByCurrency = {};
  organizers.forEach(o => {
    const currency = o.currency || 'USD';
    availableBalanceByCurrency[currency] = (availableBalanceByCurrency[currency] || 0) + o.availableForAdvance;
  });
  const advancesPaidByCurrency = {};
  advanceHistory
    .filter(a => a.status === 'paid')
    .forEach(a => {
      const currency = a.currency || 'USD';
      advancesPaidByCurrency[currency] = (advancesPaidByCurrency[currency] || 0) + parseFloat(a.advance_amount || 0);
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Back Office Funding</h1>
          <p className="text-[#0F0F0F]/60">Advance payments to trusted organizers</p>
        </div>
        <Button onClick={() => setRefreshKey(prev => prev + 1)} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* How it works */}
      <Card className="border-blue-200 bg-blue-50 rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-800 mb-2">📋 How Back Office Funding Works</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Find organizer with pending balance → Click to expand</li>
            <li>Click <strong>"Mark as Trusted"</strong> if they qualify for advances</li>
            <li>Click <strong>"Pay Advance"</strong> to pay a portion of their balance</li>
            <li>At event end: Final payout = Total Earnings - Advances Paid</li>
          </ol>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Trusted Organizers</p>
                <p className="font-bold text-[#0F0F0F]">{totalTrusted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Available Balance</p>
                <p className="font-bold text-[#0F0F0F]">{formatMultiCurrencyCompact(availableBalanceByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Advances Paid</p>
                <p className="font-bold text-green-600">{formatMultiCurrencyCompact(advancesPaidByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#F4F6FA] rounded-xl p-1">
          <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white">
            <Building2 className="w-4 h-4 mr-2" />All Organizers
          </TabsTrigger>
          <TabsTrigger value="trusted" className="rounded-lg data-[state=active]:bg-white">
            <Star className="w-4 h-4 mr-2" />Trusted Only
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white">
            <History className="w-4 h-4 mr-2" />Advance History
          </TabsTrigger>
        </TabsList>

        {/* Search (for organizer tabs) */}
        {activeTab !== 'history' && (
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
            <Input placeholder="Search organizers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
          </div>
        )}

        {/* All Organizers Tab */}
        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
          ) : filteredOrganizers.length === 0 ? (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-8 text-center">
                <Building2 className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <p className="text-[#0F0F0F]/60">No organizers with earnings found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrganizers.map(org => (
                <OrganizerCard 
                  key={org.id} 
                  organizer={org}
                  expanded={expandedOrganizers[org.id]}
                  onToggleExpand={() => toggleOrganizerExpanded(org.id)}
                  onAdvance={() => openAdvanceDialog(org)}
                  onTrustToggle={() => setTrustDialog({ open: true, organizer: org, action: org.is_trusted ? 'untrust' : 'trust' })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trusted Organizers Tab */}
        <TabsContent value="trusted" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
          ) : filteredOrganizers.length === 0 ? (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-8 text-center">
                <Star className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <p className="text-[#0F0F0F]/60">No trusted organizers yet</p>
                <p className="text-sm text-[#0F0F0F]/40 mt-2">Go to "All Organizers" tab and mark organizers as trusted</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrganizers.map(org => (
                <OrganizerCard 
                  key={org.id} 
                  organizer={org}
                  expanded={expandedOrganizers[org.id]}
                  onToggleExpand={() => toggleOrganizerExpanded(org.id)}
                  onAdvance={() => openAdvanceDialog(org)}
                  onTrustToggle={() => setTrustDialog({ open: true, organizer: org, action: org.is_trusted ? 'untrust' : 'trust' })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
          ) : advanceHistory.length === 0 ? (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-8 text-center">
                <History className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
                <p className="text-[#0F0F0F]/60">No advance payments yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardContent className="p-0">
                <div className="divide-y divide-[#0F0F0F]/10">
                  {advanceHistory.map((advance) => (
                    <div key={advance.id} className="p-4 flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <Banknote className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-[#0F0F0F]">{advance.organizers?.business_name}</p>
                          <p className="text-sm text-[#0F0F0F]/60">{advance.organizers?.email}</p>
                          <p className="text-xs text-[#0F0F0F]/40">{new Date(advance.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatPrice(advance.advance_amount, advance.currency)}</p>
                          <p className="text-xs text-[#0F0F0F]/40">of {formatPrice(advance.available_balance, advance.currency)} available</p>
                        </div>
                        <Badge className={advance.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {advance.status === 'paid' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                          {advance.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Trust Dialog */}
      <Dialog open={trustDialog.open} onOpenChange={(open) => !open && setTrustDialog({ open: false, organizer: null, action: 'trust' })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {trustDialog.action === 'trust' ? '⭐ Mark as Trusted' : '🚫 Remove Trust Status'}
            </DialogTitle>
            <DialogDescription>
              {trustDialog.action === 'trust' 
                ? 'Trusted organizers can receive advance payments before event completion.'
                : 'This organizer will no longer be eligible for advance payments.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-[#F4F6FA] rounded-xl">
              <p className="font-semibold text-[#0F0F0F]">{trustDialog.organizer?.business_name}</p>
              <p className="text-sm text-[#0F0F0F]/60">{trustDialog.organizer?.email}</p>
              <div className="mt-2 text-sm">
                <p className="text-[#0F0F0F]/60">Available Balance: <span className="font-medium text-green-600">{formatPrice(trustDialog.organizer?.availableForAdvance || 0, trustDialog.organizer?.currency)}</span></p>
              </div>
            </div>
            {trustDialog.action === 'trust' && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800">⚠️ Only mark organizers as trusted if you have verified their reliability and they have a history of successful events.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrustDialog({ open: false, organizer: null, action: 'trust' })} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={handleTrustOrganizer} 
              disabled={processing}
              className={trustDialog.action === 'trust' ? 'bg-yellow-500 hover:bg-yellow-600 rounded-xl' : 'bg-red-600 hover:bg-red-700 rounded-xl'}
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
              {trustDialog.action === 'trust' ? 'Mark as Trusted' : 'Remove Trust'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Payment Dialog */}
      <Dialog open={advanceDialog.open} onOpenChange={(open) => !open && setAdvanceDialog({ open: false, organizer: null })}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>💰 Process Advance Payment</DialogTitle>
            <DialogDescription>Pay organizer before event completion</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Organizer Info */}
            <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#0F0F0F]">{advanceDialog.organizer?.business_name}</p>
                  <p className="text-sm text-[#0F0F0F]/60">{advanceDialog.organizer?.email}</p>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800"><Star className="w-3 h-3 mr-1" />Trusted</Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-3 border-t border-[#0F0F0F]/10 pt-3">
                <div className="text-center">
                  <p className="text-xs text-[#0F0F0F]/60">Total Pending</p>
                  <p className="font-medium text-[#0F0F0F]">{formatPrice(advanceDialog.organizer?.pendingEarnings, advanceDialog.organizer?.currency)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[#0F0F0F]/60">Already Advanced</p>
                  <p className="font-medium text-purple-600">{formatPrice(advanceDialog.organizer?.totalAdvancesPaid, advanceDialog.organizer?.currency)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[#0F0F0F]/60">Available</p>
                  <p className="font-bold text-green-600">{formatPrice(advanceDialog.organizer?.availableForAdvance, advanceDialog.organizer?.currency)}</p>
                </div>
              </div>

              {/* Bank Details */}
              {advanceDialog.organizer?.primaryBank && (
                <div className="border-t border-[#0F0F0F]/10 pt-3">
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">💳 Bank Details</p>
                  <div className="text-sm space-y-1 bg-white p-2 rounded-lg">
                    <p><span className="text-[#0F0F0F]/60">Bank:</span> <span className="font-medium">{advanceDialog.organizer.primaryBank.bank_name}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Account:</span> <span className="font-mono font-medium">{advanceDialog.organizer.primaryBank.account_number}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Name:</span> <span className="font-medium">{advanceDialog.organizer.primaryBank.account_name}</span></p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Advance Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/60 font-medium">{getCurrencySymbol(advanceDialog.organizer?.currency)}</span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="pl-8 rounded-xl text-lg font-semibold"
                />
              </div>
              <p className="text-xs text-[#0F0F0F]/60">
                Maximum: {formatPrice(advanceDialog.organizer?.availableForAdvance, advanceDialog.organizer?.currency)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Transaction Reference (optional)</Label>
              <Input placeholder="e.g., Bank transfer reference" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Reason for advance, etc." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="rounded-xl" rows={2} />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-800">⚠️ Make sure you have transferred the funds before confirming. This advance will be deducted from the final payout when the event ends.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceDialog({ open: false, organizer: null })} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={processAdvancePayment} 
              disabled={processing || !advanceAmount || parseFloat(advanceAmount) <= 0}
              className="bg-green-600 hover:bg-green-700 rounded-xl"
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Organizer Card Component
function OrganizerCard({ organizer, expanded, onToggleExpand, onAdvance, onTrustToggle }) {
  return (
    <Card className={`border-[#0F0F0F]/10 rounded-2xl overflow-hidden ${organizer.is_trusted ? 'border-yellow-300 bg-yellow-50/30' : ''}`}>
      <div 
        className="p-4 flex items-center justify-between hover:bg-[#F4F6FA]/50 transition-colors cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${organizer.is_trusted ? 'bg-yellow-100' : 'bg-blue-100'}`}>
            {organizer.is_trusted ? <Star className="w-6 h-6 text-yellow-600" /> : <Building2 className="w-6 h-6 text-blue-600" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#0F0F0F]">{organizer.business_name}</h3>
              {organizer.is_trusted && (
                <Badge className="bg-yellow-100 text-yellow-800 text-xs"><Star className="w-3 h-3 mr-1" />Trusted</Badge>
              )}
            </div>
            <p className="text-sm text-[#0F0F0F]/60">{organizer.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">{formatPrice(organizer.availableForAdvance, organizer.currency)}</p>
            <p className="text-xs text-[#0F0F0F]/60">Available for Advance</p>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-[#0F0F0F]/40" /> : <ChevronDown className="w-5 h-5 text-[#0F0F0F]/40" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#0F0F0F]/10 space-y-4">
          {/* Balance Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <div className="p-3 bg-[#F4F6FA] rounded-xl text-center">
              <p className="text-lg font-bold text-[#0F0F0F]">{formatPrice(organizer.totalEarnings, organizer.currency)}</p>
              <p className="text-xs text-[#0F0F0F]/60">Total Earnings</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-xl text-center">
              <p className="text-lg font-bold text-yellow-600">{formatPrice(organizer.pendingEarnings, organizer.currency)}</p>
              <p className="text-xs text-[#0F0F0F]/60">Pending</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl text-center">
              <p className="text-lg font-bold text-purple-600">{formatPrice(organizer.totalAdvancesPaid, organizer.currency)}</p>
              <p className="text-xs text-[#0F0F0F]/60">Advances Paid</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl text-center">
              <p className="text-lg font-bold text-green-600">{formatPrice(organizer.availableForAdvance, organizer.currency)}</p>
              <p className="text-xs text-[#0F0F0F]/60">Available</p>
            </div>
          </div>

          {/* Bank Account */}
          {organizer.primaryBank ? (
            <div className="p-3 bg-[#F4F6FA] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-[#2969FF]" />
                <p className="font-medium text-[#0F0F0F]">Bank Account</p>
                {organizer.primaryBank.is_verified && (
                  <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>
                )}
              </div>
              <div className="text-sm grid grid-cols-1 md:grid-cols-3 gap-2">
                <p><span className="text-[#0F0F0F]/60">Bank:</span> <span className="font-medium">{organizer.primaryBank.bank_name}</span></p>
                <p><span className="text-[#0F0F0F]/60">Account:</span> <span className="font-mono">{organizer.primaryBank.account_number}</span></p>
                <p><span className="text-[#0F0F0F]/60">Name:</span> <span className="font-medium">{organizer.primaryBank.account_name}</span></p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">No bank account added</p>
            </div>
          )}

          {/* Active Events */}
          {organizer.activeEvents.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[#0F0F0F] mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />Active Events ({organizer.activeEvents.length})
              </p>
              <div className="space-y-2">
                {organizer.activeEvents.map(event => (
                  <div key={event.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg text-sm">
                    <div>
                      <span className="text-[#0F0F0F] font-medium">{event.title}</span>
                      <span className="text-[#0F0F0F]/60 ml-2">ends {new Date(event.end_date).toLocaleDateString()}</span>
                    </div>
                    <span className="font-semibold text-blue-600">{formatPrice(event.netEarnings, event.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Unpaid Events */}
          {organizer.completedUnpaidEvents.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[#0F0F0F] mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />Completed Events (Unpaid)
              </p>
              <div className="space-y-2">
                {organizer.completedUnpaidEvents.map(event => (
                  <div key={event.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg text-sm">
                    <span className="text-[#0F0F0F]">{event.title}</span>
                    <span className="font-semibold text-yellow-600">{formatPrice(event.netEarnings, event.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous Advances */}
          {organizer.advanceHistory.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[#0F0F0F] mb-2 flex items-center gap-2">
                <History className="w-4 h-4" />Previous Advances ({organizer.advanceHistory.length})
              </p>
              <div className="space-y-2">
                {organizer.advanceHistory.map(advance => (
                  <div key={advance.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg text-sm">
                    <span className="text-[#0F0F0F]/60">{new Date(advance.created_at).toLocaleDateString()}</span>
                    <span className="font-semibold text-green-600">{formatPrice(advance.advance_amount, advance.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-[#0F0F0F]/10">
            <Button 
              variant="outline" 
              onClick={(e) => { e.stopPropagation(); onTrustToggle(); }}
              className={`rounded-xl flex-1 ${organizer.is_trusted ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-yellow-300 text-yellow-600 hover:bg-yellow-50'}`}
            >
              <Star className="w-4 h-4 mr-2" />
              {organizer.is_trusted ? 'Remove Trust' : 'Mark as Trusted'}
            </Button>
            
            <Button 
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
              disabled={!organizer.is_trusted || organizer.availableForAdvance <= 0 || !organizer.primaryBank}
              className="bg-green-600 hover:bg-green-700 rounded-xl flex-1 disabled:opacity-50"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Pay Advance
            </Button>
          </div>

          {/* Warning messages */}
          {!organizer.is_trusted && organizer.availableForAdvance > 0 && (
            <p className="text-xs text-yellow-600 text-center">⚠️ Mark as trusted first to enable advance payments</p>
          )}
          {organizer.is_trusted && organizer.availableForAdvance <= 0 && (
            <p className="text-xs text-orange-600 text-center">⚠️ No available balance for advance</p>
          )}
          {organizer.is_trusted && !organizer.primaryBank && (
            <p className="text-xs text-red-600 text-center">⚠️ Organizer needs to add bank account first</p>
          )}
        </div>
      )}
    </Card>
  );
}
