import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, MapPin, Users, Clock, Share2, Heart, Minus, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'

const ticketTiers = [
  { id: '1', name: 'Early Bird', price: 15000, available: 45, total: 100 },
  { id: '2', name: 'Regular', price: 25000, available: 189, total: 300 },
  { id: '3', name: 'VIP', price: 50000, available: 78, total: 100 },
]

export function WebEventDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [selectedTickets, setSelectedTickets] = useState({})
  const [isFavorite, setIsFavorite] = useState(false)

  const updateTicketQuantity = (tierId, delta) => {
    setSelectedTickets(prev => {
      const current = prev[tierId] || 0
      const newQuantity = Math.max(0, current + delta)
      return { ...prev, [tierId]: newQuantity }
    })
  }

  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0)
  const totalAmount = Object.entries(selectedTickets).reduce((sum, [tierId, qty]) => {
    const tier = ticketTiers.find(t => t.id === tierId)
    return sum + (tier?.price || 0) * qty
  }, 0)

  const handleCheckout = () => {
    if (totalTickets > 0) {
      navigate('/checkout', { state: { selectedTickets, totalAmount } })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video rounded-2xl overflow-hidden bg-[#F4F6FA]">
            <ImageWithFallback src="https://source.unsplash.com/1200x600/?tech-conference" alt="Lagos Tech Summit 2024" className="w-full h-full object-cover" />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Badge className="bg-[#2969FF]/10 text-[#2969FF] border-0 rounded-lg mb-3">Technology</Badge>
              <h1 className="text-4xl font-bold text-[#0F0F0F] mb-4">Lagos Tech Summit 2024</h1>
              <div className="flex flex-wrap gap-4 text-[#0F0F0F]/60">
                <div className="flex items-center gap-2"><Calendar className="w-5 h-5" /><span>December 15, 2024</span></div>
                <div className="flex items-center gap-2"><Clock className="w-5 h-5" /><span>10:00 AM - 6:00 PM</span></div>
                <div className="flex items-center gap-2"><MapPin className="w-5 h-5" /><span>Eko Convention Center, Lagos</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setIsFavorite(!isFavorite)} className={`rounded-xl ${isFavorite ? 'text-red-500 border-red-500' : ''}`}>
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500' : ''}`} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl"><Share2 className="w-5 h-5" /></Button>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">About This Event</h2>
            <div className="text-[#0F0F0F]/80 space-y-4">
              <p>Join us for the biggest tech summit in West Africa! The Lagos Tech Summit 2024 brings together industry leaders, innovators, and tech enthusiasts for a day of networking, learning, and inspiration.</p>
              <p>This year's summit features keynote speeches from global tech leaders, panel discussions on emerging technologies, startup showcases, and exclusive networking opportunities.</p>
              <p>What to expect:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Keynote speeches from industry leaders</li>
                <li>Panel discussions and workshops</li>
                <li>Startup pitch competitions</li>
                <li>Networking sessions</li>
                <li>Exhibition area with latest tech products</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Location</h2>
            <Card className="border-[#0F0F0F]/10 rounded-2xl overflow-hidden">
              <div className="aspect-video bg-[#F4F6FA] flex items-center justify-center">
                <MapPin className="w-12 h-12 text-[#0F0F0F]/20" />
              </div>
              <CardContent className="p-6">
                <h3 className="font-semibold text-[#0F0F0F] mb-2">Eko Convention Center</h3>
                <p className="text-[#0F0F0F]/60">Plot 1, Water Corporation Drive, Victoria Island, Lagos</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div>
            <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Organized By</h2>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#2969FF]/10 flex items-center justify-center">
                <Users className="w-8 h-8 text-[#2969FF]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0F0F0F]">Tech Events NG</h3>
                <p className="text-[#0F0F0F]/60">12 events hosted</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="border-[#0F0F0F]/10 rounded-2xl sticky top-24">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-4">Select Tickets</h2>
                <div className="space-y-4">
                  {ticketTiers.map(tier => (
                    <div key={tier.id} className="p-4 border border-[#0F0F0F]/10 rounded-xl space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-[#0F0F0F]">{tier.name}</h3>
                          <p className="text-2xl font-bold text-[#2969FF] mt-1">₦{tier.price.toLocaleString()}</p>
                        </div>
                        <Badge variant="outline" className="border-[#0F0F0F]/20 text-[#0F0F0F]/60 rounded-lg">{tier.available} left</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#0F0F0F]/60">Quantity</span>
                        <div className="flex items-center gap-3">
                          <Button size="icon" variant="outline" onClick={() => updateTicketQuantity(tier.id, -1)} disabled={!selectedTickets[tier.id]} className="w-8 h-8 rounded-lg">
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium text-[#0F0F0F]">{selectedTickets[tier.id] || 0}</span>
                          <Button size="icon" variant="outline" onClick={() => updateTicketQuantity(tier.id, 1)} disabled={(selectedTickets[tier.id] || 0) >= tier.available || (selectedTickets[tier.id] || 0) >= 10} className="w-8 h-8 rounded-lg">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {totalTickets > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[#0F0F0F]/60">Total Tickets</span><span className="text-[#0F0F0F]">{totalTickets}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#0F0F0F]/60">Subtotal</span><span className="text-[#0F0F0F]">₦{totalAmount.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[#0F0F0F]/60">Service Fee</span><span className="text-[#0F0F0F]">₦{(totalAmount * 0.03).toLocaleString()}</span></div>
                    <Separator />
                    <div className="flex items-center justify-between"><span className="font-semibold text-[#0F0F0F]">Total</span><span className="text-2xl font-bold text-[#2969FF]">₦{(totalAmount * 1.03).toLocaleString()}</span></div>
                  </div>
                </>
              )}

              <Button onClick={handleCheckout} disabled={totalTickets === 0} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6">
                {totalTickets === 0 ? 'Select Tickets' : 'Proceed to Checkout'}
              </Button>

              <p className="text-xs text-[#0F0F0F]/60 text-center">
                By proceeding, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
