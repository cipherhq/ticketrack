import { useState, useEffect } from 'react';
import { 
  Link2, User, CheckCircle, Clock, Loader2, Search, Filter, 
  Banknote, RefreshCw
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
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function AffiliatePayouts() {
  const { logFinanceAction, canProcessPayouts } = useFinance();
  const [loading, setLoading] = useState(true);
  const [affiliatePayouts, setAffiliatePayouts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [paymentDialog, setPaymentDialog] = useState({ open: false, affiliate: null });
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAffiliatePayouts();
    logFinanceAction('view_affiliate_payouts');
  }, [statusFilter]);

  const loadAffiliatePayouts = async () => {
    setLoading(true);
    try {
      const { data: earnings, error } = await supabase.from('referral_earnings').select(`
        id, commission_amount, status, currency, created_at, event_id,
        profiles!referral_earnings_user_id_fkey ( id, first_name, last_name, email, referral_code ),
        event:event_id (id, title, end_date, currency)
      `).order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const completedEarnings = earnings?.filter(e => e.event?.end_date && new Date(e.event.end_date) < now) || [];

      const affiliateMap = {};
      completedEarnings.forEach(earning => {
        const affiliateId = earning.profiles?.id;
        if (!affiliateId) return;
        const currency = earning.currency || earning.event?.currency || getDefaultCurrency(earning.event?.country_code || earning.event?.country);
        
        if (!affiliateMap[affiliateId]) {
          affiliateMap[affiliateId] = { 
            affiliate: earning.profiles, 
            earnings: [], 
            totalEarned: 0, 
            totalPending: 0, 
            totalPaid: 0, 
            currency: currency 
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
    } catch (error) {
      console.error('Error loading affiliates:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentDialog = (affiliate) => {
    if (!canProcessPayouts) {
      alert('You do not have permission to process payouts.');
      return;
    }
    setPaymentDialog({ open: true, affiliate });
    setTransactionRef('');
    setPaymentNotes('');
  };

  const processPayment = async () => {
    if (!paymentDialog.affiliate) return;
    setProcessing(true);
    try {
      const { affiliate } = paymentDialog;
      const earningIds = affiliate.earnings.filter(e => e.status === 'available' || e.status === 'pending').map(e => e.id);
      
      await supabase.from('referral_earnings').update({ 
        status: 'paid', 
        paid_at: new Date().toISOString(), 
        transaction_reference: transactionRef 
      }).in('id', earningIds);
      
      await logFinanceAction('affiliate_payout', 'profile', affiliate.affiliate.id, { 
        amount: affiliate.totalPending,
        affiliateName: `${affiliate.affiliate.first_name} ${affiliate.affiliate.last_name}`,
        reference: transactionRef 
      });

      setPaymentDialog({ open: false, affiliate: null });
      loadAffiliatePayouts();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredAffiliates = affiliatePayouts.filter(affiliate => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = `${affiliate.affiliate?.first_name} ${affiliate.affiliate?.last_name}`.toLowerCase();
    return name.includes(query) || affiliate.affiliate?.email?.toLowerCase().includes(query) || affiliate.affiliate?.referral_code?.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Affiliate Payouts</h1>
          <p className="text-[#0F0F0F]/60">Process commission payouts for affiliates</p>
        </div>
        <Button onClick={loadAffiliatePayouts} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Filters */}
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
      </div>

      {/* Affiliates List */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : filteredAffiliates.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <Link2 className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">No affiliate payouts found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAffiliates.map((affiliate, idx) => (
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
                      <p className="text-xs text-[#2969FF]">Code: {affiliate.affiliate?.referral_code}</p>
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
                    {affiliate.totalPending > 0 ? (
                      <Button size="sm" onClick={() => openPaymentDialog(affiliate)} className="bg-green-600 hover:bg-green-700 rounded-lg">
                        <Banknote className="w-4 h-4 mr-1" />Pay {formatPrice(affiliate.totalPending, affiliate.currency)}
                      </Button>
                    ) : (
                      <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Fully Paid</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, affiliate: null })}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Affiliate Payment</DialogTitle>
            <DialogDescription>Record payment to affiliate</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-[#F4F6FA] rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#0F0F0F]/60">Recipient</p>
                  <p className="font-medium text-[#0F0F0F]">
                    {paymentDialog.affiliate?.affiliate?.first_name} {paymentDialog.affiliate?.affiliate?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-[#0F0F0F]/60">Amount</p>
                  <p className="font-bold text-[#0F0F0F]">
                    {formatPrice(paymentDialog.affiliate?.totalPending, paymentDialog.affiliate?.currency)}
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
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, affiliate: null })} className="rounded-xl">Cancel</Button>
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
