import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

export function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from the URL (contains access_token, etc.)
        const hashParams = new URLSearchParams(location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const errorCode = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        // Check for error in URL
        if (errorCode) {
          console.error('Auth callback error:', errorCode, errorDescription)
          throw new Error(errorDescription || 'Verification failed')
        }

        // If we have tokens in the hash, set the session explicitly
        if (accessToken && refreshToken) {
          console.log('Setting session from URL tokens...')
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          
          if (error) {
            console.error('Error setting session:', error)
            throw error
          }
          
          if (data.session) {
            console.log('Session set successfully')
            setStatus('success')
            setMessage('Your email has been verified successfully!')
            setTimeout(() => navigate('/', { replace: true }), 2000)
            return
          }
        }

        // Fallback: Try to get existing session
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          throw error
        }
        
        if (data.session) {
          console.log('Existing session found')
          setStatus('success')
          setMessage('Welcome back!')
          setTimeout(() => navigate('/', { replace: true }), 2000)
        } else {
          // No session and no tokens - this might be an expired or invalid link
          console.warn('No session found and no tokens in URL')
          throw new Error('Verification link expired or invalid. Please try signing in again.')
        }
      } catch (error) {
        console.error('Auth callback failed:', error)
        setStatus('error')
        setMessage(error.message || 'Verification failed. Please try again.')
      }
    }

    handleAuthCallback()
  }, [navigate, location])

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
                <p className="text-[#0F0F0F]/60 text-sm mb-6">Redirecting you to the home page...</p>
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
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/login')}
                    className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/')}
                    className="w-full rounded-xl"
                  >
                    Go to Home
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
