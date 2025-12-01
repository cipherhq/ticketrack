import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { formatDate, formatCurrency } from '../lib/utils'
import { CheckCircle, Download, Calendar, MapPin, Ticket, Mail, Share2 } from 'lucide-react'

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const orderNumber = searchParams.get('order')
  const [order, setOrder] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderNumber) {
      fetchOrder()
    }
  }, [orderNumber])

  const fetchOrder = async () => {
    const { data: orderData } = await supabase
      .from('orders')
      .select(`
        *,
        events(title, start_date, venue_name, city, image_url, countries(currency_symbol))
      `)
      .eq('order_number', orderNumber)
      .single()

    if (orderData) {
      setOrder(orderData)

      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*, ticket_types(name)')
        .eq('order_id', orderData.id)

      if (ticketsData) setTickets(ticketsData)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-primary-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700">Order Not Found</h1>
          <p className="text-gray-500 mt-2">We couldn't find this order</p>
          <Link to="/events">
            <Button className="mt-6">Browse Events</Button>
          </Link>
        </div>
      </div>
    )
  }

  const event = order.events
  const currencySymbol = event?.countries?.currency_symbol || '₦'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-fade-in">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Successful!</h1>
          <p className="text-gray-500 mt-2">Your tickets have been confirmed</p>
        </div>

        {/* Order Details */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <p className="text-sm text-gray-500">Order Number</p>
              <p className="font-mono font-bold text-lg">{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="font-bold text-lg text-primary-500">
                {formatCurrency(order.total_amount, currencySymbol)}
              </p>
            </div>
          </div>

          {/* Event Info */}
          <div className="py-4 border-b">
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl overflow-hidden flex-shrink-0">
                {event?.image_url && (
                  <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{event?.title}</h3>
                <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                  <Calendar className="w-4 h-4" />
                  <span>{event?.start_date && formatDate(event.start_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{event?.venue_name}, {event?.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tickets */}
          <div className="py-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary-500" />
              Your Tickets ({tickets.length})
            </h4>
            <div className="space-y-3">
              {tickets.map((ticket, index) => (
                <div key={ticket.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <div>
                    <p className="font-medium">{ticket.ticket_types?.name}</p>
                    <p className="text-sm text-gray-500 font-mono">{ticket.ticket_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Ticket {index + 1}</p>
                    <p className="text-green-600 text-sm font-medium">✓ Valid</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Email Confirmation */}
        <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">Confirmation Email Sent</h4>
              <p className="text-sm text-blue-700 mt-1">
                We've sent your tickets and order confirmation to <strong>{order.buyer_email}</strong>
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/my-tickets" className="flex-1">
            <Button className="w-full" size="lg">
              <Ticket className="w-5 h-5 mr-2" />
              View My Tickets
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="flex-1" onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: `I'm going to ${event?.title}!`,
                text: `Just got my tickets for ${event?.title} on Ticketrack!`,
                url: window.location.origin + `/events/${event?.id}`
              })
            }
          }}>
            <Share2 className="w-5 h-5 mr-2" />
            Share
          </Button>
        </div>

        {/* Continue Browsing */}
        <div className="text-center mt-8">
          <Link to="/events" className="text-primary-500 hover:underline">
            Continue browsing events →
          </Link>
        </div>
      </div>
    </div>
  )
}
