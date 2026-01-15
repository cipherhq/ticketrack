import { formatPrice } from '@/config/currencies'
import { supabase } from '@/lib/supabase'
import { markWaitlistPurchased } from '@/services/waitlist'
import { capturePayPalPayment } from '@/config/payments'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle, Download, Mail, Calendar, MapPin, Ticket, ArrowRight, Monitor, ExternalLink, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { QRCodeSVG } from 'qrcode.react'
import { generateTicketPDFBase64, generateMultiTicketPDFBase64 } from '@/utils/ticketGenerator'
import { WalletButtons } from '@/components/WalletButtons'


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
  const isProcessingRef = useRef(false)

  useEffect(() => {
    const orderId = searchParams.get('order_id')
    const sessionId = searchParams.get('session_id')
    const provider = searchParams.get('provider')
    
    if (location.state?.order || isProcessingRef.current) return
    isProcessingRef.current = true
    
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

  // Mark waitlist as purchased if order came from waitlist
  const handleWaitlistCompletion = async (orderData) => {
    if (orderData?.waitlist_id) {
      try {
        await markWaitlistPurchased(orderData.waitlist_id)
        console.log('Waitlist entry marked as purchased:', orderData.waitlist_id)
      } catch (err) {
        console.error('Failed to update waitlist status:', err)
      }
    }
  }

  const loadStripeOrder = async (orderId) => {
    setLoading(true)
    try {
      // Fetch order with event and order items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, events(*, organizer:organizers(id, business_name, logo_url), event_sponsors(*)), order_items(*, ticket_types(name, price))') 
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        console.error('Order not found:', orderError)
        navigate('/events')
        return
      }

      // Check if order needs to be completed (Stripe redirect)
      if (orderData.status === 'pending') {
        console.log('Completing Stripe order:', orderId)
        
        // Update order status to completed
        const { error: updateError } = await supabase.from('orders').update({ 
          status: 'completed',
          paid_at: new Date().toISOString()
        }).eq('id', orderId)
        
        if (updateError) {
          console.error('Failed to update order status:', updateError)
        }
        
        // Create tickets from order_items
        const ticketsToCreate = []
        const orderItems = orderData.order_items || []
        
        for (const item of orderItems) {
          for (let i = 0; i < item.quantity; i++) {
            const ticketCode = 'TKT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase()
            ticketsToCreate.push({
              event_id: orderData.event_id,
              ticket_type_id: item.ticket_type_id,
              user_id: orderData.user_id,
              attendee_email: orderData.buyer_email,
              attendee_name: orderData.buyer_name,
              attendee_phone: orderData.buyer_phone || null,
              ticket_code: ticketCode,
              qr_code: ticketCode,
              unit_price: item.unit_price,
              total_price: item.unit_price,
              payment_reference: orderData.payment_reference,
              payment_status: 'completed',
              payment_method: orderData.payment_method || 'stripe',
              order_id: orderId,
              status: 'active'
            })
          }
        }

        if (ticketsToCreate.length > 0) {
          const { data: newTickets, error: ticketError } = await supabase
            .from('tickets')
            .insert(ticketsToCreate)
            .select()

          if (ticketError) {
            console.error('Error creating tickets:', ticketError)
          } else {
            console.log('Tickets created:', newTickets?.length)
            setTickets(newTickets || [])
          }
        }

        // Send confirmation email with PDF attachment
        try {
          const eventData = orderData.events
          const ticketTypes = orderItems.map(i => i.ticket_types?.name || 'Ticket').join(', ')
          const totalQty = orderItems.reduce((sum, i) => sum + i.quantity, 0)
          
          // Generate PDF ticket
          let pdfAttachment = null
          try {
            // Generate PDF for ALL tickets (multi-page PDF)
            if (ticketsToCreate.length > 0) {
              const ticketsForPdf = ticketsToCreate.map(t => ({
                ticket_code: t.ticket_code,
                attendee_name: orderData.buyer_name,
                attendee_email: orderData.buyer_email,
                ticket_type_name: t.ticket_type_name || orderItems.find(oi => oi.ticket_type_id === t.ticket_type_id)?.ticket_types?.name || 'Ticket'
              }))
              console.log("DEBUG PDF:", { ticketCount: ticketsForPdf.length, tickets: ticketsForPdf.map(t => t.ticket_code), hasSponsors: eventData?.event_sponsors?.length || 0 }); const pdfData = await generateMultiTicketPDFBase64(ticketsForPdf, eventData)
              pdfAttachment = [{
                filename: pdfData.filename,
                content: pdfData.base64,
                type: 'application/pdf'
              }]
            }
          } catch (pdfErr) {
            console.error('PDF generation failed:', pdfErr)
          }
          
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'ticket_purchase',
              to: orderData.buyer_email,
              data: {
                attendeeName: orderData.buyer_name,
                eventTitle: eventData?.title,
                eventDate: eventData?.start_date,
                venueName: eventData?.venue_name || 'TBA',
                city: eventData?.city || '',
                ticketType: ticketTypes,
                quantity: totalQty,
                orderNumber: orderData.order_number,
                totalAmount: orderData.total_amount,
                currency: orderData.currency,
                isFree: parseFloat(orderData.total_amount) === 0,
                appUrl: window.location.origin
              },
              ...(pdfAttachment && { attachments: pdfAttachment })
            }
          })
          console.log('Attendee confirmation email sent')

          // Send notification to organizer
          if (eventData?.organizer?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'new_ticket_sale',
                to: eventData.organizer.email,
                data: {
                  eventTitle: eventData?.title,
                  eventId: eventData?.id,
                  ticketType: ticketTypes,
                  quantity: totalQty,
                  buyerName: orderData.buyer_name,
                  buyerEmail: orderData.buyer_email,
                  buyerPhone: orderData.buyer_phone || null,
                  amount: orderData.total_amount,
                  isFree: parseFloat(orderData.total_amount) === 0,
                  totalSold: eventData?.tickets_sold || 0,
                  totalCapacity: eventData?.capacity || 0,
                  appUrl: window.location.origin
                }
              }
            })
            console.log('Organizer notification email sent')
          }
        } catch (emailErr) {
          console.error('Email error:', emailErr)
        }
      } else {
        // Order already completed, just load tickets
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('*')
          .eq('order_id', orderId)
        
        setTickets(ticketsData || [])
      }

      setOrder({ ...orderData, status: 'completed' })
      setEvent(orderData.events)

      // Mark waitlist as purchased if applicable
      await handleWaitlistCompletion(orderData)
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to process order')
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

  // Generate calendar URLs
  const generateCalendarLinks = () => {
    const startDate = new Date(event.start_date)
    const endDate = new Date(event.end_date || event.start_date)
    
    // Format for Google Calendar (YYYYMMDDTHHmmssZ)
    const formatGoogleDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d{3}/g, '')
    }
    
    // Format for iCal/Outlook (YYYYMMDDTHHMMSS)
    const formatICalDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, -1)
    }
    
    const title = encodeURIComponent(event.title)
    const location = encodeURIComponent(event.is_virtual ? 'Online Event' : `${event.venue_name}, ${event.venue_address || event.city}`)
    const description = encodeURIComponent(`Ticket: ${tickets[0]?.ticket_code || 'See email'}\n\nView tickets: ${window.location.origin}/tickets`)
    
    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${description}&location=${location}`,
      outlook: `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${description}&location=${location}`,
      ical: generateICalFile(startDate, endDate)
    }
  }
  
  const generateICalFile = (startDate, endDate) => {
    const formatICalDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, -1) + 'Z'
    }
    
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ticketrack//Event//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatICalDate(startDate)}`,
      `DTEND:${formatICalDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.is_virtual ? 'Online Event' : (event.venue_name + ', ' + (event.venue_address || event.city))}`,
      `DESCRIPTION:Ticket: ${tickets[0]?.ticket_code || 'See email'}. View tickets at ${window.location.origin}/tickets`,
      `URL:${window.location.origin}/events/${event.slug || event.id}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icalContent)
  }
  
  const addToGoogleCalendar = () => {
    const links = generateCalendarLinks()
    window.open(links.google, '_blank')
  }
  
  const addToOutlookCalendar = () => {
    const links = generateCalendarLinks()
    window.open(links.outlook, '_blank')
  }
  
  const addToAppleCalendar = () => {
    const links = generateCalendarLinks()
    const link = document.createElement('a')
    link.href = links.ical
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`
    link.click()
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
                  {event.is_virtual ? (
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      <span>Virtual Event (Online)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{event.venue_name}, {event.city}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Virtual Event - Streaming Link */}
            {event.is_virtual && event.streaming_url && (
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0F0F0F]">Join Event Online</h4>
                    <p className="text-sm text-[#0F0F0F]/60">
                      {event.streaming_platform ? event.streaming_platform.charAt(0).toUpperCase() + event.streaming_platform.slice(1).replace('_', ' ') : 'Streaming Link'}
                    </p>
                  </div>
                </div>
                
                <a
                  href={event.streaming_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Streaming Link
                </a>
                <p className="text-xs text-[#0F0F0F]/50 text-center mt-2">
                  Save this link! You can also find it in "My Tickets"
                </p>
              </div>
            )}

            <Separator className="mb-6" />

            {/* Tickets with QR Codes */}
            <div className="mb-6">
              <h3 className="font-semibold text-[#0F0F0F] mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#2969FF]" />
                Your Tickets ({tickets?.length || 0})
              </h3>
              
              <div className="space-y-3">
                {tickets?.map((ticket, index) => {
                  // QR code contains just the ticket code - matches PDF ticket
                  // This creates a cleaner, more scannable QR code
                  const qrValue = ticket.ticket_code
                  
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
                          size={80}
                          level="M"
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
            
            {/* Add to Calendar */}
            <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10">
              <p className="text-sm text-[#0F0F0F]/60 mb-3 text-center">Add to Calendar</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl border-[#0F0F0F]/10 text-sm"
                  onClick={addToGoogleCalendar}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z"/>
                  </svg>
                  Google
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl border-[#0F0F0F]/10 text-sm"
                  onClick={addToOutlookCalendar}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z"/>
                  </svg>
                  Outlook
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl border-[#0F0F0F]/10 text-sm"
                  onClick={addToAppleCalendar}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83"/>
                  </svg>
                  Apple
                </Button>
              </div>
            </div>
            
            {/* Add to Wallet */}
            {tickets && tickets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#0F0F0F]/10">
                <p className="text-sm text-[#0F0F0F]/60 mb-3 text-center flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Save to Digital Wallet
                </p>
                <WalletButtons 
                  ticket={tickets[0]} 
                  event={event} 
                  className="justify-center"
                />
              </div>
            )}
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
