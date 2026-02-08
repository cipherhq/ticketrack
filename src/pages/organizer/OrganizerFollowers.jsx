import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, Calendar, Mail, MessageSquare, Search, Filter,
  Download, UserPlus, Bell, Loader2, RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { formatMultiCurrencyCompact } from '@/config/currencies';

export function OrganizerFollowers() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    if (organizer?.id) {
      loadFollowers();
    }
  }, [organizer?.id]);

  const loadFollowers = async () => {
    setLoading(true);
    try {
      // Get followers with profile info
      const { data: followersData, error: followersError } = await supabase
        .from('followers')
        .select(`
          id,
          created_at,
          notifications_enabled,
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      if (followersError) throw followersError;

      // Get events for this organizer (with currency)
      const { data: events } = await supabase
        .from('events')
        .select('id, currency')
        .eq('organizer_id', organizer.id);

      const eventIds = events?.map(e => e.id) || [];
      
      // Create a map of event_id -> currency for quick lookup
      const eventCurrencyMap = {};
      events?.forEach(e => {
        eventCurrencyMap[e.id] = e.currency;
      });

      // For each follower, get their ticket stats
      const followersWithStats = await Promise.all(
        (followersData || []).map(async (follower) => {
          if (!follower.profiles) return null;

          let eventsAttended = 0;
          let totalSpentByCurrency = {}; // Track spending by currency
          let lastActivity = follower.created_at;

          if (eventIds.length > 0) {
            const { data: tickets } = await supabase
              .from('tickets')
              .select('id, total_amount, created_at, checked_in_at, event_id')
              .eq('user_id', follower.user_id)
              .in('event_id', eventIds)
              .in('payment_status', ['completed', 'free', 'paid', 'complimentary']);

            eventsAttended = tickets?.filter(t => t.checked_in_at)?.length || 0;
            
            // Sum spending by currency
            tickets?.forEach(ticket => {
              const currency = eventCurrencyMap[ticket.event_id];
              if (!currency) {
                console.warn('Ticket missing event currency:', ticket);
                return; // Skip tickets without currency
              }
              totalSpentByCurrency[currency] = (totalSpentByCurrency[currency] || 0) + (ticket.total_amount || 0);
            });
            
            if (tickets?.length > 0) {
              const sorted = tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
              lastActivity = sorted[0].created_at;
            }
          }

          return {
            id: follower.id,
            name: follower.profiles.full_name || 'Unknown',
            email: follower.profiles.email || '',
            followedDate: follower.created_at,
            eventsAttended,
            totalSpentByCurrency, // Now an object: { NGN: 5000, USD: 100 }
            lastActivity,
            notificationsEnabled: follower.notifications_enabled ?? true,
          };
        })
      );

      setFollowers(followersWithStats.filter(Boolean));
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportFollowers = () => {
    if (followers.length === 0) return;
    
    const csvContent = [
      ['Name', 'Email', 'Followed Date', 'Events Attended', 'Total Spent', 'Last Activity'],
      ...followers.map(f => [
        f.name,
        f.email,
        new Date(f.followedDate).toLocaleDateString(),
        f.eventsAttended,
        formatMultiCurrencyCompact(f.totalSpentByCurrency), // Use formatted multi-currency string
        new Date(f.lastActivity).toLocaleDateString(),
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `followers-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Helper to get total spent across all currencies for sorting
  const getTotalSpent = (spentByCurrency) => {
    if (!spentByCurrency || typeof spentByCurrency !== 'object') return 0;
    return Object.values(spentByCurrency).reduce((sum, amount) => sum + (amount || 0), 0);
  };

  const filteredFollowers = followers
    .filter(
      (follower) =>
        follower.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        follower.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.followedDate).getTime() - new Date(a.followedDate).getTime();
        case 'events':
          return b.eventsAttended - a.eventsAttended;
        case 'spent':
          return getTotalSpent(b.totalSpentByCurrency) - getTotalSpent(a.totalSpentByCurrency);
        case 'active':
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        default:
          return 0;
      }
    });

  const totalFollowers = followers.length;
  const newFollowersThisMonth = followers.filter((f) => {
    const followedDate = new Date(f.followedDate);
    const now = new Date();
    return followedDate.getMonth() === now.getMonth() && followedDate.getFullYear() === now.getFullYear();
  }).length;

  const activeFollowers = followers.filter((f) => {
    const lastActivity = new Date(f.lastActivity);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastActivity >= thirtyDaysAgo;
  }).length;

  const notificationsOn = followers.filter((f) => f.notificationsEnabled).length;

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
          <h2 className="text-2xl font-semibold text-foreground">Followers</h2>
          <p className="text-muted-foreground mt-1">Manage your followers and send them notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadFollowers}
            className="rounded-xl border-border/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            onClick={exportFollowers}
            disabled={followers.length === 0}
            className="rounded-xl"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Followers</p>
                <p className="text-2xl font-semibold text-foreground">{totalFollowers.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">New This Month</p>
                <p className="text-2xl font-semibold text-green-600">{newFollowersThisMonth}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active (30 days)</p>
                <p className="text-2xl font-semibold text-foreground">{activeFollowers}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notifications On</p>
                <p className="text-2xl font-semibold text-foreground">{notificationsOn}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Button
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-auto py-4"
              onClick={() => navigate('/organizer/email-campaigns')}
            >
              <Mail className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">Email Campaign</p>
                <p className="text-xs opacity-80">Email {totalFollowers} followers</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-auto py-4 border-border/10"
              onClick={() => navigate('/organizer/sms')}
            >
              <MessageSquare className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">SMS Campaign</p>
                <p className="text-xs text-muted-foreground">Send SMS messages</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search followers by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-muted border-0 rounded-xl"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="md:w-48 h-12 rounded-xl border-border/10">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="active">Most Active</SelectItem>
                <SelectItem value="events">Most Events</SelectItem>
                <SelectItem value="spent">Highest Spending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredFollowers.length === 0 ? (
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {followers.length === 0 ? 'No followers yet' : 'No followers match your search'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFollowers.map((follower) => (
            <Card key={follower.id} className="border-border/10 rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium flex-shrink-0">
                    {follower.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium text-foreground">{follower.name}</h3>
                      {follower.notificationsEnabled && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <Bell className="w-3 h-3 mr-1" />
                          Notifications On
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        {follower.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Followed {new Date(follower.followedDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Events</p>
                      <p className="text-lg font-semibold text-foreground">{follower.eventsAttended}</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Spent</p>
                      <p className="text-lg font-semibold text-foreground">{formatMultiCurrencyCompact(follower.totalSpentByCurrency)}</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Last Active</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(follower.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
