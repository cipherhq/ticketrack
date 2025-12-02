import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

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
          setMessage('Email verified successfully!')
          setTimeout(() => navigate('/login', { replace: true }), 2000)
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
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA]">
      <div className="text-center p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#2969FF] mx-auto mb-4" />
            <p className="text-[#0F0F0F]/60">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-[#0F0F0F] font-medium">{message}</p>
            <p className="text-[#0F0F0F]/60 text-sm mt-2">Redirecting to login...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-[#0F0F0F] font-medium">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 text-[#2969FF] hover:underline"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
