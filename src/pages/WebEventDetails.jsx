import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, MapPin, Users, Clock, Share2, Heart, Minus, Plus, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getEvent } from '@/services/events'
import { supabase } from '@/lib/supabase'

export function WebEventDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [selectedTickets, setSelectedTickets] = useState({})
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    async function loadEvent() {
      setLoading(true)
      setError(null)
      try {
        // Fetch event details
        const eventData = await getEvent(id)
        setEvent(eventData)
        
        // Fetch ticket types for this event
        const { data: tickets, error: ticketsError } = await supabase
          .from('ticket_types')
          .select('*')
          .eq('event_id', eventData.id)
          .eq('is_active', true)
          .order('price', { ascending: true })
        
        if (ticketsError) throw ticketsError
        
        // If no ticket types, create mock ones for demo
        if (!tickets || tickets.length === 0) {
          setTicketTypes([
            { id: 'early', name: 'Early Bird', price: 15000, quantity_available: 45, quantity_total: 100 },
            { id: 'regular', name: 'Regular', price: 25000, quantity_available: 189, quantity_total: 300 },
            { id: 'vip', name: 'VIP', price: 50000, quantity_available: 78, quantity_total: 100 },
          ])
        } else {
          setTicketTypes(tickets)
        }
      } catch (err) {
        console.error('Error loading event:', err)
        setError('Event not found')
      } finally {
        setLoading(false)
      }
    }
    
    if (id) {
      loadEvent()
    }
  }, [id])

  const updateTicketQuantity = (tierId, delta) => {
    setSelectedTickets(prev => {
      const current = prev[tierId] || 0
      const tier = ticketTypes.find(t => t.id === tierId)
      const maxAvailable = tier?.quantity_available || 10
      const newQuantity = Math.max(0, Math.min(maxAvailable, Math.min(10, current + delta)))
      return { ...prev, [tierId]: newQuantity }
    })
  }

  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0)
  const totalAmount = Object.entries(selectedTickets).reduce((sum, [tierId, qty]) => {
    const tier = ticketTypes.find(t => t.id === tierId)
    return sum + (tier?.price || 0) * qty
  }, 0)

  const handleCheckout = () => {
    if (totalTickets > 0) {
      navigate('/checkout', { 
        state: { 
          event,
          selectedTickets, 
          ticketTypes,
          totalAmount 
        } 
      })
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: event.description,
          url: window.location.href,
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-6xl mb-4">😢</div>
        <h1 className="text-2xl font-bold text-[#0F0F0F] mb-2">Event Not Found</h1>
        <p className="text-[#0F0F0F]/60 mb-6">The event you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
          Browse Events
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        className="mb-6 text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Image */}
          <div className="aspect-video rounded-2xl overflow-hidden bg-[#F4F6FA]">
            <img 
              src={event.image_url} 
              alt={event.title}
              className="w-full h-full object-cover"
              onError={(e) => { 
                e.target.src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200'
              }}
            />
          </div>

          {/* Event Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg mb-3">
                {event.category?.icon} {event.category?.name || 'Event'}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-4">{event.title}</h1>
              <div className="flex flex-wrap gap-4 text-[#0F0F0F]/60">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>{formatDate(event.start_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{formatTime(event.start_date)} - {formatTime(event.end_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>{event.venue_name}, {event.city}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsFavorite(!isFavorite)} 
                className={`rounded-xl ${isFavorite ? 'text-red-500 border-red-500' : ''}`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-xl"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* About */}
          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">About This Event</h2>
            <div className="text-[#0F0F0F]/80 space-y-4 whitespace-pre-line">
              {event.description}
            </div>
          </div>

          <Separator />

          {/* Location */}
          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Location</h2>
            <Card className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
              <div className="aspect-video bg-[#F4F6FA] flex items-center justify-center">
                <MapPin className="w-12 h-12 text-[#0F0F0F]/20" />
              </div>
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#0F0F0F] mb-2">{event.venue_name}</h3>
                <p className="text-[#0F0F0F]/60">{event.venue_address}, {event.city}</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Organizer */}
          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Organized By</h2>
            <div 
              className="flex items-center gap-4 cursor-pointer hover:bg-[#F4F6FA] p-4 rounded-xl -ml-4 transition-colors"
              onClick={() => navigate(`/organizer/${event.organizer?.id}`)}
            >
              <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center overflow-hidden">
                {event.organizer?.logo_url ? (
                  <img 
                    src={event.organizer.logo_url} 
                    alt={event.organizer.business_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Users className="w-8 h-8 text-[#2969FF]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#0F0F0F]">{event.organizer?.business_name}</h3>
                  {event.organizer?.is_verified && (
                    <CheckCircle className="w-4 h-4 text-[#2969FF]" />
                  )}
                </div>
                <p className="text-[#0F0F0F]/60">{event.organizer?.total_events || 0} events hosted</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Sidebar */}
        <div className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Select Tickets</h2>
                
                {event.is_free ? (
                  <div className="text-center py-8">
                    <Badge className="bg-green-100 text-green-700 border-0 text-lg px-4 py-2 mb-4">
                      Free Event
                    </Badge>
                    <p className="text-[#0F0F0F]/60">This event is free to attend!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ticketTypes.map(tier => (
                      <div key={tier.id} className="p-4 border border-[#0F0F0F]/10 rounded-xl space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-[#0F0F0F]">{tier.name}</h3>
                            <p className="text-2xl font-bold text-[#2969FF] mt-1">
                              ₦{tier.price.toLocaleString()}
                            </p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`border-[#0F0F0F]/20 rounded-lg ${
                              tier.quantity_available < 20 ? 'text-orange-600 border-orange-300' : 'text-[#0F0F0F]/60'
                            }`}
                          >
                            {tier.quantity_available} left
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#0F0F0F]/60">Quantity</span>
                          <div className="flex items-center gap-3">
                            <Button 
                              size="icon" 
                              variant="outline" 
                              onClick={() => updateTicketQuantity(tier.id, -1)} 
                              disabled={!selectedTickets[tier.id]} 
                              className="w-8 h-8 rounded-lg"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center font-medium text-[#0F0F0F]">
                              {selectedTickets[tier.id] || 0}
                            </span>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              onClick={() => updateTicketQuantity(tier.id, 1)} 
                              disabled={
                                (selectedTickets[tier.id] || 0) >= tier.quantity_available || 
                                (selectedTickets[tier.id] || 0) >= 10
                              } 
                              className="w-8 h-8 rounded-lg"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {totalTickets > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-[#0F0F0F]/60">
                      <span>Tickets ({totalTickets})</span>
                      <span>₦{totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[#0F0F0F]/60">
                      <span>Service Fee</span>
                      <span>₦{Math.round(totalAmount * 0.05).toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg text-[#0F0F0F]">
                      <span>Total</span>
                      <span>₦{Math.round(totalAmount * 1.05).toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}

              <Button 
                className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6 text-lg"
                onClick={handleCheckout}
                disabled={totalTickets === 0 && !event.is_free}
              >
                {event.is_free ? 'Register Now' : totalTickets > 0 ? 'Proceed to Checkout' : 'Select Tickets'}
              </Button>

              <p className="text-xs text-center text-[#0F0F0F]/40">
                By purchasing, you agree to our Terms of Service
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
