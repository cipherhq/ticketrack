import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Loader2, TrendingUp, Calendar, Target, DollarSign,
  ArrowUpRight, RefreshCw, BarChart3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';
import { useFinance } from '@/contexts/FinanceContext';

export function RevenueForecast() {
  const { logFinanceAction } = useFinance();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [currency, setCurrency] = useState('NGN');
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [forecast, setForecast] = useState({
    projectedRevenue: 0,
    projectedFees: 0,
    currentSales: 0,
    targetRevenue: 0,
    percentToTarget: 0,
    averageTicketPrice: 0,
    estimatedOrders: 0
  });
  const [monthlyTrend, setMonthlyTrend] = useState([]);

  useEffect(() => {
    loadForecastData();
    logFinanceAction('view_revenue_forecast');
  }, [period, currency]);

  const loadForecastData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let endDate;

      switch (period) {
        case 'week':
          endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          break;
        case 'quarter':
          endDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
          break;
        default:
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }

      // Fetch upcoming events with ticket sales
      const { data: events } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_date,
          end_date,
          venue_name,
          organizers (business_name),
          ticket_types (
            id,
            name,
            price,
            quantity_available,
            quantity_sold
          )
        `)
        .eq('status', 'published')
        .gte('start_date', now.toISOString())
        .lte('start_date', endDate.toISOString())
        .order('start_date', { ascending: true });

      // Calculate projections for each event
      const eventsWithProjections = (events || []).map(event => {
        const totalCapacity = event.ticket_types?.reduce(
          (sum, tt) => sum + (tt.quantity_available || 0), 0
        ) || 0;
        const totalSold = event.ticket_types?.reduce(
          (sum, tt) => sum + (tt.quantity_sold || 0), 0
        ) || 0;
        const currentRevenue = event.ticket_types?.reduce(
          (sum, tt) => sum + ((tt.quantity_sold || 0) * parseFloat(tt.price || 0)), 0
        ) || 0;

        // Project based on current sell-through rate with a multiplier
        const sellThroughRate = totalCapacity > 0 ? totalSold / totalCapacity : 0;
        const daysToEvent = Math.max(1, Math.ceil(
          (new Date(event.start_date) - now) / (1000 * 60 * 60 * 24)
        ));

        // Project remaining sales based on trending
        const projectedFillRate = Math.min(0.8, sellThroughRate + (0.3 / daysToEvent));
        const projectedSold = Math.floor(totalCapacity * projectedFillRate);
        const projectedRevenue = event.ticket_types?.reduce(
          (sum, tt) => sum + (Math.floor((tt.quantity_available || 0) * projectedFillRate) * parseFloat(tt.price || 0)), 0
        ) || 0;

        return {
          ...event,
          totalCapacity,
          totalSold,
          currentRevenue,
          projectedRevenue,
          sellThroughRate: sellThroughRate * 100,
          projectedFillRate: projectedFillRate * 100
        };
      });

      setUpcomingEvents(eventsWithProjections);

      // Calculate overall forecast
      const totalCurrentRevenue = eventsWithProjections.reduce(
        (sum, e) => sum + e.currentRevenue, 0
      );
      const totalProjectedRevenue = eventsWithProjections.reduce(
        (sum, e) => sum + e.projectedRevenue, 0
      );
      const projectedFees = totalProjectedRevenue * 0.05; // 5% platform fee estimate

      const averageTicketPrice = eventsWithProjections.length > 0
        ? eventsWithProjections.reduce((sum, e) => {
            const avgPrice = e.ticket_types?.reduce(
              (s, tt) => s + parseFloat(tt.price || 0), 0
            ) / (e.ticket_types?.length || 1);
            return sum + avgPrice;
          }, 0) / eventsWithProjections.length
        : 0;

      const estimatedOrders = averageTicketPrice > 0
        ? Math.floor(totalProjectedRevenue / averageTicketPrice)
        : 0;

      // Simple target (20% growth over projection)
      const targetRevenue = totalProjectedRevenue * 1.2;

      setForecast({
        projectedRevenue: totalProjectedRevenue,
        projectedFees,
        currentSales: totalCurrentRevenue,
        targetRevenue,
        percentToTarget: targetRevenue > 0 ? (totalCurrentRevenue / targetRevenue) * 100 : 0,
        averageTicketPrice,
        estimatedOrders
      });

      // Load historical monthly data for trend
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const { data: monthOrders } = await supabase
          .from('orders')
          .select('total_amount, platform_fee')
          .eq('currency', currency)
          .eq('status', 'completed')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());

        const revenue = monthOrders?.reduce(
          (sum, o) => sum + parseFloat(o.total_amount || 0), 0
        ) || 0;
        const fees = monthOrders?.reduce(
          (sum, o) => sum + parseFloat(o.platform_fee || 0), 0
        ) || 0;

        monthlyData.push({
          month: monthStart.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
          revenue,
          fees,
          orders: monthOrders?.length || 0
        });
      }

      setMonthlyTrend(monthlyData);
    } catch (error) {
      console.error('Error loading forecast data:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Revenue Forecast</h1>
          <p className="text-[#0F0F0F]/60">Project future revenue from upcoming events</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Next Week</SelectItem>
              <SelectItem value="month">Next Month</SelectItem>
              <SelectItem value="quarter">Next Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[100px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NGN">NGN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="GHS">GHS</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadForecastData} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Forecast Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Projected Revenue</p>
                <p className="text-2xl font-bold">
                  {formatPrice(forecast.projectedRevenue, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Projected Fees</p>
                <p className="text-2xl font-bold">
                  {formatPrice(forecast.projectedFees, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Current Sales</p>
                <p className="text-2xl font-bold">
                  {formatPrice(forecast.currentSales, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Progress to Target</p>
                <p className="text-2xl font-bold">
                  {forecast.percentToTarget.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Historical Trend (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-4">
            {monthlyTrend.map((month, idx) => {
              const maxRevenue = Math.max(...monthlyTrend.map(m => m.revenue));
              const heightPercent = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;

              return (
                <div key={idx} className="text-center">
                  <div className="h-32 flex items-end justify-center mb-2">
                    <div
                      className="w-12 bg-gradient-to-t from-[#2969FF] to-[#2969FF]/60 rounded-t-lg transition-all"
                      style={{ height: `${Math.max(heightPercent, 5)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#0F0F0F]/60">{month.month}</p>
                  <p className="text-sm font-medium">
                    {formatPrice(month.revenue, currency)}
                  </p>
                  <p className="text-xs text-[#0F0F0F]/50">{month.orders} orders</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle>Upcoming Events ({upcomingEvents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Fill Rate</TableHead>
                <TableHead className="text-right">Current Revenue</TableHead>
                <TableHead className="text-right">Projected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {event.title}
                  </TableCell>
                  <TableCell>
                    {new Date(event.start_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {event.organizers?.business_name || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {event.totalCapacity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {event.totalSold.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={
                      event.sellThroughRate >= 50 ? 'bg-green-100 text-green-800' :
                      event.sellThroughRate >= 25 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {event.sellThroughRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(event.currentRevenue, currency)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpRight className="w-4 h-4" />
                      {formatPrice(event.projectedRevenue, currency)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {upcomingEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#0F0F0F]/60">
                    No upcoming events in selected period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-[#0F0F0F]/60" />
              <span className="font-medium">Events</span>
            </div>
            <p className="text-3xl font-bold">{upcomingEvents.length}</p>
            <p className="text-sm text-[#0F0F0F]/60">upcoming in {period}</p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-[#0F0F0F]/60" />
              <span className="font-medium">Est. Orders</span>
            </div>
            <p className="text-3xl font-bold">{forecast.estimatedOrders.toLocaleString()}</p>
            <p className="text-sm text-[#0F0F0F]/60">projected ticket sales</p>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-[#0F0F0F]/60" />
              <span className="font-medium">Avg. Ticket</span>
            </div>
            <p className="text-3xl font-bold">
              {formatPrice(forecast.averageTicketPrice, currency)}
            </p>
            <p className="text-sm text-[#0F0F0F]/60">average ticket price</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
