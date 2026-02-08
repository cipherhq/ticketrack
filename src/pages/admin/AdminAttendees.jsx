import { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  RefreshCw,
  Users,
  Ticket,
  DollarSign,
  Download,
  Mail,
  Phone,
  Calendar,
  Building,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export function AdminAttendees() {
  const [loading, setLoading] = useState(true);
  const [attendees, setAttendees] = useState([]);
  const [events, setEvents] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [organizerFilter, setOrganizerFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadOrganizers();
    loadEvents();
  }, []);

  useEffect(() => {
    loadAttendees();
  }, [page, eventFilter, organizerFilter, searchQuery]);

  const loadOrganizers = async () => {
    const { data } = await supabase
      .from('organizers')
      .select('id, business_name')
      .order('business_name');
    setOrganizers(data || []);
  };

  const loadAttendees = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tickets')
        .select(`
          id,
          attendee_name,
          attendee_email,
          attendee_phone,
          quantity,
          total_price,
          currency,
          payment_status,
          checked_in,
          checked_in_at,
          created_at,
          events!inner (
            id,
            title,
            organizer_id,
            organizer:organizers(id, business_name)
          )
        `, { count: 'exact' })
        .eq('payment_status', 'completed');

      // Apply filters
      if (eventFilter !== 'all') {
        query = query.eq('event_id', eventFilter);
      }
      if (organizerFilter !== 'all') {
        query = query.eq('events.organizer_id', organizerFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(`attendee_name.ilike.%${searchQuery}%,attendee_email.ilike.%${searchQuery}%,attendee_phone.ilike.%${searchQuery}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error loading attendees:', error);
        return;
      }

      // Transform data
      const transformedAttendees = (data || []).map((ticket) => ({
        id: ticket.id,
        name: ticket.attendee_name || 'Unknown',
        email: ticket.attendee_email || 'N/A',
        phone: ticket.attendee_phone || 'N/A',
        eventId: ticket.events?.id,
        eventName: ticket.events?.title || 'Unknown Event',
        organizerName: ticket.events?.organizer?.business_name || '—',
        tickets: ticket.quantity || 1,
        amountPaid: parseFloat(ticket.total_price) || 0,
        currency: ticket.currency || 'NGN',
        checkedIn: ticket.checked_in || false,
        checkedInAt: ticket.checked_in_at,
        purchaseDate: ticket.created_at,
      }));

      setAttendees(transformedAttendees);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading attendees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error loading events:', error);
      return;
    }

    setEvents(data || []);
  };

  const formatCurrency = (amount, currency = 'NGN') => {
    const symbols = { NGN: '₦', USD: '$', GBP: '£', GHS: 'GH₵', CAD: 'C$' };
    const symbol = symbols[currency] || '₦';
    return `${symbol}${(amount || 0).toLocaleString()}`;
  };

  const exportToCSV = async () => {
    try {
      // Fetch all data for export (no pagination)
      let query = supabase
        .from('tickets')
        .select(`
          attendee_name, attendee_email, attendee_phone, quantity, total_price, currency,
          checked_in, created_at,
          events!inner(title, organizer:organizers(business_name))
        `)
        .eq('payment_status', 'completed');

      if (eventFilter !== 'all') query = query.eq('event_id', eventFilter);
      if (organizerFilter !== 'all') query = query.eq('events.organizer_id', organizerFilter);

      const { data } = await query.order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      const headers = ['Name', 'Email', 'Phone', 'Event', 'Organizer', 'Tickets', 'Amount', 'Currency', 'Checked In', 'Date'];
      const rows = data.map((t) => [
        t.attendee_name || '',
        t.attendee_email || '',
        t.attendee_phone || '',
        t.events?.title || '',
        t.events?.organizer?.business_name || '',
        t.quantity || 1,
        t.total_price || 0,
        t.currency || 'NGN',
        t.checked_in ? 'Yes' : 'No',
        t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd') : '',
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export');
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const stats = {
    total: totalCount,
    totalTickets: attendees.reduce((sum, a) => sum + a.tickets, 0),
    checkedIn: attendees.filter((a) => a.checkedIn).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">All Attendees</h2>
          <p className="text-muted-foreground mt-1">View all ticket purchasers across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={exportToCSV} className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Attendees</p>
                <p className="text-2xl font-semibold">{stats.total.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tickets (this page)</p>
                <p className="text-2xl font-semibold">{stats.totalTickets.toLocaleString()}</p>
              </div>
              <Ticket className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checked In (this page)</p>
                <p className="text-2xl font-semibold">{stats.checkedIn.toLocaleString()}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-border/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-10 bg-card border-border/10 rounded-xl"
              />
            </div>
            <Select value={organizerFilter} onValueChange={(v) => { setOrganizerFilter(v); setPage(1); }}>
              <SelectTrigger className="w-52 rounded-xl">
                <Building className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Organizers" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-64">
                <SelectItem value="all">All Organizers</SelectItem>
                {organizers.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(1); }}>
              <SelectTrigger className="w-52 rounded-xl">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-64">
                <SelectItem value="all">All Events</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attendees Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">Attendees ({totalCount.toLocaleString()})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/10 bg-muted">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Attendee</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Event</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Organizer</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Tickets</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Amount</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Status</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((attendee) => (
                      <tr key={attendee.id} className="border-b border-border/5 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-foreground font-medium">{attendee.name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {attendee.email}
                              </span>
                              {attendee.phone && attendee.phone !== 'N/A' && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {attendee.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm">{attendee.eventName}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-muted-foreground">{attendee.organizerName}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p>{attendee.tickets}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{formatCurrency(attendee.amountPaid, attendee.currency)}</p>
                        </td>
                        <td className="py-3 px-4">
                          {attendee.checkedIn ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Checked In</Badge>
                          ) : (
                            <Badge className="bg-muted text-foreground/80 text-xs">Pending</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-muted-foreground">
                            {attendee.purchaseDate ? format(new Date(attendee.purchaseDate), 'MMM d, yyyy') : '—'}
                          </p>
                        </td>
                      </tr>
                    ))}
                    {attendees.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          <Users className="w-12 h-12 text-foreground/20 mx-auto mb-3" />
                          No attendees found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/10">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
