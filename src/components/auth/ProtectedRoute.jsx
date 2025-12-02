import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute({ children }) {
  const { user, loading, isEmailVerified } = useAuth()
  const location = useLocation()

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-[#0F0F0F]/60">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in - redirect to login with return URL
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Logged in but email not verified
  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  return children
}
