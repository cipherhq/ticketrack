import { getCountryFees } from '@/config/fees';
import { formatPrice, formatMultiCurrencyCompact, getDefaultCurrency } from '@/config/currencies';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, Clock, CheckCircle, Plus, CreditCard, Building2, 
  Download, Calendar, Loader2, FileText 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

export function FinancePayouts() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    inEscrowByCurrency: {},
    upcomingPayoutsByCurrency: {},
    totalPaidOutByCurrency: {},
  });
  const [upcomingPayouts, setUpcomingPayouts] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);

  useEffect(() => {
    if (organizer?.id) {
      loadPayoutData();
    }
  }, [organizer?.id]);

  const loadPayoutData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Fetch all events with their order totals (including child events for recurring events)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          currency,
          title,
          end_date,
          start_date,
          parent_event_id,
          is_recurring,
          orders (
            id,
            subtotal,
            platform_fee,
            total_amount,
            status,
            created_at,
            event_id
          )
        `)
        .eq('organizer_id', organizer.id);

      if (eventsError) throw eventsError;

      // Separate parent events and child events
      const parentEvents = events?.filter(e => !e.parent_event_id) || [];
      const childEvents = events?.filter(e => e.parent_event_id) || [];
      
      // Create a map of child events by ID for quick lookup
      const childEventMap = {};
      childEvents.forEach(e => { childEventMap[e.id] = e; });


      // Get platform fees from database
      const feesByCurrency = await getCountryFees();
      // Fetch completed payouts
      const { data: payouts, error: payoutsError } = await supabase
        .from('organizer_payouts')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      // Calculate stats and categorize by currency
      // Group orders by their actual event (child event if recurring, parent otherwise)
      const inEscrowByCurrency = {};
      const upcomingPayoutsByCurrency = {};
      const upcoming = [];
      
      // Process all orders and group by actual event date
      const ordersByEventDate = {};

      events?.forEach(event => {
        const completedOrders = event.orders?.filter(o => o.status === 'completed') || [];
        
        completedOrders.forEach(order => {
          // Get the actual event for this order (could be child or parent)
          const actualEvent = childEventMap[order.event_id] || event;
          const eventEndDate = new Date(actualEvent.end_date);
          
          // Create a key for grouping: event ID + event end date
          const eventKey = `${actualEvent.id}-${actualEvent.end_date}`;
          
          if (!ordersByEventDate[eventKey]) {
            ordersByEventDate[eventKey] = {
              event: actualEvent,
              orders: [],
              currency: actualEvent.currency,
            };
          }
          
          ordersByEventDate[eventKey].orders.push(order);
        });
      });
      
      // Process each group of orders by event date
      Object.values(ordersByEventDate).forEach(({ event, orders, currency }) => {
        if (orders.length === 0) return;
        
        const grossRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        const netAmount = orders.reduce((sum, o) => sum + (parseFloat(o.subtotal) || 0), 0);
        const platformFeeTotal = orders.reduce((sum, o) => sum + (parseFloat(o.platform_fee) || 0), 0);
        
        if (netAmount === 0) return;
        
        const eventEndDate = new Date(event.end_date);
        const payoutDate = new Date(eventEndDate.getTime() + 24 * 60 * 60 * 1000);
        
        // Determine event display name (include date if child event)
        let eventDisplayName = event.title;
        if (event.parent_event_id) {
          // Child event - show date in title
          const eventDate = new Date(event.start_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          eventDisplayName = `${event.title} - ${eventDate}`;
        }

        if (eventEndDate > now) {
          // Event hasn't ended yet - In Escrow
          inEscrowByCurrency[currency] = (inEscrowByCurrency[currency] || 0) + netAmount;
        } else if (payoutDate > now) {
          // Event ended, within 24 hours - Upcoming Payout
          upcomingPayoutsByCurrency[currency] = (upcomingPayoutsByCurrency[currency] || 0) + netAmount;
          upcoming.push({
            id: event.id,
            currency,
            event: eventDisplayName,
            grossAmount: grossRevenue,
            platformFee: platformFeeTotal,
            netAmount: netAmount,
            eventEndDate: event.end_date,
            payoutDate: payoutDate.toISOString(),
            status: 'Scheduled',
          });
        }
      });

      // Total paid out from payouts table - group by currency
      const totalPaidOutByCurrency = {};
      payouts?.filter(p => p.status === 'completed')?.forEach(p => {
        const currency = p.currency || getDefaultCurrency(p.country_code || organizer?.country_code || organizer?.country);
        totalPaidOutByCurrency[currency] = (totalPaidOutByCurrency[currency] || 0) + (parseFloat(p.amount) || 0);
      });

      setStats({
        inEscrowByCurrency,
        upcomingPayoutsByCurrency,
        totalPaidOutByCurrency,
      });

      setUpcomingPayouts(upcoming);
      setPayoutHistory(payouts || []);

    } catch (error) {
      console.error('Error loading payout data:', error);
    } finally {
      setLoading(false);
    }
  };

  

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const downloadPayoutReport = (payout) => {
    // Generate CSV report
    const csvContent = `Payout Report
