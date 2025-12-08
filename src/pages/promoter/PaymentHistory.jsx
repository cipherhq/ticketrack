import { useState, useEffect } from 'react';
import { Download, CheckCircle, Clock, XCircle, Search, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePromoter } from '@/contexts/PromoterContext';
import { supabase } from '@/lib/supabase';

export function PaymentHistory() {
  const { promoter } = usePromoter();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { if (promoter) loadPayments(); }, [promoter]);

  const loadPayments = async () => {
    const { data } = await supabase.from('promoter_payouts').select('*, promoter_bank_accounts(bank_name, account_number)').eq('promoter_id', promoter.id).order('created_at', { ascending: false });
    setPayments(data || []);
    setLoading(false);
  };

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = (p.payment_reference || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.promoter_bank_accounts?.bank_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return (statusFilter === 'all' || p.status === statusFilter) && matchesSearch;
  });

  const stats = {
    totalPaid: payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    totalPending: payments.filter((p) => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
  };

  const getStatusBadge = (status) => {
    if (status === 'completed') return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
    if (status === 'processing') return <Badge className="bg-blue-600"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
    if (status === 'pending') return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    if (status === 'failed') return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    return null;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-2xl text-[#0F0F0F] mb-2">Payment History</h2><p className="text-[#0F0F0F]/60">Track all your commission payments</p></div><Button variant="outline" className="rounded-xl"><Download className="w-4 h-4 mr-2" />Export</Button></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60 mb-1">Total Paid</p><p className="text-2xl text-green-600">₦{stats.totalPaid.toLocaleString()}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60 mb-1">Pending</p><p className="text-2xl text-blue-600">₦{stats.totalPending.toLocaleString()}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><p className="text-sm text-[#0F0F0F]/60 mb-1">Last Payment</p><p className="text-2xl text-[#0F0F0F]">{payments.length > 0 ? new Date(payments[0].created_at).toLocaleDateString() : 'N/A'}</p></CardContent></Card>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex flex-col md:flex-row gap-4"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#0F0F0F]/40 w-5 h-5" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" /></div><div className="w-full md:w-48"><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select></div></div></CardContent></Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle>All Payments ({filteredPayments.length})</CardTitle></CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? <div className="text-center py-12"><Calendar className="w-16 h-16 text-[#0F0F0F]/20 mx-auto mb-4" /><h3 className="text-lg text-[#0F0F0F] mb-2">No Payments Found</h3></div> : (
            <div className="space-y-4">
              {filteredPayments.map((p) => (
                <div key={p.id} className="p-4 border border-[#0F0F0F]/10 rounded-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div><div className="flex items-center gap-2 mb-2"><h3 className="text-lg text-[#0F0F0F]">₦{parseFloat(p.amount || 0).toLocaleString()}</h3>{getStatusBadge(p.status)}</div><p className="text-sm text-[#0F0F0F]/60">{new Date(p.created_at).toLocaleDateString()}</p></div>
                    <div className="text-right"><p className="text-sm text-[#0F0F0F]/60">Ref</p><p className="text-sm">{p.payment_reference || 'N/A'}</p></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="p-3 bg-[#F4F6FA] rounded-lg"><p className="text-xs text-[#0F0F0F]/60">Bank</p><p className="text-sm">{p.promoter_bank_accounts?.bank_name || 'N/A'}</p></div>
                    <div className="p-3 bg-[#F4F6FA] rounded-lg"><p className="text-xs text-[#0F0F0F]/60">Account</p><p className="text-sm">{p.promoter_bank_accounts?.account_number || 'N/A'}</p></div>
                  </div>
                  {p.notes && <div className="mt-3 p-3 bg-blue-50 rounded-lg"><p className="text-sm">{p.notes}</p></div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
