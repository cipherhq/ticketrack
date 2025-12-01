import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatDate } from '../lib/utils'
import { Trash2, Minus, Plus, Calendar, MapPin, ShoppingCart, ArrowLeft } from 'lucide-react'

export default function Cart() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cart, updateQuantity, removeFromCart, clearCart, getTotal, getTotalItems } = useCart()

  const handleCheckout = () => {
    if (!user) {
      navigate('/login?redirect=/checkout')
      return
    }
    navigate('/checkout')
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-12 h-12 text-gray-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-700">Your Cart is Empty</h1>
          <p className="text-gray-500 mt-2">Looks like you haven't added any tickets yet</p>
          <Link to="/events">
            <Button className="mt-6" size="lg">Browse Events</Button>
          </Link>
        </div>
      </div>
    )
  }

  const event = cart.eventDetails
  const currencySymbol = event?.country?.currency_symbol || '₦'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Your Cart</h1>
            <p className="text-gray-500">{getTotalItems()} item(s)</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {/* Event Info */}
            <Card className="p-4 mb-4">
              <div className="flex gap-4">
                <div className="w-24 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg overflow-hidden flex-shrink-0">
                  {event?.image_url && (
                    <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/events/${event?.id}`} className="font-semibold text-gray-900 hover:text-primary-500 line-clamp-1">
                    {event?.title}
                  </Link>
                  <div className="flex items-center gap-4 text-gray-500 text-sm mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {event?.start_date && formatDate(event.start_date, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {event?.city}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tickets */}
            <Card className="divide-y">
              {cart.items.map((item) => (
                <div key={item.ticketType.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.ticketType.name}</h3>
                      {item.ticketType.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.ticketType.description}</p>
                      )}
                      <p className="text-primary-500 font-semibold mt-2">
                        {formatCurrency(item.ticketType.price, currencySymbol)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.ticketType.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.ticketType.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => removeFromCart(item.ticketType.id)}
                      className="text-red-500 text-sm flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                    <p className="font-bold">
                      {formatCurrency(item.ticketType.price * item.quantity, currencySymbol)}
                    </p>
                  </div>
                </div>
              ))}
            </Card>

            {/* Clear Cart */}
            <div className="mt-4 text-right">
              <button onClick={clearCart} className="text-red-500 text-sm hover:underline">
                Clear Cart
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-lg font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                {cart.items.map((item) => (
                  <div key={item.ticketType.id} className="flex justify-between">
                    <span className="text-gray-600">
                      {item.ticketType.name} × {item.quantity}
                    </span>
                    <span>{formatCurrency(item.ticketType.price * item.quantity, currencySymbol)}</span>
                  </div>
                ))}
              </div>

              <hr className="my-4" />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary-500">{formatCurrency(getTotal(), currencySymbol)}</span>
              </div>

              <Button onClick={handleCheckout} className="w-full mt-6" size="lg">
                {user ? 'Proceed to Checkout' : 'Login to Checkout'}
              </Button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Secure checkout powered by Paystack
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
