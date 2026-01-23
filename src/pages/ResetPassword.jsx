import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { validatePassword } from '@/utils/validation'

export function ResetPassword() {
  const navigate = useNavigate()
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[ResetPassword] Session error:', error)
          setError('Invalid or expired reset link. Please request a new one.')
          setCheckingSession(false)
          return
        }

        if (session) {
          // User has a session (from clicking the reset link)
          console.log('[ResetPassword] Valid session found')
          setIsValidSession(true)
        } else {
          // No session - invalid or expired link
          console.log('[ResetPassword] No session found')
          setError('Invalid or expired reset link. Please request a new one.')
        }
      } catch (err) {
        console.error('[ResetPassword] Error checking session:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setCheckingSession(false)
      }
    }

    checkSession()

    // Listen for auth state changes (in case the recovery link triggers an event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] Auth state change:', event)
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true)
        setCheckingSession(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      setError(passwordValidation.error)
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      
      if (error) {
        console.error('[ResetPassword] Update error:', error)
        if (error.message.includes('same')) {
          setError('New password must be different from your current password')
        } else {
          setError(error.message || 'Failed to update password')
        }
        return
      }

      console.log('[ResetPassword] Password updated successfully')
      setSuccess(true)
      
      // Sign out after password change so they log in fresh
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[ResetPassword] Exception:', err)
      setError('Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-[#0F0F0F]/60">Verifying your reset link...</p>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">
                Password Updated!
              </h2>
              <p className="text-[#0F0F0F]/60 mb-6">
                Your password has been successfully updated. You can now log in with your new password.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Invalid/expired link state
  if (!isValidSession && error) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">
                Link Expired
              </h2>
              <p className="text-[#0F0F0F]/60 mb-6">
                {error}
              </p>
              <Button
                onClick={() => navigate('/forgot-password')}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                Request New Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Reset password form
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0F0F0F]">Set New Password</CardTitle>
            <p className="text-[#0F0F0F]/60 mt-2">
              Enter your new password below
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 rounded-xl border-[#0F0F0F]/10"
                    required
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-[#0F0F0F]/50">
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 rounded-xl border-[#0F0F0F]/10"
                    required
                    autoComplete="new-password"
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
