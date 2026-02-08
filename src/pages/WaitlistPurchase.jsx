import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Clock, CheckCircle, AlertCircle, Loader2, Calendar, 
  MapPin, Ticket, ArrowRight, XCircle, Minus, Plus
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/config/currencies';

export function WaitlistPurchase() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [waitlistEntry, setWaitlistEntry] = useState(null);
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setError('No purchase token provided');
      setLoading(false);
    }
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (!waitlistEntry?.expires_at) return;
    
    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(waitlistEntry.expires_at);
      const diff = expires - now;
      
      if (diff <= 0) {
        setTimeRemaining(null);
        setError('This offer has expired. The tickets have been released to the next person in queue.');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeRemaining({ hours, minutes, seconds, total: diff });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [waitlistEntry?.expires_at]);

  const validateToken = async () => {
    try {
      const { data: entry, error: entryError } = await supabase
        .from('waitlist')
        .select('*')
        .eq('purchase_token', token)
        .single();

      if (entryError || !entry) {
        setError('Invalid or expired purchase link.');
        setLoading(false);
        return;
      }

      if (entry.status === 'purchased') {
        setError('You have already purchased tickets for this event.');
        setLoading(false);
        return;
      }

      if (entry.status === 'expired') {
        setError('This offer has expired.');
        setLoading(false);
        return;
      }

      if (entry.status !== 'notified') {
        setError('This purchase link is no longer valid.');
        setLoading(false);
        return;
      }

      if (new Date(entry.expires_at) < new Date()) {
        await supabase
          .from('waitlist')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', entry.id);
        
        setError('This offer has expired.');
        setLoading(false);
        return;
      }

      setWaitlistEntry(entry);

      const { data: eventData } = await supabase
        .from('events')
        .select(`*, organizer:organizers(id, business_name, logo_url)`)
        .eq('id', entry.event_id)
        .single();

      setEvent(eventData);

      const { data: tickets } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', entry.event_id)
        .eq('is_active', true)
        .order('price', { ascending: true });

      setTicketTypes(tickets || []);

    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleTicketChange = (ticketId, delta) => {
    const ticket = ticketTypes.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const current = selectedTickets[ticketId] || 0;
    const newValue = Math.max(0, current + delta);
    const remaining = (ticket.quantity_available || ticket.quantity_total || 0) - (ticket.quantity_sold || 0);
    const maxAllowed = Math.min(remaining, waitlistEntry?.quantity_wanted || 10);
    
    // Check total doesn't exceed max
    const totalOther = Object.entries(selectedTickets)
      .filter(([id]) => id !== ticketId)
      .reduce((sum, [, qty]) => sum + qty, 0);
    
    if (newValue + totalOther > (waitlistEntry?.quantity_wanted || 10)) {
      return;
    }
    
    setSelectedTickets(prev => ({
      ...prev,
      [ticketId]: Math.min(newValue, maxAllowed)
    }));
  };

  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalAmount = ticketTypes.reduce((sum, ticket) => {
    const qty = selectedTickets[ticket.id] || 0;
    return sum + (parseFloat(ticket.price) * qty);
  }, 0);

  const handleProceedToCheckout = () => {
    if (totalTickets === 0) return;
    
    navigate('/checkout', {
      state: {
        event,
        selectedTickets,
        ticketTypes,
        totalAmount,
        fromWaitlist: true,
        waitlistId: waitlistEntry.id,
        waitlistToken: token
      }
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your purchase link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Unable to Process</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/')} className="rounded-xl bg-[#2969FF]">
              Browse Events
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2969FF] to-[#1a4fd8] text-white py-4 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <p className="font-medium">You're off the waitlist! Select your tickets below.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 py-8">
        {/* Countdown */}
        {timeRemaining && (
          <Card className="rounded-2xl border-0 shadow-lg mb-6 overflow-hidden">
            <div className="bg-orange-500 text-white p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">Time Remaining</span>
              </div>
              <div className="flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-4xl font-bold">{String(timeRemaining.hours).padStart(2, '0')}</div>
                  <div className="text-xs opacity-80">Hours</div>
                </div>
                <div className="text-4xl font-bold">:</div>
                <div className="text-center">
                  <div className="text-4xl font-bold">{String(timeRemaining.minutes).padStart(2, '0')}</div>
                  <div className="text-xs opacity-80">Minutes</div>
                </div>
                <div className="text-4xl font-bold">:</div>
                <div className="text-center">
                  <div className="text-4xl font-bold">{String(timeRemaining.seconds).padStart(2, '0')}</div>
                  <div className="text-xs opacity-80">Seconds</div>
                </div>
              </div>
            </div>
            <CardContent className="p-3 bg-orange-50">
              <p className="text-sm text-orange-800 text-center">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                After this time, your spot will be released.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Event Info */}
        <Card className="rounded-2xl border-0 shadow-lg mb-6">
          <CardContent className="p-0">
            {event?.cover_image && (
              <div className="h-40 overflow-hidden rounded-t-2xl">
                <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <Badge className="bg-green-100 text-green-700 mb-3">Reserved for {waitlistEntry?.name}</Badge>
              <h1 className="text-2xl font-bold text-foreground mb-4">{event?.title}</h1>
              <div className="space-y-2 text-sm text-foreground/70">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#2969FF]" />
                  <span>{formatDate(event?.start_date)} • {formatTime(event?.start_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#2969FF]" />
                  <span>{event?.venue_name}, {event?.city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#2969FF]" />
                  <span>Up to {waitlistEntry?.quantity_wanted} tickets reserved</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Selection */}
        <Card className="rounded-2xl border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Select Tickets</h2>
            <div className="space-y-4">
              {ticketTypes.map(ticket => {
                const remaining = (ticket.quantity_available || ticket.quantity_total || 0) - (ticket.quantity_sold || 0);
                const isSoldOut = remaining <= 0;
                const qty = selectedTickets[ticket.id] || 0;
                
                return (
                  <div key={ticket.id} className={`p-4 rounded-xl border ${isSoldOut ? 'bg-background opacity-60' : 'bg-card'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{ticket.name}</h3>
                        {ticket.description && (
                          <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
                        )}
                        <p className="text-xl font-bold text-[#2969FF] mt-2">
                          {formatPrice(ticket.price, event?.currency)}
                        </p>
                        {!isSoldOut && <p className="text-xs text-muted-foreground">{remaining} available</p>}
                      </div>
                      {isSoldOut ? (
                        <Badge className="bg-red-100 text-red-600">Sold Out</Badge>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-10 h-10"
                            onClick={() => handleTicketChange(ticket.id, -1)}
                            disabled={qty === 0}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-bold text-lg">{qty}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full w-10 h-10"
                            onClick={() => handleTicketChange(ticket.id, 1)}
                            disabled={totalTickets >= (waitlistEntry?.quantity_wanted || 10)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        {totalTickets > 0 && (
          <Card className="rounded-2xl border-0 shadow-lg mb-6">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Order Summary</h2>
              <div className="space-y-2">
                {ticketTypes.filter(t => selectedTickets[t.id] > 0).map(ticket => (
                  <div key={ticket.id} className="flex justify-between text-sm">
                    <span>{ticket.name} × {selectedTickets[ticket.id]}</span>
                    <span>{formatPrice(parseFloat(ticket.price) * selectedTickets[ticket.id], event?.currency)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Subtotal</span>
                  <span className="text-[#2969FF]">{formatPrice(totalAmount, event?.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <Button 
          onClick={handleProceedToCheckout}
          disabled={totalTickets === 0}
          className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6 text-lg disabled:opacity-50"
        >
          {totalTickets === 0 ? 'Select Tickets to Continue' : `Proceed to Checkout (${totalTickets} ticket${totalTickets > 1 ? 's' : ''})`}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
