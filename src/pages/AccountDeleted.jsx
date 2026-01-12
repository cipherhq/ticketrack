import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'

export function AccountDeleted() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-0 shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-[#0F0F0F] mb-3">
            Account Deleted
          </h1>
          
          <p className="text-[#0F0F0F]/60 mb-6">
            Your account has been successfully deleted. We're sorry to see you go.
          </p>
          
          <p className="text-sm text-[#0F0F0F]/50 mb-8">
            All your personal data has been removed from our system. If you ever want to come back, you're always welcome to create a new account.
          </p>
          
          <Button 
            onClick={() => navigate('/')}
            className="w-full bg-[#2969FF] hover:bg-[#1a4fd8] text-white rounded-xl py-6"
          >
            Return to Homepage
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
