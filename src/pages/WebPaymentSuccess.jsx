import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WebPaymentSuccess() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-[#2969FF]/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-[#2969FF]" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[#0F0F0F]">Payment Successful!</h1>
          <p className="text-[#0F0F0F]/60">
            Your tickets have been purchased successfully. You'll receive a confirmation email with your ticket details shortly.
          </p>
        </div>

        <div className="bg-[#F4F6FA] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[#0F0F0F]/60">Order ID</span>
            <span className="font-medium text-[#0F0F0F]">#TKT-{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#0F0F0F]/60">Status</span>
            <span className="px-3 py-1 bg-[#2969FF]/10 text-[#2969FF] rounded-full text-sm font-medium">Confirmed</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#0F0F0F]/60">Email sent to</span>
            <span className="text-[#0F0F0F] text-sm">your@email.com</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={() => navigate('/tickets')} className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl h-12">
            View My Tickets
          </Button>
          <Button onClick={() => navigate('/events')} variant="outline" className="w-full border-[#0F0F0F]/10 rounded-xl h-12">
            Browse More Events
          </Button>
        </div>

        <p className="text-sm text-[#0F0F0F]/40">You can access your tickets anytime from your account</p>
      </div>
    </div>
  )
}
