import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * AUTHENTICATION PAGE
 * 
 * Handles both login and signup with:
 * - Email + Password
 * - Phone + OTP
 * 
 * The 'mode' prop determines if we show login or signup form.
 */

export function WebAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  
  const { 
    signUpWithEmail, 
    signInWithEmail, 
    sendPhoneOTP, 
    verifyPhoneOTP,
    isLoading 
  } = useAuth();

  // Form state
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [authMethod, setAuthMethod] = useState('email'); // 'email' | 'phone'
  const [step, setStep] = useState('input'); // 'input' | 'otp'
  
  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  
  // UI state
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Handle email login/signup
  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (mode === 'signup') {
      if (!fullName) {
        setError('Please enter your full name');
        return;
      }

      const { error } = await signUpWithEmail(email, password, fullName);
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      
      if (error) {
        setError(error.message);
      } else {
        navigate(returnTo);
      }
    }
  }

  // Handle phone OTP request
  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    // Basic Nigerian phone validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setError('Please enter a valid Nigerian phone number');
      return;
    }

    const { error, phone: formatted } = await sendPhoneOTP(phone);
    
    if (error) {
      setError(error.message);
    } else {
      setFormattedPhone(formatted);
      setStep('otp');
      setMessage('OTP sent! Check your phone.');
    }
  }

  // Handle OTP verification
  async function handleOTPSubmit(e) {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    const { error } = await verifyPhoneOTP(formattedPhone, otp);
    
    if (error) {
      setError(error.message);
    } else {
      navigate(returnTo);
    }
  }

  // Reset to input step
  function handleBack() {
    setStep('input');
    setOtp('');
    setError('');
    setMessage('');
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div>
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Ticketrack</span>
          </a>
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-white">
            Discover Amazing Events Near You
          </h1>
          <p className="mt-4 text-lg text-blue-100">
            Join thousands of event-goers finding the best concerts, conferences, 
            and experiences across Nigeria.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i}
                className="h-10 w-10 rounded-full border-2 border-blue-600 bg-gradient-to-br from-yellow-400 to-orange-500"
              />
            ))}
          </div>
          <p className="text-sm text-blue-100">
            <span className="font-semibold text-white">10,000+</span> event organizers trust us
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <a href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Ticketrack</span>
            </a>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-gray-600">
              {mode === 'login' 
                ? 'Sign in to access your tickets and events' 
                : 'Start discovering amazing events today'}
            </p>
          </div>

          {/* Auth Method Toggle */}
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => { setAuthMethod('email'); setStep('input'); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                authMethod === 'email'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('phone'); setStep('input'); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                authMethod === 'phone'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Phone
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
              {message}
            </div>
          )}

          {/* Email Form */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading 
                  ? 'Please wait...' 
                  : mode === 'login' 
                    ? 'Sign In' 
                    : 'Create Account'}
              </button>
            </form>
          )}

          {/* Phone Form - Input Step */}
          {authMethod === 'phone' && step === 'input' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <div className="mt-1 flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">
                    +234
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="8012345678"
                    className="block w-full rounded-r-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  We'll send you a one-time verification code
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Phone Form - OTP Step */}
          {authMethod === 'phone' && step === 'otp' && (
            <form onSubmit={handleOTPSubmit} className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl font-bold tracking-widest text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the 6-digit code sent to {formattedPhone}
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full rounded-lg border border-gray-300 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Use Different Number
              </button>
            </form>
          )}

          {/* Mode Toggle */}
          <p className="mt-6 text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * WHAT YOU LEARNED:
 * 
 * 1. MULTI-STEP FORMS: Using 'step' state to show different form stages
 *    (phone input → OTP verification)
 * 
 * 2. FORM VALIDATION: Checking inputs before submitting to the backend
 * 
 * 3. CONTROLLED INPUTS: React manages input values through state
 *    (value={email} + onChange={setEmail})
 * 
 * 4. CONDITIONAL RENDERING: Showing different forms based on authMethod and step
 * 
 * 5. ERROR HANDLING: Displaying user-friendly error messages
 * 
 * 6. PHONE FORMATTING: Nigerian numbers auto-formatted to +234
 * 
 * 7. NAVIGATION: useNavigate() redirects after successful auth
 */
