import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function ForgotPassword() {
  const navigate = useNavigate()
  const { resetPassword, sendOTP, verifyOTP } = useAuth()
  
  const [resetMethod, setResetMethod] = useState('email') // 'email' or 'phone'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('input') // 'input', 'otp', 'new-password', 'submitted'

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setStep('submitted')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneSendOTP = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await sendOTP(phone)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await verifyOTP(phone, otp)
      setStep('new-password')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSetNewPassword = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setStep('submitted')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Success Screen
  if (step === 'submitted') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">
                {resetMethod === 'email' ? 'Check Your Email' : 'Password Updated'}
              </h2>
              <p className="text-[#0F0F0F]/60 mb-6">
                {resetMethod === 'email' 
                  ? "If an account exists with that email, you'll receive password reset instructions."
                  : "Your password has been successfully updated. You can now log in with your new password."
                }
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Set New Password Screen (after phone OTP verified)
  if (step === 'new-password') {
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

              <form onSubmit={handleSetNewPassword} className="space-y-4">
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
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
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
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

  // OTP Verification Screen
  if (step === 'otp') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <button
                onClick={() => setStep('input')}
                className="flex items-center gap-2 text-[#0F0F0F]/60 hover:text-[#0F0F0F] mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <CardTitle className="text-2xl text-[#0F0F0F]">Verify Your Phone</CardTitle>
              <p className="text-[#0F0F0F]/60 mt-2">
                Enter the 6-digit code sent to your phone
              </p>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl tracking-widest rounded-xl border-[#0F0F0F]/10"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handlePhoneSendOTP}
                    disabled={loading}
                    className="text-sm text-[#2969FF] hover:underline"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main Input Screen
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 text-[#0F0F0F]/60 hover:text-[#0F0F0F] mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
            <CardTitle className="text-2xl text-[#0F0F0F]">Reset Password</CardTitle>
            <p className="text-[#0F0F0F]/60 mt-2">
              {resetMethod === 'email' 
                ? "Enter your email and we'll send you reset instructions"
                : "Enter your phone number to verify your identity"
              }
            </p>
          </CardHeader>
          <CardContent>
            {/* Reset Method Toggle */}
            <div className="flex rounded-xl bg-[#F4F6FA] p-1 mb-4">
              <button
                type="button"
                onClick={() => { setResetMethod('email'); setError('') }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  resetMethod === 'email'
                    ? 'bg-white text-[#0F0F0F] shadow-sm'
                    : 'text-[#0F0F0F]/60 hover:text-[#0F0F0F]'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => { setResetMethod('phone'); setError('') }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  resetMethod === 'phone'
                    ? 'bg-white text-[#0F0F0F] shadow-sm'
                    : 'text-[#0F0F0F]/60 hover:text-[#0F0F0F]'
                }`}
              >
                Phone
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {resetMethod === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 rounded-xl border-[#0F0F0F]/10"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePhoneSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Verification Code'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
