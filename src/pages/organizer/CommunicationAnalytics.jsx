import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, TrendingUp, TrendingDown, Mail, Phone, MessageSquare,
  Send, Users, Eye, MousePointer, CheckCircle, XCircle, Clock,
  Loader2, Calendar, RefreshCw, Download, Filter, ArrowUpRight,
  ArrowDownRight, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useOrganizer } from '@/contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// Channel configuration
const CHANNELS = {
  email: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Email' },
  sms: { icon: Phone, color: 'text-green-600', bgColor: 'bg-green-100', label: 'SMS' },
  whatsapp: { icon: MessageSquare, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'WhatsApp' },
  telegram: { icon: Send, color: 'text-sky-600', bgColor: 'bg-sky-100', label: 'Telegram' },
};

export function CommunicationAnalytics() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();

  // State
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days

  // Analytics data
  const [overview, setOverview] = useState({
    totalCampaigns: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalFailed: 0,
    avgDeliveryRate: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
  });

  const [channelStats, setChannelStats] = useState([]);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [topPerforming, setTopPerforming] = useState([]);
  
  // Email tracking specific data
  const [emailTrackingStats, setEmailTrackingStats] = useState({
    deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
    clientBreakdown: {},
    recentOpens: [],
    recentClicks: [],
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (organizer?.id) {
      loadAnalytics();
    }
  }, [organizer?.id, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(dateRange));

      await Promise.all([
        loadOverview(startDate),
        loadChannelStats(startDate),
        loadRecentCampaigns(),
        loadDailyStats(startDate),
        loadTopPerforming(startDate),
        loadEmailTrackingStats(startDate),
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async (startDate) => {
    // Get campaign stats
    const { data: campaigns } = await supabase
      .from('communication_campaigns')
      .select('sent_count, delivered_count, opened_count, clicked_count, failed_count')
      .eq('organizer_id', organizer.id)
      .gte('created_at', startDate.toISOString());

    if (!campaigns || campaigns.length === 0) {
      setOverview({
        totalCampaigns: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalFailed: 0,
        avgDeliveryRate: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
      });
      return;
    }

    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
    const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered_count || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened_count || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.clicked_count || 0), 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + (c.failed_count || 0), 0);

    setOverview({
      totalCampaigns: campaigns.length,
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalFailed,
      avgDeliveryRate: totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : 0,
      avgOpenRate: totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : 0,
      avgClickRate: totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : 0,
    });
  };

  const loadChannelStats = async (startDate) => {
    // Get message stats by channel
    const { data: messages } = await supabase
      .from('communication_messages')
      .select('channel, status')
      .eq('organizer_id', organizer.id)
      .gte('created_at', startDate.toISOString());

    if (!messages) {
      setChannelStats([]);
      return;
    }

    // Group by channel
    const channelMap = {};
    messages.forEach(msg => {
      if (!channelMap[msg.channel]) {
        channelMap[msg.channel] = { sent: 0, delivered: 0, failed: 0 };
      }
      channelMap[msg.channel].sent++;
      if (msg.status === 'delivered' || msg.status === 'sent') {
        channelMap[msg.channel].delivered++;
      } else if (msg.status === 'failed') {
        channelMap[msg.channel].failed++;
      }
    });

    const stats = Object.entries(channelMap).map(([channel, data]) => ({
      channel,
      ...data,
      deliveryRate: data.sent > 0 ? ((data.delivered / data.sent) * 100).toFixed(1) : 0,
    }));

    setChannelStats(stats);
  };

  const loadRecentCampaigns = async () => {
    const { data } = await supabase
      .from('communication_campaigns')
      .select('id, name, channels, status, sent_count, delivered_count, opened_count, clicked_count, sent_at, created_at')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setRecentCampaigns(data || []);
  };

  const loadDailyStats = async (startDate) => {
    // Get messages grouped by day
    const { data: messages } = await supabase
      .from('communication_messages')
      .select('created_at, status')
      .eq('organizer_id', organizer.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at');

    if (!messages) {
      setDailyStats([]);
      return;
    }

    // Group by day
    const dayMap = {};
    messages.forEach(msg => {
      const day = format(new Date(msg.created_at), 'MMM dd');
      if (!dayMap[day]) {
        dayMap[day] = { day, sent: 0, delivered: 0 };
      }
      dayMap[day].sent++;
      if (msg.status === 'delivered' || msg.status === 'sent') {
        dayMap[day].delivered++;
      }
    });

    setDailyStats(Object.values(dayMap));
  };

  const loadTopPerforming = async (startDate) => {
    const { data } = await supabase
      .from('communication_campaigns')
      .select('id, name, channels, opened_count, clicked_count, sent_count')
      .eq('organizer_id', organizer.id)
      .eq('status', 'sent')
      .gte('created_at', startDate.toISOString())
      .order('opened_count', { ascending: false })
      .limit(5);

    setTopPerforming(data || []);
  };

  const loadEmailTrackingStats = async (startDate) => {
    // Get email tracking events for device/client breakdown
    const { data: trackingEvents } = await supabase
      .from('email_tracking_events')
      .select('event_type, device_type, email_client, first_event_at, recipient_email, link_url')
      .eq('organizer_id', organizer.id)
      .gte('first_event_at', startDate.toISOString())
      .order('first_event_at', { ascending: false })
      .limit(500);

    if (!trackingEvents || trackingEvents.length === 0) {
      setEmailTrackingStats({
        deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
        clientBreakdown: {},
        recentOpens: [],
        recentClicks: [],
      });
      return;
    }

    // Calculate device breakdown
    const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 };
    const clientBreakdown = {};
    const recentOpens = [];
    const recentClicks = [];

    trackingEvents.forEach(event => {
      // Device breakdown
      if (event.device_type) {
        deviceBreakdown[event.device_type] = (deviceBreakdown[event.device_type] || 0) + 1;
      }

      // Client breakdown (only for opens)
      if (event.event_type === 'open' && event.email_client) {
        clientBreakdown[event.email_client] = (clientBreakdown[event.email_client] || 0) + 1;
      }

      // Recent events
      if (event.event_type === 'open' && recentOpens.length < 10) {
        recentOpens.push(event);
      } else if (event.event_type === 'click' && recentClicks.length < 10) {
        recentClicks.push(event);
      }
    });

    setEmailTrackingStats({
      deviceBreakdown,
      clientBreakdown,
      recentOpens,
      recentClicks,
    });
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F0F0F]">Communication Analytics</h1>
          <p className="text-[#0F0F0F]/60">Track your campaign performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview.totalCampaigns}</p>
                <p className="text-xs text-[#0F0F0F]/60">Campaigns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(overview.totalSent)}</p>
                <p className="text-xs text-[#0F0F0F]/60">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(overview.totalDelivered)}</p>
                <p className="text-xs text-[#0F0F0F]/60">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Eye className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(overview.totalOpened)}</p>
                <p className="text-xs text-[#0F0F0F]/60">Opened</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <MousePointer className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(overview.totalClicked)}</p>
                <p className="text-xs text-[#0F0F0F]/60">Clicked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(overview.totalFailed)}</p>
                <p className="text-xs text-[#0F0F0F]/60">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#0F0F0F]/60">Delivery Rate</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-4xl font-bold text-green-600">{overview.avgDeliveryRate}%</p>
            <div className="mt-2 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${overview.avgDeliveryRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#0F0F0F]/60">Open Rate</span>
              <Eye className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-4xl font-bold text-amber-600">{overview.avgOpenRate}%</p>
            <div className="mt-2 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${overview.avgOpenRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[#0F0F0F]/60">Click Rate</span>
              <MousePointer className="w-5 h-5 text-cyan-500" />
            </div>
            <p className="text-4xl font-bold text-cyan-600">{overview.avgClickRate}%</p>
            <div className="mt-2 h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${Math.min(overview.avgClickRate * 2, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance */}
      <Card className="border-[#0F0F0F]/10 rounded-xl">
        <CardHeader>
          <CardTitle>Performance by Channel</CardTitle>
        </CardHeader>
        <CardContent>
          {channelStats.length === 0 ? (
            <div className="text-center py-8 text-[#0F0F0F]/40">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <p>No channel data yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {channelStats.map((stat) => {
                const config = CHANNELS[stat.channel] || CHANNELS.email;
                return (
                  <div key={stat.channel} className={`p-4 rounded-xl ${config.bgColor.replace('100', '50')}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <config.icon className={`w-5 h-5 ${config.color}`} />
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[#0F0F0F]/60">Sent</p>
                        <p className="font-semibold">{formatNumber(stat.sent)}</p>
                      </div>
                      <div>
                        <p className="text-[#0F0F0F]/60">Delivered</p>
                        <p className="font-semibold">{formatNumber(stat.delivered)}</p>
                      </div>
                      <div>
                        <p className="text-[#0F0F0F]/60">Failed</p>
                        <p className="font-semibold text-red-600">{formatNumber(stat.failed)}</p>
                      </div>
                      <div>
                        <p className="text-[#0F0F0F]/60">Rate</p>
                        <p className="font-semibold text-green-600">{stat.deliveryRate}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Campaigns & Top Performing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Campaigns</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/organizer/hub')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <div className="text-center py-8 text-[#0F0F0F]/40">
                <Send className="w-8 h-8 mx-auto mb-2" />
                <p>No campaigns yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.name}</p>
                      <div className="flex items-center gap-2 text-xs text-[#0F0F0F]/60">
                        <Badge className={getStatusColor(campaign.status)} variant="secondary">
                          {campaign.status}
                        </Badge>
                        <span>{format(new Date(campaign.created_at), 'MMM d')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatNumber(campaign.sent_count || 0)}</p>
                      <p className="text-xs text-[#0F0F0F]/40">sent</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performing */}
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardHeader>
            <CardTitle>Top Performing Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {topPerforming.length === 0 ? (
              <div className="text-center py-8 text-[#0F0F0F]/40">
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <p>No data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPerforming.map((campaign, index) => {
                  const openRate = campaign.sent_count > 0 
                    ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(1) 
                    : 0;
                  return (
                    <div key={campaign.id} className="flex items-center gap-3 p-3 bg-[#F4F6FA] rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-[#F4F6FA] text-[#0F0F0F]/40'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{campaign.name}</p>
                        <div className="flex items-center gap-2">
                          {(campaign.channels || ['email']).map(ch => {
                            const config = CHANNELS[ch] || CHANNELS.email;
                            return <config.icon key={ch} className={`w-3 h-3 ${config.color}`} />;
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{openRate}%</p>
                        <p className="text-xs text-[#0F0F0F]/40">open rate</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Activity Chart (simplified - bar representation) */}
      {dailyStats.length > 0 && (
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardHeader>
            <CardTitle>Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {dailyStats.slice(-14).map((day, index) => {
                const maxSent = Math.max(...dailyStats.map(d => d.sent));
                const height = maxSent > 0 ? (day.sent / maxSent) * 100 : 0;
                return (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[#2969FF] rounded-t"
                      style={{ height: `${height}%`, minHeight: day.sent > 0 ? '4px' : '0' }}
                      title={`${day.day}: ${day.sent} sent`}
                    />
                    <span className="text-[10px] text-[#0F0F0F]/40 rotate-45 origin-left">
                      {day.day.split(' ')[1]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-[#2969FF]" />
                <span className="text-[#0F0F0F]/60">Messages Sent</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Tracking Insights */}
      {(Object.values(emailTrackingStats.deviceBreakdown).some(v => v > 0) || 
        Object.keys(emailTrackingStats.clientBreakdown).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Device Breakdown */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-500" />
                Opens by Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['desktop', 'mobile', 'tablet'].map(device => {
                  const count = emailTrackingStats.deviceBreakdown[device] || 0;
                  const total = Object.values(emailTrackingStats.deviceBreakdown).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                  
                  return (
                    <div key={device} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize font-medium">{device}</span>
                        <span className="text-[#0F0F0F]/60">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-[#F4F6FA] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            device === 'mobile' ? 'bg-green-500' :
                            device === 'tablet' ? 'bg-purple-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Email Client Breakdown */}
          <Card className="border-[#0F0F0F]/10 rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Opens by Email Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(emailTrackingStats.clientBreakdown).length === 0 ? (
                <div className="text-center py-4 text-[#0F0F0F]/40">
                  <p>No client data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(emailTrackingStats.clientBreakdown)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([client, count]) => {
                      const total = Object.values(emailTrackingStats.clientBreakdown).reduce((a, b) => a + b, 0);
                      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                      
                      const clientLabels = {
                        gmail: 'Gmail',
                        outlook: 'Outlook',
                        apple_mail: 'Apple Mail',
                        yahoo: 'Yahoo',
                        other: 'Other',
                      };
                      
                      return (
                        <div key={client} className="flex items-center justify-between p-2 bg-[#F4F6FA] rounded-lg">
                          <span className="font-medium">{clientLabels[client] || client}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#0F0F0F]/60">{count}</span>
                            <Badge variant="secondary">{percentage}%</Badge>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Tracking Activity */}
      {(emailTrackingStats.recentOpens.length > 0 || emailTrackingStats.recentClicks.length > 0) && (
        <Card className="border-[#0F0F0F]/10 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Recent Email Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="opens">
              <TabsList>
                <TabsTrigger value="opens">
                  <Eye className="w-4 h-4 mr-1" />
                  Opens ({emailTrackingStats.recentOpens.length})
                </TabsTrigger>
                <TabsTrigger value="clicks">
                  <MousePointer className="w-4 h-4 mr-1" />
                  Clicks ({emailTrackingStats.recentClicks.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="opens" className="mt-4">
                {emailTrackingStats.recentOpens.length === 0 ? (
                  <p className="text-center py-4 text-[#0F0F0F]/40">No recent opens</p>
                ) : (
                  <div className="space-y-2">
                    {emailTrackingStats.recentOpens.map((event, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            event.device_type === 'mobile' ? 'bg-green-100' :
                            event.device_type === 'tablet' ? 'bg-purple-100' : 'bg-blue-100'
                          }`}>
                            <Eye className={`w-4 h-4 ${
                              event.device_type === 'mobile' ? 'text-green-600' :
                              event.device_type === 'tablet' ? 'text-purple-600' : 'text-blue-600'
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{event.recipient_email || 'Unknown'}</p>
                            <p className="text-xs text-[#0F0F0F]/40 capitalize">
                              {event.device_type || 'Unknown device'} • {event.email_client || 'Unknown client'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-[#0F0F0F]/40">
                          {format(new Date(event.first_event_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="clicks" className="mt-4">
                {emailTrackingStats.recentClicks.length === 0 ? (
                  <p className="text-center py-4 text-[#0F0F0F]/40">No recent clicks</p>
                ) : (
                  <div className="space-y-2">
                    {emailTrackingStats.recentClicks.map((event, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[#F4F6FA] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center">
                            <MousePointer className="w-4 h-4 text-cyan-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{event.recipient_email || 'Unknown'}</p>
                            <p className="text-xs text-[#0F0F0F]/40 truncate max-w-[250px]">
                              {event.link_url || 'Link clicked'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-[#0F0F0F]/40 whitespace-nowrap">
                          {format(new Date(event.first_event_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CommunicationAnalytics;
