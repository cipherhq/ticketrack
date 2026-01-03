import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Mail, Download, Filter, MoreVertical, Loader2, Users, CheckCircle, Clock, Calendar, RefreshCw, Eye, ChevronUp, ChevronDown, Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';
import { Pagination, usePagination } from '@/components/ui/pagination';

export function ManageAttendees() {
  const navigate = useNavigate();
  const { id: eventIdParam } = useParams();
  const { organizer } = useOrganizer();
  
  const [loading, setLoading] = useState(true);
  const [attendees, setAttendees] = useState([]);
  const [groupedAttendees, setGroupedAttendees] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState(eventIdParam || 'all');
  const [checkInFilter, setCheckInFilter] = useState('all');
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [customFieldsByEvent, setCustomFieldsByEvent] = useState({});
  const [customResponses, setCustomResponses] = useState({});
  const [expandedRows, setExpandedRows] = useState([]);

  useEffect(() => {
    if (organizer?.id) {
      loadData();
    }
  }, [organizer?.id]);

  // Group attendees by email whenever attendees change
  useEffect(() => {
    groupAttendeesByEmail();
  }, [attendees, eventFilter, checkInFilter, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEvents(), loadAttendees(), loadCustomFields()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title')
      .eq('organizer_id', organizer.id)
      .order('start_date', { ascending: false });

    if (error) throw error;
    setEvents(data || []);
  };

  const loadAttendees = async () => {
    const { data: orgEvents, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', organizer.id);

    if (eventsError) throw eventsError;

    const eventIds = orgEvents?.map(e => e.id) || [];
    if (eventIds.length === 0) {
      setAttendees([]);
      return;
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        attendee_name,
        attendee_email,
        ticket_code,
        quantity,
        total_price,
        payment_status,
        is_checked_in,
        checked_in_at,
        created_at,
        event_id,
        events (id, title),
        ticket_type_id,
        ticket_types (id, name)
      `)
      .in('event_id', eventIds)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false });

    if (ticketsError) throw ticketsError;

    const formattedAttendees = tickets?.map(ticket => ({
      id: ticket.id,
      name: ticket.attendee_name,
      email: ticket.attendee_email,
      event: ticket.events?.title || 'Unknown Event',
      eventId: ticket.event_id,
      ticketType: ticket.ticket_types?.name || 'Standard',
      ticketId: ticket.ticket_code,
      purchaseDate: ticket.created_at,
      checkedIn: ticket.is_checked_in || false,
      checkInTime: ticket.checked_in_at,
      quantity: ticket.quantity || 1,
      totalPrice: ticket.total_price,
    })) || [];

    setAttendees(formattedAttendees);
  };

  // Group attendees by email for cleaner display
  const groupAttendeesByEmail = () => {
    // First apply filters
    const filtered = attendees.filter((attendee) => {
      const matchesSearch =
        attendee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.ticketId?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEvent = eventFilter === 'all' || attendee.eventId === eventFilter;
      const matchesCheckIn =
        checkInFilter === 'all' ||
        (checkInFilter === 'checkedIn' && attendee.checkedIn) ||
        (checkInFilter === 'notCheckedIn' && !attendee.checkedIn);
      return matchesSearch && matchesEvent && matchesCheckIn;
    });

    // Group by email
    const grouped = {};
    filtered.forEach(attendee => {
      const key = attendee.email?.toLowerCase() || attendee.id;
      if (!grouped[key]) {
        grouped[key] = {
          email: attendee.email,
          name: attendee.name,
          tickets: [],
          totalTickets: 0,
          checkedInCount: 0,
          firstPurchase: attendee.purchaseDate,
          events: new Set(),
        };
      }
      grouped[key].tickets.push(attendee);
      grouped[key].totalTickets += 1;
      if (attendee.checkedIn) grouped[key].checkedInCount += 1;
      grouped[key].events.add(attendee.event);
      // Keep the earliest purchase date
      if (new Date(attendee.purchaseDate) < new Date(grouped[key].firstPurchase)) {
        grouped[key].firstPurchase = attendee.purchaseDate;
      }
    });

    // Convert to array and sort by most recent purchase
    const groupedArray = Object.values(grouped).map(group => ({
      ...group,
      events: Array.from(group.events),
      ticketIds: group.tickets.map(t => t.id),
    })).sort((a, b) => new Date(b.firstPurchase) - new Date(a.firstPurchase));

    setGroupedAttendees(groupedArray);
  };

  const loadCustomFields = async () => {
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', organizer.id);

    if (!orgEvents || orgEvents.length === 0) return;

    const eventIds = orgEvents.map(e => e.id);

    const { data: fields } = await supabase
      .from('event_custom_fields')
      .select('*')
      .in('event_id', eventIds)
      .order('display_order');

    if (fields && fields.length > 0) {
      const fieldsByEvent = {};
      fields.forEach(field => {
        if (!fieldsByEvent[field.event_id]) {
          fieldsByEvent[field.event_id] = [];
        }
        fieldsByEvent[field.event_id].push(field);
      });
      setCustomFieldsByEvent(fieldsByEvent);

      const { data: responses } = await supabase
        .from('custom_field_responses')
        .select('*, event_custom_fields(field_label, event_id)')
        .in('custom_field_id', fields.map(f => f.id));

      if (responses) {
        const responsesByTicket = {};
        responses.forEach(r => {
          if (!responsesByTicket[r.ticket_id]) {
            responsesByTicket[r.ticket_id] = [];
          }
          responsesByTicket[r.ticket_id].push({
            label: r.event_custom_fields?.field_label,
            value: r.response_value
          });
        });
        setCustomResponses(responsesByTicket);
      }
    }
  };

  const toggleRowExpand = (email) => {
    setExpandedRows(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const toggleSelectAll = () => {
    const allTicketIds = groupedAttendees.flatMap(g => g.ticketIds);
    if (selectedAttendees.length === allTicketIds.length) {
      setSelectedAttendees([]);
    } else {
      setSelectedAttendees(allTicketIds);
    }
  };

  const toggleSelectAttendee = (ticketIds) => {
    const allSelected = ticketIds.every(id => selectedAttendees.includes(id));
    if (allSelected) {
      setSelectedAttendees(prev => prev.filter(id => !ticketIds.includes(id)));
    } else {
      setSelectedAttendees(prev => [...new Set([...prev, ...ticketIds])]);
    }
  };

  const exportToCSV = () => {
    const allFieldLabels = new Set();
    attendees.forEach(a => {
      const responses = customResponses[a.id] || [];
      responses.forEach(r => {
        if (r.label) allFieldLabels.add(r.label);
      });
    });
    const fieldLabelsArray = Array.from(allFieldLabels);

    const headers = [
      'Name', 'Email', 'Event', 'Ticket Type', 
      'Ticket ID', 'Purchase Date', 'Status', 'Check-in Time',
      ...fieldLabelsArray
    ];
    
    // Export individual tickets (not grouped)
    const filteredTickets = attendees.filter((attendee) => {
      const matchesSearch =
        attendee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.ticketId?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEvent = eventFilter === 'all' || attendee.eventId === eventFilter;
      const matchesCheckIn =
        checkInFilter === 'all' ||
        (checkInFilter === 'checkedIn' && attendee.checkedIn) ||
        (checkInFilter === 'notCheckedIn' && !attendee.checkedIn);
      return matchesSearch && matchesEvent && matchesCheckIn;
    });

    const csvData = filteredTickets.map(a => {
      const responses = customResponses[a.id] || [];
      const customValues = fieldLabelsArray.map(label => {
        const response = responses.find(r => r.label === label);
        return response?.value || '';
      });

      return [
        a.name,
        a.email,
        a.event,
        a.ticketType,
        a.ticketId,
        formatDate(a.purchaseDate),
        a.checkedIn ? 'Checked In' : 'Pending',
        a.checkInTime ? formatDateTime(a.checkInTime) : 'N/A',
        ...customValues
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell || ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendees_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const resendTicket = async (attendee) => {
    alert(`Ticket resent to ${attendee.email}`);
  };

  const manualCheckIn = async (attendeeId, checkedIn) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          is_checked_in: checkedIn,
          checked_in_at: checkedIn ? new Date().toISOString() : null
        })
        .eq('id', attendeeId);

      if (error) throw error;

      setAttendees(attendees.map(a => 
        a.id === attendeeId 
          ? { ...a, checkedIn, checkInTime: checkedIn ? new Date().toISOString() : null }
          : a
      ));
    } catch (error) {
      console.error('Error updating check-in status:', error);
      alert('Failed to update check-in status');
    }
  };

  const bulkCheckIn = async (ticketIds, checkedIn) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          is_checked_in: checkedIn,
          checked_in_at: checkedIn ? new Date().toISOString() : null
        })
        .in('id', ticketIds);

      if (error) throw error;

      setAttendees(attendees.map(a => 
        ticketIds.includes(a.id)
          ? { ...a, checkedIn, checkInTime: checkedIn ? new Date().toISOString() : null }
          : a
      ));
    } catch (error) {
      console.error('Error updating check-in status:', error);
      alert('Failed to update check-in status');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const totalTickets = attendees.length;
  const checkedInCount = attendees.filter(a => a.checkedIn).length;
  const pendingCount = attendees.filter(a => !a.checkedIn).length;
  const uniqueAttendeesCount = groupedAttendees.length;
  
  // Pagination
  const totalPages = Math.max(1, Math.ceil(groupedAttendees.length / itemsPerPage));
  const paginatedAttendees = groupedAttendees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, eventFilter, checkInFilter]);

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
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Manage Attendees</h2>
          <p className="text-[#0F0F0F]/60 mt-1">View and manage all your event attendees</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadData} variant="outline" size="icon" className="rounded-xl border-[#0F0F0F]/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="rounded-xl border-[#0F0F0F]/10" disabled={groupedAttendees.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {selectedAttendees.length > 0 && (
            <Button onClick={() => navigate('/organizer/email-campaigns', { state: { attendeeIds: selectedAttendees } })} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
              <Mail className="w-4 h-4 mr-2" />
              Email Selected ({selectedAttendees.length})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2969FF]" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Unique Attendees</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{uniqueAttendeesCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Total Tickets</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{totalTickets}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Checked In</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{checkedInCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-[#0F0F0F]/60 text-sm">Pending</p>
                <h3 className="text-2xl font-semibold text-[#0F0F0F]">{pendingCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input placeholder="Search by name, email, or ticket ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-[#F4F6FA] border-0 rounded-xl" />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="md:w-64 h-12 rounded-xl border-[#0F0F0F]/10">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Events</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={checkInFilter} onValueChange={setCheckInFilter}>
              <SelectTrigger className="md:w-48 h-12 rounded-xl border-[#0F0F0F]/10">
                <SelectValue placeholder="Check-in Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="checkedIn">Checked In</SelectItem>
                <SelectItem value="notCheckedIn">Not Checked In</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[#0F0F0F] flex items-center justify-between">
            <span>Attendees ({groupedAttendees.length})</span>
            {groupedAttendees.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="rounded-xl text-[#2969FF]">
                {selectedAttendees.length === attendees.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupedAttendees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#0F0F0F]/20 mx-auto mb-4" />
              <p className="text-[#0F0F0F]/60">{attendees.length === 0 ? 'No attendees yet' : 'No attendees match your filters'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#0F0F0F]/10">
                    <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium w-12">
                      <input type="checkbox" checked={selectedAttendees.length === attendees.length && attendees.length > 0} onChange={toggleSelectAll} className="rounded" />
                    </th>
                    <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Attendee</th>
                    <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium hidden md:table-cell">Email</th>
                    <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium hidden lg:table-cell">Events</th>
                    <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Tickets</th>
                    <th className="text-left py-4 px-4 text-[#0F0F0F]/60 font-medium">Check-in Status</th>
                    <th className="text-right py-4 px-4 text-[#0F0F0F]/60 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttendees.map((group) => (
                    <React.Fragment key={group.email}>
                      <tr className="border-b border-[#0F0F0F]/5 hover:bg-[#F4F6FA]/50">
                        <td className="py-4 px-4">
                          <input 
                            type="checkbox" 
                            checked={group.ticketIds.every(id => selectedAttendees.includes(id))} 
                            onChange={() => toggleSelectAttendee(group.ticketIds)} 
                            className="rounded" 
                          />
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-[#0F0F0F]">{group.name}</p>
                          <p className="text-[#0F0F0F]/60 text-sm md:hidden">{group.email}</p>
                        </td>
                        <td className="py-4 px-4 hidden md:table-cell">
                          <p className="text-[#0F0F0F]/60 text-sm">{group.email}</p>
                        </td>
                        <td className="py-4 px-4 hidden lg:table-cell">
                          <div className="max-w-[200px]">
                            {group.events.slice(0, 2).map((event, idx) => (
                              <p key={idx} className="text-[#0F0F0F]/60 truncate text-sm">{event}</p>
                            ))}
                            {group.events.length > 2 && (
                              <p className="text-[#0F0F0F]/40 text-xs">+{group.events.length - 2} more</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className="bg-[#2969FF]/10 text-[#2969FF] rounded-lg">
                            <Ticket className="w-3 h-3 mr-1" />
                            {group.totalTickets} {group.totalTickets === 1 ? 'ticket' : 'tickets'}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          {group.checkedInCount === group.totalTickets ? (
                            <Badge className="bg-green-500 text-white rounded-lg">
                              All Checked In ({group.checkedInCount}/{group.totalTickets})
                            </Badge>
                          ) : group.checkedInCount > 0 ? (
                            <Badge className="bg-yellow-500 text-white rounded-lg">
                              {group.checkedInCount}/{group.totalTickets} Checked In
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-200 text-gray-700 rounded-lg">
                              0/{group.totalTickets} Checked In
                            </Badge>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl" 
                              onClick={() => toggleRowExpand(group.email)}
                              title={expandedRows.includes(group.email) ? "Hide tickets" : "Show tickets"}
                            >
                              {expandedRows.includes(group.email) ? (
                                <ChevronUp className="w-5 h-5 text-[#2969FF]" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-[#0F0F0F]/60" />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl">
                                  <MoreVertical className="w-5 h-5 text-[#0F0F0F]/60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                {group.checkedInCount < group.totalTickets && (
                                  <DropdownMenuItem onClick={() => bulkCheckIn(group.ticketIds, true)}>
                                    <CheckCircle className="w-4 h-4 mr-2" />Check In All
                                  </DropdownMenuItem>
                                )}
                                {group.checkedInCount > 0 && (
                                  <DropdownMenuItem onClick={() => bulkCheckIn(group.ticketIds, false)}>
                                    <Clock className="w-4 h-4 mr-2" />Undo All Check-ins
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => window.open(`mailto:${group.email}`)}>
                                  <Mail className="w-4 h-4 mr-2" />Send Email
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row showing individual tickets */}
                      {expandedRows.includes(group.email) && (
                        <tr className="bg-[#F4F6FA]/50">
                          <td colSpan="7" className="py-4 px-8">
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-[#0F0F0F] mb-3">Individual Tickets</p>
                              <div className="grid gap-2">
                                {group.tickets.map(ticket => (
                                  <div key={ticket.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#0F0F0F]/10">
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <p className="font-mono text-sm text-[#0F0F0F]">{ticket.ticketId}</p>
                                        <p className="text-xs text-[#0F0F0F]/60">{ticket.event}</p>
                                      </div>
                                      <Badge className="bg-[#F4F6FA] text-[#0F0F0F] rounded-lg">{ticket.ticketType}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {ticket.checkedIn ? (
                                        <Badge className="bg-green-500 text-white rounded-lg">Checked In</Badge>
                                      ) : (
                                        <Badge className="bg-yellow-500 text-white rounded-lg">Pending</Badge>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                                            <MoreVertical className="w-4 h-4 text-[#0F0F0F]/60" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                          {ticket.checkedIn ? (
                                            <DropdownMenuItem onClick={() => manualCheckIn(ticket.id, false)}>
                                              <Clock className="w-4 h-4 mr-2" />Undo Check-in
                                            </DropdownMenuItem>
                                          ) : (
                                            <DropdownMenuItem onClick={() => manualCheckIn(ticket.id, true)}>
                                              <CheckCircle className="w-4 h-4 mr-2" />Check In
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem onClick={() => resendTicket(ticket)}>
                                            <Mail className="w-4 h-4 mr-2" />Resend Ticket
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* Custom form responses */}
                              {group.tickets.some(t => customResponses[t.id]?.length > 0) && (
                                <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10">
                                  <p className="text-sm font-medium text-[#0F0F0F] mb-2">Custom Form Responses</p>
                                  {group.tickets.filter(t => customResponses[t.id]?.length > 0).map(ticket => (
                                    <div key={ticket.id} className="mb-3">
                                      <p className="text-xs text-[#0F0F0F]/60 mb-1">{ticket.ticketId}</p>
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {customResponses[ticket.id].map((response, idx) => (
                                          <div key={idx} className="bg-white p-2 rounded-lg border border-[#0F0F0F]/10">
                                            <p className="text-xs text-[#0F0F0F]/60">{response.label}</p>
                                            <p className="text-sm font-medium text-[#0F0F0F]">{response.value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {groupedAttendees.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={groupedAttendees.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
