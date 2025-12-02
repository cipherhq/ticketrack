import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, Download, Share2, Mail, Calendar, MapPin, QrCode } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const mockTickets = [
  { id: '1', eventName: 'Lagos Tech Summit 2024', eventDate: 'December 15, 2024', eventTime: '9:00 AM - 6:00 PM', venue: 'Eko Convention Center, Lagos', ticketType: 'VIP', quantity: 2, price: 50000, orderNumber: 'TKT-ABC123XYZ', status: 'active', purchaseDate: 'November 30, 2024' },
  { id: '2', eventName: 'Afrobeats Live Concert', eventDate: 'December 20, 2024', eventTime: '7:00 PM - 11:00 PM', venue: 'Tafawa Balewa Square, Lagos', ticketType: 'General Admission', quantity: 1, price: 15000, orderNumber: 'TKT-DEF456ABC', status: 'active', purchaseDate: 'November 28, 2024' },
  { id: '3', eventName: 'Business Workshop Series', eventDate: 'November 10, 2024', eventTime: '10:00 AM - 4:00 PM', venue: 'The Civic Center, Abuja', ticketType: 'Early Bird', quantity: 1, price: 8000, orderNumber: 'TKT-GHI789DEF', status: 'used', purchaseDate: 'October 25, 2024' },
]

export function WebTickets() {
  const navigate = useNavigate()
  const [tickets] = useState(mockTickets)

  const activeTickets = tickets.filter(t => t.status === 'active')
  const pastTickets = tickets.filter(t => t.status !== 'active')

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-[#2969FF]/10 text-[#2969FF]'
      case 'used': return 'bg-[#0F0F0F]/10 text-[#0F0F0F]/60'
      case 'expired': return 'bg-red-100 text-red-600'
      default: return 'bg-[#F4F6FA] text-[#0F0F0F]/60'
    }
  }

  const TicketCard = ({ ticket }) => (
    <Card className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="bg-gradient-to-r from-[#2969FF] to-[#2969FF]/80 text-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white mb-1 text-lg">{ticket.eventName}</CardTitle>
            <div className="flex items-center gap-2 text-white/80 text-xs"><Calendar className="w-3 h-3" /><span>{ticket.eventDate}</span></div>
          </div>
          <Badge className={`${getStatusColor(ticket.status)} capitalize text-xs`}>{ticket.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-[#0F0F0F]/60">Order Number</p><p className="text-[#0F0F0F]">{ticket.orderNumber}</p></div>
            <div><p className="text-xs text-[#0F0F0F]/60">Ticket Type</p><p className="text-[#0F0F0F]">{ticket.ticketType}</p></div>
            <div><p className="text-xs text-[#0F0F0F]/60">Quantity</p><p className="text-[#0F0F0F]">{ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''}</p></div>
            <div><p className="text-xs text-[#0F0F0F]/60">Event Time</p><p className="text-[#0F0F0F]">{ticket.eventTime}</p></div>
            <div><p className="text-xs text-[#0F0F0F]/60">Venue</p><p className="text-[#0F0F0F] text-sm">{ticket.venue}</p></div>
            <div><p className="text-xs text-[#0F0F0F]/60">Total Paid</p><p className="text-lg font-bold text-[#2969FF]">₦{ticket.price.toLocaleString()}</p></div>
          </div>
          <div className="flex flex-col items-center justify-center bg-[#F4F6FA] rounded-xl p-3">
            <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center border border-[#0F0F0F]/10"><QrCode className="w-24 h-24 text-[#0F0F0F]/20" /></div>
            <p className="text-xs text-[#0F0F0F]/60 mt-2 text-center">Scan at venue</p>
          </div>
        </div>
        {ticket.status === 'active' && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#0F0F0F]/10">
            <Button size="sm" variant="outline" className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs"><Download className="w-3 h-3" />Download</Button>
            <Button size="sm" variant="outline" className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs"><Mail className="w-3 h-3" />Email</Button>
            <Button size="sm" variant="outline" className="rounded-xl border-[#0F0F0F]/10 flex items-center gap-2 text-xs"><Share2 className="w-3 h-3" />Share</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-[#2969FF]/10 rounded-xl flex items-center justify-center"><Ticket className="w-6 h-6 text-[#2969FF]" /></div>
          <h1 className="text-4xl font-bold text-[#0F0F0F]">My Tickets</h1>
        </div>
        <p className="text-[#0F0F0F]/60">View and manage all your event tickets in one place</p>
      </div>

      {tickets.length === 0 ? (
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center mb-4"><Ticket className="w-10 h-10 text-[#0F0F0F]/40" /></div>
            <h3 className="text-xl font-semibold text-[#0F0F0F] mb-2">No tickets yet</h3>
            <p className="text-[#0F0F0F]/60 mb-6 text-center">Start exploring events and book your tickets</p>
            <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl">Browse Events</Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-white border border-[#0F0F0F]/10 rounded-xl p-1">
            <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Active ({activeTickets.length})</TabsTrigger>
            <TabsTrigger value="past" className="rounded-lg data-[state=active]:bg-[#2969FF] data-[state=active]:text-white">Past ({pastTickets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {activeTickets.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16"><p className="text-[#0F0F0F]/60">No active tickets</p></CardContent></Card>
            ) : activeTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)}
          </TabsContent>

          <TabsContent value="past" className="space-y-6">
            {pastTickets.length === 0 ? (
              <Card className="border-[#0F0F0F]/10 rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16"><p className="text-[#0F0F0F]/60">No past tickets</p></CardContent></Card>
            ) : pastTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
