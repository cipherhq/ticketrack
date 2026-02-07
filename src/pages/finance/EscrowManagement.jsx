import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2, Search, Lock, DollarSign, Clock,
  CheckCircle, AlertCircle, RefreshCw, Building2, Calendar,
  ChevronDown, ChevronUp, ShieldCheck, ShieldX
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact, getDefaultCurrency } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function EscrowManagement() {
  const navigate = useNavigate();
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrganizers, setExpandedOrganizers] = useState({});
  const [stats, setStats] = useState({
    totalEscrowByCurrency: {},
    pendingByCurrency: {},
    paidOutByCurrency: {},
    organizerCount: 0
  });

  useEffect(() => {
    loadEscrowData();
    logFinanceAction('view_escrow_management');
  }, [statusFilter]);

  const loadEscrowData = async () => {
    setLoading(true);
    try {
      // Get all organizers with their events and orders (calculate escrow dynamically)
      const { data: orgs, error } = await supabase.from('organizers').select(`
        id, business_name, email, country_code, kyc_status, kyc_verified,
        events (
          id, title, start_date, end_date, currency, payout_status,
          orders (id, total_amount, platform_fee, status)
        )
      `).order('business_name');

      if (error) throw error;

      // Get all payouts to calculate what's been paid
      const { data: payouts } = await supabase.from('payouts')
        .select('organizer_id, net_amount, currency')
        .eq('status', 'completed');

      // Get advance payments
      const { data: advances } = await supabase.from('advance_payments')
        .select('organizer_id, advance_amount, currency')
        .eq('recipient_type', 'organizer')
        .eq('status', 'paid');

      // Calculate escrow for each organizer
      const now = new Date();
      const organizersWithEscrow = (orgs || []).map(org => {
        let totalEarnings = 0;
        let pendingEscrow = 0; // Events still active
        let eligibleEscrow = 0; // Events ended, not paid
        let paidOut = 0;
        const currency = org.events?.[0]?.currency || getDefaultCurrency(org.country_code);
        const activeEvents = [];
        const completedUnpaidEvents = [];
        const paidEvents = [];

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
              paidEvents.push({ ...event, netEarnings, totalSales: eventTotal, platformFees });
            } else {
              eligibleEscrow += netEarnings;
              completedUnpaidEvents.push({ ...event, netEarnings, totalSales: eventTotal, platformFees });
            }
          } else {
            pendingEscrow += netEarnings;
            activeEvents.push({ ...event, netEarnings, totalSales: eventTotal, platformFees });
          }
        });

        // Calculate payouts already made for this organizer
        const orgPayouts = payouts?.filter(p => p.organizer_id === org.id) || [];
        const totalPaidFromPayouts = orgPayouts.reduce((sum, p) => sum + parseFloat(p.net_amount || 0), 0);

        // Calculate advances
        const orgAdvances = advances?.filter(a => a.organizer_id === org.id) || [];
        const totalAdvances = orgAdvances.reduce((sum, a) => sum + parseFloat(a.advance_amount || 0), 0);

        // Available escrow = total earnings - payouts - advances
        const availableEscrow = Math.max(0, totalEarnings - totalPaidFromPayouts - totalAdvances);

        // Determine status
        let status = 'none';
        if (availableEscrow > 0) {
          if (eligibleEscrow > 0) {
            status = 'eligible'; // Has completed events ready for payout
          } else if (pendingEscrow > 0) {
            status = 'pending'; // Only active events
          }
        } else if (totalEarnings > 0) {
          status = 'paid'; // All paid out
        }

        return {
          ...org,
          currency,
          totalEarnings,
          pendingEscrow,
          eligibleEscrow,
          paidOut: totalPaidFromPayouts,
          advances: totalAdvances,
          availableEscrow,
          activeEvents,
          completedUnpaidEvents,
          paidEvents,
          status
        };
      });

      // Filter organizers with escrow
      let filtered = organizersWithEscrow.filter(o => o.totalEarnings > 0);

      if (statusFilter === 'eligible') {
        filtered = filtered.filter(o => o.eligibleEscrow > 0);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(o => o.pendingEscrow > 0 && o.eligibleEscrow === 0);
      } else if (statusFilter === 'paid') {
        filtered = filtered.filter(o => o.status === 'paid');
      }

      setOrganizers(filtered);

      // Calculate totals
      const totalEscrowByCurrency = {};
      const pendingByCurrency = {};
      const paidOutByCurrency = {};

      filtered.forEach(org => {
        const c = org.currency || 'NGN';
        totalEscrowByCurrency[c] = (totalEscrowByCurrency[c] || 0) + org.availableEscrow;
        pendingByCurrency[c] = (pendingByCurrency[c] || 0) + org.pendingEscrow;
        paidOutByCurrency[c] = (paidOutByCurrency[c] || 0) + org.paidOut;
      });

      setStats({
        totalEscrowByCurrency,
        pendingByCurrency,
        paidOutByCurrency,
        organizerCount: filtered.length
      });
    } catch (error) {
      console.error('Error loading escrow data:', error);
      alert('Failed to load escrow data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (orgId) => {
    setExpandedOrganizers(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Active Events' },
      eligible: { bg: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Ready for Payout' },
      paid: { bg: 'bg-gray-100 text-gray-800', icon: CheckCircle, label: 'All Paid' },
      none: { bg: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: 'No Escrow' }
    };
    const s = styles[status] || styles.none;
    const Icon = s.icon;
    return (
      <Badge className={s.bg}>
        <Icon className="w-3 h-3 mr-1" />
        {s.label}
      </Badge>
    );
  };

  const getKYCBadge = (kycStatus, kycVerified) => {
    if (kycVerified || kycStatus === 'verified' || kycStatus === 'approved') {
      return <Badge className="bg-green-100 text-green-800"><ShieldCheck className="w-3 h-3 mr-1" />KYC Verified</Badge>;
    }
    if (kycStatus === 'pending' || kycStatus === 'in_review') {
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />KYC Pending</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800"><ShieldX className="w-3 h-3 mr-1" />No KYC</Badge>;
  };

  const filteredOrganizers = organizers.filter(org =>
    org.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    org.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Escrow Management</h1>
          <p className="text-[#0F0F0F]/60">View organizer funds held in escrow from ticket sales</p>
        </div>
        <Button onClick={loadEscrowData} variant="outline" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total in Escrow</p>
                <p className="text-xl font-bold">{formatMultiCurrencyCompact(stats.totalEscrowByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">From Active Events</p>
                <p className="text-xl font-bold">{formatMultiCurrencyCompact(stats.pendingByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Paid Out</p>
                <p className="text-xl font-bold">{formatMultiCurrencyCompact(stats.paidOutByCurrency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Organizers</p>
                <p className="text-2xl font-bold">{stats.organizerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search organizer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizers</SelectItem>
                <SelectItem value="eligible">Ready for Payout</SelectItem>
                <SelectItem value="pending">Active Events Only</SelectItem>
                <SelectItem value="paid">All Paid Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Organizers List */}
      <div className="space-y-4">
        {filteredOrganizers.map(org => (
          <Card key={org.id} className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F4F6FA]/50"
              onClick={() => toggleExpanded(org.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[#2969FF]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F0F0F]">{org.business_name}</h3>
                  <p className="text-sm text-[#0F0F0F]/60">{org.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{formatPrice(org.availableEscrow, org.currency)}</p>
                  <p className="text-xs text-[#0F0F0F]/60">Available Escrow</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(org.status)}
                  {getKYCBadge(org.kyc_status, org.kyc_verified)}
                </div>
                {expandedOrganizers[org.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>

            {expandedOrganizers[org.id] && (
              <div className="px-4 pb-4 border-t border-[#0F0F0F]/10">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-4">
                  <div className="text-center p-3 bg-[#F4F6FA] rounded-xl">
                    <p className="text-lg font-bold">{formatPrice(org.totalEarnings, org.currency)}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Total Earnings</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-xl">
                    <p className="text-lg font-bold text-yellow-700">{formatPrice(org.pendingEscrow, org.currency)}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Active Events</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-xl">
                    <p className="text-lg font-bold text-green-600">{formatPrice(org.eligibleEscrow, org.currency)}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Ready for Payout</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <p className="text-lg font-bold text-blue-600">{formatPrice(org.paidOut, org.currency)}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Paid Out</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-xl">
                    <p className="text-lg font-bold text-purple-600">{formatPrice(org.advances, org.currency)}</p>
                    <p className="text-xs text-[#0F0F0F]/60">Advances</p>
                  </div>
                </div>

                {/* Events Ready for Payout */}
                {org.completedUnpaidEvents.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-[#0F0F0F] mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Events Ready for Payout ({org.completedUnpaidEvents.length})
                    </h4>
                    <div className="space-y-2">
                      {org.completedUnpaidEvents.map(event => (
                        <div key={event.id} className="p-3 bg-green-50 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-[#0F0F0F]/60">
                              Ended {new Date(event.end_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatPrice(event.netEarnings, org.currency)}</p>
                            <p className="text-xs text-[#0F0F0F]/60">
                              Sales: {formatPrice(event.totalSales, org.currency)} | Fees: {formatPrice(event.platformFees, org.currency)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Events */}
                {org.activeEvents.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-[#0F0F0F] mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      Active Events ({org.activeEvents.length})
                    </h4>
                    <div className="space-y-2">
                      {org.activeEvents.map(event => (
                        <div key={event.id} className="p-3 bg-yellow-50 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-[#0F0F0F]/60">
                              Ends {new Date(event.end_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-yellow-700">{formatPrice(event.netEarnings, org.currency)}</p>
                            <p className="text-xs text-[#0F0F0F]/60">Current earnings</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {org.eligibleEscrow > 0 && (
                  <div className="pt-3 border-t border-[#0F0F0F]/10 flex gap-3">
                    <Button
                      onClick={() => navigate('/finance/payouts/events')}
                      className="bg-green-600 hover:bg-green-700 rounded-xl"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Process Payout
                    </Button>
                    {org.availableEscrow > 0 && (
                      <Button
                        onClick={() => navigate('/finance/payouts/funding')}
                        variant="outline"
                        className="rounded-xl"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Advance Payment
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        {filteredOrganizers.length === 0 && (
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No organizers with escrow balance found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
