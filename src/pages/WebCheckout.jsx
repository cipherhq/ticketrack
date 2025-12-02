import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CreditCard, Building2, Smartphone, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export function WebCheckout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedTickets, totalAmount } = location.state || { selectedTickets: {}, totalAmount: 0 }

  const [paymentMethod, setPaymentMethod] = useState('card')
  const [formData, setFormData] = useState({ email: '', phone: '', cardNumber: '', expiryDate: '', cvv: '', cardName: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/payment-success')
  }

  const serviceFee = totalAmount * 0.03
  const finalTotal = totalAmount + serviceFee

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[#0F0F0F] mb-2">Checkout</h1>
        <p className="text-[#0F0F0F]/60">Complete your ticket purchase</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Contact Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                <p className="text-sm text-[#0F0F0F]/60">Tickets will be sent to this email</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="+234 801 234 5678" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Payment Method</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[{ id: 'card', icon: CreditCard, label: 'Card' }, { id: 'bank', icon: Building2, label: 'Bank' }, { id: 'ussd', icon: Smartphone, label: 'USSD' }].map(({ id, icon: Icon, label }) => (
                  <button key={id} type="button" onClick={() => setPaymentMethod(id)} className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === id ? 'border-[#2969FF] bg-[#2969FF]/5' : 'border-[#0F0F0F]/10'}`}>
                    <Icon className={`w-6 h-6 ${paymentMethod === id ? 'text-[#2969FF]' : 'text-[#0F0F0F]/60'}`} />
                    <span className={`text-sm ${paymentMethod === id ? 'text-[#2969FF]' : 'text-[#0F0F0F]/60'}`}>{label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'card' && (
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input id="cardNumber" placeholder="1234 5678 9012 3456" value={formData.cardNumber} onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input id="expiryDate" placeholder="MM/YY" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" value={formData.cvv} onChange={(e) => setFormData({ ...formData, cvv: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" maxLength={3} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardName">Cardholder Name</Label>
                    <Input id="cardName" placeholder="Name on card" value={formData.cardName} onChange={(e) => setFormData({ ...formData, cardName: e.target.value })} className="rounded-xl border-[#0F0F0F]/10" required />
                  </div>
                </form>
              )}

              {paymentMethod === 'bank' && (
                <div className="p-4 bg-[#F4F6FA] rounded-xl">
                  <p className="font-medium text-[#0F0F0F] mb-2">Bank Transfer Details</p>
                  <p className="text-sm text-[#0F0F0F]/60">You'll receive account details to complete your payment after clicking "Pay Now"</p>
                </div>
              )}

              {paymentMethod === 'ussd' && (
                <div className="p-4 bg-[#F4F6FA] rounded-xl">
                  <p className="font-medium text-[#0F0F0F] mb-2">USSD Payment</p>
                  <p className="text-sm text-[#0F0F0F]/60">You'll receive a USSD code to dial from your phone after clicking "Pay Now"</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 p-4 bg-[#2969FF]/5 border border-[#2969FF]/20 rounded-xl">
            <Lock className="w-5 h-5 text-[#2969FF]" />
            <p className="text-sm text-[#0F0F0F]/80">Your payment information is secure and encrypted</p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardHeader><CardTitle className="text-[#0F0F0F]">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-[#0F0F0F] mb-2">Lagos Tech Summit 2024</h3>
                <p className="text-sm text-[#0F0F0F]/60">December 15, 2024</p>
                <p className="text-sm text-[#0F0F0F]/60">Eko Convention Center</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="text-[#0F0F0F]/60">Subtotal</span><span className="text-[#0F0F0F]">₦{totalAmount.toLocaleString()}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-[#0F0F0F]/60">Service Fee (3%)</span><span className="text-[#0F0F0F]">₦{serviceFee.toLocaleString()}</span></div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0F0F0F]">Total</span>
                <span className="text-2xl font-bold text-[#2969FF]">₦{finalTotal.toLocaleString()}</span>
              </div>

              <Button onClick={handleSubmit} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6">
                Pay ₦{finalTotal.toLocaleString()}
              </Button>

              <p className="text-xs text-[#0F0F0F]/60 text-center">
                By completing this purchase, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
