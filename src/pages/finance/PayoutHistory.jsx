import { useState, useEffect } from 'react';
import {
  History, DollarSign, Building2, Users, Link2, CheckCircle,
  Loader2, Search, Download, RefreshCw, X, CreditCard, Calendar,
  User, Mail, Hash, Banknote, Clock, FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatPrice, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function PayoutHistory() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [bankDetails, setBankDetails] = useState(null);

  useEffect(() => {
    loadPayoutHistory();
    logFinanceAction('view_payout_history');
  }, []);

  const loadPayoutHistory = async () => {
    setLoading(true);
    try {
      const [organizerPayouts, promoterPayouts, affiliateEarnings] = await Promise.all([
        supabase.from('payouts').select('*, organizers(id, business_name, email, country_code)').eq('status', 'completed').order('processed_at', { ascending: false }).limit(200),
        supabase.from('promoter_payouts').select('*, promoters(full_name, email), events(title)').eq('status', 'completed').order('created_at', { ascending: false }).limit(200),
        supabase.from('referral_earnings').select('*, profiles!referral_earnings_user_id_fkey(first_name, last_name, email), event:event_id(title)').eq('status', 'paid').order('paid_at', { ascending: false }).limit(200)
      ]);

      const history = [
        ...(organizerPayouts.data || []).map(p => ({
          ...p,
          type: 'organizer',
          recipientName: p.organizers?.business_name,
          recipientEmail: p.organizers?.email,
          organizerId: p.organizers?.id,
          eventTitle: null,
          country_code: p.organizers?.country_code,
          paidAt: p.processed_at,
          reference: p.payout_number || p.transaction_reference
        })),
        ...(promoterPayouts.data || []).map(p => ({
          ...p,
          type: 'promoter',
          recipientName: p.promoters?.full_name,
          recipientEmail: p.promoters?.email,
          eventTitle: p.events?.title,
          paidAt: p.completed_at || p.created_at,
          reference: p.reference || p.transaction_reference
        })),
        ...(affiliateEarnings.data || []).map(p => ({
          ...p,
          type: 'affiliate',
          recipientName: `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.trim(),
          recipientEmail: p.profiles?.email,
          eventTitle: p.event?.title,
          amount: p.commission_amount,
          paidAt: p.paid_at,
          reference: p.reference
        }))
      ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

      setPayoutHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPayoutDetails = async (payout) => {
    setSelectedPayout(payout);
    setDetailsOpen(true);
    setBankDetails(null);

    // Load bank details for organizer payouts
    if (payout.type === 'organizer') {
      setLoadingDetails(true);
      try {
        let bank = null;

        // First try to load by bank_account_id if available
        if (payout.bank_account_id) {
          const { data } = await supabase
            .from('bank_accounts_decrypted')
            .select('bank_name, account_name, account_number_decrypted')
            .eq('id', payout.bank_account_id)
            .single();
          bank = data;
        }

        // Fallback: try to get organizer's primary bank account
        if (!bank && payout.organizer_id) {
          const { data } = await supabase
            .from('bank_accounts_decrypted')
            .select('bank_name, account_name, account_number_decrypted')
            .eq('organizer_id', payout.organizer_id)
            .eq('is_primary', true)
            .single();
          bank = data;
        }

        // Last fallback: any bank account for this organizer
        if (!bank && payout.organizer_id) {
          const { data } = await supabase
            .from('bank_accounts_decrypted')
            .select('bank_name, account_name, account_number_decrypted')
            .eq('organizer_id', payout.organizer_id)
            .limit(1)
            .single();
          bank = data;
        }

        if (bank) {
          setBankDetails(bank);
        }
      } catch (err) {
        console.error('Error loading bank details:', err);
      } finally {
        setLoadingDetails(false);
      }
    }

    logFinanceAction('view_payout_details', null, payout.id);
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
           payout.reference?.toLowerCase().includes(query) ||
           payout.payout_number?.toLowerCase().includes(query);
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Reference', 'Type', 'Recipient', 'Email', 'Event', 'Gross Amount', 'Net Amount', 'Currency'];
    const rows = filteredHistory.map(p => [
      new Date(p.paidAt).toLocaleDateString(),
      p.reference || p.payout_number || '-',
      p.type,
      p.recipientName,
      p.recipientEmail,
      p.eventTitle || (p.notes ? p.notes.replace('Events: ', '').replace('Event: ', '') : '-'),
      p.amount || '-',
      p.net_amount || p.amount || '-',
      p.currency || getDefaultCurrency(p.country_code)
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

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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
                <div
                  key={idx}
                  onClick={() => openPayoutDetails(payout)}
                  className="p-4 flex items-center justify-between flex-wrap gap-4 hover:bg-[#F4F6FA]/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getTypeBadge(payout.type)}
                    <div>
                      <p className="font-medium text-[#0F0F0F]">{payout.recipientName}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{payout.recipientEmail}</p>
                      {payout.reference && (
                        <p className="text-xs text-[#2969FF] font-mono">{payout.reference}</p>
                      )}
                      {(payout.eventTitle || payout.notes) && (
                        <p className="text-xs text-[#0F0F0F]/50 mt-1">
                          {payout.eventTitle || payout.notes?.replace('Events: ', '')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-[#0F0F0F]">{formatPrice(payout.net_amount || payout.amount, payout.currency || getDefaultCurrency(payout.country_code))}</p>
                      <p className="text-xs text-[#0F0F0F]/40">{payout.paidAt ? new Date(payout.paidAt).toLocaleDateString() : '-'}</p>
                    </div>
                    {payout.is_advance ? (
                      <Badge className="bg-purple-100 text-purple-800"><DollarSign className="w-3 h-3 mr-1" />Advance</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2969FF]" />
              Payout Details
            </DialogTitle>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4">
              {/* Reference & Status */}
              <div className="bg-[#F4F6FA] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#0F0F0F]/60">Reference</span>
                  {selectedPayout.is_advance ? (
                    <Badge className="bg-purple-100 text-purple-800">
                      <DollarSign className="w-3 h-3 mr-1" />Advance Payout
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />Completed
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-lg font-semibold text-[#0F0F0F]">
                  {selectedPayout.reference || selectedPayout.payout_number || 'N/A'}
                </p>
              </div>

              {/* Recipient Info */}
              <div className="border border-[#0F0F0F]/10 rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-[#0F0F0F] flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Recipient
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#0F0F0F]/60">Name</p>
                    <p className="font-medium">{selectedPayout.recipientName}</p>
                  </div>
                  <div>
                    <p className="text-[#0F0F0F]/60">Type</p>
                    <p className="font-medium capitalize">{selectedPayout.type}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[#0F0F0F]/60">Email</p>
                    <p className="font-medium">{selectedPayout.recipientEmail}</p>
                  </div>
                </div>
              </div>

              {/* Event Info */}
              {(selectedPayout.eventTitle || selectedPayout.notes || selectedPayout.event_ids?.length > 0) && (
                <div className="border border-[#0F0F0F]/10 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-[#0F0F0F] flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Event{selectedPayout.event_ids?.length > 1 ? 's' : ''}
                  </h4>
                  <div className="text-sm">
                    {selectedPayout.eventTitle && (
                      <p className="font-medium text-[#2969FF]">{selectedPayout.eventTitle}</p>
                    )}
                    {selectedPayout.notes && !selectedPayout.eventTitle && (
                      <p className="font-medium">{selectedPayout.notes.replace('Events: ', '')}</p>
                    )}
                    {selectedPayout.event_ids?.length > 0 && (
                      <p className="text-[#0F0F0F]/40 text-xs mt-1">
                        {selectedPayout.event_ids.length} event{selectedPayout.event_ids.length > 1 ? 's' : ''} included
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Amount Breakdown */}
              <div className="border border-[#0F0F0F]/10 rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-[#0F0F0F] flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Amount
                </h4>
                <div className="space-y-2">
                  {selectedPayout.amount && selectedPayout.net_amount && selectedPayout.amount !== selectedPayout.net_amount && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#0F0F0F]/60">Gross Amount</span>
                        <span>{formatPrice(selectedPayout.amount, selectedPayout.currency || getDefaultCurrency(selectedPayout.country_code))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#0F0F0F]/60">Platform Fee</span>
                        <span className="text-red-600">-{formatPrice(selectedPayout.platform_fee_deducted || (selectedPayout.amount - selectedPayout.net_amount), selectedPayout.currency || getDefaultCurrency(selectedPayout.country_code))}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Net Payout</span>
                        <span className="text-green-600">{formatPrice(selectedPayout.net_amount, selectedPayout.currency || getDefaultCurrency(selectedPayout.country_code))}</span>
                      </div>
                    </>
                  )}
                  {(!selectedPayout.amount || !selectedPayout.net_amount || selectedPayout.amount === selectedPayout.net_amount) && (
                    <div className="flex justify-between font-semibold">
                      <span>Amount Paid</span>
                      <span className="text-green-600">{formatPrice(selectedPayout.net_amount || selectedPayout.amount, selectedPayout.currency || getDefaultCurrency(selectedPayout.country_code))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bank Details (for organizer payouts) */}
              {selectedPayout.type === 'organizer' && (
                <div className="border border-[#0F0F0F]/10 rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-[#0F0F0F] flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Bank Details
                  </h4>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-[#2969FF]" />
                    </div>
                  ) : bankDetails ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[#0F0F0F]/60">Bank Name</p>
                        <p className="font-medium">{bankDetails.bank_name}</p>
                      </div>
                      <div>
                        <p className="text-[#0F0F0F]/60">Account Number</p>
                        <p className="font-medium font-mono">{bankDetails.account_number_decrypted}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[#0F0F0F]/60">Account Name</p>
                        <p className="font-medium">{bankDetails.account_name}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#0F0F0F]/60">Bank details not available</p>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="border border-[#0F0F0F]/10 rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-[#0F0F0F] flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timeline
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#0F0F0F]/60">Processed At</p>
                    <p className="font-medium">{formatDateTime(selectedPayout.paidAt || selectedPayout.processed_at)}</p>
                  </div>
                  {selectedPayout.created_at && selectedPayout.created_at !== selectedPayout.processed_at && (
                    <div>
                      <p className="text-[#0F0F0F]/60">Created At</p>
                      <p className="font-medium">{formatDateTime(selectedPayout.created_at)}</p>
                    </div>
                  )}
                </div>
                {selectedPayout.notes && (
                  <div>
                    <p className="text-[#0F0F0F]/60 text-sm">Notes</p>
                    <p className="text-sm mt-1">{selectedPayout.notes}</p>
                  </div>
                )}
              </div>

              {/* Transaction Reference */}
              {selectedPayout.transaction_reference && selectedPayout.transaction_reference !== selectedPayout.reference && (
                <div className="text-xs text-[#0F0F0F]/40 font-mono">
                  Transaction Ref: {selectedPayout.transaction_reference}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
