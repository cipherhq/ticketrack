import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import {
  WebLayout,
  WebHome,
  WebAuth,
  AuthCallback,
  ForgotPassword,
  WebEventBrowse,
  WebEventDetails,
  WebSearch,
  WebCart,
  WebCheckout,
  WebPaymentSuccess,
  WebTickets,
  AttendeeProfile,
  OrganizerPublicProfile,
  WebAbout,
  WebContact,
  WebHelp,
  WebPrivacy,
  WebTerms,
} from './pages'

function ScrollToTop() {
  const { pathname } = useLocation()
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  
  return null
}

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()

  // Handle auth redirects from Supabase (email verification, password reset)
  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')
    const error = hashParams.get('error')
    const errorDescription = hashParams.get('error_description')

    if (error) {
      navigate('/login', { state: { error: errorDescription || 'Authentication failed' }, replace: true })
      return
    }

    if (accessToken) {
      if (type === 'signup' || type === 'email') {
        navigate('/login', { state: { message: 'Email verified successfully! Please sign in.' }, replace: true })
      } else if (type === 'recovery') {
        navigate('/reset-password', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [location.hash, navigate])

  return (
    <Routes>
      {/* Public routes with layout */}
      <Route path="/" element={<WebLayout />}>
        <Route index element={<WebHome />} />
        <Route path="events" element={<WebEventBrowse />} />
        <Route path="event/:id" element={<WebEventDetails />} />
        <Route path="search" element={<WebSearch />} />
        <Route path="about" element={<WebAbout />} />
        <Route path="contact" element={<WebContact />} />
        <Route path="help" element={<WebHelp />} />
        <Route path="privacy" element={<WebPrivacy />} />
        <Route path="terms" element={<WebTerms />} />
        
        {/* Protected routes */}
        <Route path="cart" element={<ProtectedRoute><WebCart /></ProtectedRoute>} />
        <Route path="checkout" element={<ProtectedRoute><WebCheckout /></ProtectedRoute>} />
        <Route path="tickets" element={<ProtectedRoute><WebTickets /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><AttendeeProfile /></ProtectedRoute>} />
        <Route path="organizer/:id" element={<OrganizerPublicProfile />} />
      </Route>

      {/* Auth routes (no layout) */}
      <Route path="/login" element={<WebAuth />} />
      <Route path="/signup" element={<WebAuth />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Payment success (no layout) */}
      <Route path="/payment-success" element={<WebPaymentSuccess />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App
