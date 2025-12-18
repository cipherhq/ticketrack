import { formatPrice } from '@/config/currencies'
import { supabase } from '@/lib/supabase'
import { capturePayPalPayment } from '@/config/payments'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle, Download, Mail, Calendar, MapPin, Ticket, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { QRCodeSVG } from 'qrcode.react'


export function WebPaymentSuccess() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  
  const [order, setOrder] = useState(location.state?.order || null)
  const [event, setEvent] = useState(location.state?.event || null)
  const [tickets, setTickets] = useState(location.state?.tickets || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const reference = location.state?.reference || searchParams.get('session_id')

  useEffect(() => {
    const orderId = searchParams.get('order_id')
    const sessionId = searchParams.get('session_id')
    const provider = searchParams.get('provider')
    
    if (location.state?.order) return
    
    if (orderId && provider === 'paypal') {
      handlePayPalReturn(orderId)
    } else if (orderId || sessionId) {
      loadStripeOrder(orderId)
    } else if (!location.state?.order && !location.state?.event) {
      navigate('/events')
    }
  }, [searchParams])

  const handlePayPalReturn = async (orderId) => {
    setLoading(true)
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('payment_reference')
        .eq('id', orderId)
        .single()

      if (orderData?.payment_reference) {
        await capturePayPalPayment(orderId, orderData.payment_reference)
      }

      await loadStripeOrder(orderId)
    } catch (err) {
      console.error('PayPal capture error:', err)
      setError('Payment verification failed')
      setLoading(false)
    }
  }

  const loadStripeOrder = async (orderId) => {
    setLoading(true)
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, events(*)') 
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        navigate('/events')
        return
      }

      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*')
        .eq('order_id', orderId)

      setOrder(orderData)
      setEvent(orderData.events)
      setTickets(ticketsData || [])
    } catch (err) {
      console.error('Error:', err)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2969FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#0F0F0F]/60">Loading your tickets...</p>
        </div>
      </div>
    )
  }

  if (!order || !event) return null
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

  const downloadAllTickets = () => {
    // For each ticket, trigger download
    tickets?.forEach((ticket, index) => {
      setTimeout(() => {
        const svg = document.getElementById(`success-qr-${index}`)
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg)
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const img = new Image()
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            const link = document.createElement('a')
            link.download = `ticket-${ticket.ticket_code}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
          }
          img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
        }
      }, index * 500)
    })
  }

  const emailTickets = () => {
    const subject = encodeURIComponent(`Your Tickets for ${event.title}`)
    const body = encodeURIComponent(
      `Thank you for your purchase!\n\n` +
      `Event: ${event.title}\n` +
      `Date: ${formatDate(event.start_date)}\n` +
      `Time: ${formatTime(event.start_date)}\n` +
      `Venue: ${event.venue_name}, ${event.city}\n\n` +
      `Number of tickets: ${tickets?.length || 0}\n` +
      `Order Number: ${order.order_number || `ORD-${order.id.slice(0, 8).toUpperCase()}`}\n\n` +
      `Please show your QR code at the venue entrance.\n\n` +
      `View your tickets: ${window.location.origin}/tickets`
    )
    window.location.href = `mailto:${order.buyer_email}?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-[#0F0F0F] mb-2">Payment Successful!</h1>
          <p className="text-[#0F0F0F]/60">Your tickets have been confirmed and sent to your email</p>
        </div>

        {/* Order Details Card */}
        <Card className="border-0 rounded-2xl shadow-lg mb-6">
          <CardContent className="p-6">
            {/* Order Number */}
            <div className="bg-[#2969FF]/5 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-[#0F0F0F]/60">Order Number</p>
                  <p className="font-mono font-bold text-[#2969FF]">
                    {order.order_number || `ORD-${order.id.slice(0, 8).toUpperCase()}`}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-700 border-0">Confirmed</Badge>
              </div>
            </div>

            {/* Event Details */}
            <div className="flex gap-4 mb-6">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#F4F6FA] flex-shrink-0">
                <img 
                  src={event.image_url} 
                  alt={event.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg text-[#0F0F0F] mb-2">{event.title}</h2>
                <div className="space-y-1 text-sm text-[#0F0F0F]/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(event.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4" />
                    <span>{formatTime(event.start_date)} - {formatTime(event.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{event.venue_name}, {event.city}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="mb-6" />

            {/* Tickets with QR Codes */}
            <div className="mb-6">
              <h3 className="font-semibold text-[#0F0F0F] mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#2969FF]" />
                Your Tickets ({tickets?.length || 0})
              </h3>
              
              <div className="space-y-3">
                {tickets?.map((ticket, index) => {
                  const qrValue = JSON.stringify({
                    ticketId: ticket.id || `temp-${index}`,
                    qrCode: ticket.ticket_code,
                    eventId: event.id,
                    attendee: ticket.attendee_name
                  })
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                      <div>
                        <p className="font-medium text-[#0F0F0F]">Ticket #{index + 1}</p>
                        <p className="text-sm text-[#0F0F0F]/60">{ticket.attendee_name}</p>
                        <p className="text-xs text-[#0F0F0F]/40 font-mono mt-1">{ticket.ticket_code}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-[#0F0F0F]/10">
                        <QRCodeSVG 
                          id={`success-qr-${index}`}
                          value={qrValue}
                          size={64}
                          level="H"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator className="mb-6" />

            {/* Payment Summary */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-[#0F0F0F]/60">Subtotal</span>
                <span className="text-[#0F0F0F]">{formatPrice(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#0F0F0F]/60">Service Fee</span>
                <span className="text-[#0F0F0F]">{formatPrice(order.platform_fee, order.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span className="text-[#0F0F0F]">Total Paid</span>
                <span className="text-[#2969FF]">{formatPrice(order.total_amount, order.currency)}</span>
              </div>
              {reference && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#0F0F0F]/40">Reference</span>
                  <span className="text-[#0F0F0F]/40 font-mono">{reference}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl border-[#0F0F0F]/10"
                onClick={downloadAllTickets}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Tickets
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl border-[#0F0F0F]/10"
                onClick={emailTickets}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email Tickets
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-0 rounded-2xl shadow-lg mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-[#0F0F0F] mb-4">What's Next?</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2969FF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#2969FF]">1</span>
                </div>
                <div>
                  <p className="font-medium text-[#0F0F0F]">Check your email</p>
                  <p className="text-sm text-[#0F0F0F]/60">We've sent your tickets to {order.buyer_email}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2969FF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#2969FF]">2</span>
                </div>
                <div>
                  <p className="font-medium text-[#0F0F0F]">Save your QR code</p>
                  <p className="text-sm text-[#0F0F0F]/60">Screenshot or download your ticket for easy access</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2969FF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#2969FF]">3</span>
                </div>
                <div>
                  <p className="font-medium text-[#0F0F0F]">Show QR at the venue</p>
                  <p className="text-sm text-[#0F0F0F]/60">Present your QR code at the entrance for quick check-in</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            className="flex-1 bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6"
            onClick={() => navigate('/tickets')}
          >
            View My Tickets
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button 
            variant="outline"
            className="flex-1 rounded-xl py-6 border-[#0F0F0F]/10"
            onClick={() => navigate('/events')}
          >
            Browse More Events
          </Button>
        </div>
      </div>
    </div>
  )
}
