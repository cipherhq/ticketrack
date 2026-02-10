import { getCountryFees } from '@/config/fees';
import { formatPrice, formatMultiCurrencyCompact, getDefaultCurrency } from '@/config/currencies';
import { calculatePayoutDate, formatPayoutDelayLabel, getPayoutDelayDays } from '@/config/payoutThresholds';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Clock, CheckCircle, Plus, CreditCard, Building2,
  Download, Calendar, Loader2, FileText, HelpCircle, Zap, AlertCircle, Info,
  ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, ShieldX
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../../components/ui/dialog';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { HelpTip } from '@/components/HelpTip';
import { 
  checkFastPayoutEligibility, 
  requestFastPayout, 
  getFastPayoutHistory,
  formatFastPayoutStatus,
  calculateFastPayoutFee 
} from '@/services/fastPayout';
import { toast } from 'sonner';

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
  
  // Fast Payout state
  const [fastPayoutEligibility, setFastPayoutEligibility] = useState(null);
  const [fastPayoutHistory, setFastPayoutHistory] = useState([]);
  const [fastPayoutDialog, setFastPayoutDialog] = useState(false);
  const [fastPayoutAmount, setFastPayoutAmount] = useState('');
  const [fastPayoutProcessing, setFastPayoutProcessing] = useState(false);
  const [fastPayoutFee, setFastPayoutFee] = useState({ gross: 0, fee: 0, net: 0 });
  const [escrowEvents, setEscrowEvents] = useState([]);
  const [escrowExpanded, setEscrowExpanded] = useState(false);
  const [totalBalanceByCurrency, setTotalBalanceByCurrency] = useState({});

  useEffect(() => {
    if (organizer?.id) {
      loadPayoutData();
      loadFastPayoutData();
    }
  }, [organizer?.id]);

  // Update fee calculation when amount changes
  useEffect(() => {
    const amount = parseFloat(fastPayoutAmount) || 0;
    if (amount > 0 && fastPayoutEligibility?.fee_percentage) {
      setFastPayoutFee(calculateFastPayoutFee(amount, fastPayoutEligibility.fee_percentage));
    } else {
      setFastPayoutFee({ gross: 0, fee: 0, net: 0 });
    }
  }, [fastPayoutAmount, fastPayoutEligibility]);

  const loadFastPayoutData = async () => {
    try {
      // Check eligibility
      const eligibility = await checkFastPayoutEligibility(organizer.id);
      setFastPayoutEligibility(eligibility);
      
      // Load history
      const history = await getFastPayoutHistory(organizer.id);
      setFastPayoutHistory(history);
    } catch (err) {
      console.error('Error loading fast payout data:', err);
    }
  };

  const handleFastPayoutRequest = async () => {
    const amount = parseFloat(fastPayoutAmount);
    
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (amount > fastPayoutEligibility?.max_payout) {
      toast.error(`Maximum payout is ${formatPrice(fastPayoutEligibility.max_payout, fastPayoutEligibility.currency)}`);
      return;
    }
    
    setFastPayoutProcessing(true);
    try {
      const result = await requestFastPayout(organizer.id, amount);
      
      if (result.success) {
        toast.success(`Fast payout of ${formatPrice(result.data.net_amount, result.data.currency)} initiated!`);
        setFastPayoutDialog(false);
        setFastPayoutAmount('');
        // Reload data
        loadPayoutData();
        loadFastPayoutData();
      } else {
        toast.error(result.error || 'Failed to process fast payout');
      }
    } catch (err) {
      console.error('Fast payout error:', err);
      toast.error(err.message || 'Failed to process fast payout');
    } finally {
      setFastPayoutProcessing(false);
    }
  };

  const loadPayoutData = async () => {
    setLoading(true);
    try {
      const now = new Date();

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
          is_free,
          fee_handling,
          event_type,
          orders (
            id,
            subtotal,
            platform_fee,
            platform_fee_absorbed,
            total_amount,
            status,
            created_at,
            event_id,
            is_donation
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
        .from('payouts')
        .select('*')
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      // Build set of event IDs that already have completed payouts
      const paidEventIds = new Set();
      payouts?.filter(p => p.status === 'completed')?.forEach(p => {
        if (p.event_id) paidEventIds.add(p.event_id);
      });

      // Calculate stats and categorize by currency
      // Group orders by their actual event (child event if recurring, parent otherwise)
      const upcomingPayoutsByCurrency = {};
      const upcoming = [];

      // Track total revenue from all completed orders (for escrow/total balance calculation)
      const totalRevenueByCurrency = {};

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

      // Build a map of parent events for looking up event_type on child events
      const parentEventMap = {};
      parentEvents.forEach(e => { parentEventMap[e.id] = e; });

      // Process each group of orders by event date
      const escrowEventsList = [];

      Object.values(ordersByEventDate).forEach(({ event, orders, currency }) => {
        if (orders.length === 0) return;

        // Separate regular orders and donation orders
        const regularOrders = orders.filter(o => !o.is_donation);
        const donationOrders = orders.filter(o => o.is_donation);

        // Regular ticket revenue from subtotal
        const ticketSubtotal = regularOrders.reduce((sum, o) => sum + (parseFloat(o.subtotal) || 0), 0);
        const ticketPlatformFee = regularOrders.reduce((sum, o) => sum + (parseFloat(o.platform_fee) || 0), 0);

        // Donation revenue from total_amount (subtotal is 0 for free events)
        const donationTotal = donationOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        const donationPlatformFee = donationOrders.reduce((sum, o) => sum + (parseFloat(o.platform_fee) || 0), 0);

        const subtotalAmount = ticketSubtotal + donationTotal;
        const platformFeeTotal = ticketPlatformFee + donationPlatformFee;

        // If organizer absorbed the fee (fee_handling = 'absorb'), deduct platform fee from their payout
        // Otherwise, they receive the full subtotal (attendee paid the fee)
        const organizerAbsorbsFee = event.fee_handling === 'absorb';
        const netAmount = organizerAbsorbsFee
          ? subtotalAmount - platformFeeTotal
          : subtotalAmount;

        if (netAmount <= 0) return;

        // Add to total revenue (all completed orders contribute to escrow)
        totalRevenueByCurrency[currency] = (totalRevenueByCurrency[currency] || 0) + netAmount;

        const eventEndDate = new Date(event.end_date);

        // Use event_type from event, or fall back to parent's event_type for child events
        const eventType = event.event_type
          || (event.parent_event_id && parentEventMap[event.parent_event_id]?.event_type)
          || 'other';
        const orderCount = orders.length;
        const payoutDate = calculatePayoutDate(event.end_date, eventType, orderCount);
        const delayLabel = formatPayoutDelayLabel(eventType, orderCount);

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

        // Determine status based on payout completion, event end date, and payout date
        let status;
        if (paidEventIds.has(event.id)) {
          status = 'Paid'; // Already paid out
        } else if (eventEndDate > now) {
          status = 'Scheduled'; // Event hasn't ended yet
        } else if (payoutDate > now) {
          status = 'Processing'; // Event ended, within hold period
        } else {
          status = 'Ready'; // Past payout date, ready for payout
        }

        // Only add to upcoming totals if not yet paid
        if (status !== 'Paid') {
          upcomingPayoutsByCurrency[currency] = (upcomingPayoutsByCurrency[currency] || 0) + netAmount;
        }
        upcoming.push({
          id: event.id,
          currency,
          event: eventDisplayName,
          orderCount,
          grossAmount: subtotalAmount,
          platformFee: platformFeeTotal,
          feeAbsorbed: organizerAbsorbsFee,
          netAmount,
          eventEndDate: event.end_date,
          payoutDate: payoutDate.toISOString(),
          delayLabel,
          status,
        });

        // Also track in escrow events for the breakdown view (only events not yet ended)
        if (eventEndDate > now) {
          escrowEventsList.push({
            id: event.id,
            currency,
            event: eventDisplayName,
            orderCount,
            netAmount,
            eventEndDate: event.end_date,
            payoutDate: payoutDate.toISOString(),
            delayLabel,
          });
        }
      });

      // Total paid out from payouts table - group by currency (use net_amount - what organizer actually receives)
      const totalPaidOutByCurrency = {};
      payouts?.filter(p => p.status === 'completed')?.forEach(p => {
        const currency = p.currency || getDefaultCurrency(p.country_code || organizer?.country_code || organizer?.country);
        totalPaidOutByCurrency[currency] = (totalPaidOutByCurrency[currency] || 0) + (parseFloat(p.net_amount) || parseFloat(p.amount) || 0);
      });

      // Calculate escrow = total revenue - total paid out
      // This represents the organizer's current balance on the platform
      const inEscrowByCurrency = {};
      Object.entries(totalRevenueByCurrency).forEach(([currency, revenue]) => {
        const paidOut = totalPaidOutByCurrency[currency] || 0;
        const escrowAmount = revenue - paidOut;
        if (escrowAmount > 0) {
          inEscrowByCurrency[currency] = escrowAmount;
        }
      });

      // Total Balance = In Escrow (they represent the same value)
      const computedTotalBalance = { ...inEscrowByCurrency };

      setStats({
        inEscrowByCurrency,
        upcomingPayoutsByCurrency,
        totalPaidOutByCurrency,
      });

      setEscrowEvents(escrowEventsList.sort((a, b) => new Date(a.eventEndDate) - new Date(b.eventEndDate)));
      setTotalBalanceByCurrency(computedTotalBalance);
      setUpcomingPayouts(upcoming.sort((a, b) => new Date(a.payoutDate) - new Date(b.payoutDate)));
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
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            Finance & Payouts
            <HelpTip>Payouts are processed automatically after each event. Funds are held in escrow until the event date, then paid out to your bank account within 3-5 business days.</HelpTip>
          </h2>
          <p className="text-muted-foreground mt-1">Track your earnings and payout schedule</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate('/organizer/bank-account')}
            variant="outline"
            className="rounded-xl border-border/10"
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

      {/* KYC Status */}
      {(() => {
        const kycStatus = organizer?.kyc_status;
        const kycVerified = organizer?.kyc_verified;
        const isVerified = kycVerified || kycStatus === 'verified';
        const isInReview = kycStatus === 'in_review';
        const isRejected = kycStatus === 'rejected';
        const notStarted = !kycStatus || kycStatus === 'pending' || kycStatus === 'not_started';

        if (isVerified) {
          return (
            <Card className="border-green-200 rounded-2xl bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">KYC Verified</span>
                  <span className="text-xs text-green-600/70 dark:text-green-500 ml-2">Your identity has been verified. Payouts are enabled.</span>
                </div>
                <Badge className="bg-green-100 text-green-700 border-0">Verified</Badge>
              </CardContent>
            </Card>
          );
        }

        if (isInReview) {
          return (
            <Card className="border-yellow-200 rounded-2xl bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">KYC Under Review</span>
                  <span className="text-xs text-yellow-600/70 dark:text-yellow-500 ml-2">Your documents are being reviewed. This usually takes 1-2 business days.</span>
                </div>
                <Badge className="bg-yellow-100 text-yellow-700 border-0">In Review</Badge>
              </CardContent>
            </Card>
          );
        }

        if (isRejected) {
          return (
            <Card className="border-red-200 rounded-2xl bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldX className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">KYC Verification Rejected</p>
                  <p className="text-xs text-red-600/70 dark:text-red-500 mt-0.5">Your verification was not approved. Please resubmit with correct documents to enable payouts.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/organizer/kyc')}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl whitespace-nowrap"
                >
                  Resubmit KYC
                </Button>
              </CardContent>
            </Card>
          );
        }

        // Not started
        return (
          <Card className="border-amber-300 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-2">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Complete Your KYC Verification</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Identity verification is required before payouts can be processed. Complete your KYC to start receiving your earnings.
                </p>
              </div>
              <Button
                onClick={() => navigate('/organizer/kyc')}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Verify Now
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-border/10 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50">
          <CardContent className="p-6">
            <DollarSign className="w-8 h-8 text-indigo-500 mb-3" />
            <p className="text-muted-foreground mb-2">Total Balance</p>
            <h2 className="text-2xl font-semibold text-indigo-600">{formatMultiCurrencyCompact(totalBalanceByCurrency)}</h2>
            <p className="text-xs text-muted-foreground mt-1">Revenue minus completed payouts</p>
          </CardContent>
        </Card>
        <Card
          className="border-border/10 rounded-2xl cursor-pointer hover:border-orange-200 transition-colors"
          onClick={() => escrowEvents.length > 0 && setEscrowExpanded(!escrowExpanded)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-8 h-8 text-orange-500" />
              {escrowEvents.length > 0 && (
                escrowExpanded
                  ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  : <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-muted-foreground mb-2">In Escrow</p>
            <h2 className="text-2xl font-semibold text-foreground">{formatMultiCurrencyCompact(stats.inEscrowByCurrency)}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {escrowEvents.length > 0
                ? `${escrowEvents.length} active event${escrowEvents.length !== 1 ? 's' : ''}`
                : 'From upcoming events'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <Calendar className="w-8 h-8 text-[#2969FF] mb-3" />
            <p className="text-muted-foreground mb-2">Pending Payouts</p>
            <h2 className="text-2xl font-semibold text-[#2969FF]">{formatMultiCurrencyCompact(stats.upcomingPayoutsByCurrency)}</h2>
            <p className="text-xs text-muted-foreground mt-1">Total from all events with orders</p>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
            <p className="text-muted-foreground mb-2">Total Paid Out</p>
            <h2 className="text-2xl font-semibold text-green-600">{formatMultiCurrencyCompact(stats.totalPaidOutByCurrency)}</h2>
            <p className="text-xs text-muted-foreground mt-1">Successfully transferred</p>
          </CardContent>
        </Card>
      </div>

      {/* Escrow Breakdown */}
      {escrowExpanded && escrowEvents.length > 0 && (
        <Card className="border-orange-200 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Escrow Breakdown by Event
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {escrowEvents.map((item) => (
                <div key={item.id} className="p-4 rounded-xl bg-orange-50/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground mb-1">{item.event}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{item.orderCount} order{item.orderCount !== 1 ? 's' : ''}</span>
                        <span>Event ends: {formatDate(item.eventEndDate)}</span>
                        <span>Expected payout: {formatDate(item.payoutDate)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.delayLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-orange-600 font-semibold text-lg">{formatPrice(item.netAmount, item.currency)}</p>
                      <p className="text-xs text-muted-foreground">Net amount</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex items-center justify-between px-4">
                <span className="font-medium text-muted-foreground">Total in Escrow</span>
                <span className="font-semibold text-foreground">{formatMultiCurrencyCompact(stats.inEscrowByCurrency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fast Payout Card */}
      {fastPayoutEligibility?.eligible && (
        <Card className="border-border/10 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    Fast Payout Available
                    <Badge className="bg-amber-100 text-amber-700 text-xs">0.5% fee</Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Get your earnings now instead of waiting. Up to {formatPrice(fastPayoutEligibility.max_payout, fastPayoutEligibility.currency)} available.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fastPayoutEligibility.sales_percentage?.toFixed(0)}% tickets sold • {fastPayoutEligibility.cap_percentage}% payout cap
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => {
                  setFastPayoutAmount(fastPayoutEligibility.max_payout.toString());
                  setFastPayoutDialog(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl whitespace-nowrap"
              >
                <Zap className="w-4 h-4 mr-2" />
                Request Fast Payout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Eligible Info */}
      {fastPayoutEligibility && !fastPayoutEligibility.eligible && (
        <Card className="border-border/10 rounded-2xl bg-background">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Fast Payout</h3>
                <p className="text-sm text-muted-foreground">
                  {fastPayoutEligibility.reason || 'Not currently available'}
                </p>
                {fastPayoutEligibility.sales_percentage !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current sales: {fastPayoutEligibility.sales_percentage?.toFixed(0)}% • Required: {fastPayoutEligibility.required_percentage}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Info Card */}
      <Card className="border-border/10 rounded-2xl bg-blue-50/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-[#2969FF]" />
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Automatic Payouts</h3>
              <p className="text-sm text-muted-foreground">
                Your earnings are automatically paid to your registered bank account after each event ends.
                The hold period varies by event type (0-7 days) and event size, then funds are transferred within 3-5 business days.
                A 5% platform fee is deducted from ticket sales.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fast Payout History */}
      {fastPayoutHistory.length > 0 && (
        <Card className="border-border/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Fast Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fastPayoutHistory.slice(0, 5).map((payout) => {
                const status = formatFastPayoutStatus(payout.status);
                return (
                  <div key={payout.id} className="p-4 rounded-xl bg-muted">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-foreground mb-1">
                          {payout.event?.title || 'Fast Payout'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payout.requested_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-amber-600 font-medium">
                            {formatPrice(payout.net_amount, payout.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Fee: {formatPrice(payout.fee_amount, payout.currency)}
                          </p>
                        </div>
                        <Badge className={`bg-${status.color}-100 text-${status.color}-700`}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payouts */}
      {upcomingPayouts.length > 0 && (
        <Card className="border-border/10 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground">Upcoming Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingPayouts.map((payout) => (
                <div key={payout.id} className="p-4 rounded-xl bg-muted">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground mb-1">{payout.event}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{payout.orderCount} order{payout.orderCount !== 1 ? 's' : ''}</span>
                        <span>Event ended: {formatDate(payout.eventEndDate)}</span>
                        <span className="text-[#2969FF] font-medium">
                          Payout: {formatDateTime(payout.payoutDate)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{payout.delayLabel}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[#2969FF] font-semibold text-lg">{formatPrice(payout.netAmount, payout.currency)}</p>
                        <p className="text-xs text-muted-foreground">Net amount</p>
                      </div>
                      <Badge className={
                        payout.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        payout.status === 'Ready' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        payout.status === 'Processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }>
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
      <Card className="border-border/10 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Payout History</CardTitle>
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
              <Building2 className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">No payout history yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your completed payouts will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payoutHistory.map((payout) => (
                <div key={payout.id} className={`p-4 rounded-xl ${payout.is_advance ? 'bg-purple-50' : 'bg-muted'}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground">{payout.payout_number || 'Payout'}</h4>
                        {payout.is_advance && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">Advance</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(payout.processed_at || payout.created_at)}</p>
                      {payout.notes && (
                        <p className="text-xs text-[#2969FF] mt-1">{payout.notes.replace('Events: ', '').replace('Advance Payment: ', '').replace('Advance Payment', '')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-medium ${payout.is_advance ? 'text-purple-600' : 'text-green-600'}`}>{formatPrice(payout.net_amount || payout.amount, payout.currency)}</p>
                        {payout.net_amount && payout.amount && payout.net_amount !== payout.amount && !payout.is_advance && (
                          <p className="text-xs text-muted-foreground">Gross: {formatPrice(payout.amount, payout.currency)}</p>
                        )}
                      </div>
                      <Badge
                        className={`${
                          payout.is_advance
                            ? 'bg-purple-100 text-purple-700'
                            : payout.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : payout.status === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : payout.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-[#0F0F0F]/10 text-muted-foreground'
                        }`}
                      >
                        {payout.is_advance ? 'advance' : payout.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fast Payout Dialog */}
      <Dialog open={fastPayoutDialog} onOpenChange={setFastPayoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Request Fast Payout
            </DialogTitle>
            <DialogDescription>
              Get your earnings now with a small 0.5% processing fee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Available Amount */}
            <div className="bg-amber-50 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Available for Fast Payout</div>
              <div className="text-2xl font-bold text-amber-600">
                {formatPrice(fastPayoutEligibility?.max_payout || 0, fastPayoutEligibility?.currency)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {fastPayoutEligibility?.cap_percentage}% of available earnings
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>Amount to withdraw</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {fastPayoutEligibility?.currency || 'NGN'}
                </span>
                <Input
                  type="number"
                  value={fastPayoutAmount}
                  onChange={(e) => setFastPayoutAmount(e.target.value)}
                  placeholder="0.00"
                  max={fastPayoutEligibility?.max_payout}
                  className="pl-14 h-12 rounded-xl text-lg"
                />
              </div>
              <Button
                variant="link"
                className="text-xs text-amber-600 p-0 h-auto"
                onClick={() => setFastPayoutAmount(fastPayoutEligibility?.max_payout?.toString() || '')}
              >
                Use maximum amount
              </Button>
            </div>

            {/* Fee Breakdown */}
            {fastPayoutFee.gross > 0 && (
              <div className="border rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{formatPrice(fastPayoutFee.gross, fastPayoutEligibility?.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing Fee (0.5%)</span>
                  <span className="text-red-500">-{formatPrice(fastPayoutFee.fee, fastPayoutEligibility?.currency)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>You'll Receive</span>
                  <span className="text-green-600">{formatPrice(fastPayoutFee.net, fastPayoutEligibility?.currency)}</span>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Funds will be sent to your registered bank account within minutes. 
                The remaining {100 - (fastPayoutEligibility?.cap_percentage || 70)}% is held as a buffer for potential refunds.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFastPayoutDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFastPayoutRequest}
              disabled={fastPayoutProcessing || !fastPayoutAmount || parseFloat(fastPayoutAmount) <= 0}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
            >
              {fastPayoutProcessing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Confirm Fast Payout</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
