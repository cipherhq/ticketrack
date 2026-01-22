import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DollarSign, Users, Calendar, TrendingUp, Plus, Eye, Download, Link2, ShoppingCart, Loader2, Zap, X, Heart, Ticket, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
      const countries = JSON.parse(settings?.find(s => s.key === 'stripe_connect_countries')?.value || '[]');
      
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
        .eq('payment_status', 'completed');

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

  return (
    <div className="space-y-6">
      {/* Stripe Connect Promotion Banner */}
      {showConnectBanner && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 p-6 text-white shadow-lg">
          <button
            onClick={dismissConnectBanner}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-8 h-8" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">Get Paid Faster with Stripe Connect</h3>
              <p className="text-white/90 text-sm mb-3">
                Connect your Stripe account to receive ticket sales directly. Payouts are automatic, 
                and you can process refunds instantly from your dashboard.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-white/80">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Direct payouts to your bank
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  2-3 day transfers after events
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Instant refund processing
                </span>
              </div>
            </div>
            
            <Link
              to="/organizer/stripe-connect"
              className="flex-shrink-0 px-6 py-3 bg-white text-purple-700 font-semibold rounded-xl hover:bg-purple-50 transition-colors shadow-md"
            >
              Set Up Now
            </Link>
          </div>
        </div>
      )}

      {/* Revenue by Currency - Mobile optimized grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {Object.entries(stats.salesByCurrency || {}).map(([currency, amount]) => (
          <Card key={currency} className="border-[#0F0F0F]/10 rounded-xl sm:rounded-2xl">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[#0F0F0F]/60 text-xs sm:text-sm mb-1 sm:mb-2">{currency} Sales</p>
                  <h2 className="text-lg sm:text-2xl font-semibold text-[#0F0F0F] mb-0.5 sm:mb-1 truncate">
                    {formatPrice(amount, currency)}
                  </h2>
                  <p className="text-xs sm:text-sm text-green-600 truncate">Net: {formatPrice(amount - (stats.feesByCurrency?.[currency] || 0), currency)}</p>
                </div>
                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[#2969FF]/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-[#2969FF]" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card className="border-[#0F0F0F]/10 rounded-xl sm:rounded-2xl">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[#0F0F0F]/60 text-xs sm:text-sm mb-1 sm:mb-2">Tickets Sold</p>
                <h2 className="text-lg sm:text-2xl font-semibold text-[#0F0F0F] mb-0.5 sm:mb-1">
                  {stats.totalAttendees.toLocaleString()}
                </h2>
                <p className="text-xs sm:text-sm text-green-600">All events</p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl sm:rounded-2xl">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[#0F0F0F]/60 text-xs sm:text-sm mb-1 sm:mb-2">Total Events</p>
                <h2 className="text-lg sm:text-2xl font-semibold text-[#0F0F0F] mb-0.5 sm:mb-1">
                  {stats.totalEvents}
                </h2>
                <p className="text-xs sm:text-sm text-green-600">Created</p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Free Events Stats */}
      {freeEventStats.freeEvents > 0 && (
        <Card className="border-[#0F0F0F]/10 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="p-3 sm:p-6 pb-0 sm:pb-0">
            <CardTitle className="text-[#0F0F0F] flex items-center gap-2 text-sm sm:text-base">
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              Free Events Overview
              <HelpTip>Track RSVPs and donations for your free events. Free events are a great way to build your audience!</HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-3 sm:pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <div className="p-2 sm:p-4 rounded-lg sm:rounded-xl bg-white/80 border border-green-100">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                  <span className="text-xs sm:text-sm text-[#0F0F0F]/60">Free Events</span>
                </div>
                <p className="text-lg sm:text-2xl font-semibold text-[#0F0F0F]">{freeEventStats.freeEvents}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/80 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Total RSVPs</span>
                </div>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{freeEventStats.totalRSVPs.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/80 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Donations</span>
                </div>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{freeEventStats.totalDonations}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/80 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Donation Amount</span>
                </div>
                <p className="text-xl font-semibold text-emerald-600">
                  {Object.keys(freeEventStats.donationsByCurrency).length > 0 
                    ? formatMultiCurrencyCompact(freeEventStats.donationsByCurrency)
                    : formatPrice(0, defaultCurrency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
            Quick Actions
            <HelpTip>Common tasks to manage your events and sales</HelpTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button 
              onClick={() => navigate('/organizer/events/create')}
              className="w-full h-14 rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90 text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/organizer/attendees')}
              className="w-full h-14 rounded-xl border-[#0F0F0F]/10"
            >
              <Eye className="w-5 h-5 mr-2" />
              View Attendees
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/organizer/finance')}
              className="w-full h-14 rounded-xl border-[#0F0F0F]/10"
            >
              <Download className="w-5 h-5 mr-2" />
              View Payouts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0F0F0F]">Upcoming Events</CardTitle>
            <Link to="/organizer/events" className="text-[#2969FF] text-sm hover:underline">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-3" />
              <p className="text-[#0F0F0F]/60 mb-4">No upcoming events</p>
              <Button 
                onClick={() => navigate('/organizer/events/create')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                  className={`p-4 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    event.isFree 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100' 
                      : 'bg-[#F4F6FA] hover:bg-[#F4F6FA]/80'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-[#0F0F0F]">{event.name}</h4>
                      {event.isFree && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Free</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-6 text-sm text-[#0F0F0F]/60">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4" />
                        <span>
                          {event.ticketsSold}/{event.totalTickets} {event.isFree ? 'RSVPs' : 'sold'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {event.isFree ? (
                      event.revenue > 0 ? (
                        <>
                          <p className="text-emerald-600 font-medium mb-1 flex items-center justify-end gap-1">
                            <Heart className="w-3 h-3" />
                            {formatPrice(event.revenue, event.currency)}
                          </p>
                          <p className="text-xs text-[#0F0F0F]/50">in donations</p>
                        </>
                      ) : (
                        <p className="text-[#0F0F0F]/40 text-sm">No donations yet</p>
                      )
                    ) : (
                      <>
                        <p className="text-[#2969FF] font-medium mb-1">{formatPrice(event.revenue, event.currency)}</p>
                        <div className="w-24 h-2 bg-white rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2969FF]"
                            style={{
                              width: `${Math.min((event.ticketsSold / event.totalTickets) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Promoters Section */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
              Event Promoters & Affiliates
              <HelpTip>Invite promoters to sell tickets and earn commission. Great for expanding your reach!</HelpTip>
            </CardTitle>
            <Link to="/organizer/promoters" className="text-[#2969FF] text-sm hover:underline">
              Manage All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Promoter Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Active Promoters</span>
                </div>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{promoterStats.activePromoters}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Tickets Sold</span>
                </div>
                <p className="text-2xl font-semibold text-[#0F0F0F]">{promoterStats.ticketsSold}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Revenue</span>
                </div>
                <p className="text-xl font-semibold text-[#0F0F0F]">{formatMultiCurrencyCompact(promoterStats.revenueByCurrency)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Unpaid</span>
                </div>
                <p className="text-xl font-semibold text-orange-600">{formatMultiCurrencyCompact(promoterStats.unpaidByCurrency)}</p>
              </div>
            </div>

            {/* Top Promoters */}
            {topPromoters.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm text-[#0F0F0F]/60">Top Performing Promoters</h4>
                {topPromoters.map((promoter) => (
                  <div key={promoter.id} className="p-4 rounded-xl bg-[#F4F6FA] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                        {promoter.name?.[0]?.toUpperCase() || 'P'}
                      </div>
                      <div>
                        <h5 className="font-medium text-[#0F0F0F]">{promoter.name}</h5>
                        <p className="text-sm text-[#0F0F0F]/60">
                          {promoter.commission_value}% Commission • {promoter.promo_code}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#0F0F0F] font-medium">{promoter.total_sales || 0} tickets</p>
                      <p className="text-sm text-green-600">{formatMultiCurrencyCompact(promoter.earnedByCurrency || {})} earned</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Users className="w-10 h-10 text-[#0F0F0F]/20 mx-auto mb-2" />
                <p className="text-[#0F0F0F]/60 text-sm">No promoters yet</p>
              </div>
            )}

            {/* CTA Button */}
            <Button
              onClick={() => navigate('/organizer/promoters')}
              className="w-full h-12 rounded-xl bg-[#2969FF] hover:bg-[#2969FF]/90 text-white"
            >
              <Link2 className="w-5 h-5 mr-2" />
              Manage Event Promoters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tax Documents */}
      {organizer?.id && (
        <TaxDocuments type="organizer" recipientId={organizer.id} countryCode={organizer?.country_code || 'NG'} />
      )}
    </div>
  );
}
