import { getOrganizerFees, DEFAULT_FEES, calculateFees } from '@/config/fees'
import { getPaymentProvider, getPaymentProviderWithFallback, getProviderInfo, initStripeCheckout, initPayPalCheckout, initFlutterwaveCheckout, getActiveGateway } from '@/config/payments'
import { formatPrice, getDefaultCurrency } from '@/config/currencies'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CreditCard, Building2, Smartphone, Lock, Loader2, Calendar, MapPin, Clock, Tag, CheckCircle, AlertCircle, User, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { generateTicketPDFBase64 } from '@/utils/ticketGenerator'
import { toast } from 'sonner'

export function WebPaymentLink() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { isEnabledForCurrency } = useFeatureFlags()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)
  const [event, setEvent] = useState(null)
  const [organizer, setOrganizer] = useState(null)
  const [ticketType, setTicketType] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [ticketCode, setTicketCode] = useState(null)

  // Load payment link data
  useEffect(() => {
    loadPaymentLink()
  }, [token])

  const loadPaymentLink = async () => {
    try {
      setLoading(true)
      setError(null)

      // Find order by payment_link_token
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          events!inner(
            id, title, slug, start_date, end_date, venue_name, city, country_code, image_url,
            currency, organizer_id, status,
            organizers(id, user_id, business_name, logo_url, paystack_subaccount_id, paystack_subaccount_status, paystack_subaccount_enabled)
          ),
          order_items(
            id, ticket_type_id, quantity, unit_price, total_price,
            ticket_types(id, name, description, price)
          )
        `)
        .eq('payment_link_token', token)
        .single()

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          setError('Payment link not found or has expired.')
        } else {
          throw orderError
        }
        return
      }

      // Check if already paid
      if (orderData.status === 'completed') {
        setCompleted(true)
        // Get ticket code
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('ticket_code')
          .eq('order_id', orderData.id)
          .single()
        if (ticketData) setTicketCode(ticketData.ticket_code)
      }

      // Check if event is still valid
      if (orderData.events.status !== 'published') {
        setError('This event is no longer available.')
        return
      }

      setOrder(orderData)
      setEvent(orderData.events)
      setOrganizer(orderData.events.organizers)
      setTicketType(orderData.order_items?.[0]?.ticket_types)

      // Determine default payment method
      const currency = orderData.currency || 'USD'
      const defaultProvider = getPaymentProviderWithFallback(currency)
      setPaymentMethod(defaultProvider)

    } catch (err) {
      console.error('Error loading payment link:', err)
      setError(err.message || 'Failed to load payment information.')
    } finally {
      setLoading(false)
    }
  }

  // Finalize payment - create tickets and send confirmation
  const finalizePayment = async (orderId, reference) => {
    try {
      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          paid_at: new Date().toISOString(),
          payment_reference: reference,
        })
        .eq('id', orderId)

      // Create tickets from order items
      const ticketsToCreate = []
      for (const item of order.order_items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketCode = 'TKT' + Date.now().toString(36).toUpperCase() +
            Math.random().toString(36).substring(2, 8).toUpperCase()
          ticketsToCreate.push({
            event_id: event.id,
            ticket_type_id: item.ticket_type_id,
            user_id: null,
            attendee_email: order.buyer_email,
            attendee_name: order.buyer_name,
            attendee_phone: order.buyer_phone || null,
            ticket_code: ticketCode,
            qr_code: ticketCode,
            unit_price: item.unit_price,
            total_price: item.unit_price,
            payment_reference: reference,
            payment_status: 'completed',
            payment_method: 'paystack',
            order_id: orderId,
            status: 'active',
          })
        }
      }

      let createdTickets = []
      if (ticketsToCreate.length > 0) {
        const { data: tickets, error: ticketError } = await supabase
          .from('tickets')
          .insert(ticketsToCreate)
          .select()

        if (ticketError) {
          console.error('Error creating tickets:', ticketError)
          return { success: false }
        }
        createdTickets = tickets

        // Update ticket type sold count
        for (const item of order.order_items) {
          await supabase.rpc('increment_ticket_sold', {
            p_ticket_type_id: item.ticket_type_id,
            p_quantity: item.quantity,
          }).catch(async () => {
            // Fallback: fetch and update
            const { data: ticketType } = await supabase
              .from('ticket_types')
              .select('quantity_sold')
              .eq('id', item.ticket_type_id)
              .single()

            await supabase
              .from('ticket_types')
              .update({ quantity_sold: (ticketType?.quantity_sold || 0) + item.quantity })
              .eq('id', item.ticket_type_id)
          })
        }
      }

      // Send confirmation email
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'ticket_purchase',
            to: order.buyer_email,
            data: {
              attendeeName: order.buyer_name,
              eventTitle: event.title,
              eventDate: event.start_date,
              venueName: event.venue_name,
              city: event.city,
              ticketType: ticketType?.name || 'Ticket',
              quantity: order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 1,
              orderNumber: order.order_number,
              totalAmount: order.total_amount,
              currency: order.currency,
              isFree: false,
              appUrl: window.location.origin,
            },
            eventId: event.id,
            ticketId: createdTickets[0]?.id,
          }
        })
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError)
      }

      return { success: true, tickets: createdTickets }
    } catch (err) {
      console.error('Error finalizing payment:', err)
      return { success: false }
    }
  }

  const handlePayment = async () => {
    if (!order || !event || processing) return

    setProcessing(true)
    try {
      const currency = order.currency
      const totalAmount = order.total_amount

      // Get organizer fees
      const { data: feeData } = await supabase
        .from('organizer_fees')
        .select('*')
        .eq('organizer_id', event.organizer_id)
        .single()

      const fees = feeData || DEFAULT_FEES
      const { platformFee, processingFee, organizerAmount } = calculateFees(totalAmount, fees)

      // Get active payment gateway
      const activeGateway = await getActiveGateway(event.organizer_id)
      const provider = activeGateway?.provider || paymentMethod

      // Update order with fee breakdown
      await supabase
        .from('orders')
        .update({
          platform_fee: platformFee,
          processing_fee: processingFee,
          organizer_amount: organizerAmount,
          payment_method: provider,
        })
        .eq('id', order.id)

      const returnUrl = `${window.location.origin}/payment-success?order_id=${order.id}&from_payment_link=true`
      const metadata = {
        order_id: order.id,
        event_id: event.id,
        buyer_email: order.buyer_email,
        buyer_name: order.buyer_name,
        from_payment_link: 'true',
      }

      // Initialize payment based on provider
      if (provider === 'stripe') {
        await initStripeCheckout({
          orderId: order.id,
          amount: Math.round(totalAmount * 100),
          currency: currency.toLowerCase(),
          customerEmail: order.buyer_email,
          eventTitle: event.title,
          successUrl: returnUrl,
          cancelUrl: window.location.href,
          metadata,
          organizerId: event.organizer_id,
        })
      } else if (provider === 'paypal') {
        await initPayPalCheckout({
          orderId: order.id,
          amount: totalAmount,
          currency,
          description: `Ticket for ${event.title}`,
          returnUrl,
          cancelUrl: window.location.href,
          metadata,
        })
      } else if (provider === 'flutterwave') {
        await initFlutterwaveCheckout({
          orderId: order.id,
          amount: totalAmount,
          currency,
          email: order.buyer_email,
          name: order.buyer_name,
          phone: order.buyer_phone || '',
          eventTitle: event.title,
          redirectUrl: returnUrl,
          metadata,
          organizerId: event.organizer_id,
        })
      } else {
        // Default: Paystack inline payment
        const paymentRef = `PL-${order.id.slice(0, 8).toUpperCase()}-${Date.now()}`

        // Save payment reference to order
        await supabase.from('orders').update({ payment_reference: paymentRef }).eq('id', order.id)

        // Check if organizer has Paystack subaccount
        const useSubaccount =
          organizer?.paystack_subaccount_id &&
          organizer?.paystack_subaccount_status === 'active' &&
          organizer?.paystack_subaccount_enabled === true

        if (window.PaystackPop) {
          const paystackConfig = {
            key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
            email: order.buyer_email,
            amount: Math.round(totalAmount * 100),
            currency: currency,
            ref: paymentRef,
            metadata: {
              order_id: order.id,
              event_id: event.id,
              event_name: event.title,
              from_payment_link: 'true',
              custom_fields: [
                { display_name: 'Customer Name', variable_name: 'customer_name', value: order.buyer_name }
              ]
            },
            callback: (response) => {
              finalizePayment(order.id, response.reference).then((result) => {
                if (result.success) {
                  navigate('/payment-success', {
                    state: { order, event, tickets: result.tickets, reference: response.reference }
                  })
                } else {
                  setError('Payment received but there was an error creating tickets. Please contact support.')
                  setProcessing(false)
                }
              })
            },
            onClose: () => {
              setProcessing(false)
            }
          }

          // Add subaccount if available
          if (useSubaccount && organizer.paystack_subaccount_id) {
            paystackConfig.split_code = organizer.paystack_subaccount_id
          }

          const handler = window.PaystackPop.setup(paystackConfig)
          handler.openIframe()
        } else {
          toast.error('Payment system not loaded. Please refresh the page.')
          setProcessing(false)
        }
      }

    } catch (err) {
      console.error('Payment error:', err)
      toast.error(err.message || 'Failed to process payment. Please try again.')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Link Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Complete!</h1>
            <p className="text-gray-600 mb-4">This payment has already been processed.</p>
            {ticketCode && (
              <p className="text-sm text-gray-500 mb-6">
                Ticket Code: <span className="font-mono font-semibold">{ticketCode}</span>
              </p>
            )}
            <div className="space-y-3">
              <Button onClick={() => navigate(`/events/${event?.slug}`)} className="w-full">
                View Event
              </Button>
              <Button onClick={() => navigate('/tickets')} variant="outline" className="w-full">
                View My Tickets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currency = order?.currency || 'USD'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Event Header */}
        <Card className="mb-6 overflow-hidden">
          {event?.image_url && (
            <div className="h-40 bg-gray-200">
              <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <CardContent className="p-6">
            <h1 className="text-xl font-bold text-gray-900 mb-3">{event?.title}</h1>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(event?.start_date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })}</span>
              </div>
              {event?.venue_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{event.venue_name}{event.city && `, ${event.city}`}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Attendee Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{order?.buyer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-500" />
                <span>{order?.buyer_email}</span>
              </div>
              {order?.buyer_phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{order.buyer_phone}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Ticket Info */}
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{ticketType?.name || 'Ticket'}</p>
                <p className="text-sm text-gray-500">Qty: {order?.order_items?.[0]?.quantity || 1}</p>
              </div>
              <p className="font-semibold">{formatPrice(order?.total_amount || 0, currency)}</p>
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total</span>
              <span className="text-[#2969FF]">{formatPrice(order?.total_amount || 0, currency)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Button */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Lock className="w-4 h-4" />
              <span>Secure payment powered by {getProviderInfo(paymentMethod)?.name || 'Paystack'}</span>
            </div>

            <Button
              onClick={handlePayment}
              disabled={processing}
              className="w-full h-12 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white font-semibold"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Pay {formatPrice(order?.total_amount || 0, currency)}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-gray-400 mt-4">
              By completing this payment, you agree to the event's terms and conditions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
