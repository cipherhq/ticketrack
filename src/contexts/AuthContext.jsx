import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { validateEmail, validatePassword, validatePhone, validateFirstName, validateLastName, validateOTP } from '@/utils/validation'
import { validatePhoneForRegistration, normalizePhone } from '@/lib/phoneValidation'
import { toast } from 'sonner'

const AuthContext = createContext({})

// Session warning time - warn 5 minutes before expiry
const SESSION_WARNING_MINUTES = 5
const SESSION_WARNING_MS = SESSION_WARNING_MINUTES * 60 * 1000

const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in',
  RATE_LIMITED: 'Too many attempts. Please try again later',
  NETWORK_ERROR: 'Network error. Please check your connection',
  UNKNOWN: 'An error occurred. Please try again',
  OTP_EXPIRED: 'OTP has expired. Please request a new one',
  OTP_INVALID: 'Invalid OTP. Please try again',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [otpSent, setOtpSent] = useState(false)
  const [pendingUser, setPendingUser] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sessionWarning, setSessionWarning] = useState(false)
  const hadSessionRef = useRef(false) // Track if user had a session before
  const sessionWarningTimeoutRef = useRef(null) // Timeout for session warning
  const sessionExpiryTimeoutRef = useRef(null) // Timeout for session expiry

  // Clear existing session timers
  const clearSessionTimers = () => {
    if (sessionWarningTimeoutRef.current) {
      clearTimeout(sessionWarningTimeoutRef.current)
      sessionWarningTimeoutRef.current = null
    }
    if (sessionExpiryTimeoutRef.current) {
      clearTimeout(sessionExpiryTimeoutRef.current)
      sessionExpiryTimeoutRef.current = null
    }
  }

  // Set up session expiry warning timers
  const setupSessionTimers = (session) => {
    clearSessionTimers()

    if (!session?.expires_at) return

    const expiresAt = session.expires_at * 1000 // Convert to milliseconds
    const now = Date.now()
    const timeUntilExpiry = expiresAt - now
    const timeUntilWarning = timeUntilExpiry - SESSION_WARNING_MS

    // Set up warning timer (5 minutes before expiry)
    if (timeUntilWarning > 0) {
      sessionWarningTimeoutRef.current = setTimeout(() => {
        setSessionWarning(true)
        toast.warning(
          'Your session will expire in 5 minutes. Click to extend.',
          {
            duration: 60000, // Show for 1 minute
            id: 'session-warning',
            action: {
              label: 'Extend Session',
              onClick: () => extendSession(),
            },
          }
        )
      }, timeUntilWarning)
    } else if (timeUntilExpiry > 60000) {
      // Less than 5 minutes but more than 1 minute - warn immediately
      setSessionWarning(true)
      const minutesLeft = Math.ceil(timeUntilExpiry / 60000)
      toast.warning(
        `Your session will expire in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}. Click to extend.`,
        {
          duration: 30000,
          id: 'session-warning',
          action: {
            label: 'Extend Session',
            onClick: () => extendSession(),
          },
        }
      )
    }
  }

  // Extend/refresh the session
  const extendSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error

      if (data?.session) {
        setSessionWarning(false)
        toast.success('Session extended successfully', { id: 'session-extended' })
        setupSessionTimers(data.session)
      }
    } catch (err) {
      console.error('Failed to extend session:', err)
      toast.error('Failed to extend session. Please log in again.')
    }
  }

  useEffect(() => {
    let mounted = true
    let subscription = null

    const initAuth = async () => {
      try {
        // First try to get the existing session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.warn('Session check failed:', error.message)
          // If session retrieval fails, try to refresh
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.warn('Session refresh failed:', refreshError.message)
            if (mounted) {
              // If user had a session before and now it's gone, session expired
              if (hadSessionRef.current) {
                setSessionExpired(true)
                toast.error('Your session has expired. Please log in again.', {
                  duration: 5000,
                  id: 'session-expired',
                })
              }
              setUser(null)
              setLoading(false)
            }
            return
          }
          if (mounted) {
            if (refreshData?.session?.user) {
              hadSessionRef.current = true
              setupSessionTimers(refreshData.session)
            }
            setUser(refreshData?.session?.user ?? null)
            setLoading(false)
          }
          return
        }

        if (mounted) {
          if (session?.user) {
            hadSessionRef.current = true
            setupSessionTimers(session)
          }
          setUser(session?.user ?? null)
          setLoading(false)
        }
      } catch (err) {
        console.warn('Auth init error:', err)
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    initAuth()

    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event)

        if (mounted) {
          // Track if user had a session
          if (session?.user) {
            hadSessionRef.current = true
          }

          setUser(session?.user ?? null)

          if (session?.user) {
            setPendingUser(null)
            setOtpSent(false)
            setSessionExpired(false)
            setSessionWarning(false)
            setupSessionTimers(session)
          }

          // Handle specific auth events
          switch (event) {
            case 'SIGNED_OUT':
              // Clear session timers
              clearSessionTimers()
              // Clear any cached data
              setUser(null)
              setPendingUser(null)
              setOtpSent(false)
              setSessionWarning(false)
              hadSessionRef.current = false
              break
            case 'TOKEN_REFRESHED':
              console.log('Token refreshed successfully')
              setSessionExpired(false)
              setSessionWarning(false)
              if (session) {
                setupSessionTimers(session)
              }
              break
            case 'USER_UPDATED':
              console.log('User updated')
              break
            case 'INITIAL_SESSION':
              // Initial session loaded
              if (session?.user) {
                hadSessionRef.current = true
                setupSessionTimers(session)
              }
              break
          }
        }
      })
      subscription = data.subscription
    } catch (err) {
      console.warn('Auth listener error:', err)
    }

    // Set up periodic session check (every 5 minutes)
    const sessionCheckInterval = setInterval(async () => {
      if (!hadSessionRef.current) return // Only check if user had a session

      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          // Try to refresh
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

          if (refreshError || !refreshData?.session) {
            // Session is truly expired
            if (hadSessionRef.current && mounted) {
              setSessionExpired(true)
              setUser(null)
              hadSessionRef.current = false
              toast.error('Your session has expired. Please log in again.', {
                duration: 5000,
                id: 'session-expired',
              })
            }
          }
        }
      } catch (err) {
        console.warn('Session check error:', err)
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => {
      mounted = false
      if (subscription) subscription.unsubscribe()
      clearInterval(sessionCheckInterval)
      clearSessionTimers()
    }
  }, [])

  const signUp = useCallback(async (email, password, firstName, lastName, phone, countryCode = 'NG', marketingConsent = false) => {
    const emailResult = validateEmail(email)
    if (!emailResult.valid) throw new Error(emailResult.error)

    const passwordResult = validatePassword(password)
    if (!passwordResult.valid) throw new Error(passwordResult.error)

    const firstNameResult = validateFirstName(firstName)
    if (!firstNameResult.valid) throw new Error(firstNameResult.error)

    const lastNameResult = validateLastName(lastName)
    if (!lastNameResult.valid) throw new Error(lastNameResult.error)

    const phoneResult = validatePhone(phone)
    if (!phoneResult.valid) throw new Error(phoneResult.error)

    try {
      // Format phone number consistently (remove + prefix for storage)
      // This matches the format used in edge functions (formatPhoneNumber)
      let formattedPhoneForStorage = phoneResult.value
      if (formattedPhoneForStorage.startsWith('+')) {
        formattedPhoneForStorage = formattedPhoneForStorage.substring(1)
      }
      
      // Check if phone number is already registered
      const phoneUniqueCheck = await validatePhoneForRegistration(formattedPhoneForStorage)
      if (!phoneUniqueCheck.valid) {
        throw new Error(phoneUniqueCheck.error)
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: emailResult.value,
        password,
        options: {
          data: {
            first_name: firstNameResult.value,
            last_name: lastNameResult.value,
            full_name: `${firstNameResult.value} ${lastNameResult.value}`,
            phone: formattedPhoneForStorage, // Store without + prefix (e.g., "12025579406")
            country_code: countryCode,
            marketing_consent: marketingConsent, // GDPR: Store marketing consent
            marketing_consent_date: marketingConsent ? new Date().toISOString() : null,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (error) {
        console.error('Signup error details:', error)
        console.error('Error status:', error.status)
        console.error('Error message:', error.message)
        
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        
        // Handle SMTP/email configuration errors
        if (error.message?.includes('email') && (error.message?.includes('send') || error.message?.includes('SMTP') || error.message?.includes('mail'))) {
          console.error('Email sending error - likely SMTP configuration issue')
          throw new Error('Unable to send verification email. Please check your email settings or try again later.')
        }
        
        if (error.status === 500 || error.status >= 500) {
          // Check if it's an email-related 500 error
          if (error.message?.toLowerCase().includes('email') || error.message?.toLowerCase().includes('smtp') || error.message?.toLowerCase().includes('mail')) {
            throw new Error('Email service error. Please check your SMTP configuration or try again later.')
          }
          throw new Error('Server error. Please try again in a moment. If the problem persists, contact support.')
        }
        
        // Handle "email already registered" error with special flag
        if (
          error.message?.toLowerCase().includes('already registered') || 
          error.message?.toLowerCase().includes('already exists') ||
          error.message?.toLowerCase().includes('user already registered') ||
          error.message?.includes('User already registered') ||
          error.message?.includes('duplicate key') ||
          error.message?.includes('unique constraint')
        ) {
          const customError = new Error('EMAIL_ALREADY_REGISTERED')
          customError.isEmailExists = true
          customError.userMessage = 'An account with this email already exists.'
          throw customError
        }
        
        if (error.message) {
          throw new Error(error.message)
        }
        throw new Error(AUTH_ERRORS.UNKNOWN)
      }

      // Even if signup succeeds, check if email was actually sent
      // Supabase might create the user but fail to send email silently
      if (data?.user && !data?.session) {
        // User created but not confirmed - email should have been sent
        // Send welcome email to new user
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'welcome',
              to: emailResult.value,
              data: {
                firstName: firstNameResult.value,
                appUrl: window.location.origin
              }
            }
          })
        } catch (emailErr) {
          console.warn('Welcome email may not have been sent:', emailErr?.message)
        }
      }

      return { success: true, message: 'Please check your email to verify your account', email: emailResult.value }
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const resendVerificationEmail = useCallback(async (email) => {
    const emailResult = validateEmail(email)
    if (!emailResult.valid) throw new Error(emailResult.error)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailResult.value,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (error) {
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        throw new Error('Failed to resend verification email. Please try again.')
      }

      return { success: true, message: 'Verification email sent! Please check your inbox.' }
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const emailResult = validateEmail(email)
    if (!emailResult.valid) throw new Error(emailResult.error)

    if (!password) throw new Error('Password is required')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailResult.value,
        password,
      })

      if (error) {
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        if (error.message?.includes('Email not confirmed')) {
          return { success: false, emailNotVerified: true, email: emailResult.value }
        }
        
        // Security Best Practice: Use generic error message to prevent user enumeration
        // Attackers cannot determine if an email exists in our system
        // Additional protections: Supabase rate limiting + we can add CAPTCHA if needed
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('Invalid')) {
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS)
        }
        
        throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS)
      }


      return { success: true, requiresOTP: false }
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const sendEmailOTP = useCallback(async (email, isSignup = false) => {
    const emailResult = validateEmail(email)
    if (!emailResult.valid) throw new Error(emailResult.error)

    try {
      // Use signInWithOtp for both signup and login
      // This sends a 6-digit OTP code, not a magic link
      // For signup, this works even if the user hasn't verified yet
      
      const { error } = await supabase.auth.signInWithOtp({
        email: emailResult.value,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          // Explicitly request OTP code instead of magic link
          shouldCreateUser: !isSignup, // For signup, user already exists, so set to false
        }
      })

      if (error) {
        console.error('[Email OTP] Send error:', error)
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        // Security: Use generic error to prevent user enumeration
        // Don't reveal whether email exists in our system
        if (error.message?.includes('User not found') && !isSignup) {
          throw new Error('Unable to send verification code. Please check your email or sign up.')
        }
        throw new Error(error.message || 'Failed to send verification code')
      }

      setOtpSent(true)
      return { success: true, message: 'Verification code sent to your email' }
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const verifyEmailOTP = useCallback(async (email, token, isSignup = false) => {
    const emailResult = validateEmail(email)
    if (!emailResult.valid) throw new Error(emailResult.error)

    const otpResult = validateOTP(token)
    if (!otpResult.valid) throw new Error(otpResult.error)

    try {
      // signInWithOtp always uses type 'email' regardless of signup or login
      // The type is determined by how the OTP was sent, not by when the account was created
      
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailResult.value,
        token: otpResult.value,
        type: 'email' // signInWithOtp always uses type 'email'
      })

      if (error) {
        console.error('[Email OTP] Verification error:', error)
        if (error.message?.includes('expired') || error.message?.includes('Expired')) {
          throw new Error(AUTH_ERRORS.OTP_EXPIRED)
        }
        if (error.message?.includes('Invalid') || error.message?.includes('invalid') || error.message?.includes('token')) {
          throw new Error(AUTH_ERRORS.OTP_INVALID)
        }
        throw new Error(error.message || AUTH_ERRORS.OTP_INVALID)
      }

      setOtpSent(false)
      setPendingUser(null)
      return { success: true, user: data.user }
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const sendOTP = useCallback(async (phone, type = 'login') => {
    const phoneResult = validatePhone(phone)
    if (!phoneResult.valid) throw new Error(phoneResult.error)

    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: phoneResult.value, type }
      })
      
      if (error || !data?.success) {
        const errMsg = data?.error || error?.message || 'Failed to send OTP'
        if (errMsg.includes('Rate') || errMsg.includes('429')) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        throw new Error(errMsg)
      }

      setOtpSent(true)
      return { success: true }
    } catch (error) {
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const verifyOTP = useCallback(async (phone, otp, type = 'login', email = null) => {
    const phoneResult = validatePhone(phone)
    if (!phoneResult.valid) throw new Error(phoneResult.error)

    const otpResult = validateOTP(otp)
    if (!otpResult.valid) throw new Error(otpResult.error)

    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          phone: phoneResult.value, 
          otp: otpResult.value, 
          type,
          email // Pass email for signup verification
        }
      })

      if (error || !data?.success) {
        const errMsg = data?.error || error?.message || 'Verification failed'
        if (errMsg.includes('expired')) throw new Error(AUTH_ERRORS.OTP_EXPIRED)
        throw new Error(AUTH_ERRORS.OTP_INVALID)
      }

      // If user exists and we have a token_hash, use it to sign in
      if (data.token_hash && data.email) {
        const { error: signInError } = await supabase.auth.verifyOtp({ 
          token_hash: data.token_hash, 
          type: 'magiclink' 
        })
        if (signInError) {
          console.error('Sign in error:', signInError)
          // Fallback - user verified but session failed
          throw new Error('Phone verified but login failed. Please try email login.')
        }
      } else if (data.requiresEmailLogin) {
        // User exists but we could not create session
        throw new Error('Phone verified. Please login with your email.')
      } else if (data.isNewUser && type === 'login') {
        // New user - needs to register (only for login flow)
        return { success: true, isNewUser: true, phone: data.phone }
      }

      setOtpSent(false)
      setPendingUser(null)
      return { success: true, isNewUser: data.isNewUser, user: data.user }
    } catch (error) {
      if (error.message?.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const resendOTP = useCallback(async () => {
    const phone = pendingUser?.user_metadata?.phone
    if (!phone) throw new Error('No phone number on file')
    return sendOTP(phone)
  }, [pendingUser, sendOTP])

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setPendingUser(null)
      setOtpSent(false)
    } catch (error) {
      throw new Error('Failed to sign out')
    }
  }, [])

  const resetPassword = useCallback(async (email) => {
    const emailResult = validateEmail(email)
    if (!emailResult.valid) throw new Error(emailResult.error)

    try {
      console.log('[Auth] Sending password reset email to:', emailResult.value)
      
      // Always use production URL for password reset to ensure consistent experience
      // Must match Supabase Site URL setting
      const productionUrl = 'https://ticketrack.com'
      const { data, error } = await supabase.auth.resetPasswordForEmail(emailResult.value, {
        redirectTo: `${productionUrl}/reset-password`,
      })

      if (error) {
        console.error('[Auth] Password reset error:', error)
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        if (error.message) throw new Error(error.message)
        throw new Error(AUTH_ERRORS.UNKNOWN)
      }

      console.log('[Auth] Password reset email sent successfully')
      return { success: true, message: 'If an account exists, you will receive a password reset email' }
    } catch (error) {
      console.error('[Auth] Password reset exception:', error)
      if (error.message.includes('fetch')) throw new Error(AUTH_ERRORS.NETWORK_ERROR)
      throw error
    }
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    const passwordResult = validatePassword(newPassword)
    if (!passwordResult.valid) throw new Error(passwordResult.error)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error('Failed to update password')
      return { success: true }
    } catch (error) {
      throw error
    }
  }, [])

  const isEmailVerified = user?.email_confirmed_at != null

  // Clear session expired flag when user signs in
  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false)
  }, [])

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    sendOTP,
    verifyOTP,
    sendEmailOTP,
    verifyEmailOTP,
    resendOTP,
    resetPassword,
    updatePassword,
    resendVerificationEmail,
    isAuthenticated: !!user && isEmailVerified,
    isEmailVerified,
    otpSent,
    pendingUser,
    sessionExpired,
    sessionWarning,
    clearSessionExpired,
    extendSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
