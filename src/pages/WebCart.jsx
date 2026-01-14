import { formatPrice } from '@/config/currencies'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingCart, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/contexts/CartContext'

export function WebCart() {
  const navigate = useNavigate()
  const {
    items: cartItems,
    itemCount,
    subtotal,
    serviceFee,
    processingFee,
    platformFee,
    total,
    loadingFees,
    updateQuantity,
    removeItem
  } = useCart()

  // Get currency from first cart item (all items should be same currency for checkout to work)
  const cartCurrency = cartItems.length > 0 ? cartItems[0].currency : null

  return (
    <div className="min-h-screen bg-[#F4F6FA] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0F0F0F] mb-2">Shopping Cart</h1>
          <p className="text-[#0F0F0F]/60">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart</p>
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-[#F4F6FA] rounded-full flex items-center justify-center">
                <ShoppingCart className="w-10 h-10 text-[#0F0F0F]/40" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-[#0F0F0F] mb-2">Your cart is empty</h2>
            <p className="text-[#0F0F0F]/60 mb-6">Browse events and add tickets to your cart</p>
            <Button onClick={() => navigate('/events')} className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12 px-8">Browse Events</Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-6">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-xl bg-[#F4F6FA] flex-shrink-0 overflow-hidden">
                      <img src={item.eventImage} alt={item.eventName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#0F0F0F] mb-1 truncate">{item.eventName}</h3>
                      <p className="text-sm text-[#0F0F0F]/60 mb-1">{item.eventDate}</p>
                      <p className="text-sm text-[#0F0F0F]/60 mb-2">{item.eventLocation}</p>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F4F6FA] rounded-lg text-sm text-[#0F0F0F]">{item.ticketType}</div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button onClick={() => removeItem(item.id)} className="text-[#0F0F0F]/40 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                      <div className="text-right">
                        <div className="font-semibold text-[#0F0F0F] mb-3">{formatPrice(item.price * item.quantity, item.currency)}</div>
                        <div className="flex items-center gap-2 bg-[#F4F6FA] rounded-lg p-1">
                          <button onClick={() => updateQuantity(item.id, -1)} disabled={item.quantity <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors disabled:opacity-40"><Minus className="w-4 h-4" /></button>
                          <span className="w-8 text-center font-medium text-[#0F0F0F]">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 sticky top-24">
                <h2 className="text-xl font-semibold text-[#0F0F0F] mb-6">Order Summary</h2>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-[#0F0F0F]/60">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal, cartCurrency)}</span>
                  </div>

                  <div className="flex justify-between text-[#0F0F0F]/60">
                    <div className="flex flex-col">
                      <span className="text-sm">Platform Fee</span>
                      <span className="text-xs text-[#0F0F0F]/40">Event hosting & platform features</span>
                    </div>
                    <span>{formatPrice(platformFee, cartCurrency)}</span>
                  </div>

                  <div className="flex justify-between text-[#0F0F0F]/60">
                    <div className="flex flex-col">
                      <span className="text-sm">Processing Fee</span>
                      <span className="text-xs text-[#0F0F0F]/40">Payment provider fees</span>
                    </div>
                    <span>{formatPrice(processingFee, cartCurrency)}</span>
                  </div>

                  <div className="border-t border-[#0F0F0F]/10 pt-4">
                    <div className="flex justify-between font-semibold text-[#0F0F0F]">
                      <span>Total</span>
                      <span>{formatPrice(total, cartCurrency)}</span>
                    </div>
                    {loadingFees && (
                      <p className="text-xs text-[#0F0F0F]/40 mt-1">Calculating fees...</p>
                    )}
                  </div>
                </div>
                <Button onClick={() => navigate('/checkout')} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12">Proceed to Checkout</Button>
                <button onClick={() => navigate('/events')} className="w-full mt-3 text-[#2969FF] hover:text-[#2969FF]/80 transition-colors">Continue Shopping</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
