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

export function AdminAttendees() {
  const [loading, setLoading] = useState(true);
  const [attendees, setAttendees] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAttendees(), loadEvents()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendees = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        attendee_name,
        attendee_email,
        attendee_phone,
        quantity,
        total_amount,
        payment_status,
        checked_in,
        checked_in_at,
        created_at,
        events (
          id,
          title
        ),
        profiles:user_id (
          full_name,
          email,
          phone
        )
      `)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading attendees:', error);
      return;
    }

    // Transform data
    const transformedAttendees = (data || []).map((ticket) => ({
      id: ticket.id,
      name: ticket.attendee_name || ticket.profiles?.full_name || 'Unknown',
      email: ticket.attendee_email || ticket.profiles?.email || 'N/A',
      phone: ticket.attendee_phone || ticket.profiles?.phone || 'N/A',
      eventId: ticket.events?.id,
      eventName: ticket.events?.title || 'Unknown Event',
      tickets: ticket.quantity || 1,
      amountPaid: parseFloat(ticket.total_amount) || 0,
      checkedIn: ticket.checked_in || false,
      checkedInAt: ticket.checked_in_at,
      purchaseDate: ticket.created_at,
    }));

    setAttendees(transformedAttendees);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Event', 'Tickets', 'Amount Paid', 'Checked In', 'Purchase Date'];
    const rows = filteredAttendees.map((a) => [
      a.name,
      a.email,
      a.phone,
      a.eventName,
      a.tickets,
      a.amountPaid,
      a.checkedIn ? 'Yes' : 'No',
      new Date(a.purchaseDate).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredAttendees = attendees.filter((attendee) => {
    const matchesSearch =
      attendee.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attendee.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attendee.eventName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEvent = eventFilter === 'all' || attendee.eventId === eventFilter;

    return matchesSearch && matchesEvent;
  });

  const stats = {
    total: attendees.length,
    totalTickets: attendees.reduce((sum, a) => sum + a.tickets, 0),
    totalRevenue: attendees.reduce((sum, a) => sum + a.amountPaid, 0),
    checkedIn: attendees.filter((a) => a.checkedIn).length,
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">All Attendees</h2>
          <p className="text-[#0F0F0F]/60 mt-1">View all ticket purchasers across the platform</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Attendees</p>
                <p className="text-2xl font-semibold">{stats.total.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-[#2969FF]/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Tickets</p>
                <p className="text-2xl font-semibold">{stats.totalTickets.toLocaleString()}</p>
              </div>
              <Ticket className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Total Revenue</p>
                <p className="text-xl font-semibold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F0F0F]/60">Checked In</p>
                <p className="text-2xl font-semibold">{stats.checkedIn.toLocaleString()}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search by name, email, or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-[#0F0F0F]/10 rounded-xl"
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-64 rounded-xl">
                <SelectValue placeholder="Filter by event" />
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
      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F]">Attendees ({filteredAttendees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#0F0F0F]/10">
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Attendee</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Contact</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Event</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Tickets</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Amount</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Status</th>
                  <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#2969FF]/10 flex items-center justify-center text-[#2969FF] font-medium">
                          {attendee.name?.charAt(0) || 'A'}
                        </div>
                        <p className="text-[#0F0F0F] font-medium">{attendee.name}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm text-[#0F0F0F]/80">
                          <Mail className="w-3 h-3" />
                          {attendee.email}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-[#0F0F0F]/60">
                          <Phone className="w-3 h-3" />
                          {attendee.phone}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/80 text-sm">{attendee.eventName}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]">{attendee.tickets}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F] font-medium">{formatCurrency(attendee.amountPaid)}</p>
                    </td>
                    <td className="py-4 px-4">
                      {attendee.checkedIn ? (
                        <Badge className="bg-green-100 text-green-700">Checked In</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">Not Checked In</Badge>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-[#0F0F0F]/60 text-sm">
                        {new Date(attendee.purchaseDate).toLocaleDateString()}
                      </p>
                    </td>
                  </tr>
                ))}
                {filteredAttendees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#0F0F0F]/60">
                      No attendees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
