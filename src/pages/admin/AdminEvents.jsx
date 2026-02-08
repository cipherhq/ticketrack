import { useState, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Calendar,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Ban,
  MapPin,
  Clock,
  Ticket,
  TrendingUp,
  Image,
  ExternalLink,
  Plus,
  Heart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/contexts/AdminContext';

export function AdminEvents() {
  const { logAdminAction, admin } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [suspendReasons, setSuspendReasons] = useState({
    refunds: false,
    attendeesReport: false,
    policy: false,
    fraud: false,
    other: false,
  });
  const [suspendNote, setSuspendNote] = useState('');
  const [eventAttendees, setEventAttendees] = useState([]);
  const [eventTicketTypes, setEventTicketTypes] = useState([]);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          organizers (
            id,
            business_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get ticket stats and engagement stats for each event
      const eventsWithStats = await Promise.all(
        (data || []).map(async (event) => {
          const [ticketsRes, viewsRes, savesRes] = await Promise.all([
            supabase
              .from('tickets')
              .select('quantity, total_price')
              .eq('event_id', event.id)
              .eq('payment_status', 'completed'),
            supabase
              .from('user_event_interactions')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .eq('interaction_type', 'view'),
            supabase
              .from('saved_events')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
          ]);

          const ticketsSold = ticketsRes.data?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 0;
          const revenue = ticketsRes.data?.reduce((sum, t) => sum + (parseFloat(t.total_price) || 0), 0) || 0;

          return {
            ...event,
            ticketsSold,
            revenue,
            views: viewsRes.count || 0,
            saves: savesRes.count || 0,
          };
        })
      );

      setEvents(eventsWithStats);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEventDetails = async (event) => {
    try {
      // Load attendees
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, customer_name, customer_email, customer_phone, quantity, total_price, payment_status, created_at, checked_in')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setEventAttendees(tickets || []);

      // Load ticket types
      const { data: ticketTypes } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', event.id);

      setEventTicketTypes(ticketTypes || []);
    } catch (error) {
      console.error('Error loading event details:', error);
    }
  };

  const openDetailsDialog = async (event) => {
    setSelectedEvent(event);
    setDetailsDialog(true);
    await loadEventDetails(event);
  };

  const openEditDialog = (event) => {
    setSelectedEvent(event);
    setEditForm({
      title: event.title || '',
      description: event.description || '',
      location: event.location || '',
      venue: event.venue || '',
      start_date: event.start_date ? event.start_date.slice(0, 16) : '',
      end_date: event.end_date ? event.end_date.slice(0, 16) : '',
      category: event.category || '',
      status: event.status || 'draft',
      ticket_price: event.ticket_price || 0,
      capacity: event.capacity || 100,
    });
    setEditDialog(true);
  };

  const handleAction = (action, event) => {
    setSelectedEvent(event);
    setActionDialog(action);
    setSuspendReasons({ refunds: false, attendeesReport: false, policy: false, fraud: false, other: false });
    setSuspendNote('');
  };

  const confirmAction = async () => {
    if (!selectedEvent) return;
    setProcessing(true);

    try {
      if (actionDialog === 'approve') {
        const { error } = await supabase
          .from('events')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', selectedEvent.id);
        if (error) throw error;
        await logAdminAction('event_approved', 'event', selectedEvent.id, { title: selectedEvent.title });
        alert('Event approved successfully!');
      } else if (actionDialog === 'suspend') {
        const reasons = Object.entries(suspendReasons)
          .filter(([_, v]) => v)
          .map(([k]) => k);
        
        const { error } = await supabase
          .from('events')
          .update({ 
            status: 'suspended',
            suspension_reason: reasons.join(', '),
            suspension_note: suspendNote,
            suspended_at: new Date().toISOString(),
          })
          .eq('id', selectedEvent.id);
        if (error) throw error;
        await logAdminAction('event_suspended', 'event', selectedEvent.id, { 
          title: selectedEvent.title,
          reasons,
          note: suspendNote 
        });
        alert('Event suspended successfully!');
      } else if (actionDialog === 'unsuspend') {
        const { error } = await supabase
          .from('events')
          .update({ 
            status: 'published',
            suspension_reason: null,
            suspension_note: null,
            suspended_at: null,
          })
          .eq('id', selectedEvent.id);
        if (error) throw error;
        await logAdminAction('event_unsuspended', 'event', selectedEvent.id, { title: selectedEvent.title });
        alert('Event unsuspended successfully!');
      } else if (actionDialog === 'delete') {
        // First delete related records
        await supabase.from('tickets').delete().eq('event_id', selectedEvent.id);
        await supabase.from('ticket_types').delete().eq('event_id', selectedEvent.id);
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', selectedEvent.id);
        if (error) throw error;
        await logAdminAction('event_deleted', 'event', selectedEvent.id, { title: selectedEvent.title });
        alert('Event deleted successfully!');
      }

      setActionDialog(null);
      setSelectedEvent(null);
      loadEvents();
    } catch (error) {
      console.error('Action error:', error);
      alert(`Failed to perform action: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const saveEventEdit = async () => {
    if (!selectedEvent) return;
    setProcessing(true);

    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: editForm.title,
          description: editForm.description,
          location: editForm.location,
          venue: editForm.venue,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
          category: editForm.category,
          status: editForm.status,
          ticket_price: parseFloat(editForm.ticket_price) || 0,
          capacity: parseInt(editForm.capacity) || 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      await logAdminAction('event_edited', 'event', selectedEvent.id, { 
        title: editForm.title,
        changes: editForm 
      });

      setEditDialog(false);
      setSelectedEvent(null);
      loadEvents();
      alert('Event updated successfully!');
    } catch (error) {
      console.error('Edit error:', error);
      alert(`Failed to update event: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500 text-white rounded-lg">Published</Badge>;
      case 'draft':
        return <Badge className="bg-background0 text-white rounded-lg">Draft</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white rounded-lg">Pending</Badge>;
      case 'suspended':
        return <Badge className="bg-red-500 text-white rounded-lg">Suspended</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500 text-white rounded-lg">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-700 text-white rounded-lg">Cancelled</Badge>;
      default:
        return <Badge className="bg-background0 text-white rounded-lg">{status}</Badge>;
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organizers?.business_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: events.length,
    published: events.filter(e => e.status === 'published').length,
    pending: events.filter(e => e.status === 'pending' || e.status === 'draft').length,
    suspended: events.filter(e => e.status === 'suspended').length,
  };

  const isSuperAdmin = admin?.role === 'super_admin';

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
          <h2 className="text-2xl font-semibold text-foreground">Event Management</h2>
          <p className="text-muted-foreground mt-1">Manage all platform events</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadEvents} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Total Events</p>
                <h3 className="text-2xl font-semibold text-foreground">{stats.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2969FF]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#2969FF]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Published</p>
                <h3 className="text-2xl font-semibold text-green-600">{stats.published}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Pending Review</p>
                <h3 className="text-2xl font-semibold text-yellow-600">{stats.pending}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1">Suspended</p>
                <h3 className="text-2xl font-semibold text-red-600">{stats.suspended}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
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
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border/10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card className="border-border/10 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">All Events ({filteredEvents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Event</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Organizer</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Tickets Sold</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Engagement</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Revenue</th>
                  <th className="text-left py-4 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-4 px-4 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-border/5 hover:bg-muted/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt={event.title} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-[#2969FF]" />
                          </div>
                        )}
                        <div>
                          <p className="text-foreground font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">{event.category || 'Uncategorized'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">{event.organizers?.business_name || 'Unknown'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">
                        {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'TBD'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground/80">{event.ticketsSold.toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-purple-600">
                          <Eye className="w-3 h-3" /> {event.views || 0}
                        </span>
                        <span className="flex items-center gap-1 text-red-500">
                          <Heart className="w-3 h-3" /> {event.saves || 0}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-foreground font-medium">{formatCurrency(event.revenue)}</p>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(event.status)}</td>
                    <td className="py-4 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => openDetailsDialog(event)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {isSuperAdmin && (
                            <DropdownMenuItem onClick={() => openEditDialog(event)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Event
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {(event.status === 'pending' || event.status === 'draft') && (
                            <DropdownMenuItem onClick={() => handleAction('approve', event)}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                              Approve Event
                            </DropdownMenuItem>
                          )}
                          {event.status === 'suspended' ? (
                            <DropdownMenuItem onClick={() => handleAction('unsuspend', event)}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                              Unsuspend Event
                            </DropdownMenuItem>
                          ) : event.status !== 'cancelled' && (
                            <DropdownMenuItem onClick={() => handleAction('suspend', event)}>
                              <Ban className="w-4 h-4 mr-2 text-orange-600" />
                              Suspend Event
                            </DropdownMenuItem>
                          )}
                          {isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => handleAction('delete', event)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Event
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No events found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-6 py-4">
              {/* Event Header */}
              <div className="flex gap-4">
                {selectedEvent.cover_image_url ? (
                  <img src={selectedEvent.cover_image_url} alt={selectedEvent.title} className="w-32 h-32 rounded-2xl object-cover" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-[#2969FF]/10 flex items-center justify-center">
                    <Calendar className="w-12 h-12 text-[#2969FF]" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-semibold text-foreground">{selectedEvent.title}</h3>
                    {getStatusBadge(selectedEvent.status)}
                  </div>
                  <p className="text-muted-foreground mb-2">{selectedEvent.description || 'No description'}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-start gap-1">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="break-words">
                        {selectedEvent.is_virtual ? 'Virtual Event' : [selectedEvent.venue_name, selectedEvent.venue_address, selectedEvent.city].filter(Boolean).join(', ') || 'TBD'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {selectedEvent.start_date ? new Date(selectedEvent.start_date).toLocaleDateString() : 'TBD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <Ticket className="w-6 h-6 text-[#2969FF] mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-[#2969FF]">{selectedEvent.ticketsSold}</p>
                  <p className="text-sm text-muted-foreground">Tickets Sold</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(selectedEvent.revenue)}</p>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <Users className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-purple-600">{selectedEvent.capacity || 0}</p>
                  <p className="text-sm text-muted-foreground">Capacity</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl text-center">
                  <TrendingUp className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-orange-600">
                    {selectedEvent.capacity ? Math.round((selectedEvent.ticketsSold / selectedEvent.capacity) * 100) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Fill Rate</p>
                </div>
              </div>

              {/* Engagement Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-purple-50 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-purple-600">{(selectedEvent.views || 0).toLocaleString()}</p>
                    <p className="text-xs text-purple-600/60">Page Views</p>
                  </div>
                </div>
                <div className="p-3 bg-red-50 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-red-500">{(selectedEvent.saves || 0).toLocaleString()}</p>
                    <p className="text-xs text-red-500/60">Saved by Users</p>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="info" className="w-full">
                <TabsList className="bg-muted rounded-xl">
                  <TabsTrigger value="info" className="rounded-lg">Event Info</TabsTrigger>
                  <TabsTrigger value="attendees" className="rounded-lg">Attendees ({eventAttendees.length})</TabsTrigger>
                  <TabsTrigger value="tickets" className="rounded-lg">Ticket Types</TabsTrigger>
                  <TabsTrigger value="organizer" className="rounded-lg">Organizer</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Category</p>
                      <p className="text-foreground">{selectedEvent.category || 'Uncategorized'}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Ticket Price</p>
                      <p className="text-foreground">{formatCurrency(selectedEvent.ticket_price)}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                      <p className="text-foreground">
                        {selectedEvent.start_date ? new Date(selectedEvent.start_date).toLocaleString() : 'TBD'}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">End Date</p>
                      <p className="text-foreground">
                        {selectedEvent.end_date ? new Date(selectedEvent.end_date).toLocaleString() : 'TBD'}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Location</p>
                      <p className="text-foreground">{selectedEvent.location || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Venue</p>
                      <p className="text-foreground">{selectedEvent.venue_name || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Created</p>
                      <p className="text-foreground">{new Date(selectedEvent.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Event ID</p>
                      <p className="text-foreground text-xs font-mono">{selectedEvent.id}</p>
                    </div>
                  </div>
                  {selectedEvent.status === 'suspended' && selectedEvent.suspension_reason && (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl">
                      <p className="text-sm text-red-600 font-medium mb-1">Suspension Reason</p>
                      <p className="text-red-700">{selectedEvent.suspension_reason}</p>
                      {selectedEvent.suspension_note && (
                        <p className="text-red-600 text-sm mt-2">{selectedEvent.suspension_note}</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="attendees" className="mt-4">
                  {eventAttendees.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No attendees yet</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {eventAttendees.map((attendee) => (
                        <div key={attendee.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                          <div>
                            <p className="text-foreground font-medium">{attendee.customer_name}</p>
                            <p className="text-sm text-muted-foreground">{attendee.customer_email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-foreground">{attendee.quantity} ticket(s)</p>
                            <Badge className={attendee.checked_in ? 'bg-green-100 text-green-700' : 'bg-muted text-foreground/80'}>
                              {attendee.checked_in ? 'Checked In' : 'Not Checked In'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tickets" className="mt-4">
                  {eventTicketTypes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No ticket types configured</p>
                  ) : (
                    <div className="space-y-2">
                      {eventTicketTypes.map((type) => (
                        <div key={type.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                          <div>
                            <p className="text-foreground font-medium">{type.name}</p>
                            <p className="text-sm text-muted-foreground">{type.description || 'No description'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-foreground font-medium">{formatCurrency(type.price)}</p>
                            <p className="text-sm text-muted-foreground">{type.quantity_available || 0} available</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="organizer" className="mt-4">
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-[#2969FF] flex items-center justify-center text-white text-xl font-medium">
                        {selectedEvent.organizers?.business_name?.charAt(0) || 'O'}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">{selectedEvent.organizers?.business_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{selectedEvent.organizers?.email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="text-foreground">{selectedEvent.organizers?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="text-foreground">{selectedEvent.organizers?.phone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Quick Actions */}
              <div className="flex gap-3 pt-4 border-t border-border/10">
                {selectedEvent.status !== 'suspended' && selectedEvent.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialog(false);
                      handleAction('suspend', selectedEvent);
                    }}
                    className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Suspend
                  </Button>
                )}
                {selectedEvent.status === 'suspended' && (
                  <Button
                    onClick={() => {
                      setDetailsDialog(false);
                      handleAction('unsuspend', selectedEvent);
                    }}
                    className="rounded-xl bg-green-500 hover:bg-green-600 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Unsuspend
                  </Button>
                )}
                {isSuperAdmin && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDetailsDialog(false);
                        openEditDialog(selectedEvent);
                      }}
                      className="rounded-xl"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDetailsDialog(false);
                        handleAction('delete', selectedEvent);
                      }}
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Make changes to the event details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="rounded-xl mt-1"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Location</Label>
                <Input
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Venue</Label>
                <Input
                  value={editForm.venue}
                  onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="datetime-local"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="datetime-local"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="arts">Arts & Theatre</SelectItem>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ticket Price (₦)</Label>
                <Input
                  type="number"
                  value={editForm.ticket_price}
                  onChange={(e) => setEditForm({ ...editForm, ticket_price: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={saveEventEdit}
              disabled={processing}
              className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {actionDialog === 'approve' && 'Approve Event'}
              {actionDialog === 'suspend' && 'Suspend Event'}
              {actionDialog === 'unsuspend' && 'Unsuspend Event'}
              {actionDialog === 'delete' && 'Delete Event'}
            </DialogTitle>
            {(actionDialog === 'approve' || actionDialog === 'delete' || actionDialog === 'unsuspend') && (
              <DialogDescription>
                {actionDialog === 'approve' &&
                  `Are you sure you want to approve "${selectedEvent?.title}"? This event will be published and visible to users.`}
                {actionDialog === 'unsuspend' &&
                  `Are you sure you want to unsuspend "${selectedEvent?.title}"? This event will be visible to users again.`}
                {actionDialog === 'delete' &&
                  `Are you sure you want to delete "${selectedEvent?.title}"? This action cannot be undone and will remove all associated tickets.`}
              </DialogDescription>
            )}
          </DialogHeader>
          {actionDialog === 'suspend' && (
            <div className="text-sm text-muted-foreground space-y-4 mt-4 text-left">
              <p>Are you sure you want to suspend "{selectedEvent?.title}"? This event will be hidden from users.</p>
              <div className="space-y-3 p-4 bg-muted rounded-xl">
                <p className="text-foreground font-medium">Select reason(s) for suspension:</p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="refunds"
                      checked={suspendReasons.refunds}
                      onCheckedChange={(checked) => setSuspendReasons({ ...suspendReasons, refunds: checked })}
                    />
                    <Label htmlFor="refunds" className="cursor-pointer">Excessive refund requests</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attendeesReport"
                      checked={suspendReasons.attendeesReport}
                      onCheckedChange={(checked) => setSuspendReasons({ ...suspendReasons, attendeesReport: checked })}
                    />
                    <Label htmlFor="attendeesReport" className="cursor-pointer">Multiple complaints from attendees</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="policy"
                      checked={suspendReasons.policy}
                      onCheckedChange={(checked) => setSuspendReasons({ ...suspendReasons, policy: checked })}
                    />
                    <Label htmlFor="policy" className="cursor-pointer">Violates platform policy</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fraud"
                      checked={suspendReasons.fraud}
                      onCheckedChange={(checked) => setSuspendReasons({ ...suspendReasons, fraud: checked })}
                    />
                    <Label htmlFor="fraud" className="cursor-pointer">Suspected fraud</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="other"
                      checked={suspendReasons.other}
                      onCheckedChange={(checked) => setSuspendReasons({ ...suspendReasons, other: checked })}
                    />
                    <Label htmlFor="other" className="cursor-pointer">Other</Label>
                  </div>
                </div>
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  value={suspendNote}
                  onChange={(e) => setSuspendNote(e.target.value)}
                  placeholder="Add any additional notes..."
                  className="rounded-xl mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDialog(null);
                setSuspendReasons({ refunds: false, attendeesReport: false, policy: false, fraud: false, other: false });
                setSuspendNote('');
              }}
              className="rounded-xl border-border/10"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={
                processing ||
                (actionDialog === 'suspend' && !Object.values(suspendReasons).some(v => v))
              }
              className={`rounded-xl ${
                actionDialog === 'delete' ? 'bg-red-500 hover:bg-red-600' : 
                actionDialog === 'suspend' ? 'bg-orange-500 hover:bg-orange-600' :
                'bg-[#2969FF] hover:bg-[#2969FF]/90'
              } text-white`}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
