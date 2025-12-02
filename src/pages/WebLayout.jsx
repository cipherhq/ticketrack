import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Ticket, Search, User, ShoppingCart, Menu, X, Plus, Heart, Settings, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function WebLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount] = useState(0)
  
  // Simulating logged in state - in real app, this would come from auth context
  const [isLoggedIn] = useState(false)
  const [currentUser] = useState({
    id: 'user_001',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@example.com',
    profileImage: '',
  })

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Header */}
      <header className="bg-white border-b border-[#0F0F0F]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              className="flex items-center cursor-pointer gap-2"
              onClick={() => navigate('/')}
            >
              <div className="w-8 h-8 bg-[#2969FF] rounded-lg flex items-center justify-center">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-[#0F0F0F]">Ticketrack</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => navigate('/events')}
                className={`text-[#0F0F0F] hover:text-[#2969FF] transition-colors ${
                  isActive('/events') ? 'text-[#2969FF]' : ''
                }`}
              >
                Browse Events
              </button>
              <button
                onClick={() => navigate('/tickets')}
                className={`text-[#0F0F0F] hover:text-[#2969FF] transition-colors ${
                  isActive('/tickets') ? 'text-[#2969FF]' : ''
                }`}
              >
                My Tickets
              </button>
              <button
                onClick={() => navigate('/search')}
                className="text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="relative text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#2969FF] text-white text-xs rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </nav>

            {/* Auth Buttons / User Profile */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/organizer')}
                className="rounded-xl border-[#2969FF] text-[#2969FF] hover:bg-[#2969FF]/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Event
              </Button>
              
              {isLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={currentUser.profileImage} />
                        <AvatarFallback className="bg-[#2969FF] text-white text-sm">
                          {currentUser.firstName[0]}
                          {currentUser.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left hidden lg:block">
                        <p className="text-sm text-[#0F0F0F]">
                          {currentUser.firstName} {currentUser.lastName}
                        </p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <div className="px-2 py-2">
                      <p className="text-sm text-[#0F0F0F]">
                        {currentUser.firstName} {currentUser.lastName}
                      </p>
                      <p className="text-xs text-[#0F0F0F]/60">
                        {currentUser.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate('/profile')}
                      className="cursor-pointer rounded-lg"
                    >
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/tickets')}
                      className="cursor-pointer rounded-lg"
                    >
                      <Ticket className="w-4 h-4 mr-2" />
                      My Tickets
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/saved')}
                      className="cursor-pointer rounded-lg"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Saved Events
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/settings')}
                      className="cursor-pointer rounded-lg"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate('/login')}
                      className="cursor-pointer rounded-lg text-red-600 focus:text-red-600"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/login')}
                    className="rounded-xl"
                  >
                    Login
                  </Button>
                  <Button
                    onClick={() => navigate('/signup')}
                    className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-[#0F0F0F]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-[#0F0F0F]/10">
              <nav className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    navigate('/events')
                    setMobileMenuOpen(false)
                  }}
                  className="text-left text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
                >
                  Browse Events
                </button>
                <button
                  onClick={() => {
                    navigate('/tickets')
                    setMobileMenuOpen(false)
                  }}
                  className="text-left text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
                >
                  My Tickets
                </button>
                <button
                  onClick={() => {
                    navigate('/search')
                    setMobileMenuOpen(false)
                  }}
                  className="text-left text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    navigate('/cart')
                    setMobileMenuOpen(false)
                  }}
                  className="text-left text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
                >
                  Cart {cartCount > 0 && `(${cartCount})`}
                </button>
                <div className="flex flex-col gap-2 pt-4 border-t border-[#0F0F0F]/10">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate('/organizer')
                      setMobileMenuOpen(false)
                    }}
                    className="rounded-xl w-full border-[#2969FF] text-[#2969FF] hover:bg-[#2969FF]/10 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Event
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate('/login')
                      setMobileMenuOpen(false)
                    }}
                    className="rounded-xl w-full"
                  >
                    Login
                  </Button>
                  <Button
                    onClick={() => {
                      navigate('/signup')
                      setMobileMenuOpen(false)
                    }}
                    className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl w-full"
                  >
                    Sign Up
                  </Button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#0F0F0F]/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div 
                className="flex items-center gap-2 mb-4 cursor-pointer"
                onClick={() => navigate('/')}
              >
                <div className="w-8 h-8 bg-[#2969FF] rounded-lg flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-semibold text-[#0F0F0F]">Ticketrack</span>
              </div>
              <p className="text-[#0F0F0F]/60 text-sm">
                Your trusted and secure event ticketing platform
              </p>
            </div>

            <div>
              <h4 className="text-[#0F0F0F] font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-[#0F0F0F]/60">
                <li>
                  <button onClick={() => navigate('/about')} className="hover:text-[#2969FF]">
                    About Us
                  </button>
                </li>
                <li>
                  <button className="hover:text-[#2969FF]">Careers</button>
                </li>
                <li>
                  <button onClick={() => navigate('/contact')} className="hover:text-[#2969FF]">
                    Contact
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[#0F0F0F] font-medium mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-[#0F0F0F]/60">
                <li>
                  <button onClick={() => navigate('/help')} className="hover:text-[#2969FF]">
                    Help Center
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/terms')} className="hover:text-[#2969FF]">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/privacy')} className="hover:text-[#2969FF]">
                    Privacy Policy
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-[#0F0F0F] font-medium mb-4">Organizers</h4>
              <ul className="space-y-2 text-sm text-[#0F0F0F]/60">
                <li>
                  <button onClick={() => navigate('/organizer')} className="hover:text-[#2969FF]">
                    Organizer Dashboard
                  </button>
                </li>
                <li>
                  <button className="hover:text-[#2969FF]">Create Event</button>
                </li>
                <li>
                  <button className="hover:text-[#2969FF]">Pricing</button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#0F0F0F]/10 mt-8 pt-8 text-center text-sm text-[#0F0F0F]/60">
            © 2024 Ticketrack. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
