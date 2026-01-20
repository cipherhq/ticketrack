import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

export function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) throw error
        
        if (data.session) {
          setStatus('success')
          setMessage('Your email has been verified successfully!')
          // Wait 3 seconds to show the success message, then redirect to profile
          setTimeout(() => navigate('/profile', { replace: true }), 3000)
        } else {
          throw new Error('No session found')
        }
      } catch (error) {
        setStatus('error')
        setMessage('Verification failed. Please try again.')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Logo className="h-12" />
        </div>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardContent className="p-8 text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-[#2969FF] mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">Verifying Your Email</h2>
                <p className="text-[#0F0F0F]/60">Please wait while we verify your email address...</p>
              </>
            )}
            {status === 'success' && (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">Email Verified!</h2>
                <p className="text-[#0F0F0F] font-medium mb-4">{message}</p>
                <p className="text-[#0F0F0F]/60 text-sm mb-6">Redirecting you to your profile...</p>
                <div className="flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#2969FF]" />
                </div>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">Verification Failed</h2>
                <p className="text-[#0F0F0F] font-medium mb-6">{message}</p>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                >
                  Back to Login
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
