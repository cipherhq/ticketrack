import { useState, useEffect } from 'react';
import { 
  History, DollarSign, Building2, Users, Link2, CheckCircle, 
  Loader2, Search, Download, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function PayoutHistory() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPayoutHistory();
    logFinanceAction('view_payout_history');
  }, []);

  const loadPayoutHistory = async () => {
    setLoading(true);
    try {
      const [organizerPayouts, promoterPayouts, affiliateEarnings] = await Promise.all([
        supabase.from('payouts').select('*, organizers(business_name, email, country_code)').eq('status', 'completed').order('processed_at', { ascending: false }).limit(200),
        supabase.from('promoter_payouts').select('*, promoters(full_name, email), events(title)').eq('status', 'completed').order('created_at', { ascending: false }).limit(200),
        supabase.from('referral_earnings').select('*, profiles!referral_earnings_user_id_fkey(first_name, last_name, email), event:event_id(title)').eq('status', 'paid').order('paid_at', { ascending: false }).limit(200)
      ]);

      const history = [
        ...(organizerPayouts.data || []).map(p => ({
          ...p,
          type: 'organizer',
          recipientName: p.organizers?.business_name,
          recipientEmail: p.organizers?.email,
          eventTitle: null,
          country_code: p.organizers?.country_code,
          paidAt: p.processed_at
        })),
        ...(promoterPayouts.data || []).map(p => ({ 
          ...p, 
          type: 'promoter', 
          recipientName: p.promoters?.full_name, 
          recipientEmail: p.promoters?.email, 
          eventTitle: p.events?.title,
          paidAt: p.completed_at || p.created_at 
        })),
        ...(affiliateEarnings.data || []).map(p => ({ 
          ...p, 
          type: 'affiliate', 
          recipientName: `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.trim(), 
          recipientEmail: p.profiles?.email, 
          eventTitle: p.event?.title,
          amount: p.commission_amount, 
          paidAt: p.paid_at 
        }))
      ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

      setPayoutHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'organizer': return <Badge className="bg-blue-100 text-blue-800"><Building2 className="w-3 h-3 mr-1" />Organizer</Badge>;
      case 'promoter': return <Badge className="bg-purple-100 text-purple-800"><Users className="w-3 h-3 mr-1" />Promoter</Badge>;
      case 'affiliate': return <Badge className="bg-green-100 text-green-800"><Link2 className="w-3 h-3 mr-1" />Affiliate</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  const filteredHistory = payoutHistory.filter(payout => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return payout.recipientName?.toLowerCase().includes(query) || 
           payout.recipientEmail?.toLowerCase().includes(query) ||
           payout.eventTitle?.toLowerCase().includes(query) ||
           payout.reference?.toLowerCase().includes(query);
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Recipient', 'Email', 'Event', 'Amount', 'Currency', 'Reference'];
    const rows = filteredHistory.map(p => [
      new Date(p.paidAt).toLocaleDateString(),
      p.type,
      p.recipientName,
      p.recipientEmail,
      p.eventTitle || '-',
      p.amount || p.net_amount,
      p.currency || getDefaultCurrency(p.country_code),
      p.reference || p.transaction_reference || '-'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    logFinanceAction('export_payout_history', null, null, { count: filteredHistory.length });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Payout History</h1>
          <p className="text-[#0F0F0F]/60">View all completed payouts</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
          <Button onClick={loadPayoutHistory} variant="outline" className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
        <Input placeholder="Search by recipient, email, event, or reference..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Organizer Payouts</p>
                <p className="font-bold text-[#0F0F0F]">{payoutHistory.filter(p => p.type === 'organizer').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Promoter Payouts</p>
                <p className="font-bold text-[#0F0F0F]">{payoutHistory.filter(p => p.type === 'promoter').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Affiliate Payouts</p>
                <p className="font-bold text-[#0F0F0F]">{payoutHistory.filter(p => p.type === 'affiliate').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History List */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>
      ) : filteredHistory.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            <History className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">No payout history yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-0">
            <div className="divide-y divide-[#0F0F0F]/10">
              {filteredHistory.map((payout, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between flex-wrap gap-4 hover:bg-[#F4F6FA]/50">
                  <div className="flex items-center gap-4">
                    {getTypeBadge(payout.type)}
                    <div>
                      <p className="font-medium text-[#0F0F0F]">{payout.recipientName}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{payout.recipientEmail}</p>
                      {payout.eventTitle && <p className="text-xs text-[#2969FF]">{payout.eventTitle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-[#0F0F0F]">{formatPrice(payout.amount || payout.net_amount, payout.currency || getDefaultCurrency(payout.country_code))}</p>
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
}
