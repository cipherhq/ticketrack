import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CreditCard, Building2, Smartphone, Lock, ArrowLeft, Loader2, Calendar, MapPin, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function WebCheckout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  const { event, selectedTickets, ticketTypes, totalAmount, isFreeEvent } = location.state || {}
  
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [formData, setFormData] = useState({ 
    email: user?.email || '', 
    phone: '', 
    firstName: '',
    lastName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setFormData(prev => ({
            ...prev,
            email: profile.email || user.email || '',
            phone: profile.phone || '',
            firstName: profile.first_name || '',
            lastName: profile.last_name || ''
          }))
        }
      }
    }
    loadProfile()
  }, [user])

  useEffect(() => {
    if (!event || !selectedTickets || Object.keys(selectedTickets).length === 0) {
      navigate('/events')
    }
  }, [event, selectedTickets, navigate])

  if (!event) return null

  const serviceFee = isFreeEvent ? 0 : Math.round(totalAmount * 0.05)
  const finalTotal = isFreeEvent ? 0 : totalAmount + serviceFee

  const ticketSummary = Object.entries(selectedTickets)
    .filter(([_, qty]) => qty > 0)
    .map(([tierId, qty]) => {
      const tier = ticketTypes.find(t => t.id === tierId)
      return { 
        id: tierId,
        name: tier?.name || 'Ticket', 
        quantity: qty, 
        price: isFreeEvent ? 0 : (tier?.price || 0), 
        subtotal: isFreeEvent ? 0 : (tier?.price || 0) * qty 
      }
    })

  const totalTicketCount = ticketSummary.reduce((sum, t) => sum + t.quantity, 0)

  // Generate unique ticket number
  const generateTicketNumber = (index) => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `TKT${timestamp}${random}${index}`
  }

  // Create tickets in database
  const createTickets = async (orderId) => {
    const ticketsToCreate = []
    
    for (const item of ticketSummary) {
      for (let i = 0; i < item.quantity; i++) {
        const ticketNumber = generateTicketNumber(i)
        ticketsToCreate.push({
          order_id: orderId,
          event_id: event.id,
          ticket_type_id: item.id,
          user_id: user.id,
          attendee_email: formData.email,
          attendee_name: `${formData.firstName} ${formData.lastName}`,
          attendee_phone: formData.phone || null,
          ticket_number: ticketNumber,
          qr_code_hash: ticketNumber,
          qr_code_salt: Math.random().toString(36).substring(2, 10),
          status: 'valid'
        })
      }
    }

    console.log('Creating tickets:', ticketsToCreate)
    const { data, error } = await supabase.from('tickets').insert(ticketsToCreate).select()
    
    if (error) {
      console.error('Tickets insert error:', error)
      throw error
    }
    
    return data || ticketsToCreate
  }

  // Handle FREE event registration
  const handleFreeRegistration = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError('Please fill in all required fields')
      return
    }

    if (!user) {
      setError('Please log in to continue')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          order_number: `ORD${Date.now().toString(36).toUpperCase()}`,
          status: 'completed',
          subtotal: 0,
          platform_fee: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          currency: 'NGN',
          payment_method: 'free',
          payment_provider: 'none',
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          paid_at: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order error:', orderError)
        throw orderError
      }

      console.log('Order created:', order)

      // Create order items (optional, don't fail if error)
      const orderItems = ticketSummary.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: 0,
        subtotal: 0
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) {
        console.warn('Order items error (non-fatal):', itemsError)
      }

      // Create tickets
      const tickets = await createTickets(order.id)

      // Navigate to success
      navigate('/payment-success', {
        state: { order, event, tickets, reference: 'FREE' }
      })
    } catch (err) {
      console.error('Registration error:', err)
      setError(err.message || 'An error occurred during registration')
    } finally {
      setLoading(false)
    }
  }

  // Finalize order after Paystack payment (called from callback)
  const finalizePayment = async (orderId, reference) => {
    try {
      // Update order status
      await supabase.from('orders').update({ 
        status: 'completed',
        payment_reference: reference,
        paid_at: new Date().toISOString()
      }).eq('id', orderId)

      // Create tickets
      const tickets = await createTickets(orderId)
      
      return { success: true, tickets }
    } catch (err) {
      console.error('Finalize payment error:', err)
      return { success: false, error: err }
    }
  }

  // Handle Paystack payment
  const handlePaystackPayment = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError('Please fill in all required fields')
      return
    }

    if (!user) {
      setError('Please log in to continue')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          order_number: `ORD${Date.now().toString(36).toUpperCase()}`,
          status: 'pending',
          subtotal: totalAmount,
          platform_fee: serviceFee,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: finalTotal,
          currency: 'NGN',
          payment_method: paymentMethod,
          payment_provider: 'paystack',
          buyer_email: formData.email,
          buyer_phone: formData.phone || null,
          buyer_name: `${formData.firstName} ${formData.lastName}`
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order error:', orderError)
        throw orderError
      }

      console.log('Order created:', order)

      // Create order items (optional)
      const orderItems = ticketSummary.map(ticket => ({
        order_id: order.id,
        ticket_type_id: ticket.id,
        quantity: ticket.quantity,
        unit_price: ticket.price,
        subtotal: ticket.subtotal
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) {
        console.warn('Order items error (non-fatal):', itemsError)
      }

      const paymentRef = `TKT-${order.id.slice(0, 8).toUpperCase()}-${Date.now()}`

      // Initialize Paystack
      if (window.PaystackPop) {
        const handler = window.PaystackPop.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: formData.email,
          amount: finalTotal * 100,
          currency: 'NGN',
          ref: paymentRef,
          metadata: {
            order_id: order.id,
            event_id: event.id,
            event_name: event.title,
            custom_fields: [
              { display_name: "Customer Name", variable_name: "customer_name", value: `${formData.firstName} ${formData.lastName}` }
            ]
          },
          callback: function(response) {
            // Call async function and handle with .then()
            finalizePayment(order.id, response.reference).then(function(result) {
              if (result.success) {
                navigate('/payment-success', { 
                  state: { order, event, tickets: result.tickets, reference: response.reference } 
                })
              } else {
                setError('Payment received but there was an error creating tickets. Please contact support.')
                setLoading(false)
              }
            })
          },
          onClose: function() {
            setLoading(false)
          }
        })
        handler.openIframe()
      } else {
        setError('Payment system not loaded. Please refresh the page.')
        setLoading(false)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err.message || 'An error occurred during checkout')
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button variant="ghost" className="mb-6 text-[#0F0F0F]/60 hover:text-[#0F0F0F]" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-2">{isFreeEvent ? 'Register' : 'Checkout'}</h1>
        <p className="text-[#0F0F0F]/60">{isFreeEvent ? 'Complete your free registration' : 'Complete your ticket purchase'}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" placeholder="John" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" placeholder="Doe" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                <p className="text-sm text-[#0F0F0F]/60">Tickets will be sent to this email</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="+234 801 234 5678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" />
              </div>
            </CardContent>
          </Card>

          {/* Only show payment method for paid events */}
          {!isFreeEvent && (
            <Card className="border-[#0F0F0F]/10 rounded-2xl">
              <CardHeader><CardTitle className="text-[#0F0F0F]">Payment Method</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[{ id: 'card', icon: CreditCard, label: 'Card' }, { id: 'bank', icon: Building2, label: 'Bank' }, { id: 'ussd', icon: Smartphone, label: 'USSD' }].map(({ id, icon: Icon, label }) => (
                    <button key={id} type="button" onClick={() => setPaymentMethod(id)} className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === id ? 'border-[#2969FF] bg-[#2969FF]/5' : 'border-[#0F0F0F]/10 hover:border-[#0F0F0F]/20'}`}>
                      <Icon className={`w-6 h-6 ${paymentMethod === id ? 'text-[#2969FF]' : 'text-[#0F0F0F]/60'}`} />
                      <span className={`text-sm ${paymentMethod === id ? 'text-[#2969FF]' : 'text-[#0F0F0F]/60'}`}>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-4 bg-[#F4F6FA] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-[#2969FF]" />
                    <p className="font-medium text-[#0F0F0F]">Secure Payment via Paystack</p>
                  </div>
                  <p className="text-sm text-[#0F0F0F]/60">
                    {paymentMethod === 'card' && 'You will be redirected to enter your card details securely.'}
                    {paymentMethod === 'bank' && 'You will receive bank transfer details to complete payment.'}
                    {paymentMethod === 'ussd' && 'You will receive a USSD code to dial from your phone.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show free event info */}
          {isFreeEvent && (
            <Card className="border-green-200 bg-green-50/50 rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F0F0F]">Free Event</h3>
                    <p className="text-sm text-[#0F0F0F]/60">No payment required - just fill in your details to register</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F4F6FA] flex-shrink-0">
                  <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0F0F0F] line-clamp-2">{event.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 mt-1"><Calendar className="w-3 h-3" /><span>{formatDate(event.start_date)}</span></div>
                  <div className="flex items-center gap-1 text-xs text-[#0F0F0F]/60 mt-1"><MapPin className="w-3 h-3" /><span>{event.venue_name}</span></div>
                </div>
              </div>

              {isFreeEvent && (
                <Badge className="bg-green-100 text-green-700 border-0 w-full justify-center py-2">
                  Free Event
                </Badge>
              )}

              <Separator />

              <div className="space-y-3">
                {ticketSummary.map((ticket, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-[#0F0F0F]/70">{ticket.name} × {ticket.quantity}</span>
                    <span className="text-[#0F0F0F]">{isFreeEvent ? 'Free' : `₦${ticket.subtotal.toLocaleString()}`}</span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#0F0F0F]/60">Subtotal ({totalTicketCount} tickets)</span>
                  <span className="text-[#0F0F0F]">{isFreeEvent ? 'Free' : `₦${totalAmount.toLocaleString()}`}</span>
                </div>
                {!isFreeEvent && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#0F0F0F]/60">Service Fee</span>
                    <span className="text-[#0F0F0F]">₦{serviceFee.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-[#0F0F0F]">Total</span>
                  <span className="text-[#2969FF]">{isFreeEvent ? 'Free' : `₦${finalTotal.toLocaleString()}`}</span>
                </div>
              </div>

              <Button 
                className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6 text-lg" 
                onClick={isFreeEvent ? handleFreeRegistration : handlePaystackPayment} 
                disabled={loading || !formData.email || !formData.firstName || !formData.lastName}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</>
                ) : isFreeEvent ? (
                  <><CheckCircle className="w-5 h-5 mr-2" />Complete Registration</>
                ) : (
                  <><Lock className="w-5 h-5 mr-2" />Pay ₦{finalTotal.toLocaleString()}</>
                )}
              </Button>

              <p className="text-xs text-center text-[#0F0F0F]/40">By {isFreeEvent ? 'registering' : 'purchasing'}, you agree to our Terms of Service</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
