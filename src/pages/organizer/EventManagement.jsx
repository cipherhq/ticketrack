import { formatPrice } from '@/config/currencies'
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, MoreVertical, Calendar, Loader2, MapPin, Copy, Radio, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { supabase } from '@/lib/supabase';

export function EventManagement() {
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (organizer?.id) {
      loadEvents();
    }
  }, [organizer?.id]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      
      // Fetch events for this organizer
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (id, price, quantity_available, quantity_sold)
        `)
        .eq('organizer_id', organizer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats for each event
      const eventsWithStats = (eventsData || []).map(event => {
        const ticketTypes = event.ticket_types || [];
        const totalTickets = ticketTypes.reduce((sum, t) => sum + (t.quantity_available || 0), 0);
        const soldTickets = ticketTypes.reduce((sum, t) => sum + (t.quantity_sold || 0), 0);
        const revenue = ticketTypes.reduce((sum, t) => sum + ((t.quantity_sold || 0) * (t.price || 0)), 0);

        return {
          ...event,
          totalTickets,
          soldTickets,
          revenue
        };
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

  // Get event status: 'draft', 'cancelled', 'completed', 'live', 'upcoming'
  const getEventStatus = (event) => {
    if (event.status === 'draft') return 'draft';
    if (event.status === 'cancelled') return 'cancelled';
    
    const now = new Date();
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    
    if (endDate < now) return 'completed';
    if (startDate <= now && endDate >= now) return 'live';
    return 'upcoming';
  };

  // Check if event can be edited (only upcoming and live events)
  const canEditEvent = (event) => {
    const status = getEventStatus(event);
    return status === 'upcoming' || status === 'live' || status === 'draft';
  };

  // Check if event can be deleted (no tickets sold)
  const canDeleteEvent = (event) => {
    return event.soldTickets === 0;
  };

  // Handle reuse template - navigate to create event with prefilled data
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
    
    // Prevent deletion if tickets were sold
    if (event && event.soldTickets > 0) {
      alert('Cannot delete this event because tickets have been sold. For audit purposes, events with sales must be preserved.');
      return;
    }

    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeleting(id);
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error('Error deleting event:', err);
      alert('Failed to delete event. It may have associated tickets or orders.');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (event) => {
    const status = getEventStatus(event);
    
    switch (status) {
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-700">Draft</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      case 'completed':
        return <Badge className="bg-purple-100 text-purple-700">Completed</Badge>;
      case 'live':
        return (
          <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse" />
            Live
          </Badge>
        );
      case 'upcoming':
        return <Badge className="bg-blue-100 text-blue-700">Upcoming</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700">{event.status}</Badge>;
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#0F0F0F]">Event Management</h2>
          <p className="text-[#0F0F0F]/60 mt-1">Create and manage your events</p>
        </div>
        <Button
          onClick={() => navigate('/organizer/create-event')}
          className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Event
        </Button>
      </div>

      <Card className="border-[#0F0F0F]/10 rounded-2xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 rounded-xl bg-[#F4F6FA] border-0"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-[#0F0F0F]/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#0F0F0F] mb-2">No events yet</h3>
              <p className="text-[#0F0F0F]/60 mb-6">Create your first event to start selling tickets</p>
              <Button
                onClick={() => navigate('/organizer/create-event')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Event
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => {
                const eventStatus = getEventStatus(event);
                const isEditable = canEditEvent(event);
                const isDeletable = canDeleteEvent(event);
                
                return (
                  <div
                    key={event.id}
                    className="p-4 rounded-xl bg-[#F4F6FA] hover:bg-[#F4F6FA]/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4 flex-1">
                        {/* Event Image */}
                        {event.image_url && (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-20 h-20 rounded-lg object-cover hidden sm:block"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-[#0F0F0F] truncate">{event.title}</h4>
                            {getStatusBadge(event)}
                            {event.soldTickets > 0 && (
                              <Badge className="bg-amber-100 text-amber-700 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                {event.soldTickets} sold
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#0F0F0F]/60">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(event.start_date)}
                            </span>
                            {event.venue_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {event.venue_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-[#0F0F0F]/60">
                              <span className="font-medium text-[#0F0F0F]">{event.soldTickets}</span>
                              /{event.totalTickets} sold
                            </span>
                            <span className="text-[#2969FF] font-medium">
                              {formatPrice(event.revenue, event.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {/* View Public Page */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/event/${event.id}`)}
                          className="rounded-lg"
                          title="View Public Page"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {/* Edit or Reuse Template based on status */}
                        {isEditable ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/organizer/events/${event.id}/edit`)}
                            className="rounded-lg"
                            title="Edit Event"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReuseTemplate(event)}
                            className="rounded-lg"
                            title="Reuse Event Template"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-lg">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => navigate(`/event/${event.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Public Page
                            </DropdownMenuItem>
                            
                            {isEditable ? (
                              <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/edit`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Event
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReuseTemplate(event)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Reuse Event Template
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => navigate(`/organizer/events/${event.id}/attendees`)}>
                              View Attendees
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/organizer/analytics?event=${event.id}`)}>
                              View Analytics
                            </DropdownMenuItem>
                            {eventStatus !== 'completed' && (
                              <DropdownMenuItem onClick={() => navigate(`/organizer/check-in?event=${event.id}`)}>
                                Check-In Attendees
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            {isDeletable ? (
                              <DropdownMenuItem 
                                onClick={() => deleteEvent(event.id)}
                                className="text-red-600"
                                disabled={deleting === event.id}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {deleting === event.id ? 'Deleting...' : 'Delete Event'}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="text-gray-400">
                                <Lock className="w-4 h-4 mr-2" />
                                Cannot Delete (Tickets Sold)
                              </DropdownMenuItem>
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
        </CardContent>
      </Card>
    </div>
  );
}
