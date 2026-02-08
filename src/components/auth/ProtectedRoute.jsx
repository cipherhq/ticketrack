import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Debug logging - only in development
  if (import.meta.env.DEV) {
    console.log('ProtectedRoute check:', { user: !!user, loading, path: location.pathname })
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in - redirect to login with return URL
  if (!user) {
    if (import.meta.env.DEV) {
      console.log('No user, redirecting to login')
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (import.meta.env.DEV) {
    console.log('User authenticated, rendering children')
  }
  return children
}
