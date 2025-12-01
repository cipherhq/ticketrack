import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { formatDate, formatTime } from '../lib/utils'
import { Ticket, Calendar, MapPin, QrCode, ChevronRight, Clock } from 'lucide-react'

export default function MyTickets() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/my-tickets')
      return
    }
    if (user) {
      fetchTickets()
    }
  }, [user, authLoading])

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        ticket_types(name, price),
        events(id, title, start_date, end_date, venue_name, city, image_url, countries(currency_symbol))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTickets(data)
    }
    setLoading(false)
  }

  const now = new Date()
  const filteredTickets = tickets.filter(ticket => {
    const eventDate = new Date(ticket.events?.start_date)
    if (filter === 'upcoming') {
      return eventDate >= now && ticket.status === 'valid'
    } else if (filter === 'past') {
      return eventDate < now || ticket.status === 'used'
    }
    return true
  })

  // Group tickets by event
  const groupedTickets = filteredTickets.reduce((acc, ticket) => {
    const eventId = ticket.events?.id
    if (!acc[eventId]) {
      acc[eventId] = {
        event: ticket.events,
        tickets: []
      }
    }
    acc[eventId].tickets.push(ticket)
    return acc
  }, {})

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Loading tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold">My Tickets</h1>
          <p className="text-primary-100 mt-2">All your event tickets in one place</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 bg-white rounded-xl p-1 border">
          {['upcoming', 'past', 'all'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition capitalize ${
                filter === tab
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tickets */}
        {Object.keys(groupedTickets).length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Ticket className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700">
              {filter === 'upcoming' ? 'No Upcoming Tickets' : filter === 'past' ? 'No Past Tickets' : 'No Tickets Yet'}
            </h3>
            <p className="text-gray-500 mt-2">
              {filter === 'upcoming' 
                ? "You don't have any upcoming events" 
                : filter === 'past'
                ? "You haven't attended any events yet"
                : "Start exploring events and get your first ticket!"
              }
            </p>
            <Link to="/events">
              <Button className="mt-6">Browse Events</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.values(groupedTickets).map(({ event, tickets }) => {
              const eventDate = new Date(event?.start_date)
              const isPast = eventDate < now
              const currencySymbol = event?.countries?.currency_symbol || '₦'

              return (
                <Card key={event?.id} className="overflow-hidden">
                  {/* Event Header */}
                  <div className="flex gap-4 p-4 border-b bg-gray-50">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl overflow-hidden flex-shrink-0">
                      {event?.image_url && (
                        <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/events/${event?.id}`} className="font-semibold text-lg hover:text-primary-500 line-clamp-1">
                        {event?.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-500 text-sm mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(event?.start_date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(event?.start_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {event?.city}
                        </span>
                      </div>
                    </div>
                    {isPast ? (
                      <Badge variant="default">Past</Badge>
                    ) : (
                      <Badge variant="success">Upcoming</Badge>
                    )}
                  </div>

                  {/* Tickets List */}
                  <div className="divide-y">
                    {tickets.map((ticket) => (
                      <Link 
                        key={ticket.id} 
                        to={`/ticket/${ticket.id}`}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                            <QrCode className="w-6 h-6 text-primary-500" />
                          </div>
                          <div>
                            <p className="font-medium">{ticket.ticket_types?.name}</p>
                            <p className="text-sm text-gray-500 font-mono">{ticket.ticket_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={ticket.status === 'valid' ? 'success' : ticket.status === 'used' ? 'default' : 'danger'}>
                            {ticket.status === 'valid' ? '✓ Valid' : ticket.status === 'used' ? 'Used' : 'Cancelled'}
                          </Badge>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
