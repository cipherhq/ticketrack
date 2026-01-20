import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { validateEmail, validatePassword, validatePhone, validateFirstName, validateLastName, validateOTP } from '@/utils/validation'

const AuthContext = createContext({})

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

  useEffect(() => {
    let mounted = true
    let subscription = null

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) console.warn('Session check failed:', error.message)
        if (mounted) {
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
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            setPendingUser(null)
            setOtpSent(false)
          }
        }
      })
      subscription = data.subscription
    } catch (err) {
      console.warn('Auth listener error:', err)
    }

    return () => {
      mounted = false
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email, password, firstName, lastName, phone, countryCode = 'NG') => {
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
          },
          emailRedirectTo: `${window.location.origin}/`,
        }
      })

      if (error) {
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        if (error.message?.includes('already registered')) {
          throw new Error('Unable to create account. Please try again or sign in.')
        }
        throw new Error(AUTH_ERRORS.UNKNOWN)
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
          emailRedirectTo: `${window.location.origin}/`,
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
      console.log(`[Email OTP] Sending OTP to ${email}, isSignup: ${isSignup}`)
      
      const { error } = await supabase.auth.signInWithOtp({
        email: emailResult.value,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          // Explicitly request OTP code instead of magic link
          shouldCreateUser: !isSignup, // For signup, user already exists, so set to false
        }
      })

      if (error) {
        console.error('[Email OTP] Send error:', error)
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        // If user doesn't exist and we're trying to login, provide clearer error
        if (error.message?.includes('User not found') && !isSignup) {
          throw new Error('No account found with this email. Please sign up first.')
        }
        throw new Error(error.message || 'Failed to send email OTP')
      }

      console.log('[Email OTP] OTP sent successfully')
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
      console.log(`[Email OTP] Verifying OTP for ${email}, token: ${otpResult.value.substring(0, 2)}...`)
      
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

      console.log('[Email OTP] Verification successful, user:', data.user?.id)
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

    console.log("Sending OTP to:", phoneResult.value, "Type:", type)
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
      const { error } = await supabase.auth.resetPasswordForEmail(emailResult.value, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        if (error.status === 429) throw new Error(AUTH_ERRORS.RATE_LIMITED)
        throw new Error(AUTH_ERRORS.UNKNOWN)
      }

      return { success: true, message: 'If an account exists, you will receive a password reset email' }
    } catch (error) {
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
