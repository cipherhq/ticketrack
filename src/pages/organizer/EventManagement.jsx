import { formatPrice } from '@/config/currencies'
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, MoreVertical, Calendar, Loader2, MapPin, Copy, Radio, Lock, RefreshCw, BarChart3, ArrowRightLeft, Ticket, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Pagination, usePagination } from '@/components/ui/pagination';

const MANUAL_ISSUE_TYPES = [
  { value: 'complimentary', label: 'Complimentary' },
  { value: 'on_site_sale', label: 'On-Site Sale' },
  { value: 'vip_guest', label: 'VIP Guest' },
  { value: 'press_media', label: 'Press / Media' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'giveaway_winner', label: 'Giveaway Winner' },
];

function generateTicketCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${timestamp}${random}`;
}

export function EventManagement() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [cancelingSeries, setCancelingSeries] = useState(null);

  const [issueTicketModal, setIssueTicketModal] = useState({ open: false, event: null });
  const [issueForm, setIssueForm] = useState({
    firstName: '',
    lastName: '',
    attendee_email: '',
    attendee_phone: '',
    ticket_type_id: '',
    manual_issue_type: 'complimentary',
  });
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(null);
  const [issueError, setIssueError] = useState(null);

  useEffect(() => {
    if (organizer?.id) {
      loadEvents();
    }
  }, [organizer?.id]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (id, name, price, quantity_available, quantity_sold)
        `)
        .eq('organizer_id', organizer.id)
        .is('parent_event_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const parentIds = (eventsData || []).filter(e => e.is_recurring).map(e => e.id);
      let childCounts = {};
      if (parentIds.length > 0) {
        const { data: children } = await supabase
          .from('events')
          .select('parent_event_id')
          .in('parent_event_id', parentIds);
        childCounts = (children || []).reduce((acc, c) => {
          acc[c.parent_event_id] = (acc[c.parent_event_id] || 0) + 1;
          return acc;
        }, {});
      }

      const eventsWithStats = (eventsData || []).map(event => {
        const ticketTypes = event.ticket_types || [];
        const totalTickets = ticketTypes.reduce((sum, t) => sum + (t.quantity_available || 0), 0);
        const soldTickets = ticketTypes.reduce((sum, t) => sum + (t.quantity_sold || 0), 0);
        const revenue = ticketTypes.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0);
        return { ...event, totalTickets, soldTickets, revenue, childEventCount: childCounts[event.id] || 0 };
      });

      setEvents(eventsWithStats);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const { 
    currentPage, totalPages, totalItems, itemsPerPage, 
    paginatedItems: paginatedEvents, handlePageChange, setCurrentPage 
  } = usePagination(filteredEvents, 20);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getEventStatus = (event) => {
    if (event.status === 'draft') return 'draft';
    if (event.status === 'scheduled') return 'scheduled';
    if (event.status === 'cancelled') return 'cancelled';
    const now = new Date();
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    if (endDate < now) return 'completed';
    if (startDate <= now && endDate >= now) return 'live';
    return 'upcoming';
  };

  const toggleTransfers = async (eventId, currentValue) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ allow_transfers: !currentValue })
        .eq('id', eventId);
      if (error) throw error;
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, allow_transfers: !currentValue } : e));
    } catch (err) {
      console.error('Error toggling transfers:', err);
      alert('Failed to update transfer setting');
    }
  };

  const canEditEvent = (event) => {
    const status = getEventStatus(event);
    return status === 'upcoming' || status === 'live' || status === 'draft' || status === 'scheduled';
  };

  const canDeleteEvent = (event) => event.soldTickets === 0;

  const canIssueTickets = (event) => {
    const status = getEventStatus(event);
    return status === 'upcoming' || status === 'live';
  };

  const openIssueTicketModal = (event) => {
    setIssueTicketModal({ open: true, event });
    setIssueForm({
      firstName: '',
      lastName: '',
      attendee_email: '',
      attendee_phone: '',
      ticket_type_id: event.ticket_types?.[0]?.id || '',
      manual_issue_type: 'complimentary',
    });
    setIssueSuccess(null);
    setIssueError(null);
  };

  const closeIssueTicketModal = () => {
    setIssueTicketModal({ open: false, event: null });
    setIssueForm({ firstName: '', lastName: '', attendee_email: '', attendee_phone: '', ticket_type_id: '', manual_issue_type: 'complimentary' });
    setIssueSuccess(null);
    setIssueError(null);
  };

  const handleIssueTicket = async (e) => {
    e.preventDefault();
    setIssueLoading(true);
    setIssueError(null);
    setIssueSuccess(null);

    try {
      const event = issueTicketModal.event;
      if (!issueForm.firstName.trim()) throw new Error('First name is required');
      if (!issueForm.lastName.trim()) throw new Error('Last name is required');
      if (!issueForm.attendee_email.trim()) throw new Error('Email is required');
      if (!issueForm.ticket_type_id) throw new Error('Please select a ticket type');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(issueForm.attendee_email.trim())) throw new Error('Please enter a valid email address');

      const selectedTicketType = event.ticket_types?.find(t => t.id === issueForm.ticket_type_id);
      if (!selectedTicketType) throw new Error('Invalid ticket type selected');

      const remaining = (selectedTicketType.quantity_available || 0) - (selectedTicketType.quantity_sold || 0);
      if (remaining <= 0) throw new Error('This ticket type is sold out');

      const ticketCode = generateTicketCode();
      const fullName = `${issueForm.firstName.trim()} ${issueForm.lastName.trim()}`;

      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          event_id: event.id,
          ticket_type_id: issueForm.ticket_type_id,
          attendee_name: fullName,
          attendee_email: issueForm.attendee_email.trim().toLowerCase(),
          attendee_phone: issueForm.attendee_phone.trim() || null,
          ticket_code: ticketCode,
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          currency: event.currency || 'NGN',
          payment_status: 'complimentary',
          payment_method: null,
          status: 'active',
          is_manual_issue: true,
          issued_by: user?.id,
          manual_issue_type: issueForm.manual_issue_type,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      await supabase
        .from('ticket_types')
        .update({ quantity_sold: (selectedTicketType.quantity_sold || 0) + 1 })
        .eq('id', issueForm.ticket_type_id);

      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'ticket_purchase',
            to: issueForm.attendee_email.trim().toLowerCase(),
            data: {
              attendeeName: fullName,
              eventTitle: event.title,
              eventDate: event.start_date,
              venueName: event.venue_name,
              city: event.city,
              ticketType: selectedTicketType.name,
              quantity: 1,
              orderNumber: ticketCode,
              totalAmount: 0,
              currency: event.currency || 'NGN',
              isFree: true,
              appUrl: window.location.origin,
            },
            userId: null,
            eventId: event.id,
            ticketId: newTicket.id,
          }
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      setIssueSuccess({
        ticketCode,
        attendeeName: fullName,
        attendeeEmail: issueForm.attendee_email.trim(),
        ticketType: selectedTicketType.name,
        reason: MANUAL_ISSUE_TYPES.find(t => t.value === issueForm.manual_issue_type)?.label,
      });
      loadEvents();
    } catch (err) {
      console.error('Error issuing ticket:', err);
      setIssueError(err.message || 'Failed to issue ticket');
    } finally {
      setIssueLoading(false);
    }
  };

  const handleReuseTemplate = (event) => {
    navigate('/organizer/create-event', { 
      state: { 
        template: {
          title: event.title,
          description: event.description,
          category: event.category,
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          city: event.city,
          country_code: event.country_code,
          image_url: event.image_url,
          timezone: event.timezone,
          is_free: event.is_free,
          ticket_types: event.ticket_types?.map(t => ({
            name: t.name,
            description: t.description,
            price: t.price,
            quantity_available: t.quantity_available,
            max_per_order: t.max_per_order
          }))
        }
      }
    });
  };

  const deleteEvent = async (id) => {
    const event = events.find(e => e.id === id);
    if (event && event.soldTickets > 0) {
      alert('Cannot delete this event because tickets have been sold. For audit purposes, events with sales must be preserved.');
      return;
    }
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      setDeleting(id);
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event. It may have associated tickets or orders.');
    } finally {
      setDeleting(null);
    }
  };

  const cancelSeries = async (event) => {
    if (!event.is_recurring) return;
    const confirmed = confirm('Cancel entire series? This will cancel this event and all ' + (event.childEventCount || 0) + ' upcoming events in the series. Attendees will be notified.');
    if (!confirmed) return;
    try {
      setCancelingSeries(event.id);
      await supabase.from('events').update({ status: 'cancelled' }).eq('id', event.id);
      await supabase.from('events').update({ status: 'cancelled' }).eq('parent_event_id', event.id);
      alert('Series cancelled successfully. Consider notifying attendees via email.');
      loadEvents();
    } catch (err) {
      console.error('Error cancelling series:', err);
      alert('Failed to cancel series');
    } finally {
      setCancelingSeries(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (event) => {
    const status = getEventStatus(event);
    switch (status) {
      case 'draft': return <Badge className="bg-gray-100 text-gray-700">Draft</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      case 'completed': return <Badge className="bg-purple-100 text-purple-700">Completed</Badge>;
      case 'live': return <Badge className="bg-green-100 text-green-700 flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" />Live</Badge>;
      case 'upcoming': return <Badge className="bg-blue-100 text-blue-700">Upcoming</Badge>;
      case 'scheduled': return <Badge className="bg-purple-100 text-purple-700">Scheduled</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-700">{event.status}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Event Management</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Create and manage your events</p>
        </div>
        <Button onClick={() => navigate('/organizer/create-event')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
          <Plus className="w-5 h-5 mr-2" />Create Event
        </Button>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-12 pl-12 rounded-xl bg-[#F4F6FA] border-0" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-[#0F0F0F]/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#0F0F0F] mb-2">No events yet</h3>
              <p className="text-[#0F0F0F]/60 mb-6">Create your first event to start selling tickets</p>
              <Button onClick={() => navigate('/organizer/create-event')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">
                <Plus className="w-5 h-5 mr-2" />Create Your First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedEvents.map((event) => {
                const eventStatus = getEventStatus(event);
                const isEditable = canEditEvent(event);
                const isDeletable = canDeleteEvent(event);
                const canIssue = canIssueTickets(event);
                return (
                  <div key={event.id} className="p-4 rounded-xl bg-[#F4F6FA] hover:bg-[#F4F6FA]/80 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4 flex-1">
                        {event.image_url && <img src={event.image_url} alt={event.title} className="w-20 h-20 rounded-lg object-cover hidden sm:block" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-[#0F0F0F] truncate">{event.title}</h4>
                            {getStatusBadge(event)}
                            {event.soldTickets > 0 && <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1"><Lock className="w-3 h-3" />{event.soldTickets} sold</Badge>}
                            {event.is_recurring && <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" />Series ({event.childEventCount + 1} events)</Badge>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#0F0F0F]/60">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(event.start_date)}</span>
                            {event.venue_name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</span>}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-[#0F0F0F]/60"><span className="font-medium text-[#0F0F0F]">{event.soldTickets}</span>/{event.totalTickets} sold</span>
                            <span className="text-[#2969FF] font-medium">{formatPrice(event.revenue, event.currency)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/e/${event.slug || event.id}`)} className="rounded-lg" title="View Public Page"><Eye className="w-4 h-4" /></Button>
                        {isEditable ? (
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/organizer/events/${event.id}/edit`)} className="rounded-lg" title="Edit Event"><Edit className="w-4 h-4" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => handleReuseTemplate(event)} className="rounded-lg" title="Reuse Event Template"><Copy className="w-4 h-4" /></Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-lg"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => navigate(`/e/${event.slug || event.id}`)}><Eye className="w-4 h-4 mr-2" />View Public Page</DropdownMenuItem>
                            {isEditable ? (
                              <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/edit`)}><Edit className="w-4 h-4 mr-2" />Edit Event</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReuseTemplate(event)}><Copy className="w-4 h-4 mr-2" />Reuse Event Template</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canIssue && <DropdownMenuItem onClick={() => openIssueTicketModal(event)}><Ticket className="w-4 h-4 mr-2" />Issue Tickets</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/attendees`)}>View Attendees</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/organizer/analytics?event=${event.id}`)}>View Analytics</DropdownMenuItem>
                            {eventStatus === 'completed' && <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/post-event`)}><BarChart3 className="w-4 h-4 mr-2" />Post-Event Report</DropdownMenuItem>}
                            {eventStatus !== 'completed' && <DropdownMenuItem onClick={() => navigate(`/organizer/check-in?event=${event.id}`)}>Check-In Attendees</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleTransfers(event.id, event.allow_transfers)}><ArrowRightLeft className="w-4 h-4 mr-2" />{event.allow_transfers ? 'Disable Transfers' : 'Enable Transfers'}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isDeletable ? (
                              <DropdownMenuItem onClick={() => deleteEvent(event.id)} className="text-red-600" disabled={deleting === event.id}><Trash2 className="w-4 h-4 mr-2" />{deleting === event.id ? 'Deleting...' : 'Delete Event'}</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="text-gray-400"><Lock className="w-4 h-4 mr-2" />Cannot Delete (Tickets Sold)</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Pagination */}
          {filteredEvents.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>

      {issueTicketModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-[#0F0F0F]">Issue Ticket</h3>
                <p className="text-sm text-[#0F0F0F]/60 mt-1">{issueTicketModal.event?.title}</p>
              </div>
              <button onClick={closeIssueTicketModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-[#0F0F0F]/60" /></button>
            </div>
            {issueSuccess ? (
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
                  <h4 className="text-lg font-semibold text-[#0F0F0F] mb-2">Ticket Issued Successfully!</h4>
                  <p className="text-sm text-[#0F0F0F]/60">Confirmation email sent to {issueSuccess.attendeeEmail}</p>
                </div>
                <div className="bg-[#F4F6FA] rounded-xl p-4 space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-[#0F0F0F]/60">Attendee</span><span className="text-sm font-medium text-[#0F0F0F]">{issueSuccess.attendeeName}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-[#0F0F0F]/60">Ticket Type</span><span className="text-sm font-medium text-[#0F0F0F]">{issueSuccess.ticketType}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-[#0F0F0F]/60">Price</span><Badge className="bg-green-100 text-green-700">Complimentary</Badge></div>
                  <div className="flex justify-between"><span className="text-sm text-[#0F0F0F]/60">Reason</span><span className="text-sm font-medium text-[#0F0F0F]">{issueSuccess.reason}</span></div>
                  <div className="flex justify-between pt-2 border-t border-gray-200"><span className="text-sm text-[#0F0F0F]/60">Ticket Code</span><span className="text-sm font-mono font-medium text-[#2969FF]">{issueSuccess.ticketCode}</span></div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button onClick={() => { setIssueSuccess(null); setIssueForm({ firstName: '', lastName: '', attendee_email: '', attendee_phone: '', ticket_type_id: issueTicketModal.event?.ticket_types?.[0]?.id || '', manual_issue_type: 'complimentary' }); }} variant="outline" className="flex-1 rounded-xl">Issue Another</Button>
                  <Button onClick={closeIssueTicketModal} className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">Done</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIssueTicket} className="p-6 space-y-4">
                {issueError && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{issueError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-[#0F0F0F]">First Name <span className="text-red-500">*</span></Label>
                    <Input id="firstName" type="text" placeholder="John" value={issueForm.firstName} onChange={(e) => setIssueForm(prev => ({ ...prev, firstName: e.target.value }))} className="h-12 rounded-xl bg-[#F4F6FA] border-0" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-[#0F0F0F]">Last Name <span className="text-red-500">*</span></Label>
                    <Input id="lastName" type="text" placeholder="Doe" value={issueForm.lastName} onChange={(e) => setIssueForm(prev => ({ ...prev, lastName: e.target.value }))} className="h-12 rounded-xl bg-[#F4F6FA] border-0" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee_email" className="text-sm font-medium text-[#0F0F0F]">Email <span className="text-red-500">*</span></Label>
                  <Input id="attendee_email" type="email" placeholder="email@example.com" value={issueForm.attendee_email} onChange={(e) => setIssueForm(prev => ({ ...prev, attendee_email: e.target.value }))} className="h-12 rounded-xl bg-[#F4F6FA] border-0" required />
                  <p className="text-xs text-[#0F0F0F]/50">Ticket will be sent to this email</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee_phone" className="text-sm font-medium text-[#0F0F0F]">Phone Number <span className="text-[#0F0F0F]/40">(optional)</span></Label>
                  <Input id="attendee_phone" type="tel" placeholder="+234 800 000 0000" value={issueForm.attendee_phone} onChange={(e) => setIssueForm(prev => ({ ...prev, attendee_phone: e.target.value }))} className="h-12 rounded-xl bg-[#F4F6FA] border-0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket_type" className="text-sm font-medium text-[#0F0F0F]">Ticket Type <span className="text-red-500">*</span></Label>
                  <select id="ticket_type" value={issueForm.ticket_type_id} onChange={(e) => setIssueForm(prev => ({ ...prev, ticket_type_id: e.target.value }))} className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0 text-[#0F0F0F] focus:ring-2 focus:ring-[#2969FF]" required>
                    <option value="">Select ticket type</option>
                    {issueTicketModal.event?.ticket_types?.map((type) => {
                      const remaining = (type.quantity_available || 0) - (type.quantity_sold || 0);
                      return <option key={type.id} value={type.id} disabled={remaining <= 0}>{type.name} - {formatPrice(type.price, issueTicketModal.event?.currency)} ({remaining} left)</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue_type" className="text-sm font-medium text-[#0F0F0F]">Reason for Issue <span className="text-red-500">*</span></Label>
                  <select id="issue_type" value={issueForm.manual_issue_type} onChange={(e) => setIssueForm(prev => ({ ...prev, manual_issue_type: e.target.value }))} className="w-full h-12 px-4 rounded-xl bg-[#F4F6FA] border-0 text-[#0F0F0F] focus:ring-2 focus:ring-[#2969FF]" required>
                    {MANUAL_ISSUE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm text-green-700"><span className="font-medium">Price:</span> Complimentary (Free)</p>
                  <p className="text-xs text-green-600 mt-1">This ticket will not count toward revenue reports.</p>
                </div>
                <Button type="submit" disabled={issueLoading} className="w-full h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl font-medium">
                  {issueLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Issuing Ticket...</> : <><Ticket className="w-4 h-4 mr-2" />Issue Ticket</>}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