Event,${payout.event}
Gross Amount,${formatPrice(payout.grossAmount, payout.currency)}
Platform Fee,${formatPrice(payout.grossAmount - payout.netAmount, payout.currency)}
Net Amount,${formatPrice(payout.netAmount, payout.currency)}
Event End Date,${formatDate(payout.eventEndDate)}
Payout Date,${formatDateTime(payout.payoutDate)}
Status,${payout.status}
`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-report-${payout.event.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadFullReport = () => {
    // Generate full payout history report
    let csvContent = `Payout History Report\nGenerated,${new Date().toISOString()}\n\nEvent,Amount,Status,Date\n`;
    
    payoutHistory.forEach(payout => {
      csvContent += `"${payout.event_title || 'N/A'}",${formatPrice(payout.amount, payout.currency)},${payout.status},${formatDate(payout.created_at)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Finance & Payouts</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Track your earnings and payout schedule</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate('/organizer/bank-account')}
            variant="outline"
            className="rounded-xl border-[#0F0F0F]/10"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Manage Bank Accounts
          </Button>
          <Button 
            onClick={() => navigate('/organizer/bank-account')}
            className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Bank Account
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <Clock className="w-8 h-8 text-orange-500 mb-3" />
            <p className="text-[#0F0F0F]/60 mb-2">In Escrow</p>
            <h2 className="text-2xl font-semibold text-[#0F0F0F]">{formatMultiCurrencyCompact(stats.inEscrowByCurrency)}</h2>
            <p className="text-xs text-[#0F0F0F]/40 mt-1">From upcoming events</p>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <Calendar className="w-8 h-8 text-[#2969FF] mb-3" />
            <p className="text-[#0F0F0F]/60 mb-2">Upcoming Payouts</p>
            <h2 className="text-2xl font-semibold text-[#2969FF]">{formatMultiCurrencyCompact(stats.upcomingPayoutsByCurrency)}</h2>
            <p className="text-xs text-[#0F0F0F]/40 mt-1">To be paid within 24 hours</p>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
            <p className="text-[#0F0F0F]/60 mb-2">Total Paid Out</p>
            <h2 className="text-2xl font-semibold text-green-600">{formatMultiCurrencyCompact(stats.totalPaidOutByCurrency)}</h2>
            <p className="text-xs text-[#0F0F0F]/40 mt-1">Successfully transferred</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Info Card */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl bg-blue-50/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-[#2969FF]" />
            </div>
            <div>
              <h3 className="font-medium text-[#0F0F0F] mb-1">Automatic Payouts</h3>
              <p className="text-sm text-[#0F0F0F]/60">
                Your earnings are automatically paid to your registered bank account within 24 hours after each event ends. 
                A 5% platform fee is deducted from ticket sales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Payouts */}
      {upcomingPayouts.length > 0 && (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-[#0F0F0F]">Upcoming Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingPayouts.map((payout) => (
                <div key={payout.id} className="p-4 rounded-xl bg-[#F4F6FA]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-[#0F0F0F] mb-1">{payout.event}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#0F0F0F]/60">
                        <span>Event ended: {formatDate(payout.eventEndDate)}</span>
                        <span className="text-[#2969FF] font-medium">
                          Payout: {formatDateTime(payout.payoutDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[#2969FF] font-semibold text-lg">{formatPrice(payout.netAmount, payout.currency)}</p>
                        <p className="text-xs text-[#0F0F0F]/40">Net amount</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700">
                        {payout.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPayoutReport(payout)}
                        className="rounded-lg"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[#0F0F0F]">Payout History</CardTitle>
          {payoutHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={downloadFullReport}
              className="rounded-xl"
            >
              <FileText className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {payoutHistory.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">No payout history yet</p>
              <p className="text-sm text-[#0F0F0F]/40 mt-1">
                Your completed payouts will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payoutHistory.map((payout) => (
                <div key={payout.id} className="p-4 rounded-xl bg-[#F4F6FA]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-[#0F0F0F] mb-1">{payout.event_title || 'Payout'}</h4>
                      <p className="text-sm text-[#0F0F0F]/60">{formatDate(payout.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[#2969FF] font-medium">{formatPrice(payout.amount, payout.currency)}</p>
                      </div>
                      <Badge
                        className={`${
                          payout.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : payout.status === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : payout.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-[#0F0F0F]/10 text-[#0F0F0F]/60'
                        }`}
                      >
                        {payout.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
