import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { formatDate, formatTime, formatCurrency } from '../lib/utils'
import { 
  Calendar, MapPin, Clock, Users, Share2, Heart, ArrowLeft, 
  Minus, Plus, CheckCircle, AlertCircle, ExternalLink 
} from 'lucide-react'

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToCart, cart } = useCart()
  
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTickets, setSelectedTickets] = useState({})
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    fetchEventDetails()
  }, [id])

  const fetchEventDetails = async () => {
    const [eventRes, ticketsRes] = await Promise.all([
      supabase
        .from('events')
        .select(`
          *,
          organizers(id, business_name, logo_url, is_verified, description),
          categories(name, icon),
          countries(name, currency, currency_symbol, tax_percent, platform_fee_percent)
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', id)
        .eq('is_active', true)
        .order('price', { ascending: true })
    ])

    if (eventRes.data) setEvent(eventRes.data)
    if (ticketsRes.data) setTicketTypes(ticketsRes.data)
    setLoading(false)
  }

  const updateTicketQuantity = (ticketId, delta) => {
    setSelectedTickets(prev => {
      const current = prev[ticketId] || 0
      const ticket = ticketTypes.find(t => t.id === ticketId)
      const available = ticket.quantity_available - ticket.quantity_sold
      const maxAllowed = Math.min(ticket.max_per_order || 10, available)
      const newQuantity = Math.max(0, Math.min(current + delta, maxAllowed))
      
      if (newQuantity === 0) {
        const { [ticketId]: removed, ...rest } = prev
        return rest
      }
      return { ...prev, [ticketId]: newQuantity }
    })
  }

  const getSubtotal = () => {
    return Object.entries(selectedTickets).reduce((total, [ticketId, quantity]) => {
      const ticket = ticketTypes.find(t => t.id === ticketId)
      return total + (ticket?.price || 0) * quantity
    }, 0)
  }

  const getTotalTickets = () => {
    return Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0)
  }

  const handleAddToCart = () => {
    Object.entries(selectedTickets).forEach(([ticketId, quantity]) => {
      const ticket = ticketTypes.find(t => t.id === ticketId)
      if (ticket && quantity > 0) {
        addToCart(event.id, {
          id: event.id,
          title: event.title,
          image_url: event.image_url,
          start_date: event.start_date,
          venue_name: event.venue_name,
          city: event.city,
          country: event.countries
        }, ticket, quantity)
      }
    })
    navigate('/cart')
  }

  const handleBuyNow = () => {
    if (!user) {
      navigate('/login?redirect=' + encodeURIComponent(`/events/${id}`))
      return
    }
    handleAddToCart()
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title}`,
          url: window.location.href
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-primary-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-700">Event Not Found</h2>
          <p className="text-gray-500 mt-2">This event may have been removed or doesn't exist.</p>
          <Link to="/events">
            <Button className="mt-6">Browse Events</Button>
          </Link>
        </div>
      </div>
    )
  }

  const eventDate = new Date(event.start_date)
  const isPastEvent = eventDate < new Date()
  const currencySymbol = event.countries?.currency_symbol || '₦'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Image */}
      <div className="h-64 md:h-96 bg-gradient-to-br from-primary-400 to-primary-600 relative">
        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        {/* Navigation */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <button
            onClick={() => navigate(-1)}
            className="bg-white/90 hover:bg-white p-2 rounded-full transition shadow"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="bg-white/90 hover:bg-white p-2 rounded-full transition shadow"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setLiked(!liked)}
              className={`p-2 rounded-full transition shadow ${liked ? 'bg-red-500 text-white' : 'bg-white/90 hover:bg-white'}`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Event Status Badges */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {event.is_featured && (
            <Badge variant="warning" className="bg-yellow-400 text-yellow-900">⭐ Featured</Badge>
          )}
          {event.is_free && (
            <Badge variant="success">Free Event</Badge>
          )}
          {isPastEvent && (
            <Badge variant="danger">Past Event</Badge>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Category */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="primary">
                  {event.categories?.icon} {event.categories?.name}
                </Badge>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">{event.countries?.name}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{event.title}</h1>
            </div>

            {/* Organizer Card */}
            <Card className="p-4">
              <Link to={`/organizer/${event.organizers?.id}`} className="flex items-center gap-4 group">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                  {event.organizers?.logo_url ? (
                    <img src={event.organizers.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-primary-500">
                      {event.organizers?.business_name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 group-hover:text-primary-500 transition flex items-center gap-2">
                    {event.organizers?.business_name}
                    {event.organizers?.is_verified && (
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                    )}
                  </p>
                  <p className="text-sm text-gray-500">Event Organizer</p>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
              </Link>
            </Card>

            {/* Event Details */}
            <Card className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Event Details</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-semibold">{formatDate(event.start_date)}</p>
                    <p className="text-sm text-gray-600">{formatTime(event.start_date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-semibold">{event.venue_name}</p>
                    <p className="text-sm text-gray-600">{event.city}, {event.countries?.name}</p>
                  </div>
                </div>
              </div>

              {event.venue_address && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Full Address</p>
                  <p className="text-gray-700">{event.venue_address}</p>
                </div>
              )}
            </Card>

            {/* Description */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">About This Event</h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-600 whitespace-pre-line">
                  {event.description || 'No description provided for this event.'}
                </p>
              </div>
            </Card>
          </div>

          {/* Ticket Selection Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Select Tickets</h2>

              {isPastEvent ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">This event has already passed</p>
                </div>
              ) : ticketTypes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No tickets available yet</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {ticketTypes.map((ticket) => {
                      const available = ticket.quantity_available - ticket.quantity_sold
                      const isAvailable = available > 0
                      const quantity = selectedTickets[ticket.id] || 0

                      return (
                        <div 
                          key={ticket.id} 
                          className={`border rounded-xl p-4 transition ${
                            !isAvailable ? 'opacity-50 bg-gray-50' : quantity > 0 ? 'border-primary-500 bg-primary-50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold">{ticket.name}</h3>
                              {ticket.description && (
                                <p className="text-sm text-gray-500 mt-1">{ticket.description}</p>
                              )}
                            </div>
                            <p className="font-bold text-primary-500">
                              {ticket.price === 0 ? 'Free' : formatCurrency(ticket.price, currencySymbol)}
                            </p>
                          </div>

                          {isAvailable ? (
                            <div className="flex items-center justify-between mt-4">
                              <span className="text-sm text-gray-500">
                                {available} {available === 1 ? 'ticket' : 'tickets'} left
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => updateTicketQuantity(ticket.id, -1)}
                                  disabled={quantity === 0}
                                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-semibold">{quantity}</span>
                                <button
                                  onClick={() => updateTicketQuantity(ticket.id, 1)}
                                  disabled={quantity >= Math.min(ticket.max_per_order || 10, available)}
                                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-red-500 text-sm mt-2">Sold Out</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Summary */}
                  {getTotalTickets() > 0 && (
                    <div className="border-t pt-4 mb-4">
                      <div className="flex justify-between text-gray-600 mb-2">
                        <span>{getTotalTickets()} ticket(s)</span>
                        <span>{formatCurrency(getSubtotal(), currencySymbol)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary-500">{formatCurrency(getSubtotal(), currencySymbol)}</span>
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={handleBuyNow} 
                    disabled={getTotalTickets() === 0}
                    className="w-full"
                    size="lg"
                  >
                    {user ? 'Buy Now' : 'Login to Buy'}
                  </Button>
                  
                  <p className="text-center text-xs text-gray-400 mt-4">
                    Secure checkout powered by Paystack
                  </p>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
