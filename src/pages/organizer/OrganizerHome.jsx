import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DollarSign, Users, Calendar, TrendingUp, Plus, Download, ShoppingCart, Loader2, Zap, X, Heart, Ticket, ArrowRight, ChevronRight, BarChart3, Sun } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatMultiCurrencyCompact, getUserDefaultCurrency, getDefaultCurrency } from '@/config/currencies';
import { TaxDocuments } from '@/components/TaxDocuments';
import { HelpTip } from '@/components/HelpTip';

export function OrganizerHome() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ salesByCurrency: {}, feesByCurrency: {},
    totalAttendees: 0,
    totalEvents: 0,
  });
  const [freeEventStats, setFreeEventStats] = useState({
    totalRSVPs: 0,
    totalDonations: 0,
    donationsByCurrency: {},
    freeEvents: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [promoterStats, setPromoterStats] = useState({
    activePromoters: 0,
    ticketsSold: 0,
    revenueByCurrency: {},
    unpaidByCurrency: {},
  });
  const [topPromoters, setTopPromoters] = useState([]);
  const [dailySales, setDailySales] = useState({ revenueByCurrency: {}, ticketsSold: 0, orders: 0 });
  const [defaultCurrency, setDefaultCurrency] = useState('USD'); // Fallback from user's country
  const [showConnectBanner, setShowConnectBanner] = useState(false);
  const [connectCountries, setConnectCountries] = useState([]);

  useEffect(() => {
    if (organizer?.id) {
      loadDashboardData();
    }
  }, [organizer?.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user's default currency from their country
      if (organizer?.user_id) {
        const currency = await getUserDefaultCurrency(supabase, organizer.user_id);
        if (currency) setDefaultCurrency(currency);
      }
      
      // Check if Connect banner should show
      await checkConnectBannerVisibility();
      
      await Promise.all([
        loadStats(),
        loadUpcomingEvents(),
        loadPromoterData(),
        loadFreeEventStats(),
        loadDailySales(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectBannerVisibility = async () => {
    try {
      // Check if banner was dismissed
      const dismissed = localStorage.getItem('connect_banner_dismissed');
      if (dismissed) return;

      // Check if organizer already has Connect
      if (organizer?.stripe_connect_status === 'active' || organizer?.stripe_connect_id) return;

      // Get Connect settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['stripe_connect_enabled', 'stripe_connect_countries']);

      const enabled = settings?.find(s => s.key === 'stripe_connect_enabled')?.value === 'true';
      let countries = [];
      try {
        countries = JSON.parse(settings?.find(s => s.key === 'stripe_connect_countries')?.value || '[]');
      } catch {
        countries = [];
      }
      
      if (!enabled || countries.length === 0) return;
      
      setConnectCountries(countries);

      // Check if organizer's country is eligible
      if (organizer?.country_code && countries.includes(organizer.country_code)) {
        setShowConnectBanner(true);
      }
    } catch (error) {
      console.error('Error checking Connect banner:', error);
    }
  };

  const dismissConnectBanner = () => {
    localStorage.setItem('connect_banner_dismissed', 'true');
    setShowConnectBanner(false);
  };

  const loadStats = async () => {
    // Get total events with currency and fee_handling
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, currency, fee_handling')
      .eq('organizer_id', organizer.id);

    if (eventsError) throw eventsError;

    const eventIds = events?.map(e => e.id) || [];
    const eventCurrencyMap = {};
    const eventFeeHandlingMap = {};
    events?.forEach(e => { 
      eventCurrencyMap[e.id] = e.currency || defaultCurrency;
      eventFeeHandlingMap[e.id] = e.fee_handling || 'pass_to_attendee';
    });

    // Get tickets sold for these events
    let totalTickets = 0;
    const salesByCurrency = {};
    const feesByCurrency = {};

    if (eventIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('quantity, total_price, event_id')
        .in('event_id', eventIds)
        .in('payment_status', ['completed', 'free', 'paid', 'complimentary']);

      if (!ticketsError && tickets) {
        totalTickets = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        
        // Group by currency
        tickets.forEach(t => {
          const currency = eventCurrencyMap[t.event_id] || defaultCurrency;
          if (!salesByCurrency[currency]) salesByCurrency[currency] = 0;
          salesByCurrency[currency] += parseFloat(t.total_price) || 0;
        });
      }

      // Get actual platform fees from orders - only for events where organizer absorbs fees
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('event_id, platform_fee, currency')
        .in('event_id', eventIds)
        .eq('status', 'completed');

      if (!ordersError && orders) {
        orders.forEach(o => {
          // Only count fee if organizer absorbs it
          if (eventFeeHandlingMap[o.event_id] === 'absorb') {
            const currency = o.currency || eventCurrencyMap[o.event_id] || defaultCurrency;
            if (!feesByCurrency[currency]) feesByCurrency[currency] = 0;
            feesByCurrency[currency] += parseFloat(o.platform_fee) || 0;
          }
        });
      }
    }

    setStats({
      salesByCurrency,
      feesByCurrency,
      totalAttendees: totalTickets,
      totalEvents: events?.length || 0,
    });
  };

  const loadFreeEventStats = async () => {
    try {
      // Get free events for this organizer
      const { data: freeEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, currency')
        .eq('organizer_id', organizer.id)
        .eq('is_free', true);

      if (eventsError) throw eventsError;

      const freeEventIds = freeEvents?.map(e => e.id) || [];
      const eventCurrencyMap = {};
      freeEvents?.forEach(e => {
        eventCurrencyMap[e.id] = e.currency || defaultCurrency;
      });

      let totalRSVPs = 0;
      let totalDonations = 0;
      const donationsByCurrency = {};

      if (freeEventIds.length > 0) {
        // Get RSVPs (tickets for free events)
        const { data: rsvps, error: rsvpError } = await supabase
          .from('tickets')
          .select('id, quantity, event_id')
          .in('event_id', freeEventIds);

        if (!rsvpError && rsvps) {
          totalRSVPs = rsvps.reduce((sum, t) => sum + (t.quantity || 1), 0);
        }

        // Get donations (orders with is_donation = true)
        const { data: donations, error: donationsError } = await supabase
          .from('orders')
          .select('id, total_amount, currency, event_id')
          .in('event_id', freeEventIds)
          .eq('is_donation', true)
          .eq('status', 'completed');

        if (!donationsError && donations) {
          totalDonations = donations.length;
          donations.forEach(d => {
            const currency = d.currency || eventCurrencyMap[d.event_id] || defaultCurrency;
            if (!donationsByCurrency[currency]) donationsByCurrency[currency] = 0;
            donationsByCurrency[currency] += parseFloat(d.total_amount) || 0;
          });
        }
      }

      setFreeEventStats({
        totalRSVPs,
        totalDonations,
        donationsByCurrency,
        freeEvents: freeEvents?.length || 0,
      });
    } catch (error) {
      console.error('Error loading free event stats:', error);
    }
  };

  const loadDailySales = async () => {
    try {
      // Get organizer's event IDs
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, currency')
        .eq('organizer_id', organizer.id);

      if (eventsError) throw eventsError;

      const eventIds = events?.map(e => e.id) || [];
      if (eventIds.length === 0) return;

      const eventCurrencyMap = {};
      events?.forEach(e => { eventCurrencyMap[e.id] = e.currency || defaultCurrency; });

      // Start of today in UTC
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // Get today's completed orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, currency, event_id')
        .in('event_id', eventIds)
        .eq('status', 'completed')
        .gte('created_at', todayISO);

      const revenueByCurrency = {};
      let orderCount = 0;
      if (!ordersError && orders) {
        orderCount = orders.length;
        orders.forEach(o => {
          const currency = o.currency || eventCurrencyMap[o.event_id] || defaultCurrency;
          revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + (parseFloat(o.total_amount) || 0);
        });
      }

      // Get today's tickets for ticket count
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('quantity, event_id')
        .in('event_id', eventIds)
        .in('payment_status', ['completed', 'paid'])
        .gte('created_at', todayISO);

      let ticketsSold = 0;
      if (!ticketsError && tickets) {
        ticketsSold = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      }

      setDailySales({ revenueByCurrency, ticketsSold, orders: orderCount });
    } catch (error) {
      console.error('Error loading daily sales:', error);
    }
  };

  const loadUpcomingEvents = async () => {
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        currency,
        start_date,
        total_capacity,
        is_free,
        ticket_types (
          id,
          quantity_available,
          quantity_sold,
          price
        )
      `)
      .eq('organizer_id', organizer.id)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error loading events:', error);
      return;
    }

    // Get RSVP counts for free events
    const freeEventIds = events?.filter(e => e.is_free).map(e => e.id) || [];
    let rsvpCounts = {};
    let donationAmounts = {};

    if (freeEventIds.length > 0) {
      // Get RSVP counts
      const { data: rsvps } = await supabase
        .from('tickets')
        .select('event_id, quantity')
        .in('event_id', freeEventIds);
      
      rsvps?.forEach(r => {
        rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] || 0) + (r.quantity || 1);
      });

      // Get donation amounts
      const { data: donations } = await supabase
        .from('orders')
        .select('event_id, total_amount')
        .in('event_id', freeEventIds)
        .eq('is_donation', true)
        .eq('status', 'completed');
      
      donations?.forEach(d => {
        donationAmounts[d.event_id] = (donationAmounts[d.event_id] || 0) + parseFloat(d.total_amount || 0);
      });
    }

    const eventsWithStats = events?.map(event => {
      const isFree = event.is_free;
      const ticketsSold = isFree 
        ? (rsvpCounts[event.id] || 0)
        : (event.ticket_types?.reduce((sum, t) => sum + (t.quantity_sold || 0), 0) || 0);
      const totalTickets = event.ticket_types?.reduce((sum, t) => sum + (t.quantity_available || 0), 0) || event.total_capacity || 100;
      const revenue = isFree
        ? (donationAmounts[event.id] || 0)
        : (event.ticket_types?.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0) || 0);

      return {
        id: event.id,
        name: event.title,
        date: new Date(event.start_date).toLocaleDateString('en-NG', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }),
        ticketsSold,
        totalTickets,
        revenue,
        currency: event.currency || defaultCurrency,
        isFree,
      };
    }) || [];

    setUpcomingEvents(eventsWithStats);
  };

  const loadPromoterData = async () => {
    // Get promoters for this organizer
    const { data: promoters, error } = await supabase
      .from('promoters')
      .select('*')
      .eq('organizer_id', organizer.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error loading promoters:', error);
      return;
    }

    const activePromoters = promoters?.length || 0;
    const promoterIds = promoters?.map(p => p.id) || [];

    // Get sales data with currency from events
    let ticketsSold = 0;
    const revenueByCurrency = {};
    const earnedByCurrency = {};
    const promoterEarnedByCurrency = {}; // Per-promoter earnings by currency

    if (promoterIds.length > 0) {
      const { data: salesData } = await supabase
        .from('promoter_sales')
        .select('promoter_id, sale_amount, commission_amount, tickets_sold, events(currency)')
        .in('promoter_id', promoterIds);

      salesData?.forEach(sale => {
        const currency = sale.events?.currency || getDefaultCurrency(sale.events?.country_code || sale.events?.country);
        const promoterId = sale.promoter_id;
        ticketsSold += sale.tickets_sold || 0;
        revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + parseFloat(sale.sale_amount || 0);
        earnedByCurrency[currency] = (earnedByCurrency[currency] || 0) + parseFloat(sale.commission_amount || 0);
        
        // Track per-promoter earnings by currency
        if (!promoterEarnedByCurrency[promoterId]) {
          promoterEarnedByCurrency[promoterId] = {};
        }
        promoterEarnedByCurrency[promoterId][currency] = (promoterEarnedByCurrency[promoterId][currency] || 0) + parseFloat(sale.commission_amount || 0);
      });

      // Get completed payouts (grouped by currency when available)
      const { data: payoutsData } = await supabase
        .from('promoter_payouts')
        .select('promoter_id, amount, currency')
        .in('promoter_id', promoterIds)
        .eq('status', 'completed');

      const paidByCurrency = {};
      payoutsData?.forEach(payout => {
        const currency = payout.currency || getDefaultCurrency(payout.country_code || organizer?.country_code || organizer?.country);
        paidByCurrency[currency] = (paidByCurrency[currency] || 0) + parseFloat(payout.amount || 0);
      });

      // Calculate unpaid by currency
      const unpaidByCurrency = {};
      Object.keys(earnedByCurrency).forEach(currency => {
        const unpaid = (earnedByCurrency[currency] || 0) - (paidByCurrency[currency] || 0);
        if (unpaid > 0) unpaidByCurrency[currency] = unpaid;
      });
    }

    setPromoterStats({
      activePromoters,
      ticketsSold,
      revenueByCurrency,
      unpaidByCurrency: typeof unpaidByCurrency !== 'undefined' ? unpaidByCurrency : {},
    });

    // Top promoters by sales - enriched with earnedByCurrency
    const enrichedPromoters = (promoters || []).map(p => ({
      ...p,
      earnedByCurrency: promoterEarnedByCurrency[p.id] || {}
    }));
    const sorted = enrichedPromoters.sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0));
    setTopPromoters(sorted.slice(0, 3));
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  // Total revenue across all currencies
  const totalRevenuePrimary = Object.entries(stats.salesByCurrency || {});
  const primaryCurrency = totalRevenuePrimary[0]?.[0] || defaultCurrency;
  const primaryAmount = totalRevenuePrimary[0]?.[1] || 0;
  const primaryNet = primaryAmount - (stats.feesByCurrency?.[primaryCurrency] || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome back{organizer?.organization_name ? `, ${organizer.organization_name}` : ''}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's how your events are performing</p>
        </div>
        <Button
          onClick={() => navigate('/organizer/events/create')}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-10 px-5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Stripe Connect Promotion Banner */}
      {showConnectBanner && (
        <div className="relative rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <button
            onClick={dismissConnectBanner}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-purple-100 transition-colors text-purple-400 hover:text-purple-600"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-sm">Get Paid Faster with Stripe Connect</h3>
              <p className="text-muted-foreground text-sm mt-0.5">
                Receive ticket sales directly, with automatic payouts and instant refund processing.
              </p>
            </div>
            <Link
              to="/organizer/stripe-connect"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors flex-shrink-0"
            >
              Set Up Now
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#2969FF]/20 bg-blue-50/50 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#2969FF] uppercase tracking-wider">Today's Sales</span>
              <div className="w-8 h-8 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
                <Sun className="w-4 h-4 text-[#2969FF]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {Object.keys(dailySales.revenueByCurrency).length > 0
                ? formatMultiCurrencyCompact(dailySales.revenueByCurrency)
                : formatPrice(0, defaultCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {dailySales.ticketsSold} ticket{dailySales.ticketsSold !== 1 ? 's' : ''} · {dailySales.orders} order{dailySales.orders !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#2969FF]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {formatPrice(primaryAmount, primaryCurrency)}
            </p>
            {totalRevenuePrimary.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {totalRevenuePrimary.slice(1).map(([currency, amount]) => (
                  <span key={currency} className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-md">
                    {formatPrice(amount, currency)}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Earnings</span>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {formatPrice(primaryNet, primaryCurrency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">After platform fees</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tickets Sold</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {stats.totalAttendees.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Across all events</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Events</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {stats.totalEvents}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total created</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/organizer/attendees')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-gray-200 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors"
        >
          <Users className="w-4 h-4 text-muted-foreground" />
          Attendees
        </button>
        <button
          onClick={() => navigate('/organizer/finance')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-gray-200 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4 text-muted-foreground" />
          Payouts
        </button>
        <button
          onClick={() => navigate('/organizer/events')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-gray-200 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors"
        >
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          Analytics
        </button>
      </div>

      {/* Free Events Stats */}
      {freeEventStats.freeEvents > 0 && (
        <Card className="rounded-2xl border-gray-200 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Heart className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Free Events</h3>
              <HelpTip>Track RSVPs and donations for your free events.</HelpTip>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:divide-x md:divide-gray-200">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Events</p>
                <p className="text-lg font-bold text-foreground">{freeEventStats.freeEvents}</p>
              </div>
              <div className="md:pl-4">
                <p className="text-xs text-muted-foreground mb-1">RSVPs</p>
                <p className="text-lg font-bold text-foreground">{freeEventStats.totalRSVPs.toLocaleString()}</p>
              </div>
              <div className="md:pl-4">
                <p className="text-xs text-muted-foreground mb-1">Donations</p>
                <p className="text-lg font-bold text-foreground">{freeEventStats.totalDonations}</p>
              </div>
              <div className="md:pl-4">
                <p className="text-xs text-muted-foreground mb-1">Donation Amount</p>
                <p className="text-lg font-bold text-emerald-600">
                  {Object.keys(freeEventStats.donationsByCurrency).length > 0
                    ? formatMultiCurrencyCompact(freeEventStats.donationsByCurrency)
                    : formatPrice(0, defaultCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <hr className="border-gray-200" />

      {/* Upcoming Events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Upcoming Events</h2>
          <Link to="/organizer/events" className="text-[#2969FF] text-sm font-medium hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-gray-300 shadow-none">
            <CardContent className="p-10 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-4">No upcoming events yet</p>
              <Button
                onClick={() => navigate('/organizer/events/create')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-gray-200 shadow-none overflow-hidden">
            <div className="divide-y divide-gray-100">
              {upcomingEvents.map((event) => {
                const soldPercent = Math.min((event.ticketsSold / event.totalTickets) * 100, 100);
                return (
                  <div
                    key={event.id}
                    onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                    className="group flex items-center gap-4 p-4 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    {/* Date badge */}
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                      event.isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-[#2969FF]'
                    }`}>
                      <span className="text-[10px] font-semibold leading-none uppercase">{event.date.split(' ')[0]}</span>
                      <span className="text-base font-bold leading-snug">{event.date.split(' ')[1]?.replace(',', '')}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground text-sm truncate">{event.name}</h4>
                        {event.isFree && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded flex-shrink-0">Free</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.ticketsSold}/{event.totalTickets} {event.isFree ? 'RSVPs' : 'sold'}
                        </span>
                        {/* Inline progress bar */}
                        <div className="flex-1 max-w-[120px] h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${event.isFree ? 'bg-emerald-400' : 'bg-[#2969FF]'}`}
                            style={{ width: `${soldPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{Math.round(soldPercent)}%</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {event.isFree ? (
                        event.revenue > 0 ? (
                          <p className="text-emerald-600 font-semibold text-sm flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {formatPrice(event.revenue, event.currency)}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )
                      ) : (
                        <p className="text-foreground font-semibold text-sm">{formatPrice(event.revenue, event.currency)}</p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#2969FF] transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Promoters & Affiliates Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Promoters & Affiliates</h2>
            <HelpTip>Invite promoters to sell tickets and earn commission.</HelpTip>
          </div>
          <Link to="/organizer/promoters" className="text-[#2969FF] text-sm font-medium hover:underline flex items-center gap-1">
            Manage <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <Card className="rounded-2xl border-gray-200 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Active Promoters</p>
              <p className="text-xl font-bold text-foreground">{promoterStats.activePromoters}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Tickets Sold</p>
              <p className="text-xl font-bold text-foreground">{promoterStats.ticketsSold}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Revenue</p>
              <p className="text-lg font-bold text-foreground">{formatMultiCurrencyCompact(promoterStats.revenueByCurrency)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Unpaid</p>
              <p className="text-lg font-bold text-orange-600">{formatMultiCurrencyCompact(promoterStats.unpaidByCurrency)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Promoters */}
        {topPromoters.length > 0 ? (
          <Card className="rounded-2xl border-gray-200 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Top Promoters</p>
              <div className="space-y-3">
                {topPromoters.map((promoter, i) => (
                  <div key={promoter.id} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground/40 w-4 text-center">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2969FF] to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                      {promoter.name?.[0]?.toUpperCase() || 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{promoter.name}</p>
                      <p className="text-xs text-muted-foreground">{promoter.commission_value}% &middot; {promoter.promo_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{promoter.total_sales || 0} sales</p>
                      <p className="text-xs text-green-600">{formatMultiCurrencyCompact(promoter.earnedByCurrency || {})}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-dashed border-gray-300 shadow-none">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No promoters yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/organizer/promoters')}
                className="mt-3 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Promoter
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tax Documents */}
      {organizer?.id && (
        <TaxDocuments type="organizer" recipientId={organizer.id} countryCode={organizer?.country_code || 'NG'} />
      )}
    </div>
  );
}
