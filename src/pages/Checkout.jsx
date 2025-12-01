import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatDate, generateOrderNumber } from '../lib/utils'
import { ArrowLeft, Calendar, MapPin, Lock, CreditCard, CheckCircle } from 'lucide-react'

export default function Checkout() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { cart, getTotal, getTotalItems, clearCart } = useCart()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/checkout')
      return
    }

    if (cart.items.length === 0) {
      navigate('/events')
      return
    }

    // Pre-fill with user data
    if (profile) {
      const names = (profile.full_name || '').split(' ')
      setFormData({
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || '',
        email: user.email || '',
        phone: profile.phone || ''
      })
    } else {
      setFormData(prev => ({ ...prev, email: user.email || '' }))
    }
  }, [user, profile, cart, navigate])

  const event = cart.eventDetails
  const currencySymbol = event?.country?.currency_symbol || '₦'
  const platformFee = Math.round(getTotal() * 0.10)
  const total = getTotal() + platformFee

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const orderNumber = generateOrderNumber()

      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          event_id: event.id,
          status: 'pending',
          subtotal: getTotal(),
          platform_fee: platformFee,
          total_amount: total,
          currency: event.country?.currency || 'NGN',
          buyer_name: `${formData.firstName} ${formData.lastName}`,
          buyer_email: formData.email,
          buyer_phone: formData.phone
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Create order items
      const orderItems = cart.items.map(item => ({
        order_id: order.id,
        ticket_type_id: item.ticketType.id,
        quantity: item.quantity,
        unit_price: item.ticketType.price,
        total_price: item.ticketType.price * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      // For demo, simulate successful payment
      // In production, integrate Paystack here
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          payment_method: 'card',
          payment_reference: `PAY-${Date.now()}`
        })
        .eq('id', order.id)

      if (updateError) throw updateError

      // Create tickets
      const tickets = []
      cart.items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
          tickets.push({
            order_id: order.id,
            event_id: event.id,
            ticket_type_id: item.ticketType.id,
            user_id: user.id,
            ticket_number: `TIX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            qr_code_hash: `QR-${Date.now()}-${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
            attendee_name: `${formData.firstName} ${formData.lastName}`,
            attendee_email: formData.email,
            status: 'valid'
          })
        }
      })

      const { error: ticketsError } = await supabase
        .from('tickets')
        .insert(tickets)

      if (ticketsError) throw ticketsError

      // Clear cart and redirect to success
      clearCart()
      navigate(`/payment-success?order=${orderNumber}`)

    } catch (err) {
      console.error('Checkout error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (!event) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Checkout</h1>
            <p className="text-gray-500">Complete your purchase</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Contact Information */}
              <Card className="p-6 mb-6">
                <h2 className="text-lg font-bold mb-4">Contact Information</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <Input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <Input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </Card>

              {/* Payment Method */}
              <Card className="p-6 mb-6">
                <h2 className="text-lg font-bold mb-4">Payment Method</h2>
                <div className="border-2 border-primary-500 rounded-xl p-4 bg-primary-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Pay with Paystack</p>
                      <p className="text-sm text-gray-500">Card, Bank Transfer, USSD</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-primary-500 ml-auto" />
                  </div>
                </div>
              </Card>

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                <Lock className="w-4 h-4 mr-2" />
                Pay {formatCurrency(total, currencySymbol)}
              </Button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Your payment is secured with 256-bit SSL encryption
              </p>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-lg font-bold mb-4">Order Summary</h2>

              {/* Event */}
              <div className="flex gap-3 pb-4 border-b">
                <div className="w-16 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg overflow-hidden flex-shrink-0">
                  {event?.image_url && (
                    <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-1">{event?.title}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {event?.start_date && formatDate(event.start_date, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="py-4 border-b space-y-2">
                {cart.items.map((item) => (
                  <div key={item.ticketType.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.ticketType.name} × {item.quantity}
                    </span>
                    <span>{formatCurrency(item.ticketType.price * item.quantity, currencySymbol)}</span>
                  </div>
                ))}
              </div>

              {/* Fees */}
              <div className="py-4 border-b space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatCurrency(getTotal(), currencySymbol)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Fee (10%)</span>
                  <span>{formatCurrency(platformFee, currencySymbol)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary-500">{formatCurrency(total, currencySymbol)}</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
