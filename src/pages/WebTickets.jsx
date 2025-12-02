import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, Download, Share2, Mail, Calendar, MapPin, QrCode, Loader2, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function WebTickets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }
    loadTickets()
  }, [user, navigate])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          event:events(id, title, slug, start_date, end_date, venue_name, venue_address, city, image_url),
          ticket_type:ticket_types(name, price),
          order:orders(id, total_amount, payment_reference, created_at)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-700'
      case 'used': return 'bg-gray-100 text-gray-600'
      case 'expired': return 'bg-red-100 text-red-600'
      case 'cancelled': return 'bg-orange-100 text-orange-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'valid': return 'Active'
      case 'used': return 'Used'
      case 'expired': return 'Expired'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  // Check if event date has passed
  const isEventPast = (eventDate) => {
    return new Date(eventDate) < new Date()
  }

  const activeTickets = tickets.filter(t => t.status === 'valid' && !isEventPast(t.event?.end_date))
  const pastTickets = tickets.filter(t => t.status !== 'valid' || isEventPast(t.event?.end_date))

  const TicketCard = ({ ticket }) => {
    const isPast = isEventPast(ticket.event?.end_date)
    
    return (
      <Card className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-[#2969FF] to-[#2969FF]/80 text-white p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-white mb-1 text-lg line-clamp-1">{ticket.event?.title}</CardTitle>
              <div className="flex items-center gap-2 text-white/80 text-xs">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(ticket.event?.start_date)}</span>
              </div>
            </div>
            <Badge className={`${getStatusColor(isPast ? 'used' : ticket.status)} capitalize text-xs`}>
              {isPast ? 'Past' : getStatusLabel(ticket.status)}
            </Badge>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ticket Details */}
            <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Order Number</p>
                <p className="text-[#0F0F0F] font-mono">TKT-{ticket.order?.id?.slice(0, 8).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Ticket Type</p>
                <p className="text-[#0F0F0F]">{ticket.ticket_type?.name || 'General'}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Event Time</p>
                <p className="text-[#0F0F0F]">{formatTime(ticket.event?.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-[#0F0F0F]/60">Attendee</p>
                <p className="text-[#0F0F0F]">{ticket.attendee_name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[#0F0F0F]/60">Venue</p>
                <p className="text-[#0F0F0F] text-sm flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {ticket.event?.venue_name}, {ticket.event?.city}
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center bg-[#F4F6FA] rounded-xl p-3">
              <div className="w-28 h-28 bg-white rounded-lg flex items-center justify-center border border-[#0F0F0F]/10 mb-2">
                {/* QR Code placeholder - in production use a QR library */}
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-[#0F0F0F]/30 mx-auto" />
                </div>
              </div>
              <p className="text-xs text-[#0F0F0F]/60 text-center font-mono">{ticket.qr_code}</p>
            </div>
          </div>

          {/* Actions */}
          {ticket.status === 'valid' && !isPast && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#0F0F0F]/10">
              <Button size="sm" variant="outline" className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs">
                <Download className="w-3 h-3" />Download
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs">
                <Mail className="w-3 h-3" />Email
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs">
                <Share2 className="w-3 h-3" />Share
              </Button>
              <Button 
                size="sm" 
                className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl ml-auto text-xs"
                onClick={() => navigate(`/event/${ticket.event?.slug}`)}
              >
                View Event
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" className="mb-4 text-[#0F0F0F]/60 hover:text-[#0F0F0F] -ml-2" onClick={() => navigate('/profile')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Profile
        </Button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center">
            <Ticket className="w-6 h-6 text-[#2969FF]" />
          </div>
          <h1 className="text-4xl font-bold text-[#0F0F0F]">My Tickets</h1>
        </div>
        <p className="text-[#0F0F0F]/60">View and manage all your event tickets in one place</p>
      </div>

      {/* Content */}
      {tickets.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
              <Ticket className="w-10 h-10 text-[#0F0F0F]/40" />
            </div>
            <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No tickets yet</h3>
            <p className="text-[#0F0F0F]/60 mb-6 text-center">Start exploring events and book your first ticket</p>
            <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl">
              Browse Events
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
            <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Active ({activeTickets.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">
              Past ({pastTickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {activeTickets.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4">
                    <Ticket className="w-8 h-8 text-[#0F0F0F]/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F0F0F] mb-2">No active tickets</h3>
                  <p className="text-[#0F0F0F]/60 mb-4">Your upcoming event tickets will appear here</p>
                  <Button onClick={() => navigate('/events')} variant="outline" className="rounded-xl">
                    Browse Events
                  </Button>
                </CardContent>
              </Card>
            ) : (
              activeTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-6">
            {pastTickets.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-[#0F0F0F]/60">No past tickets</p>
                </CardContent>
              </Card>
            ) : (
              pastTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
