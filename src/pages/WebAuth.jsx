import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, Ticket, AlertCircle, CheckCircle2, Loader2, RefreshCw, ArrowLeft, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PhoneInput, COUNTRIES } from '@/components/ui/phone-input'
import { useAuth } from '@/contexts/AuthContext'

export function WebAuth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, sendOTP, verifyOTP, resendOTP, resendVerificationEmail, user, pendingUser } = useAuth()
  
  const isLogin = location.pathname === '/login'
  const from = location.state?.from || '/profile'

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState(isLogin ? 'credentials' : 'country-selection')
  const [loginMethod, setLoginMethod] = useState("email")
  const showPhoneLogin = true // Twilio Verify enabled // "email" or "phone"
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    otp: '',
    countryCode: '',
  })

  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '' })

  // Reset step when switching between login and signup
  useEffect(() => {
    setStep(isLogin ? 'credentials' : 'country-selection')
    setError('')
    setSuccess('')
  }, [isLogin])

  useEffect(() => {
    if (location.state?.message) setSuccess(location.state.message)
    if (location.state?.error) setError(location.state.error)
  }, [location.state])

  useEffect(() => {
    if (user) navigate(from, { replace: true, state: location.state })
  }, [user, navigate, from])

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

  const handlePhoneChange = (value) => {
    setFormData(prev => ({ ...prev, phone: value }))
    setError('')
  }

  const handleCountrySelect = (countryCode) => {
    setFormData(prev => ({ ...prev, countryCode, phone: '' }))
    setStep('credentials')
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
        const phone = loginMethod === "phone" ? formData.phone : pendingUser?.user_metadata?.phone
        const result = await verifyOTP(phone, formData.otp)
        console.log('verifyOTP result:', result)
        
        // Check if this is a new user who needs to register
        if (result.isNewUser) {
          setError('No account found with this phone number. Please sign up first.')
          setStep('credentials')
          return
        }
        
        // Wait a moment for auth state to update
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Navigate to profile/destination
        navigate(from, { replace: true, state: location.state })
        return
      }

      if (isLogin) {
        if (loginMethod === "phone") {
          // Phone login - send OTP
          await sendOTP(formData.phone)
          setStep("otp")
          setSuccess("OTP sent to your phone")
        } else {
          // Email login
          const result = await signIn(formData.email, formData.password)
          
          if (result.emailNotVerified) {
            setUnverifiedEmail(result.email)
            setStep("email-not-verified")
            return
          }
          
          if (result.requiresOTP) {
            setStep("otp")
            setSuccess("OTP sent to your phone")
          } else {
            navigate(from, { replace: true, state: location.state })
          }
        }
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match')
        }

        if (!formData.countryCode) {
          throw new Error('Please select your country')
        }

        const result = await signUp(
          formData.email, 
          formData.password, 
          formData.firstName, 
          formData.lastName, 
          formData.phone,
          formData.countryCode
        )
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

  const getSelectedCountryName = () => {
    const country = COUNTRIES.find(c => c.code === formData.countryCode)
    return country ? `${country.flag} ${country.name}` : ''
  }

  // Country Selection Screen (Signup only)
  if (step === 'country-selection') {
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
              <div className="w-16 h-16 bg-[#2969FF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-[#2969FF]" />
              </div>
              <CardTitle className="text-2xl text-[#0F0F0F] text-center">Where are you located?</CardTitle>
              <p className="text-center text-[#0F0F0F]/60 mt-2">
                This sets your event currency and cannot be changed later
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country.code)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-[#0F0F0F]/10 hover:border-[#2969FF] hover:bg-[#2969FF]/5 transition-all"
                  >
                    <span className="text-4xl">{country.flag}</span>
                    <span className="text-sm font-medium text-[#0F0F0F]">{country.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-[#0F0F0F]/60">
                  Already have an account?{' '}
                  <button onClick={() => navigate('/login')} className="text-[#2969FF] hover:underline">
                    Sign In
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

  // Email Not Verified Screen
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
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><RefreshCw className="w-5 h-5 mr-2" />Resend Verification Email</>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => { setStep('credentials'); setUnverifiedEmail(''); setError(''); setSuccess('') }}
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

  // Verify Email Screen
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
                Didn't receive the email? Check your spam folder or click below.
              </p>

              <Button
                onClick={handleResendVerification}
                disabled={loading}
                variant="outline"
                className="w-full rounded-xl border-[#0F0F0F]/10 mb-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><RefreshCw className="w-5 h-5 mr-2" />Resend Verification Email</>
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

  // OTP Screen
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
              <CardTitle className="text-2xl text-[#0F0F0F] text-center">Verify Your Phone</CardTitle>
              <p className="text-center text-[#0F0F0F]/60 mt-2">Enter the 6-digit code sent to your phone</p>
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
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
                </Button>

                <div className="text-center">
                  <button type="button" onClick={handleResendOTP} disabled={loading} className="text-sm text-[#2969FF] hover:underline">
                    Resend Code
                  </button>
                </div>

                <div className="text-center">
                  <button type="button" onClick={() => { setStep('credentials'); setFormData(prev => ({ ...prev, otp: '' })) }} className="text-sm text-[#0F0F0F]/60 hover:underline">
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
              {isLogin ? 'Sign in to access your tickets and more' : 'Sign up to start booking amazing events'}
            </p>
          </CardHeader>
          <CardContent>
            {/* Show selected country for signup */}
            {!isLogin && formData.countryCode && (
              <div className="mb-4 p-3 bg-[#F4F6FA] rounded-xl flex items-center justify-between">
                <span className="text-sm text-[#0F0F0F]">
                  <span className="text-[#0F0F0F]/60">Country: </span>
                  {getSelectedCountryName()}
                </span>
                <button
                  type="button"
                  onClick={() => setStep('country-selection')}
                  className="text-sm text-[#2969FF] hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Change
                </button>
              </div>
            )}

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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="pl-10 rounded-xl border-[#0F0F0F]/10"
                        required
                        autoComplete="off-given-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="rounded-xl border-[#0F0F0F]/10"
                      required
                      autoComplete="off-family-name"
                    />
                  </div>
                </div>
              )}


              {/* Login Method Toggle - Only show for login */}
              {isLogin && showPhoneLogin && (
                <div className="flex rounded-xl bg-[#F4F6FA] p-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setLoginMethod("email")}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      loginMethod === "email"
                        ? "bg-white text-[#0F0F0F] shadow-sm"
                        : "text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
                    }`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod("phone")}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                      loginMethod === "phone"
                        ? "bg-white text-[#0F0F0F] shadow-sm"
                        : "text-[#0F0F0F]/60 hover:text-[#0F0F0F]"
                    }`}
                  >
                    Phone
                  </button>
                </div>
              )}
              {/* Email input - show for signup OR email login */}
              {(!isLogin || loginMethod === "email") && (
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
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                </div>
              </div>
              )}

              {/* Phone input for login with phone */}
              {isLogin && loginMethod === "phone" && (
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <PhoneInput
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  onCountryChange={(code) => setFormData(prev => ({ ...prev, countryCode: code }))}
                  required
                />
              </div>
              )}

              {!isLogin && (
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onCountryChange={(code) => setFormData(prev => ({ ...prev, countryCode: code }))}
                    lockedCountry={formData.countryCode}
                    required
                  />
                </div>
              )}


              {/* Password - show for signup OR email login */}
              {(!isLogin || loginMethod === "email") && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 rounded-xl border-[#0F0F0F]/10"
                    required
                    autoComplete="nope"
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
                              ? passwordStrength.score <= 2 ? "bg-red-500" : passwordStrength.score <= 4 ? "bg-yellow-500" : "bg-green-500"
                              : "bg-[#0F0F0F]/10"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${passwordStrength.score <= 2 ? "text-red-500" : passwordStrength.score <= 4 ? "text-yellow-600" : "text-green-600"}`}>
                      {passwordStrength.feedback}
                    </p>
                  </div>
                )}
              </div>
              )}

              {/* Confirm Password - signup only */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0F0F0F]/40" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="pl-10 rounded-xl border-[#0F0F0F]/10"
                      required
                      autoComplete="new-password-off"
                    />
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>
              )}

              {/* Forgot password link - email login only */}
              {isLogin && loginMethod === "email" && (
                <div className="flex items-center justify-end">
                  <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm text-[#2969FF] hover:underline">
                    Forgot Password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl py-6"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-[#0F0F0F]/60">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => navigate(isLogin ? "/signup" : "/login")} className="text-[#2969FF] hover:underline">
                  {isLogin ? "Sign Up" : "Sign In"}
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
