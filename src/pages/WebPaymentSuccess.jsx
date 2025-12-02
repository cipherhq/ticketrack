import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Download, Mail, Calendar, MapPin, Ticket, ArrowRight, QrCode } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export function WebPaymentSuccess() {
  const navigate = useNavigate()
  const location = useLocation()
  const { order, event, tickets, reference } = location.state || {}

  useEffect(() => {
    if (!order || !event) {
      navigate('/events')
    }
  }, [order, event, navigate])

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
                    TKT-{order.id.slice(0, 8).toUpperCase()}
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
                    <span className="w-4" /> {/* Spacer */}
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

            {/* Tickets */}
            <div className="mb-6">
              <h3 className="font-semibold text-[#0F0F0F] mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#2969FF]" />
                Your Tickets ({tickets?.length || 0})
              </h3>
              
              <div className="space-y-3">
                {tickets?.map((ticket, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-[#F4F6FA] rounded-xl">
                    <div>
                      <p className="font-medium text-[#0F0F0F]">Ticket #{index + 1}</p>
                      <p className="text-sm text-[#0F0F0F]/60">{ticket.attendee_name}</p>
                    </div>
                    <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center border border-[#0F0F0F]/10">
                      <QrCode className="w-10 h-10 text-[#0F0F0F]/30" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="mb-6" />

            {/* Payment Summary */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-[#0F0F0F]/60">Subtotal</span>
                <span className="text-[#0F0F0F]">₦{order.subtotal?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#0F0F0F]/60">Service Fee</span>
                <span className="text-[#0F0F0F]">₦{order.platform_fee?.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span className="text-[#0F0F0F]">Total Paid</span>
                <span className="text-[#2969FF]">₦{order.total_amount?.toLocaleString()}</span>
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
                onClick={() => {/* Download functionality */}}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Tickets
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl border-[#0F0F0F]/10"
                onClick={() => {/* Email functionality */}}
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
