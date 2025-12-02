import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, User, Phone, Eye, EyeOff, Ticket, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

export function WebAuth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, verifyOTP, resendOTP, resendVerificationEmail, user, otpSent, pendingUser } = useAuth()
  
  const isLogin = location.pathname === '/login'
  const from = location.state?.from || '/profile'

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState('credentials')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    otp: '',
  })

  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '' })

  // Show success/error message from redirect
  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message)
    }
    if (location.state?.error) {
      setError(location.state.error)
    }
  }, [location.state])

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true })
    }
  }, [user, navigate, from])

  // Check password strength
  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength({ score: 0, feedback: '' })
      return
    }

    let score = 0
    const feedback = []

    if (formData.password.length >= 8) score++
    else feedback.push('8+ characters')

    if (/[A-Z]/.test(formData.password)) score++
    else feedback.push('uppercase')

    if (/[a-z]/.test(formData.password)) score++
    else feedback.push('lowercase')

    if (/[0-9]/.test(formData.password)) score++
    else feedback.push('number')

    if (/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) score++
    else feedback.push('special char')

    setPasswordStrength({
      score,
      feedback: feedback.length > 0 ? `Need: ${feedback.join(', ')}` : 'Strong password!'
    })
  }, [formData.password])

  const handleInputChange = (e) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
    setError('')
  }

  const handleResendVerification = async () => {
    setError('')
    setLoading(true)
    try {
      const emailToResend = unverifiedEmail || signupEmail
      const result = await resendVerificationEmail(emailToResend)
      setSuccess(result.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (step === 'otp') {
        const phone = pendingUser?.user_metadata?.phone
        await verifyOTP(phone, formData.otp)
        navigate(from, { replace: true })
        return
      }

      if (isLogin) {
        const result = await signIn(formData.email, formData.password)
        
        if (result.emailNotVerified) {
          setUnverifiedEmail(result.email)
          setStep('email-not-verified')
          return
        }
        
        if (result.requiresOTP) {
          setStep('otp')
          setSuccess('OTP sent to your phone')
        } else {
          navigate(from, { replace: true })
        }
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match')
        }

        const result = await signUp(formData.email, formData.password, formData.name, formData.phone)
        setSignupEmail(result.email)
        setStep('verify-email')
        setSuccess(result.message)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError('')
    setLoading(true)
    try {
      await resendOTP()
      setSuccess('New OTP sent!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Email Not Verified Screen (for login attempt with unverified email)
  if (step === 'email-not-verified') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F4F6FA]">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#2969FF] rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-semibold text-[#0F0F0F]">Ticketrack</span>
          </div>

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">Email Not Verified</h2>
              <p className="text-[#0F0F0F]/60 mb-6">
                Your email <strong>{unverifiedEmail}</strong> hasn't been verified yet. 
                Please check your inbox for the verification link, or request a new one.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{success}</span>
                </div>
              )}

              <Button
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6 mb-4"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setStep('credentials')
                  setUnverifiedEmail('')
                  setError('')
                  setSuccess('')
                }}
                className="w-full rounded-xl border-[#0F0F0F]/10"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Verify Email Screen (after signup)
  if (step === 'verify-email') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F4F6FA]">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#2969FF] rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-semibold text-[#0F0F0F]">Ticketrack</span>
          </div>

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-[#2969FF]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0F0F0F] mb-2">Check Your Email</h2>
              <p className="text-[#0F0F0F]/60 mb-6">
                We've sent a verification link to <strong>{signupEmail || formData.email}</strong>. 
                Please click the link to verify your account.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{success}</span>
                </div>
              )}

              <p className="text-sm text-[#0F0F0F]/40 mb-6">
                Didn't receive the email? Check your spam folder or click below to resend.
              </p>

              <Button
                onClick={handleResendVerification}
                disabled={loading}
                variant="outline"
                className="w-full rounded-xl border-[#0F0F0F]/10 mb-4"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/login')}
                className="w-full rounded-xl border-[#0F0F0F]/10"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // OTP Verification Screen
  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F4F6FA]">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#2969FF] rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-semibold text-[#0F0F0F]">Ticketrack</span>
          </div>

          <Card className="border-[#0F0F0F]/10 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl text-[#0F0F0F] text-center">
                Verify Your Phone
              </CardTitle>
              <p className="text-center text-[#0F0F0F]/60 mt-2">
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

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={formData.otp}
                    onChange={handleInputChange}
                    className="text-center text-2xl tracking-widest rounded-xl border-[#0F0F0F]/10"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || formData.otp.length !== 6}
                  className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-sm text-[#2969FF] hover:underline"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials')
                      setFormData(prev => ({ ...prev, otp: '' }))
                    }}
                    className="text-sm text-[#0F0F0F]/60 hover:underline"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main Login/Signup Form
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F4F6FA]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-[#2969FF] rounded-xl flex items-center justify-center">
            <Ticket className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-semibold text-[#0F0F0F]">Ticketrack</span>
        </div>

        <Card className="border-[#0F0F0F]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0F0F0F] text-center">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <p className="text-center text-[#0F0F0F]/60 mt-2">
              {isLogin 
                ? 'Sign in to access your tickets and more' 
                : 'Sign up to start booking amazing events'}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                    <Input
                      id="name"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10 rounded-xl border-[#0F0F0F]/10"
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10 rounded-xl border-[#0F0F0F]/10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+234 801 234 5678"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="pl-10 rounded-xl border-[#0F0F0F]/10"
                      required
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-xs text-[#0F0F0F]/40">
                    Include country code (e.g., +234 for Nigeria)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 rounded-xl border-[#0F0F0F]/10"
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F0F0F]/40 hover:text-[#0F0F0F]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {!isLogin && formData.password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i <= passwordStrength.score
                              ? passwordStrength.score <= 2
                                ? 'bg-red-500'
                                : passwordStrength.score <= 4
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                              : 'bg-[#0F0F0F]/10'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength.score <= 2
                        ? 'text-red-500'
                        : passwordStrength.score <= 4
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>
                      {passwordStrength.feedback}
                    </p>
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="pl-10 rounded-xl border-[#0F0F0F]/10"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>
              )}

              {isLogin && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-sm text-[#2969FF] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-[#0F0F0F]/60">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => navigate(isLogin ? '/signup' : '/login')}
                  className="text-[#2969FF] hover:underline"
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-[#0F0F0F]/40 text-center mt-6">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-[#2969FF] hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-[#2969FF] hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}
