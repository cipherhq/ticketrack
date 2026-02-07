import { useState, useEffect } from 'react';
import { 
  Users, User, CheckCircle, Clock, Loader2, Search, Filter, 
  Banknote, RefreshCw, Calendar
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
import { formatPrice, formatMultiCurrencyCompact, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function PromoterPayouts() {
  const { logFinanceAction, canProcessPayouts } = useFinance();
  const [loading, setLoading] = useState(true);
  const [promoterPayouts, setPromoterPayouts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [paymentDialog, setPaymentDialog] = useState({ open: false, promoter: null });
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPromoterPayouts();
    logFinanceAction('view_promoter_payouts');
  }, [statusFilter]);

  const loadPromoterPayouts = async () => {
    setLoading(true);
    try {
      // Get all promoter sales from completed events
      const now = new Date().toISOString();
      const { data: sales, error } = await supabase.from('promoter_sales').select(`
        id, commission_amount, status, created_at, event_id, paid_at,
        promoters ( 
          id, full_name, email, phone,
          promoter_bank_accounts (id, bank_name, account_number, account_name, is_verified) 
        ),
        events ( id, title, end_date, currency )
      `).order('created_at', { ascending: false });

      if (error) throw error;

      // Filter to only completed events
      const completedSales = sales?.filter(s => s.events?.end_date && new Date(s.events.end_date) < new Date()) || [];

      // Group by promoter
      const promoterMap = {};
      completedSales.forEach(sale => {
        const promoterId = sale.promoters?.id;
        if (!promoterId) return;
        
        if (!promoterMap[promoterId]) {
          promoterMap[promoterId] = {
            promoter: sale.promoters,
            sales: [],
            totalEarned: 0,
            totalPending: 0,
            totalPaid: 0,
            pendingSales: [],
            currencies: new Set()
          };
        }
        
        promoterMap[promoterId].sales.push(sale);
        promoterMap[promoterId].totalEarned += parseFloat(sale.commission_amount || 0);
        promoterMap[promoterId].currencies.add(sale.events?.currency || getDefaultCurrency(sale.events?.country_code || sale.events?.country));
        
        if (sale.status === 'pending') {
          promoterMap[promoterId].totalPending += parseFloat(sale.commission_amount || 0);
          promoterMap[promoterId].pendingSales.push(sale);
        } else if (sale.status === 'paid') {
          promoterMap[promoterId].totalPaid += parseFloat(sale.commission_amount || 0);
        }
      });

      let promoters = Object.values(promoterMap);
      
      // Apply filter
      if (statusFilter === 'pending') {
        promoters = promoters.filter(p => p.totalPending > 0);
      } else if (statusFilter === 'paid') {
        promoters = promoters.filter(p => p.totalPaid > 0 && p.totalPending === 0);
      }

      // Sort by pending amount (highest first)
      promoters.sort((a, b) => b.totalPending - a.totalPending);

      setPromoterPayouts(promoters);
    } catch (error) {
      console.error('Error loading promoters:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentDialog = (promoter) => {
    if (!canProcessPayouts) {
      alert('You do not have permission to process payouts.');
      return;
    }
    setPaymentDialog({ open: true, promoter });
    setTransactionRef('');
    setPaymentNotes('');
  };

  const processPayment = async () => {
    if (!paymentDialog.promoter) return;
    setProcessing(true);
    try {
      const { promoter } = paymentDialog;
      const bankAccount = promoter.promoter?.promoter_bank_accounts?.[0];
      
      // Get the primary currency (most common)
      const currency = Array.from(promoter.currencies)[0] || getDefaultCurrency(promoter.sales[0]?.events?.country_code || promoter.sales[0]?.events?.country);

      // Create payout record
      await supabase.from('promoter_payouts').insert({
        promoter_id: promoter.promoter.id,
        amount: promoter.totalPending,
        currency: currency,
        bank_name: bankAccount?.bank_name,
        account_number: bankAccount?.account_number,
        account_name: bankAccount?.account_name,
        status: 'completed',
        completed_at: new Date().toISOString(),
        transaction_reference: transactionRef,
        admin_notes: paymentNotes
      });

      // Update all pending sales to paid
      const pendingSaleIds = promoter.pendingSales.map(s => s.id);
      await supabase.from('promoter_sales').update({ 
        status: 'paid', 
        paid_at: new Date().toISOString() 
      }).in('id', pendingSaleIds);

      await logFinanceAction('promoter_payout', 'promoter', promoter.promoter.id, {
        amount: promoter.totalPending,
        promoterName: promoter.promoter.full_name,
        salesCount: pendingSaleIds.length,
        reference: transactionRef
      });

      setPaymentDialog({ open: false, promoter: null });
      loadPromoterPayouts();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredPromoters = promoterPayouts.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return p.promoter?.full_name?.toLowerCase().includes(query) || 
           p.promoter?.email?.toLowerCase().includes(query);
  });

  // Calculate totals by currency
  const totalPendingByCurrency = {};
  const totalPaidByCurrency = {};
  promoterPayouts.forEach(p => {
    const currency = Array.from(p.currencies)[0] || 'USD';
    totalPendingByCurrency[currency] = (totalPendingByCurrency[currency] || 0) + p.totalPending;
    totalPaidByCurrency[currency] = (totalPaidByCurrency[currency] || 0) + p.totalPaid;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Promoter Payouts</h1>
          <p className="text-[#0F0F0F]/60">Process commission payouts for promoters</p>
        </div>
        <Button onClick={loadPromoterPayouts} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Promoters</p>
                <p className="font-bold text-[#0F0F0F]">{promoterPayouts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Pending</p>
                <p className="font-bold text-yellow-600">{formatMultiCurrencyCompact(totalPendingByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Paid</p>
                <p className="font-bold text-green-600">{formatMultiCurrencyCompact(totalPaidByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
          <Input placeholder="Search promoters..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48 rounded-xl">
            <Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Promoters</SelectItem>
            <SelectItem value="pending">Pending Payout</SelectItem>
            <SelectItem value="paid">Fully Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Promoters List */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : filteredPromoters.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">No promoter payouts found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPromoters.map((item, idx) => {
            const bankAccount = item.promoter?.promoter_bank_accounts?.[0];
            const currency = Array.from(item.currencies)[0] || getDefaultCurrency(item.sales[0]?.events?.country_code || item.sales[0]?.events?.country);
            
            return (
              <Card key={idx} className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Promoter Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F0F0F]">{item.promoter?.full_name}</p>
                        <p className="text-sm text-[#0F0F0F]/60">{item.promoter?.email}</p>
                        {item.promoter?.phone && (
                          <p className="text-sm text-[#0F0F0F]/60">{item.promoter?.phone}</p>
                        )}
                        
                        {/* Bank Details */}
                        {bankAccount ? (
                          <div className="mt-2 p-2 bg-[#F4F6FA] rounded-lg text-sm">
                            <p className="font-medium text-[#0F0F0F]">{bankAccount.bank_name}</p>
                            <p className="text-[#0F0F0F]/60">
                              {bankAccount.account_number} • {bankAccount.account_name}
                            </p>
                            {bankAccount.is_verified && (
                              <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                                <CheckCircle className="w-3 h-3 mr-1" />Verified
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-red-500 mt-2">⚠️ No bank account</p>
                        )}

                        {/* Events */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.pendingSales.slice(0, 3).map((sale, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              {sale.events?.title?.substring(0, 20)}...
                            </Badge>
                          ))}
                          {item.pendingSales.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.pendingSales.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats & Action */}
                    <div className="flex items-center gap-6 flex-wrap lg:flex-nowrap">
                      <div className="text-right">
                        <p className="text-sm text-[#0F0F0F]/60">Total Earned</p>
                        <p className="font-semibold text-[#0F0F0F]">{formatPrice(item.totalEarned, currency)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[#0F0F0F]/60">Pending</p>
                        <p className="font-bold text-yellow-600">{formatPrice(item.totalPending, currency)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-[#0F0F0F]/60">Paid</p>
                        <p className="font-semibold text-green-600">{formatPrice(item.totalPaid, currency)}</p>
                      </div>
                      
                      {item.totalPending > 0 ? (
                        <Button 
                          onClick={() => openPaymentDialog(item)} 
                          className="bg-purple-600 hover:bg-purple-700 rounded-xl"
                          disabled={!bankAccount}
                        >
                          <Banknote className="w-4 h-4 mr-2" />
                          Pay {formatPrice(item.totalPending, currency)}
                        </Button>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 py-2 px-3">
                          <CheckCircle className="w-3 h-3 mr-1" />Fully Paid
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, promoter: null })}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Promoter Payment</DialogTitle>
            <DialogDescription>Record commission payment to promoter</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Payment Info */}
            <div className="p-4 bg-[#F4F6FA] rounded-xl space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-[#0F0F0F]">{paymentDialog.promoter?.promoter?.full_name}</p>
                  <p className="text-sm text-[#0F0F0F]/60">{paymentDialog.promoter?.promoter?.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-[#0F0F0F]/10 pt-3">
                <div>
                  <p className="text-[#0F0F0F]/60">Events</p>
                  <p className="font-medium text-[#0F0F0F]">{paymentDialog.promoter?.pendingSales?.length || 0} events</p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Amount</p>
                  <p className="font-bold text-green-600 text-lg">
                    {formatPrice(paymentDialog.promoter?.totalPending, Array.from(paymentDialog.promoter?.currencies || ['USD'])[0])}
                  </p>
                </div>
              </div>

              {/* Bank Details */}
              {paymentDialog.promoter?.promoter?.promoter_bank_accounts?.[0] && (
                <div className="border-t border-[#0F0F0F]/10 pt-3">
                  <p className="text-xs text-[#0F0F0F]/60 mb-2">Bank Details</p>
                  <div className="text-sm space-y-1">
                    <p><span className="text-[#0F0F0F]/60">Bank:</span> <span className="font-medium">{paymentDialog.promoter.promoter.promoter_bank_accounts[0].bank_name}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Account:</span> <span className="font-mono font-medium">{paymentDialog.promoter.promoter.promoter_bank_accounts[0].account_number}</span></p>
                    <p><span className="text-[#0F0F0F]/60">Name:</span> <span className="font-medium">{paymentDialog.promoter.promoter.promoter_bank_accounts[0].account_name}</span></p>
                  </div>
                </div>
              )}
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
              <p className="text-sm text-blue-800">⚠️ Make sure you have transferred the funds before marking as paid.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, promoter: null })} className="rounded-xl">Cancel</Button>
            <Button onClick={processPayment} disabled={processing} className="bg-purple-600 hover:bg-purple-700 rounded-xl">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
