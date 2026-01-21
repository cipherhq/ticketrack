import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Eye, ShoppingCart, TrendingUp, CreditCard, AlertCircle, Loader2, Copy, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePromoter } from '@/contexts/PromoterContext';
import { supabase } from '@/lib/supabase';
import { formatMultiCurrency, formatMultiCurrencyCompact } from '@/config/currencies';
import { TaxDocuments } from '@/components/TaxDocuments';

export function PromoterDashboard() {
  const { promoter, loading: promoterLoading } = usePromoter();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [earningsByCurrency, setEarningsByCurrency] = useState({});
  const [paidByCurrency, setPaidByCurrency] = useState({});

  useEffect(() => {
    if (promoter) { loadData(); } else { setLoading(false); }
  }, [promoter]);

  const loadData = async () => {
    try {
      const { data: bankData } = await supabase.from('promoter_bank_accounts').select('*').eq('promoter_id', promoter.id);
      setBankAccounts(bankData || []);
      
      const { data: eventData } = await supabase.from('promoter_events').select('*, events(id, title)').eq('promoter_id', promoter.id).eq('is_active', true);
      setEvents(eventData || []);

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

      // Get payouts grouped by currency (join with promoter_sales via event)
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

    } catch (error) { console.error('Error loading data:', error); }
    finally { setLoading(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/events?ref=${promoter?.short_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (promoterLoading || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  }

  if (!promoter) {
    return (
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-[#0F0F0F]/20 mx-auto mb-4" />
          <h3 className="text-lg text-[#0F0F0F] mb-2">Not a Promoter Yet</h3>
          <p className="text-[#0F0F0F]/60">Contact an organizer to become a promoter.</p>
        </CardContent>
      </Card>
    );
  }

  const hasBankAccount = bankAccounts.length > 0;
  const conversionRate = promoter.total_clicks > 0 ? ((promoter.total_sales / promoter.total_clicks) * 100).toFixed(2) : 0;

  // Calculate unpaid by currency
  const unpaidByCurrency = {};
  Object.keys(earningsByCurrency).forEach(currency => {
    const earned = earningsByCurrency[currency] || 0;
    const paid = paidByCurrency[currency] || 0;
    if (earned - paid > 0) {
      unpaidByCurrency[currency] = earned - paid;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-[#0F0F0F] mb-2">Welcome back, {promoter.full_name}!</h2>
        <p className="text-[#0F0F0F]/60">Track your performance and manage your earnings</p>
      </div>

      {!hasBankAccount && (
        <Card className="border-orange-200 bg-orange-50 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-[#0F0F0F] mb-1">Add Your Bank Account</h3>
                <p className="text-sm text-[#0F0F0F]/60 mb-3">To receive payments, please add your bank account details.</p>
                <Link to="/promoter/bank-accounts"><Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl">Add Bank Account</Button></Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><Eye className="w-4 h-4 text-blue-600" /><span className="text-sm text-[#0F0F0F]/60">Total Clicks</span></div><p className="text-2xl text-[#0F0F0F]">{(promoter.total_clicks || 0).toLocaleString()}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><ShoppingCart className="w-4 h-4 text-green-600" /><span className="text-sm text-[#0F0F0F]/60">Tickets Sold</span></div><p className="text-2xl text-green-600">{promoter.total_sales || 0}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-purple-600" /><span className="text-sm text-[#0F0F0F]/60">Conversion</span></div><p className="text-2xl text-[#0F0F0F]">{conversionRate}%</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-[#2969FF]" /><span className="text-sm text-[#0F0F0F]/60">Total Earned</span></div><p className="text-xl text-[#2969FF]">{formatMultiCurrencyCompact(earningsByCurrency)}</p></CardContent></Card>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle>Earnings Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-green-50 border border-green-200"><p className="text-sm text-[#0F0F0F]/60 mb-1">Total Earned</p><p className="text-2xl text-[#0F0F0F] mb-2">{formatMultiCurrency(earningsByCurrency)}</p><p className="text-sm text-green-600">{promoter.commission_rate}% Commission Rate</p></div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200"><p className="text-sm text-[#0F0F0F]/60 mb-1">Total Paid</p><p className="text-2xl text-blue-600 mb-2">{formatMultiCurrency(paidByCurrency)}</p><Link to="/promoter/payment-history" className="text-sm text-blue-600 hover:underline">View Payment History →</Link></div>
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200"><p className="text-sm text-[#0F0F0F]/60 mb-1">Unpaid Balance</p><p className="text-2xl text-orange-600 mb-2">{formatMultiCurrency(unpaidByCurrency)}</p><p className="text-sm text-[#0F0F0F]/60">Pending payment</p></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle>Your Unique Promo Link</CardTitle></CardHeader>
        <CardContent>
          <div className="p-4 bg-[#F4F6FA] rounded-xl">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div><p className="text-sm text-[#0F0F0F]/60 mb-1">Promo Code</p><p className="text-xl text-[#0F0F0F] font-bold">{promoter.short_code}</p></div>
              <Badge className="bg-green-600 text-lg px-4 py-2">{promoter.commission_rate}% Commission</Badge>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm text-[#0F0F0F] bg-white px-4 py-3 rounded-lg border border-[#0F0F0F]/10 truncate">{window.location.origin}/events?ref={promoter.short_code}</code>
              <Button onClick={copyLink} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">{copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}{copied ? 'Copied!' : 'Copy Link'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle>Assigned Events ({events.length})</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? <p className="text-center text-[#0F0F0F]/60 py-8">No events assigned yet</p> : (
            <div className="space-y-3">{events.map((pe) => (<div key={pe.id} className="p-4 bg-[#F4F6FA] rounded-xl flex items-center justify-between"><span className="text-[#0F0F0F]">{pe.events?.title}</span><Badge variant="outline">Active</Badge></div>))}</div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/promoter/performance"><Card className="border-[#0F0F0F]/10 rounded-2xl hover:border-[#2969FF] transition-colors cursor-pointer"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-purple-600" /></div><div><h3 className="text-[#0F0F0F] mb-1">View Performance</h3><p className="text-sm text-[#0F0F0F]/60">Detailed analytics and stats</p></div></div></CardContent></Card></Link>
        <Link to="/promoter/bank-accounts"><Card className="border-[#0F0F0F]/10 rounded-2xl hover:border-[#2969FF] transition-colors cursor-pointer"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center"><CreditCard className="w-6 h-6 text-blue-600" /></div><div><h3 className="text-[#0F0F0F] mb-1">Manage Bank Accounts</h3><p className="text-sm text-[#0F0F0F]/60">Add or update payment details</p></div></div></CardContent></Card></Link>
      </div>

      {/* Tax Documents */}
      {promoter?.id && (
        <TaxDocuments type="promoter" recipientId={promoter.id} countryCode={promoter.country_code || 'NG'} />
      )}
    </div>
  );
}
