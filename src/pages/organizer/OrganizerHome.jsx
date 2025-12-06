import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DollarSign, Users, Calendar, TrendingUp, Plus, Eye, Download, Link2, ShoppingCart, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

export function OrganizerHome() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalAttendees: 0,
    totalEvents: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [promoterStats, setPromoterStats] = useState({
    activePromoters: 0,
    ticketsSold: 0,
    revenue: 0,
    unpaidCommission: 0,
  });
  const [topPromoters, setTopPromoters] = useState([]);

  useEffect(() => {
    if (organizer?.id) {
      loadDashboardData();
    }
  }, [organizer?.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadUpcomingEvents(),
        loadPromoterData(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    // Get total events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', organizer.id);

    if (eventsError) throw eventsError;

    const eventIds = events?.map(e => e.id) || [];

    // Get tickets sold for these events
    let totalTickets = 0;
    let totalRevenue = 0;

    if (eventIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('quantity, total_price')
        .in('event_id', eventIds)
        .eq('payment_status', 'completed');

      if (!ticketsError && tickets) {
        totalTickets = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        totalRevenue = tickets.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0);
      }
    }

    setStats({
      totalSales: totalRevenue,
      totalRevenue: totalRevenue * 0.9, // After platform fees
      totalAttendees: totalTickets,
      totalEvents: events?.length || 0,
    });
  };

  const loadUpcomingEvents = async () => {
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        start_date,
        total_capacity,
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

    const eventsWithStats = events?.map(event => {
      const ticketsSold = event.ticket_types?.reduce((sum, t) => sum + (t.quantity_sold || 0), 0) || 0;
      const totalTickets = event.ticket_types?.reduce((sum, t) => sum + (t.quantity_available || 0), 0) || event.total_capacity || 100;
      const revenue = event.ticket_types?.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0) || 0;

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
    const ticketsSold = promoters?.reduce((sum, p) => sum + (p.total_sales || 0), 0) || 0;
    const revenue = promoters?.reduce((sum, p) => sum + (parseFloat(p.total_revenue) || 0), 0) || 0;
    const totalCommission = promoters?.reduce((sum, p) => sum + (parseFloat(p.total_commission) || 0), 0) || 0;

    setPromoterStats({
      activePromoters,
      ticketsSold,
      revenue,
      unpaidCommission: totalCommission,
    });

    // Top promoters by sales
    const sorted = [...(promoters || [])].sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0));
    setTopPromoters(sorted.slice(0, 3));
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return `₦${amount.toLocaleString()}`;
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-2">Total Sales</p>
                <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-1">
                  {formatCurrency(stats.totalSales)}
                </h2>
                <p className="text-sm text-green-600">Lifetime</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-2">Net Revenue</p>
                <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-1">
                  {formatCurrency(stats.totalRevenue)}
                </h2>
                <p className="text-sm text-green-600">After fees</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-2">Tickets Sold</p>
                <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-1">
                  {stats.totalAttendees.toLocaleString()}
                </h2>
                <p className="text-sm text-green-600">All events</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#0F0F0F]/60 mb-2">Total Events</p>
                <h2 className="text-2xl font-semibold text-[#0F0F0F] mb-1">
                  {stats.totalEvents}
                </h2>
                <p className="text-sm text-green-600">Created</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Quick Actions</CardTitle>
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
                  className="p-4 rounded-xl bg-[#F4F6FA] flex items-center justify-between cursor-pointer hover:bg-[#F4F6FA]/80 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-[#0F0F0F] mb-2">{event.name}</h4>
                    <div className="flex items-center space-x-6 text-sm text-[#0F0F0F]/60">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4" />
                        <span>
                          {event.ticketsSold}/{event.totalTickets} sold
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#2969FF] font-medium mb-1">{formatCurrency(event.revenue)}</p>
                    <div className="w-24 h-2 bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2969FF]"
                        style={{
                          width: `${Math.min((event.ticketsSold / event.totalTickets) * 100, 100)}%`,
                        }}
                      />
                    </div>
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
            <CardTitle className="text-[#0F0F0F]">Event Promoters & Affiliates</CardTitle>
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
                <p className="text-xl font-semibold text-[#0F0F0F]">{formatCurrency(promoterStats.revenue)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-[#0F0F0F]/60">Unpaid</span>
                </div>
                <p className="text-xl font-semibold text-orange-600">{formatCurrency(promoterStats.unpaidCommission)}</p>
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
                      <p className="text-sm text-green-600">{formatCurrency(promoter.total_commission || 0)} earned</p>
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
    </div>
  );
}
