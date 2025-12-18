import { useState, useEffect } from 'react';
import { Calendar, Users, AlertTriangle, DollarSign, TrendingUp, Clock, ShoppingCart, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalOrganizers: 0,
    pendingKYCs: 0,
    payoutQueue: 0,
    fraudAlerts: 0,
    platformRevenue: 0,
    activeEventsToday: 0,
    ticketsSoldToday: 0,
    revenueToday: 0,
    openTickets: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [topAffiliates, setTopAffiliates] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadRecentActivity(),
        loadTopAffiliates(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    // Total events
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    // Total organizers
    const { count: totalOrganizers } = await supabase
      .from('organizers')
      .select('*', { count: 'exact', head: true });

    // Pending KYCs
    const { count: pendingKYCs } = await supabase
      .from('kyc_verifications')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_review']);

    // Payout queue
    const { count: payoutQueue } = await supabase
      .from('payouts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Platform revenue (sum of all completed ticket sales)
    const { data: revenueData } = await supabase
      .from('tickets')
      .select('total_amount')
      .eq('payment_status', 'completed');
    
    const platformRevenue = revenueData?.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0;

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    
    const { count: activeEventsToday } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .lte('start_date', today)
      .gte('end_date', today);

    const { data: todayTickets } = await supabase
      .from('tickets')
      .select('total_amount, quantity')
      .eq('payment_status', 'completed')
      .gte('created_at', `${today}T00:00:00`);

    const ticketsSoldToday = todayTickets?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 0;
    const revenueToday = todayTickets?.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0) || 0;

    // Open support tickets
    const { count: openTickets } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    setStats({
      totalEvents: totalEvents || 0,
      totalOrganizers: totalOrganizers || 0,
      pendingKYCs: pendingKYCs || 0,
      payoutQueue: payoutQueue || 0,
      fraudAlerts: 0,
      platformRevenue,
      activeEventsToday: activeEventsToday || 0,
      ticketsSoldToday,
      revenueToday,
      openTickets: openTickets || 0,
    });
  };

  const loadRecentActivity = async () => {
    // Get recent organizer registrations
    const { data: recentOrganizers } = await supabase
      .from('organizers')
      .select('business_name, created_at')
      .order('created_at', { ascending: false })
      .limit(2);

    // Get recent events
    const { data: recentEvents } = await supabase
      .from('events')
      .select('title, created_at, organizers(business_name)')
      .order('created_at', { ascending: false })
      .limit(2);

    // Get recent payouts
    const { data: recentPayouts } = await supabase
      .from('payouts')
      .select('status, created_at, organizers(business_name)')
      .order('created_at', { ascending: false })
      .limit(2);

    const activities = [];

    recentOrganizers?.forEach(org => {
      activities.push({
        action: 'New organizer registered',
        organizer: org.business_name || 'Unknown',
        time: getTimeAgo(org.created_at),
        timestamp: new Date(org.created_at),
      });
    });

    recentEvents?.forEach(event => {
      activities.push({
        action: 'Event created',
        organizer: event.organizers?.business_name || 'Unknown',
        time: getTimeAgo(event.created_at),
        timestamp: new Date(event.created_at),
      });
    });

    recentPayouts?.forEach(payout => {
      activities.push({
        action: `Payout ${payout.status}`,
        organizer: payout.organizers?.business_name || 'Unknown',
        time: getTimeAgo(payout.created_at),
        timestamp: new Date(payout.created_at),
      });
    });

    // Sort by timestamp and take top 5
    activities.sort((a, b) => b.timestamp - a.timestamp);
    setRecentActivity(activities.slice(0, 5));
  };

  const loadTopAffiliates = async () => {
    const { data } = await supabase
      .from('promoters')
      .select('name, promo_code, total_sales, total_revenue, events(title)')
      .eq('is_active', true)
      .order('total_revenue', { ascending: false })
      .limit(4);

    setTopAffiliates(data || []);
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(1)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const statCards = [
    { label: 'Total Events', value: stats.totalEvents, icon: Calendar, color: '#2969FF' },
    { label: 'Total Organizers', value: stats.totalOrganizers, icon: Users, color: '#2969FF' },
    { label: 'Pending KYCs', value: stats.pendingKYCs, icon: Clock, color: '#f59e0b' },
    { label: 'Payout Queue', value: stats.payoutQueue, icon: DollarSign, color: '#2969FF' },
    { label: 'Fraud Alerts', value: stats.fraudAlerts, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Platform Revenue', value: formatCurrency(stats.platformRevenue), icon: TrendingUp, color: '#10b981' },
  ];

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
        <h2 className="text-2xl font-semibold text-[#0F0F0F]">Platform Overview</h2>
        <Button variant="outline" size="icon" onClick={loadDashboardData} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#0F0F0F]/60 mb-2">{stat.label}</p>
                  <h2 className="text-2xl font-semibold text-[#0F0F0F]">{stat.value}</h2>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F]">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-xl bg-[#F4F6FA]">
                    <div className="w-2 h-2 rounded-full bg-[#2969FF] mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0F0F0F] mb-1">{activity.action}</p>
                      <p className="text-sm text-[#0F0F0F]/60">
                        {activity.organizer} • {activity.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[#0F0F0F]/60 text-center py-8">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-[#0F0F0F]">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                <span className="text-[#0F0F0F]">Active Events Today</span>
                <span className="text-[#2969FF] font-semibold">{stats.activeEventsToday}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                <span className="text-[#0F0F0F]">Tickets Sold Today</span>
                <span className="text-[#2969FF] font-semibold">{stats.ticketsSoldToday.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                <span className="text-[#0F0F0F]">Revenue Today</span>
                <span className="text-[#2969FF] font-semibold">{formatCurrency(stats.revenueToday)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#F4F6FA]">
                <span className="text-[#0F0F0F]">Support Tickets Open</span>
                <span className="text-[#2969FF] font-semibold">{stats.openTickets}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Affiliates */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0F0F0F]">Top Affiliates & Promoters</CardTitle>
            <Link to="/admin/affiliates" className="text-[#2969FF] text-sm hover:underline">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {topAffiliates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topAffiliates.map((affiliate, index) => (
                <div key={index} className="p-4 rounded-xl bg-[#F4F6FA] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                      {affiliate.name?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <h5 className="text-[#0F0F0F] font-medium">{affiliate.name}</h5>
                      <p className="text-sm text-[#0F0F0F]/60">
                        {affiliate.events?.title || 'All Events'} • {affiliate.promo_code}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#0F0F0F]">{affiliate.total_sales || 0} sales</p>
                    <p className="text-sm text-green-600">{formatCurrency(affiliate.total_revenue || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#0F0F0F]/60 text-center py-8">No affiliates yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
