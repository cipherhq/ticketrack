import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Calendar, MapPin, Clock, Users, Ticket, Share2, Heart, ArrowLeft, Minus, Plus } from 'lucide-react'

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [ticketTypes, setTicketTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTickets, setSelectedTickets] = useState({})

  useEffect(() => {
    fetchEventDetails()
  }, [id])

  const fetchEventDetails = async () => {
    const [eventRes, ticketsRes] = await Promise.all([
      supabase
        .from('events')
        .select('*, organizers(id, business_name, logo_url, is_verified), categories(name), countries(name, currency, currency_symbol, tax_percent)')
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
      const newQuantity = Math.max(0, Math.min(current + delta, ticket?.max_per_order || 10))
      
      if (newQuantity === 0) {
        const { [ticketId]: removed, ...rest } = prev
        return rest
      }
      return { ...prev, [ticketId]: newQuantity }
    })
  }

  const getTotalAmount = () => {
    return Object.entries(selectedTickets).reduce((total, [ticketId, quantity]) => {
      const ticket = ticketTypes.find(t => t.id === ticketId)
      return total + (ticket?.price || 0) * quantity
    }, 0)
  }

  const getTotalTickets = () => {
    return Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0)
  }

  const handleCheckout = () => {
    if (!user) {
      navigate('/login')
      return
    }
    // Store selected tickets in session storage for checkout
    sessionStorage.setItem('checkout', JSON.stringify({
      eventId: id,
      tickets: selectedTickets
    }))
    navigate('/checkout')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading event...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Event not found</p>
          <Link to="/events">
            <Button className="mt-4">Browse Events</Button>
          </Link>
        </div>
      </div>
    )
  }

  const eventDate = new Date(event.start_date)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Image */}
      <div className="h-64 md:h-96 bg-gradient-to-br from-primary-400 to-primary-600 relative">
        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute top-4 left-4">
          <button
            onClick={() => navigate(-1)}
            className="bg-white/90 hover:bg-white p-2 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="bg-white/90 hover:bg-white p-2 rounded-full transition">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="bg-white/90 hover:bg-white p-2 rounded-full transition">
            <Heart className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <span className="text-sm font-medium text-primary-500 bg-primary-50 px-3 py-1 rounded-full">
              {event.categories?.name}
            </span>
            
            <h1 className="text-3xl md:text-4xl font-bold mt-4">{event.title}</h1>
            
            {/* Organizer */}
            <div className="flex items-center gap-3 mt-6 p-4 bg-white rounded-xl border">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                {event.organizers?.logo_url ? (
                  <img src={event.organizers.logo_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-primary-500 font-bold">{event.organizers?.business_name?.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  {event.organizers?.business_name}
                  {event.organizers?.is_verified && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Verified</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">Event Organizer</p>
              </div>
            </div>

            {/* Event Details */}
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border">
                <Calendar className="w-6 h-6 text-primary-500 mt-1" />
                <div>
                  <p className="font-medium">
                    {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border">
                <MapPin className="w-6 h-6 text-primary-500 mt-1" />
                <div>
                  <p className="font-medium">{event.venue_name}</p>
                  <p className="text-sm text-gray-500">{event.venue_address || event.city}, {event.countries?.name}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">About This Event</h2>
              <div className="bg-white rounded-xl border p-6">
                <p className="text-gray-600 whitespace-pre-line">
                  {event.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </div>

          {/* Ticket Selection Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4">Select Tickets</h2>
              
              {ticketTypes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No tickets available</p>
              ) : (
                <div className="space-y-4">
                  {ticketTypes.map((ticket) => {
                    const available = ticket.quantity_available - ticket.quantity_sold
                    const isAvailable = available > 0
                    
                    return (
                      <div key={ticket.id} className={`border rounded-xl p-4 ${!isAvailable ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{ticket.name}</h3>
                            {ticket.description && (
                              <p className="text-sm text-gray-500 mt-1">{ticket.description}</p>
                            )}
                            <p className="text-lg font-bold text-primary-500 mt-2">
                              {event.countries?.currency_symbol}{ticket.price.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        {isAvailable ? (
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-sm text-gray-500">{available} left</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateTicketQuantity(ticket.id, -1)}
                                className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                                disabled={!selectedTickets[ticket.id]}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-medium">
                                {selectedTickets[ticket.id] || 0}
                              </span>
                              <button
                                onClick={() => updateTicketQuantity(ticket.id, 1)}
                                className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                                disabled={(selectedTickets[ticket.id] || 0) >= ticket.max_per_order}
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
              )}

              {/* Total */}
              {getTotalTickets() > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600">{getTotalTickets()} ticket(s)</span>
                    <span className="text-2xl font-bold">
                      {event.countries?.currency_symbol}{getTotalAmount().toLocaleString()}
                    </span>
                  </div>
                  <Button onClick={handleCheckout} className="w-full">
                    {user ? 'Proceed to Checkout' : 'Login to Buy'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
