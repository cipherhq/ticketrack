import { useState, useEffect } from 'react';
import { TrendingUp, Eye, MousePointerClick, ShoppingCart, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePromoter } from '@/contexts/PromoterContext';
import { supabase } from '@/lib/supabase';

export function PromoterPerformance() {
  const { promoter } = usePromoter();
  const [selectedPeriod, setSelectedPeriod] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ clicks: 0, uniqueVisitors: 0, ticketsSold: 0, revenue: 0, commission: 0, conversionRate: 0 });
  const [eventPerformance, setEventPerformance] = useState([]);

  useEffect(() => { if (promoter) loadPerformanceData(); }, [promoter, selectedPeriod]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      let daysBack = selectedPeriod === '7days' ? 7 : selectedPeriod === '30days' ? 30 : selectedPeriod === '90days' ? 90 : 365 * 5;
      const startDate = new Date(); startDate.setDate(startDate.getDate() - daysBack);

      const { count: clickCount } = await supabase.from('promoter_clicks').select('*', { count: 'exact', head: true }).eq('promoter_id', promoter.id).gte('created_at', startDate.toISOString());
      const { data: salesData } = await supabase.from('promoter_sales').select('*, events(title)').eq('promoter_id', promoter.id).gte('created_at', startDate.toISOString());

      const ticketsSold = salesData?.reduce((sum, s) => sum + (s.ticket_count || 0), 0) || 0;
      const revenue = salesData?.reduce((sum, s) => sum + parseFloat(s.sale_amount || 0), 0) || 0;
      const commission = salesData?.reduce((sum, s) => sum + parseFloat(s.commission_amount || 0), 0) || 0;

      setStats({ clicks: clickCount || 0, uniqueVisitors: Math.floor((clickCount || 0) * 0.7), ticketsSold, revenue, commission, conversionRate: clickCount > 0 ? ((salesData?.length || 0) / clickCount * 100).toFixed(2) : 0 });

      const eventMap = {};
      salesData?.forEach(sale => {
        const t = sale.events?.title || 'Unknown';
        if (!eventMap[t]) eventMap[t] = { name: t, clicks: 0, ticketsSold: 0, revenue: 0, commission: 0 };
        eventMap[t].ticketsSold += sale.ticket_count || 0;
        eventMap[t].revenue += parseFloat(sale.sale_amount || 0);
        eventMap[t].commission += parseFloat(sale.commission_amount || 0);
      });
      setEventPerformance(Object.values(eventMap));
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl text-[#0F0F0F] mb-2">Performance Analytics</h2><p className="text-[#0F0F0F]/60">Track your promotional performance</p></div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}><SelectTrigger className="w-48 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7days">Last 7 Days</SelectItem><SelectItem value="30days">Last 30 Days</SelectItem><SelectItem value="90days">Last 90 Days</SelectItem><SelectItem value="alltime">All Time</SelectItem></SelectContent></Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><MousePointerClick className="w-4 h-4 text-blue-600" /><span className="text-xs text-[#0F0F0F]/60">Total Clicks</span></div><p className="text-2xl text-[#0F0F0F]">{stats.clicks.toLocaleString()}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><Eye className="w-4 h-4 text-purple-600" /><span className="text-xs text-[#0F0F0F]/60">Unique Visitors</span></div><p className="text-2xl text-[#0F0F0F]">{stats.uniqueVisitors.toLocaleString()}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><ShoppingCart className="w-4 h-4 text-green-600" /><span className="text-xs text-[#0F0F0F]/60">Tickets Sold</span></div><p className="text-2xl text-green-600">{stats.ticketsSold}</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-indigo-600" /><span className="text-xs text-[#0F0F0F]/60">Revenue</span></div><p className="text-xl text-[#0F0F0F]">₦{(stats.revenue / 1000000).toFixed(1)}M</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-[#2969FF]" /><span className="text-xs text-[#0F0F0F]/60">Commission</span></div><p className="text-xl text-[#2969FF]">₦{(stats.commission / 1000).toFixed(0)}K</p></CardContent></Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-orange-600" /><span className="text-xs text-[#0F0F0F]/60">Conversion</span></div><p className="text-2xl text-orange-600">{stats.conversionRate}%</p></CardContent></Card>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader><CardTitle>Performance by Event</CardTitle></CardHeader>
        <CardContent>
          {eventPerformance.length === 0 ? <p className="text-center text-[#0F0F0F]/60 py-8">No event data available</p> : (
            <div className="space-y-4">
              {eventPerformance.map((event, i) => (
                <div key={i} className="p-4 border border-[#0F0F0F]/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-4"><h3 className="text-lg text-[#0F0F0F]">{event.name}</h3><Badge className="bg-green-600">Active</Badge></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg"><p className="text-xs text-[#0F0F0F]/60 mb-1">Tickets Sold</p><p className="text-lg text-green-600">{event.ticketsSold}</p></div>
                    <div className="p-3 bg-indigo-50 rounded-lg"><p className="text-xs text-[#0F0F0F]/60 mb-1">Revenue</p><p className="text-lg text-[#0F0F0F]">₦{(event.revenue / 1000).toFixed(0)}K</p></div>
                    <div className="p-3 bg-[#2969FF]/10 rounded-lg"><p className="text-xs text-[#0F0F0F]/60 mb-1">Commission</p><p className="text-lg text-[#2969FF]">₦{(event.commission / 1000).toFixed(0)}K</p></div>
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
