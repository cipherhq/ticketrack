import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from './Button'
import { Ticket, User, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Ticketrack</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/events" className="text-gray-600 hover:text-primary-500 transition">
              Browse Events
            </Link>
            <Link to="/#categories" className="text-gray-600 hover:text-primary-500 transition">
              Categories
            </Link>
            <Link to="/#countries" className="text-gray-600 hover:text-primary-500 transition">
              Countries
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link to="/my-tickets" className="text-gray-600 hover:text-primary-500 transition">
                  My Tickets
                </Link>
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-5 h-5" />
                  <span>{profile?.full_name || user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-gray-600 hover:text-red-500 transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-4 space-y-4">
            <Link to="/events" className="block text-gray-600 hover:text-primary-500">
              Browse Events
            </Link>
            <Link to="/#categories" className="block text-gray-600 hover:text-primary-500">
              Categories
            </Link>
            {user ? (
              <>
                <Link to="/my-tickets" className="block text-gray-600 hover:text-primary-500">
                  My Tickets
                </Link>
                <button onClick={handleSignOut} className="text-red-500">
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-4">
                <Link to="/login">
                  <Button variant="outline" className="w-full">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
