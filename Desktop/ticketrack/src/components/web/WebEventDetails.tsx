import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, Share2, Heart, Minus, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, formatTime, formatCurrency, isValidUUID } from '@/lib/utils';
import { toast } from 'sonner';
import type { Event, TicketType, Organizer, Category } from '@/types/database';

interface EventWithDetails extends Event {
  organizers: Organizer;
  categories: Category;
  ticket_types: TicketType[];
}

export function WebEventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (id) fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    if (!id || !isValidUUID(id)) {
      setError('Invalid event ID');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select(`
          *,
          organizers (*),
          categories (*),
          ticket_types (*)
        `)
        .eq('id', id)
        .eq('status', 'published')
        .single();

      if (fetchError) throw fetchError;
      if (!data) {
        setError('Event not found');
        return;
      }

      setEvent(data as EventWithDetails);
    } catch (err) {
      setError('Failed to load event');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTicketQuantity = (ticketId: string, delta: number) => {
    setSelectedTickets(prev => {
      const current = prev[ticketId] || 0;
      const ticket = event?.ticket_types.find(t => t.id === ticketId);
      if (!ticket) return prev;
      
      const newQty = Math.max(0, Math.min(current + delta, ticket.max_per_order, ticket.quantity_available - ticket.quantity_sold));
      if (newQty === 0) {
        const { [ticketId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [ticketId]: newQty };
    });
  };

  const getTotalAmount = () => {
    if (!event) return 0;
    return Object.entries(selectedTickets).reduce((total, [ticketId, qty]) => {
      const ticket = event.ticket_types.find(t => t.id === ticketId);
      return total + (ticket ? ticket.price * qty : 0);
    }, 0);
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate(`/login?returnTo=/event/${id}`);
      return;
    }
    
    const totalQty = Object.values(selectedTickets).reduce((a, b) => a + b, 0);
    if (totalQty === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    // Store selection and navigate to checkout
    sessionStorage.setItem('checkout_data', JSON.stringify({
      eventId: id,
      tickets: selectedTickets,
    }));
    navigate('/checkout');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-96 rounded-2xl mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#0F0F0F] mb-4">{error || 'Event not found'}</h1>
        <Button onClick={() => navigate('/events')} className="rounded-xl">
          Browse Events
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-[#2969FF]/20 to-[#1E4FCC]/20">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar className="w-24 h-24 text-[#2969FF]/30" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <Badge className="bg-white text-[#0F0F0F]">{event.categories?.name || 'Event'}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Event Details */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-[#0F0F0F] mb-4">{event.title}</h1>
            <div className="flex flex-wrap gap-4 text-[#0F0F0F]/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {formatDate(event.start_date)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {formatTime(event.start_date)}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {event.venue_name}, {event.city}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-xl font-semibold text-[#0F0F0F] mb-4">About this event</h2>
            <p className="text-[#0F0F0F]/70 whitespace-pre-wrap">{event.description || 'No description provided.'}</p>
          </div>

          <Separator />

          <div>
            <h2 className="text-xl font-semibold text-[#0F0F0F] mb-4">Organizer</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2969FF]/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-[#2969FF]" />
              </div>
              <div>
                <p className="font-medium text-[#0F0F0F]">{event.organizers?.business_name}</p>
                {event.organizers?.is_verified && (
                  <Badge variant="secondary" className="text-xs">Verified</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Selection */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24 rounded-2xl border-[#0F0F0F]/10">
            <CardHeader>
              <CardTitle>Select Tickets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.ticket_types.filter(t => t.is_active).map((ticket) => {
                const available = ticket.quantity_available - ticket.quantity_sold;
                const qty = selectedTickets[ticket.id] || 0;
                
                return (
                  <div key={ticket.id} className="p-4 bg-[#F4F6FA] rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-[#0F0F0F]">{ticket.name}</p>
                        {ticket.description && (
                          <p className="text-sm text-[#0F0F0F]/60">{ticket.description}</p>
                        )}
                      </div>
                      <p className="font-semibold text-[#2969FF]">
                        {ticket.price === 0 ? 'Free' : formatCurrency(ticket.price, ticket.currency)}
                      </p>
                    </div>
                    
                    {available > 0 ? (
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm text-[#0F0F0F]/60">{available} left</span>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => updateTicketQuantity(ticket.id, -1)}
                            disabled={qty === 0}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{qty}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => updateTicketQuantity(ticket.id, 1)}
                            disabled={qty >= Math.min(ticket.max_per_order, available)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="mt-2">Sold Out</Badge>
                    )}
                  </div>
                );
              })}

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold text-[#2969FF]">
                  {formatCurrency(getTotalAmount(), event.ticket_types[0]?.currency || 'NGN')}
                </span>
              </div>

              <Button
                onClick={handleCheckout}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12"
                disabled={Object.values(selectedTickets).reduce((a, b) => a + b, 0) === 0}
              >
                {isAuthenticated ? 'Proceed to Checkout' : 'Login to Buy Tickets'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
