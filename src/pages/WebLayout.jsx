import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Ticket, Search, User, ShoppingCart, Menu, X, Plus, Heart, Settings, LogOut, LayoutDashboard, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function WebLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [cartCount] = useState(0)
  const [profile, setProfile] = useState(null)
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [isPromoter, setIsPromoter] = useState(false)

  // Load user profile and check roles
  useEffect(() => {
    async function loadUserData() {
      if (user) {
        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profileData)

        // Check if user is an organizer (has an organizer profile with events)
        const { data: organizerData } = await supabase
          .from('organizers')
          .select('id')
          .eq('user_id', user.id)
          .single()
        
        if (organizerData) {
          const { count: eventCount } = await supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('organizer_id', organizerData.id)
          setIsOrganizer(eventCount > 0)
        } else {
          setIsOrganizer(false)
        }

        // Check if user is a promoter (has any promoter assignments)
        const { count: promoterCount } = await supabase
          .from('promoter_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('promoter_id', user.id)
          .eq('status', 'accepted')
        setIsPromoter(promoterCount > 0)

      } else {
        setProfile(null)
        setIsOrganizer(false)
        setIsPromoter(false)
      }
    }
    loadUserData()
  }, [user])

  const isLoggedIn = !!user
  const currentUser = {
    firstName: profile?.first_name || user?.email?.split('@')[0] || 'User',
    lastName: profile?.last_name || '',
    email: user?.email || '',
    profileImage: profile?.avatar_url || '',
  }

  const getInitials = () => {
    if (currentUser.firstName && currentUser.lastName) {
      return `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase()
    }
    return currentUser.firstName?.[0]?.toUpperCase() || 'U'
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

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
              <img src="/ticketrackLogo.png" alt="Ticketrack" className="h-10" />
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
                onClick={() => navigate('/profile', { state: { tab: 'tickets' } })}
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
                onClick={() => {
                  if (user) {
                    navigate('/create-event');
                  } else {
                    navigate('/login', { state: { from: '/create-event' } });
                  }
                }}
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
                          {getInitials()}
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
                      <p className="text-sm font-medium text-[#0F0F0F]">
                        {currentUser.firstName} {currentUser.lastName}
                      </p>
                      <p className="text-xs text-[#0F0F0F]/60">
                        {currentUser.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    
                    {/* Organizer Dashboard - Only if user has created events */}
                    {isOrganizer && (
                      <DropdownMenuItem
                        onClick={() => navigate("/organizer")}
                        className="cursor-pointer rounded-lg"
                      >
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Organizer Dashboard
                      </DropdownMenuItem>
                    )}
                    
                    {/* Promoter Dashboard - Only if user is an active promoter */}
                    {isPromoter && (
                      <DropdownMenuItem
                        onClick={() => navigate("/promoter")}
                        className="cursor-pointer rounded-lg"
                      >
                        <Megaphone className="w-4 h-4 mr-2" />
                        Promoter Dashboard
                      </DropdownMenuItem>
                    )}
                    
                    {(isOrganizer || isPromoter) && <DropdownMenuSeparator />}
                    
                    <DropdownMenuItem
                      onClick={() => navigate('/profile')}
                      className="cursor-pointer rounded-lg"
                    >
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/profile', { state: { tab: 'tickets' } })}
                      className="cursor-pointer rounded-lg"
                    >
                      <Ticket className="w-4 h-4 mr-2" />
                      My Tickets
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/profile', { state: { tab: 'saved' } })}
                      className="cursor-pointer rounded-lg"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Saved Events
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/profile', { state: { tab: 'settings' } })}
                      className="cursor-pointer rounded-lg"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
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
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-[#0F0F0F]" />
              ) : (
                <Menu className="w-6 h-6 text-[#0F0F0F]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#0F0F0F]/10">
            <div className="px-4 py-4 space-y-4">
              <button
                onClick={() => {
                  navigate('/events')
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left py-2 text-[#0F0F0F]"
              >
                Browse Events
              </button>
              <button
                onClick={() => {
                  navigate('/profile', { state: { tab: 'tickets' } })
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left py-2 text-[#0F0F0F]"
              >
                My Tickets
              </button>
              <button
                onClick={() => {
                  navigate('/search')
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left py-2 text-[#0F0F0F]"
              >
                Search
              </button>
              
              <div className="pt-4 border-t border-[#0F0F0F]/10">
                {isLoggedIn ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={currentUser.profileImage} />
                        <AvatarFallback className="bg-[#2969FF] text-white">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-[#0F0F0F]">
                          {currentUser.firstName} {currentUser.lastName}
                        </p>
                        <p className="text-xs text-[#0F0F0F]/60">{currentUser.email}</p>
                      </div>
                    </div>
                    
                    {isOrganizer && (
                      <button
                        onClick={() => {
                          navigate('/organizer')
                          setMobileMenuOpen(false)
                        }}
                        className="block w-full text-left py-2 text-[#0F0F0F]"
                      >
                        Organizer Dashboard
                      </button>
                    )}
                    
                    {isPromoter && (
                      <button
                        onClick={() => {
                          navigate('/promoter')
                          setMobileMenuOpen(false)
                        }}
                        className="block w-full text-left py-2 text-[#0F0F0F]"
                      >
                        Promoter Dashboard
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        navigate('/profile')
                        setMobileMenuOpen(false)
                      }}
                      className="block w-full text-left py-2 text-[#0F0F0F]"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        handleSignOut()
                        setMobileMenuOpen(false)
                      }}
                      className="block w-full text-left py-2 text-red-600"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate('/login')
                        setMobileMenuOpen(false)
                      }}
                      className="flex-1 rounded-xl"
                    >
                      Login
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/signup')
                        setMobileMenuOpen(false)
                      }}
                      className="flex-1 bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl"
                    >
                      Sign Up
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#0F0F0F] text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/ticketrackLogo.png" alt="Ticketrack" className="h-10" />
              </div>
              <p className="text-white/60 text-sm">
                The best platform for discovering and booking events across Africa.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button onClick={() => navigate('/about')} className="hover:text-white transition-colors">
                    About Us
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/contact')} className="hover:text-white transition-colors">
                    Contact
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/careers')} className="hover:text-white transition-colors">
                    Careers
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button onClick={() => navigate('/help')} className="hover:text-white transition-colors">
                    Help Center
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">
                    Privacy Policy
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">For Organizers</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button 
                    onClick={() => {
                      if (user) {
                        navigate('/create-event');
                      } else {
                        navigate('/login', { state: { from: '/create-event' } });
                      }
                    }} 
                    className="hover:text-white transition-colors"
                  >
                    Create Event
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/pricing')} className="hover:text-white transition-colors">
                    Pricing
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate('/resources')} className="hover:text-white transition-colors">
                    Resources
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-8 text-center text-white/40 text-sm">
            <p>© {new Date().getFullYear()} Ticketrack. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
