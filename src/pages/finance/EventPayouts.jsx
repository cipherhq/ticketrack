import { useState, useEffect } from 'react';
import { 
  Calendar, Building2, Users, CheckCircle, Clock, Loader2, 
  Search, Filter, ChevronDown, ChevronUp, Banknote, RefreshCw,
  CreditCard, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';
import { getMinimumPayout, getBelowThresholdMessage } from '@/config/payoutThresholds';

export function EventPayouts() {
  const { logFinanceAction, canProcessPayouts, reAuthenticate } = useFinance();
  const [loading, setLoading] = useState(true);
  const [completedEvents, setCompletedEvents] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [paymentDialog, setPaymentDialog] = useState({ open: false, type: null, recipient: null, event: null });
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthRequired, setReAuthRequired] = useState(false);
  const [reAuthError, setReAuthError] = useState('');

  useEffect(() => {
    loadEventPayouts();
    logFinanceAction('view_event_payouts');
  }, [statusFilter]);

  const loadEventPayouts = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      // Include both parent and child events - only show events that have ended
      // Fetch all related data in a SINGLE query to avoid N+1 queries
      const { data: events, error } = await supabase.from('events').select(`
        id, title, slug, start_date, end_date, currency, payout_status, organizer_id, parent_event_id,
        organizers (
          id, business_name, email, phone, kyc_status, kyc_verified
        ),
        orders (id, total_amount, status, platform_fee, event_id),
        promoter_sales (
          id, commission_amount, status,
          promoters ( id, full_name, email, promoter_bank_accounts (id, bank_name, account_number, account_name, is_verified) )
        )
      `).lt('end_date', now).order('end_date', { ascending: false });

      // Fetch decrypted bank accounts separately
      const organizerIds = [...new Set(events?.map(e => e.organizer_id).filter(Boolean))];
      const { data: bankAccounts } = await supabase
        .from('bank_accounts_decrypted')
        .select('*')
        .in('organizer_id', organizerIds);

      // Map bank accounts to organizers
      const bankAccountsByOrganizer = {};
      bankAccounts?.forEach(ba => {
        if (!bankAccountsByOrganizer[ba.organizer_id]) {
          bankAccountsByOrganizer[ba.organizer_id] = [];
        }
        bankAccountsByOrganizer[ba.organizer_id].push(ba);
      });

      // Attach bank accounts to events
      events?.forEach(event => {
        if (event.organizers) {
          event.organizers.bank_accounts = bankAccountsByOrganizer[event.organizer_id] || [];
        }
      });

      if (error) throw error;

      let filteredEvents = events || [];
      if (statusFilter === 'pending') filteredEvents = filteredEvents.filter(e => e.payout_status !== 'paid');
      else if (statusFilter === 'paid') filteredEvents = filteredEvents.filter(e => e.payout_status === 'paid');

      // Process events with already-fetched data (no more N+1 queries)
      const eventsWithPayouts = filteredEvents.map((event) => {
        const promoterSales = event.promoter_sales || [];

        const completedOrders = (event.orders || []).filter(o => o.status === 'completed');
        const totalSales = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
        const platformFees = completedOrders.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0);

        const promoterEarnings = {};
        promoterSales.forEach(sale => {
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

        // Get all bank accounts, sorted by is_default
        const bankAccounts = event.organizers?.bank_accounts?.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)) || [];
        const primaryBankAccount = bankAccounts.find(b => b.is_default) || bankAccounts[0];

        return {
          ...event, totalSales, platformFees, organizerNet,
          promoterEarnings: Object.values(promoterEarnings), totalPromoterCommission,
          bankAccounts,
          primaryBankAccount
        };
      });

      setCompletedEvents(eventsWithPayouts.filter(e => e.totalSales > 0));
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventExpanded = (eventId) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const openPaymentDialog = (type, recipient, event = null) => {
    if (!canProcessPayouts) {
      alert('You do not have permission to process payouts.');
      return;
    }
    setPaymentDialog({ open: true, type, recipient, event });
    setTransactionRef('');
    setPaymentNotes('');
    setReAuthRequired(true);
    setReAuthPassword('');
    setReAuthError('');
  };

  const handleReAuth = async () => {
    const result = await reAuthenticate(reAuthPassword);
    if (result.success) {
      setReAuthRequired(false);
      setReAuthError('');
    } else {
      setReAuthError(result.error || 'Invalid password');
    }
  };

  const processPayment = async () => {
    if (!paymentDialog.type || !paymentDialog.recipient) return;
    if (reAuthRequired) {
      setReAuthError('Please verify your password first');
      return;
    }

    setProcessing(true);
    try {
      const { type, recipient, event } = paymentDialog;

      if (type === 'organizer') {
        // Check if this event has already been paid (prevent duplicate payouts)
        const { data: existingPayout } = await supabase
          .from('payouts')
          .select('id, payout_number')
          .eq('notes', `Event: ${event.title} (${event.id})%`)
          .eq('status', 'completed')
          .limit(1);

        if (existingPayout && existingPayout.length > 0) {
          alert(`This event has already been paid out (${existingPayout[0].payout_number}). Refresh the page to see updated status.`);
          setProcessing(false);
          loadEventPayouts();
          return;
        }

        // Double-check event payout status from database
        const { data: currentEvent } = await supabase
          .from('events')
          .select('payout_status')
          .eq('id', event.id)
          .single();

        if (currentEvent?.payout_status === 'paid') {
          alert('This event has already been marked as paid. Refresh the page to see updated status.');
          setProcessing(false);
          loadEventPayouts();
          return;
        }

        // Validate payout amount
        if (!event.organizerNet || event.organizerNet <= 0) {
          alert('Invalid payout amount. The organizer net amount must be greater than zero.');
          setProcessing(false);
          return;
        }

        // Check minimum payout threshold based on currency
        const minPayout = getMinimumPayout(event.currency);
        if (event.organizerNet < minPayout) {
          alert(getBelowThresholdMessage(event.organizerNet, event.currency));
          setProcessing(false);
          return;
        }

        // Check if organizer has a bank account
        const bankAccountId = event.primaryBankAccount?.id;
        if (!bankAccountId) {
          alert('Organizer must have a bank account to process payout');
          setProcessing(false);
          return;
        }

        // Check KYC verification status
        const kycStatus = event.organizers?.kyc_status;
        const kycVerified = event.organizers?.kyc_verified;
        if (!kycVerified && kycStatus !== 'verified' && kycStatus !== 'approved') {
          alert('Cannot process payout: Organizer has not completed KYC verification. Please ask the organizer to complete their KYC verification first.');
          setProcessing(false);
          return;
        }

        // Generate payout number
        const payoutNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;

        // Insert payout record with 'processing' status initially
        const { data: payoutRecord, error: payoutError } = await supabase.from('payouts').insert({
          organizer_id: event.organizers?.id,
          bank_account_id: bankAccountId,
          payout_number: payoutNumber,
          amount: event.totalSales,
          platform_fee_deducted: event.platformFees,
          net_amount: event.organizerNet,
          currency: event.currency || 'NGN',
          status: 'processing',
          transaction_reference: transactionRef || null,
          processed_at: new Date().toISOString(),
          notes: `Event: ${event.title} (${event.id}). ${paymentNotes || ''}`
        }).select('id').single();
        if (payoutError) {
          console.error('Payout insert error:', payoutError);
          throw payoutError;
        }

        try {
          // Update event payout status
          const { error: eventError } = await supabase.from('events').update({ payout_status: 'paid' }).eq('id', event.id);
          if (eventError) {
            console.error('Event update error:', eventError);
            throw eventError;
          }

          // Deduct from organizer's available balance (if they have one)
          const { data: organizer } = await supabase
            .from('organizers')
            .select('available_balance')
            .eq('id', event.organizers?.id)
            .single();

          if (organizer && organizer.available_balance > 0) {
            const newBalance = Math.max(0, (organizer.available_balance || 0) - event.organizerNet);
            await supabase
              .from('organizers')
              .update({ available_balance: newBalance })
              .eq('id', event.organizers?.id);
          }

          // Mark payout as completed after all operations succeed
          await supabase.from('payouts').update({ status: 'completed' }).eq('id', payoutRecord.id);
        } catch (rollbackError) {
          // Rollback: delete payout record and reset event status on failure
          console.error('Payout operation failed, rolling back:', rollbackError);
          await supabase.from('payouts').delete().eq('id', payoutRecord.id);
          await supabase.from('events').update({ payout_status: 'pending' }).eq('id', event.id);
          throw rollbackError;
        }

        await logFinanceAction('organizer_payout', 'event', event.id, {
          amount: event.organizerNet,
          organizer: event.organizers?.business_name,
          bank: event.primaryBankAccount?.bank_name,
          reference: transactionRef
        });

      } else if (type === 'promoter') {
        await supabase.from('promoter_payouts').insert({
          promoter_id: recipient.promoter.id, event_id: event.id, amount: recipient.totalCommission,
          currency: event.currency, bank_name: recipient.promoter.promoter_bank_accounts?.[0]?.bank_name,
          account_number: recipient.promoter.promoter_bank_accounts?.[0]?.account_number,
          account_name: recipient.promoter.promoter_bank_accounts?.[0]?.account_name,
          status: 'completed', completed_at: new Date().toISOString(), transaction_reference: transactionRef, admin_notes: paymentNotes
        });
        await supabase.from('promoter_sales').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('event_id', event.id).eq('promoter_id', recipient.promoter.id);
        await logFinanceAction('promoter_payout', 'promoter', recipient.promoter.id, { 
          amount: recipient.totalCommission,
          promoter: recipient.promoter?.full_name,
          reference: transactionRef 
        });
      }

      setPaymentDialog({ open: false, type: null, recipient: null, event: null });
      loadEventPayouts();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment.');
    } finally {
      setProcessing(false);
    }
  };

  const payAllForEvent = async (event) => {
    if (!canProcessPayouts) {
      alert('You do not have permission to process payouts.');
      return;
    }
    if (!confirm(`Pay all pending amounts for "${event.title}"?\n\nOrganizer: ${formatPrice(event.organizerNet, event.currency)}\nPromoters: ${formatPrice(event.totalPromoterCommission, event.currency)}`)) return;
    
    setProcessing(true);
    try {
      if (event.organizerNet > 0 && event.payout_status !== 'paid') {
        // Check if organizer has a bank account
        const bankAccountId = event.primaryBankAccount?.id;
        if (!bankAccountId) {
          alert('Organizer must have a bank account to process payout');
          setProcessing(false);
          return;
        }

        // Check KYC verification status
        const kycStatus = event.organizers?.kyc_status;
        const kycVerified = event.organizers?.kyc_verified;
        if (!kycVerified && kycStatus !== 'verified' && kycStatus !== 'approved') {
          alert('Cannot process payout: Organizer has not completed KYC verification. Please ask the organizer to complete their KYC verification first.');
          setProcessing(false);
          return;
        }

        // Generate payout number
        const payoutNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;

        // Insert payout record with 'processing' status initially
        const { data: payoutRecord, error: payoutError } = await supabase.from('payouts').insert({
          organizer_id: event.organizers?.id,
          bank_account_id: bankAccountId,
          payout_number: payoutNumber,
          amount: event.totalSales,
          platform_fee_deducted: event.platformFees,
          net_amount: event.organizerNet,
          currency: event.currency || 'NGN',
          status: 'processing',
          transaction_reference: payoutNumber,
          processed_at: new Date().toISOString(),
          notes: `Event: ${event.title} (${event.id})`
        }).select('id').single();
        if (payoutError) {
          console.error('Payout insert error:', payoutError);
          throw payoutError;
        }

        try {
          // Update event status
          await supabase.from('events').update({ payout_status: 'paid' }).eq('id', event.id);

          // Deduct from organizer's available balance
          const { data: organizer } = await supabase
            .from('organizers')
            .select('available_balance')
            .eq('id', event.organizers?.id)
            .single();

          if (organizer && organizer.available_balance > 0) {
            const newBalance = Math.max(0, (organizer.available_balance || 0) - event.organizerNet);
            await supabase
              .from('organizers')
              .update({ available_balance: newBalance })
              .eq('id', event.organizers?.id);
          }

          // Mark payout as completed after all operations succeed
          await supabase.from('payouts').update({ status: 'completed' }).eq('id', payoutRecord.id);
        } catch (rollbackError) {
          // Rollback: delete payout record and reset event status on failure
          console.error('Bulk payout operation failed, rolling back:', rollbackError);
          await supabase.from('payouts').delete().eq('id', payoutRecord.id);
          await supabase.from('events').update({ payout_status: 'pending' }).eq('id', event.id);
          throw rollbackError;
        }
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
      await logFinanceAction('bulk_payout', 'event', event.id, { 
        totalAmount: event.organizerNet + event.totalPromoterCommission,
        eventTitle: event.title 
      });
      loadEventPayouts();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to process payments.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredEvents = completedEvents.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return event.title?.toLowerCase().includes(query) || event.organizers?.business_name?.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Event Payouts</h1>
          <p className="text-[#0F0F0F]/60">Process payouts for completed events</p>
        </div>
        <Button onClick={loadEventPayouts} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Filters */}
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
      </div>

      {/* Events List */}
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
                  {/* Summary */}
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

                  {/* Organizer Section */}
                  <div className="py-4 border-b border-[#0F0F0F]/10">
                    <h4 className="font-medium text-[#0F0F0F] mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />Organizer Details
                    </h4>
                    
                    <div className="bg-[#F4F6FA] rounded-xl p-4 space-y-4">
                      {/* Organizer Info */}
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <p className="font-semibold text-[#0F0F0F] text-lg">{event.organizers?.business_name}</p>
                          <p className="text-sm text-[#0F0F0F]/60">{event.organizers?.email}</p>
                          {event.organizers?.phone && (
                            <p className="text-sm text-[#0F0F0F]/60">{event.organizers?.phone}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[#0F0F0F]/60">Amount to Pay</p>
                          <p className="text-2xl font-bold text-green-600">{formatPrice(event.organizerNet, event.currency)}</p>
                        </div>
                      </div>

                      {/* Bank Account Details */}
                      <div className="border-t border-[#0F0F0F]/10 pt-4">
                        <h5 className="font-medium text-[#0F0F0F] mb-3 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-[#2969FF]" />
                          Bank Account Details
                        </h5>
                        
                        {event.bankAccounts && event.bankAccounts.length > 0 ? (
                          <div className="space-y-3">
                            {event.bankAccounts.map((bank, idx) => (
                              <div 
                                key={bank.id || idx} 
                                className={`p-3 rounded-lg border-2 ${bank.is_default ? 'border-[#2969FF] bg-white' : 'border-transparent bg-white/50'}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-[#0F0F0F]">{bank.bank_name}</p>
                                      {bank.is_default && (
                                        <Badge className="bg-[#2969FF] text-white text-xs">Primary</Badge>
                                      )}
                                      {bank.is_verified && (
                                        <Badge className="bg-green-100 text-green-800 text-xs">
                                          <CheckCircle className="w-3 h-3 mr-1" />Verified
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                      <div>
                                        <span className="text-[#0F0F0F]/60">Account Name: </span>
                                        <span className="font-medium text-[#0F0F0F]">{bank.account_name || 'N/A'}</span>
                                      </div>
                                      <div>
                                        <span className="text-[#0F0F0F]/60">Account Number: </span>
                                        <span className="font-mono font-medium text-[#0F0F0F]">{bank.account_number || 'N/A'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-red-800">No Bank Account Found</p>
                              <p className="text-sm text-red-600">This organizer has not added any bank account details yet.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Pay Button */}
                      <div className="pt-2">
                        {event.payout_status === 'paid' ? (
                          <Badge className="bg-green-100 text-green-800 py-2 px-4">
                            <CheckCircle className="w-4 h-4 mr-2" />Payout Completed
                          </Badge>
                        ) : (
                          <Button 
                            onClick={(e) => { e.stopPropagation(); openPaymentDialog('organizer', event, event); }} 
                            className="bg-[#2969FF] hover:bg-[#2969FF]/90 rounded-xl"
                            disabled={!event.bankAccounts || event.bankAccounts.length === 0}
                          >
                            <Banknote className="w-4 h-4 mr-2" />
                            Pay Organizer {formatPrice(event.organizerNet, event.currency)}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Promoters */}
                  {event.promoterEarnings.length > 0 && (
                    <div className="py-4">
                      <h4 className="font-medium text-[#0F0F0F] mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />Promoters ({event.promoterEarnings.length})
                      </h4>
                      <div className="space-y-2">
                        {event.promoterEarnings.map((promo, idx) => (
                          <div key={idx} className="p-4 bg-[#F4F6FA] rounded-xl">
                            <div className="flex items-start justify-between flex-wrap gap-4">
                              <div>
                                <p className="font-semibold text-[#0F0F0F]">{promo.promoter?.full_name}</p>
                                <p className="text-sm text-[#0F0F0F]/60">{promo.promoter?.email}</p>
                                {promo.promoter?.promoter_bank_accounts?.[0] && (
                                  <div className="mt-2 text-sm">
                                    <p className="text-[#0F0F0F]/60">
                                      {promo.promoter.promoter_bank_accounts[0].bank_name} - {promo.promoter.promoter_bank_accounts[0].account_number}
                                    </p>
                                    <p className="text-[#0F0F0F]/60">{promo.promoter.promoter_bank_accounts[0].account_name}</p>
                                  </div>
                                )}
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pay All */}
                  {event.payout_status !== 'paid' && (
                    <div className="pt-4 border-t border-[#0F0F0F]/10">
                      <Button 
                        onClick={(e) => { e.stopPropagation(); payAllForEvent(event); }} 
                        disabled={processing || (!event.bankAccounts || event.bankAccounts.length === 0)} 
                        className="w-full bg-green-600 hover:bg-green-700 rounded-xl"
                      >
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

      {/* Payment Dialog with Re-Auth */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, type: null, recipient: null, event: null })}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>Record payment to {paymentDialog.type}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Payment Info */}
            <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#0F0F0F]/60">Recipient</p>
                  <p className="font-medium text-[#0F0F0F]">
                    {paymentDialog.type === 'organizer' && paymentDialog.event?.organizers?.business_name}
                    {paymentDialog.type === 'promoter' && paymentDialog.recipient?.promoter?.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Amount</p>
                  <p className="font-bold text-green-600 text-lg">
                    {paymentDialog.type === 'organizer' && formatPrice(paymentDialog.event?.organizerNet, paymentDialog.event?.currency)}
                    {paymentDialog.type === 'promoter' && formatPrice(paymentDialog.recipient?.totalCommission, paymentDialog.event?.currency)}
                  </p>
                </div>
              </div>
              
              {/* Bank Details in Dialog */}
              {paymentDialog.type === 'organizer' && paymentDialog.event?.primaryBankAccount && (
                <div className="border-t border-[#0F0F0F]/10 pt-3">
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Bank Details</p>
                  <div className="text-sm space-y-1">
                    <p><span className="text-[#0F0F0F]/60">Bank:</span> <span className="font-medium">{paymentDialog.event.primaryBankAccount.bank_name}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Account:</span> <span className="font-mono font-medium">{paymentDialog.event.primaryBankAccount.account_number}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Name:</span> <span className="font-medium">{paymentDialog.event.primaryBankAccount.account_name}</span></p>
                  </div>
                </div>
              )}
              
              {paymentDialog.type === 'promoter' && paymentDialog.recipient?.promoter?.promoter_bank_accounts?.[0] && (
                <div className="border-t border-[#0F0F0F]/10 pt-3">
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Bank Details</p>
                  <div className="text-sm space-y-1">
                    <p><span className="text-[#0F0F0F]/60">Bank:</span> <span className="font-medium">{paymentDialog.recipient.promoter.promoter_bank_accounts[0].bank_name}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Account:</span> <span className="font-mono font-medium">{paymentDialog.recipient.promoter.promoter_bank_accounts[0].account_number}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Name:</span> <span className="font-medium">{paymentDialog.recipient.promoter.promoter_bank_accounts[0].account_name}</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* Re-Authentication */}
            {reAuthRequired && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                <p className="text-sm font-medium text-red-800">🔐 Security Verification Required</p>
                <div className="space-y-2">
                  <Label>Enter your password to continue</Label>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={reAuthPassword} 
                    onChange={(e) => setReAuthPassword(e.target.value)} 
                    className="rounded-xl"
                  />
                  {reAuthError && <p className="text-xs text-red-600">{reAuthError}</p>}
                </div>
                <Button onClick={handleReAuth} variant="outline" className="w-full rounded-xl">
                  Verify Password
                </Button>
              </div>
            )}

            {/* Transaction Details (shown after re-auth) */}
            {!reAuthRequired && (
              <>
                <div className="space-y-2">
                  <Label>Transaction Reference (optional)</Label>
                  <Input placeholder="e.g., Bank transfer reference" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea placeholder="Add any notes..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} className="rounded-xl" rows={2} />
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800">⚠️ Make sure you have transferred the funds before marking as paid.</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, type: null, recipient: null, event: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={processPayment} disabled={processing || reAuthRequired} className="bg-green-600 hover:bg-green-700 rounded-xl">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
