import { getCountryFees, DEFAULT_FEES } from '@/config/fees';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, Percent, BarChart3, 
  Loader2, Calendar, Ticket, Eye, Download, RefreshCw
} from 'lucide-react';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatPrice, getUserDefaultCurrency } from '@/config/currencies';

export function Analytics() {
  const { organizer } = useOrganizer();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days
  const [selectedEvent, setSelectedEvent] = useState('all');
  
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    grossRevenueByCurrency: {},
    netRevenueByCurrency: {},
    platformFeesByCurrency: {},
    totalTickets: 0,
    totalAttendees: 0,
    averageTicketPrice: {},
    conversionRate: 0,
  });
  const [salesByDay, setSalesByDay] = useState([]);
  const [salesByEvent, setSalesByEvent] = useState([]);
  const [salesByTicketType, setSalesByTicketType] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [topEvents, setTopEvents] = useState([]);
  const [followerStats, setFollowerStats] = useState({ total: 0, growth: 0 });
  const [defaultCurrency, setDefaultCurrency] = useState('USD'); // Fallback from user's country

  useEffect(() => {
    if (organizer?.id) {
      loadAnalytics();
    }
  }, [organizer?.id, timeRange, selectedEvent]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch user's default currency from their country
      if (organizer?.user_id) {
        const currency = await getUserDefaultCurrency(supabase, organizer.user_id);
        if (currency) setDefaultCurrency(currency);
      }

      await Promise.all([
        loadEvents(),
        loadStats(),
        loadSalesByDay(),
        loadSalesByTicketType(),
        loadMonthlyRevenue(),
        loadTopEvents(),
        loadFollowerStats(),
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, currency')
      .eq('organizer_id', organizer.id)
      .order('start_date', { ascending: false });
    
    setEvents(data || []);
  };

  const loadStats = async () => {
    // Get events for this organizer with currency
    // Fetch platform fees from database
    const feesByCurrency = await getCountryFees();
    let eventQuery = supabase
      .from('events')
      .select('id, currency')
      .eq('organizer_id', organizer.id);
    
    if (selectedEvent !== 'all') {
      eventQuery = eventQuery.eq('id', selectedEvent);
    }

    const { data: orgEvents } = await eventQuery;
    const eventIds = orgEvents?.map(e => e.id) || [];
    const eventCurrencyMap = {};
    orgEvents?.forEach(e => { eventCurrencyMap[e.id] = e.currency || defaultCurrency; });

    if (eventIds.length === 0) {
      setStats({
        grossRevenueByCurrency: {},
        netRevenueByCurrency: {},
        platformFeesByCurrency: {},
        totalTickets: 0,
        totalAttendees: 0,
        averageTicketPrice: {},
        conversionRate: 0,
      });
      return;
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange));

    // Get tickets within time range
    const { data: tickets } = await supabase
      .from('tickets')
      .select('total_price, quantity, created_at, event_id')
      .in('event_id', eventIds)
      .eq('payment_status', 'completed')
      .gte('created_at', startDate.toISOString());

    // Group by currency
    const grossRevenueByCurrency = {};
    const ticketCountByCurrency = {};
    
    tickets?.forEach(t => {
      const currency = eventCurrencyMap[t.event_id] || defaultCurrency;
      if (!grossRevenueByCurrency[currency]) {
        grossRevenueByCurrency[currency] = 0;
        ticketCountByCurrency[currency] = 0;
      }
      grossRevenueByCurrency[currency] += parseFloat(t.total_price) || 0;
      ticketCountByCurrency[currency] += t.quantity || 1;
    });

    const platformFeesByCurrency = {};
    const netRevenueByCurrency = {};
    const averageTicketPrice = {};
    
    Object.keys(grossRevenueByCurrency).forEach(currency => {
      platformFeesByCurrency[currency] = grossRevenueByCurrency[currency] * (feesByCurrency[currency]?.platformFee || 0.10);
      netRevenueByCurrency[currency] = grossRevenueByCurrency[currency] - platformFeesByCurrency[currency];
      averageTicketPrice[currency] = ticketCountByCurrency[currency] > 0 
        ? grossRevenueByCurrency[currency] / ticketCountByCurrency[currency] 
        : 0;
    });

    const totalTickets = tickets?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 0;

    // Get checked-in count
    const { data: checkedIn } = await supabase
      .from('tickets')
      .select('id, currency')
      .in('event_id', eventIds)
      .eq('payment_status', 'completed')
      .eq('is_checked_in', true);

    const totalAttendees = checkedIn?.length || 0;

    setStats({
      grossRevenueByCurrency,
      netRevenueByCurrency,
      platformFeesByCurrency,
      totalTickets,
      totalAttendees,
      averageTicketPrice,
      conversionRate: totalTickets > 0 ? (totalAttendees / totalTickets) * 100 : 0,
    });
  };

  const loadSalesByDay = async () => {
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id, currency')
      .eq('organizer_id', organizer.id);

    const eventIds = orgEvents?.map(e => e.id) || [];
    if (eventIds.length === 0) {
      setSalesByDay([]);
      return;
    }

    // Get sales for last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: 0,
        revenue: 0,
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    const { data: tickets } = await supabase
      .from('tickets')
      .select('total_price, quantity, created_at')
      .in('event_id', eventIds)
      .eq('payment_status', 'completed')
      .gte('created_at', startDate.toISOString());

    tickets?.forEach(ticket => {
      const ticketDate = ticket.created_at.split('T')[0];
      const dayIndex = days.findIndex(d => d.date === ticketDate);
      if (dayIndex !== -1) {
        days[dayIndex].sales += ticket.quantity || 1;
        days[dayIndex].revenue += parseFloat(ticket.total_price) || 0;
      }
    });

    setSalesByDay(days);
  };

  const loadSalesByTicketType = async () => {
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id, currency')
      .eq('organizer_id', organizer.id);

    const eventIds = orgEvents?.map(e => e.id) || [];
    if (eventIds.length === 0) {
      setSalesByTicketType([]);
      return;
    }

    const { data: ticketTypes } = await supabase
      .from('ticket_types')
      .select(`
        id,
        name,
        price,
        quantity_sold,
        event_id
      `)
      .in('event_id', eventIds);

    // Aggregate by ticket type name
    const typeMap = new Map();
    ticketTypes?.forEach(tt => {
      const existing = typeMap.get(tt.name) || { name: tt.name, sold: 0, revenue: 0 };
      existing.sold += tt.quantity_sold || 0;
      existing.revenue += (tt.quantity_sold || 0) * (tt.price || 0);
      typeMap.set(tt.name, existing);
    });

    const types = Array.from(typeMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const total = types.reduce((sum, t) => sum + t.sold, 0);
    const typesWithPercent = types.map((t, i) => ({
      ...t,
      percent: total > 0 ? (t.sold / total) * 100 : 0,
      color: ['#2969FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i] || '#6B7280',
    }));

    setSalesByTicketType(typesWithPercent);
  };

  const loadMonthlyRevenue = async () => {
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id, currency')
      .eq('organizer_id', organizer.id);

    const eventIds = orgEvents?.map(e => e.id) || [];
    const eventCurrencyMap = {};
    orgEvents?.forEach(e => { eventCurrencyMap[e.id] = e.currency || defaultCurrency; });
    const feesByCurrency = await getCountryFees();
    if (eventIds.length === 0) {
      setMonthlyRevenue([]);
      return;
    }

    // Get last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        monthNum: date.getMonth(),
        gross: 0,
        net: 0,
        platformFee: 0,
      });
    }

    // Get all tickets from last 6 months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5);
    startDate.setDate(1);

    const { data: tickets } = await supabase
      .from('tickets')
      .select('total_price, created_at, event_id')
      .in('event_id', eventIds)
      .eq('payment_status', 'completed')
      .gte('created_at', startDate.toISOString());

    tickets?.forEach(ticket => {
      const ticketDate = new Date(ticket.created_at);
      const monthIndex = months.findIndex(
        m => m.monthNum === ticketDate.getMonth() && m.year === ticketDate.getFullYear()
      );
      if (monthIndex !== -1) {
        const amount = parseFloat(ticket.total_price) || 0;
        months[monthIndex].gross += amount;
        const ticketCurrency = eventCurrencyMap[ticket.event_id] || defaultCurrency; const platformFeeRate = feesByCurrency[ticketCurrency]?.platformFee || 0.10; months[monthIndex].platformFee += amount * platformFeeRate;
        months[monthIndex].net += amount * (1 - platformFeeRate);
      }
    });

    setMonthlyRevenue(months);
  };

  const loadTopEvents = async () => {
    const { data: events } = await supabase
      .from('events')
      .select(`
        id,
        title,
        start_date,
        ticket_types (
          quantity_sold,
          price
        )
      `)
      .eq('organizer_id', organizer.id);

    const eventsWithRevenue = events?.map(event => {
      const ticketsSold = event.ticket_types?.reduce((sum, t) => sum + (t.quantity_sold || 0), 0) || 0;
      const revenue = event.ticket_types?.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0) || 0;
      return { ...event, ticketsSold, revenue };
    }) || [];

    const sorted = eventsWithRevenue.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    setTopEvents(sorted);
  };

  const loadFollowerStats = async () => {
    const { data: followers, count } = await supabase
      .from('followers')
      .select('id, created_at', { count: 'exact' })
      .eq('organizer_id', organizer.id);

    // Calculate growth (followers gained this month)
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const newFollowers = followers?.filter(f => new Date(f.created_at) >= thisMonth).length || 0;
    const totalFollowers = count || 0;
    const growth = totalFollowers > 0 ? (newFollowers / totalFollowers) * 100 : 0;

    setFollowerStats({ total: totalFollowers, growth });
  };

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      timeRange: `Last ${timeRange} days`,
      stats,
      monthlyRevenue,
      topEvents,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
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

  const maxSales = Math.max(...salesByDay.map(d => d.sales), 1);

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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Analytics</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Track your event performance and revenue</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-48 rounded-xl border-[#0F0F0F]/10">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Events</SelectItem>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-36 rounded-xl border-[#0F0F0F]/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={loadAnalytics}
            className="rounded-xl border-[#0F0F0F]/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={exportReport}
            className="rounded-xl border-[#0F0F0F]/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>


      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(stats.grossRevenueByCurrency || {}).map(([currency, amount]) => (
          <Card key={`gross-${currency}`} className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#0F0F0F]/60">{currency} Gross</span>
                <DollarSign className="w-5 h-5 text-[#2969FF]" />
              </div>
              <p className="text-2xl font-semibold text-[#0F0F0F]">{formatPrice(amount, currency)}</p>
              <p className="text-xs text-[#0F0F0F]/40 mt-1">Net: {formatPrice(stats.netRevenueByCurrency?.[currency] || 0, currency)}</p>
            </CardContent>
          </Card>
        ))}
        
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#0F0F0F]/60">Tickets Sold</span>
              <Ticket className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalTickets.toLocaleString()}</p>
            <p className="text-xs text-[#0F0F0F]/40 mt-1">All currencies</p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#0F0F0F]/60">Attendees</span>
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-semibold text-[#0F0F0F]">{stats.totalAttendees.toLocaleString()}</p>
            <p className="text-xs text-[#0F0F0F]/40 mt-1">{stats.conversionRate.toFixed(1)}% check-in rate</p>
          </CardContent>
        </Card>
      </div>
      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Percent className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Platform Fees</p>
                <p className="text-lg font-semibold text-[#0F0F0F]">{Object.entries(stats.platformFeesByCurrency || {}).map(([c, a]) => formatPrice(a, c)).join(" | ") || "₦0"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Checked In</p>
                <p className="text-lg font-semibold text-[#0F0F0F]">{stats.totalAttendees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Check-in Rate</p>
                <p className="text-lg font-semibold text-[#0F0F0F]">{stats.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Total Events</p>
                <p className="text-lg font-semibold text-[#0F0F0F]">{events.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Per Day */}
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F] flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Sales Per Day (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesByDay.length === 0 || salesByDay.every(d => d.sales === 0) ? (
              <div className="h-64 flex items-center justify-center text-[#0F0F0F]/40">
                No sales data for this period
              </div>
            ) : (
              <div className="h-64 flex items-end justify-between gap-2 px-4">
                {salesByDay.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-[#0F0F0F]/60 font-medium">{day.sales}</div>
                    <div 
                      className="w-full bg-[#2969FF] rounded-t-lg transition-all hover:bg-[#2969FF]/80"
                      style={{ height: `${Math.max((day.sales / maxSales) * 180, 4)}px` }}
                    />
                    <span className="text-xs text-[#0F0F0F]/60">{day.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales by Ticket Type */}
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F]">Sales by Ticket Type</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByTicketType.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#0F0F0F]/40">
                No ticket type data available
              </div>
            ) : (
              <div className="space-y-4">
                {salesByTicketType.map((type) => (
                  <div key={type.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#0F0F0F]">{type.name}</span>
                      <span className="text-sm text-[#0F0F0F]/60">
                        {type.sold} sold • {formatCurrency(type.revenue)}
                      </span>
                    </div>
                    <div className="w-full bg-[#F4F6FA] rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${type.percent}%`, backgroundColor: type.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Events */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Top Performing Events</CardTitle>
        </CardHeader>
        <CardContent>
          {topEvents.length === 0 ? (
            <div className="text-center py-8 text-[#0F0F0F]/40">
              No events data available
            </div>
          ) : (
            <div className="space-y-3">
              {topEvents.map((event, index) => (
                <div key={event.id} className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-[#0F0F0F]/20'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-[#0F0F0F]">{event.title}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{event.ticketsSold} tickets sold</p>
                    </div>
                  </div>
                  <p className="text-lg font-semibold text-[#2969FF]">{formatCurrency(event.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Revenue Breakdown */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Monthly Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyRevenue.length === 0 || monthlyRevenue.every(m => m.gross === 0) ? (
            <div className="text-center py-8 text-[#0F0F0F]/40">
              No revenue data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#0F0F0F]/10">
                    <th className="text-left py-3 px-4 text-[#0F0F0F]/60 font-medium">Month</th>
                    <th className="text-right py-3 px-4 text-[#0F0F0F]/60 font-medium">Gross Revenue</th>
                    <th className="text-right py-3 px-4 text-[#0F0F0F]/60 font-medium">Platform Fees</th>
                    <th className="text-right py-3 px-4 text-[#0F0F0F]/60 font-medium">Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRevenue.map((row) => (
                    <tr key={`${row.month}-${row.year}`} className="border-b border-[#0F0F0F]/5">
                      <td className="py-3 px-4 text-[#0F0F0F]">{row.month} {row.year}</td>
                      <td className="py-3 px-4 text-right text-[#0F0F0F]">{formatCurrency(row.gross)}</td>
                      <td className="py-3 px-4 text-right text-[#0F0F0F]/60">{formatCurrency(row.platformFee)}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(row.net)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#F4F6FA] font-medium">
                    <td className="py-3 px-4 text-[#0F0F0F]">Total</td>
                    <td className="py-3 px-4 text-right text-[#0F0F0F]">
                      {formatCurrency(monthlyRevenue.reduce((s, r) => s + r.gross, 0))}
                    </td>
                    <td className="py-3 px-4 text-right text-[#0F0F0F]/60">
                      {formatCurrency(monthlyRevenue.reduce((s, r) => s + r.platformFee, 0))}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600">
                      {formatCurrency(monthlyRevenue.reduce((s, r) => s + r.net, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
