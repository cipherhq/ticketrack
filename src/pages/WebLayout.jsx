import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Ticket, Search, User, ShoppingCart, Menu, X, Plus, Heart, Settings, LogOut, LayoutDashboard, Megaphone, Users, Calendar, BookOpen, DollarSign, UserCircle, Grid3X3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
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
          .from('promoters')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-background border-b border-gray-200 dark:border-border sticky top-0 z-50" style={{ paddingTop: 'max(0px, env(safe-area-inset-top))' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Logo className="h-12" />

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => navigate('/events')}
                className={`text-foreground hover:text-primary transition-colors ${
                  isActive('/events') ? 'text-primary' : ''
                }`}
              >
                Browse Events
              </button>
              <button
                onClick={() => navigate('/profile', { state: { tab: 'tickets' } })}
                className={`text-foreground hover:text-primary transition-colors ${
                  isActive('/tickets') ? 'text-primary' : ''
                }`}
              >
                My Tickets
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className={`text-foreground hover:text-primary transition-colors ${
                  isActive('/pricing') ? 'text-primary' : ''
                }`}
              >
                Pricing
              </button>
              <button
                onClick={() => navigate('/blog')}
                className={`text-foreground hover:text-primary transition-colors ${
                  isActive('/blog') ? 'text-primary' : ''
                }`}
              >
                Blog
              </button>
              <button
                onClick={() => navigate('/search')}
                className="text-foreground hover:text-primary transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="relative text-foreground hover:text-primary transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
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
                className="rounded-xl border-primary text-primary hover:bg-primary/10 flex items-center gap-2"
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
                        <p className="text-sm text-foreground">
                          {currentUser.firstName} {currentUser.lastName}
                        </p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <div className="px-2 py-2">
                      <p className="text-sm font-medium text-foreground">
                        {currentUser.firstName} {currentUser.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                      onClick={() => navigate('/my-groups')}
                      className="cursor-pointer rounded-lg"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      My Groups
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/my-ads')}
                      className="cursor-pointer rounded-lg"
                    >
                      <Megaphone className="w-4 h-4 mr-2" />
                      My Ads
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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-3 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-foreground" />
              ) : (
                <Menu className="w-6 h-6 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu - Compact Design */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-background border-t border-gray-200 dark:border-border max-h-[85vh] overflow-y-auto">
            <div className="px-4 py-3">
              {/* Create Event CTA - Always visible */}
              <button
                onClick={() => {
                  navigate('/create-event')
                  setMobileMenuOpen(false)
                }}
                className="w-full mb-4 py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium flex items-center justify-center gap-2 touch-manipulation"
              >
                <Plus className="w-5 h-5" />
                Create Event
              </button>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <button
                  onClick={() => { navigate('/events'); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl hover:bg-muted active:bg-muted touch-manipulation"
                >
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="text-xs text-foreground">Events</span>
                </button>
                <button
                  onClick={() => { navigate('/search'); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl hover:bg-muted active:bg-muted touch-manipulation"
                >
                  <Search className="w-5 h-5 text-primary" />
                  <span className="text-xs text-foreground">Search</span>
                </button>
                <button
                  onClick={() => { navigate('/profile', { state: { tab: 'tickets' } }); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl hover:bg-muted active:bg-muted touch-manipulation"
                >
                  <Ticket className="w-5 h-5 text-primary" />
                  <span className="text-xs text-foreground">Tickets</span>
                </button>
                <button
                  onClick={() => { navigate('/my-groups'); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl hover:bg-muted active:bg-muted touch-manipulation"
                >
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-xs text-foreground">Groups</span>
                </button>
              </div>

              {/* Secondary Links */}
              <div className="flex gap-4 py-2 border-t border-border/10 text-sm">
                <button
                  onClick={() => { navigate('/blog'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 text-foreground/70 hover:text-foreground"
                >
                  <BookOpen className="w-4 h-4" />
                  Blog
                </button>
                <button
                  onClick={() => { navigate('/pricing'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-1.5 text-foreground/70 hover:text-foreground"
                >
                  <DollarSign className="w-4 h-4" />
                  Pricing
                </button>
              </div>
              
              {/* User Section */}
              <div className="pt-3 mt-2 border-t border-border/10">
                {isLoggedIn ? (
                  <div className="space-y-2">
                    {/* User Info Row */}
                    <div className="flex items-center gap-3 py-2">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={currentUser.profileImage} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {currentUser.firstName} {currentUser.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                      </div>
                    </div>

                    {/* Dashboard Links */}
                    <div className="flex flex-wrap gap-2">
                      {isOrganizer && (
                        <button
                          onClick={() => { navigate('/organizer'); setMobileMenuOpen(false); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-primary/10"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Organizer
                        </button>
                      )}
                      {isPromoter && (
                        <button
                          onClick={() => { navigate('/promoter'); setMobileMenuOpen(false); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-primary/10"
                        >
                          <Megaphone className="w-4 h-4" />
                          Promoter
                        </button>
                      )}
                      <button
                        onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm text-foreground hover:bg-primary/10"
                      >
                        <UserCircle className="w-4 h-4" />
                        Profile
                      </button>
                      <button
                        onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-500/10"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                      className="flex-1 rounded-xl h-11"
                    >
                      Login
                    </Button>
                    <Button
                      onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11"
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

      {/* Footer - Mobile Compact */}
      <footer className="bg-[#0F0F0F] text-white py-6 md:py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Footer */}
          <div className="md:hidden">
            <div className="flex items-center justify-center mb-4">
              <Logo className="h-8" variant="light" />
            </div>

            {/* Compact Links */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-white/60 mb-4">
              <button onClick={() => navigate('/about')} className="hover:text-white">About</button>
              <button onClick={() => navigate('/contact')} className="hover:text-white">Contact</button>
              <button onClick={() => navigate('/help')} className="hover:text-white">Help</button>
              <button onClick={() => navigate('/pricing')} className="hover:text-white">Pricing</button>
              <button onClick={() => navigate('/blog')} className="hover:text-white">Blog</button>
              <button onClick={() => navigate('/advertise')} className="hover:text-white">Advertise</button>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-white/40 mb-4">
              <button onClick={() => navigate('/terms')} className="hover:text-white/60">Terms</button>
              <span>·</span>
              <button onClick={() => navigate('/privacy')} className="hover:text-white/60">Privacy</button>
              <span>·</span>
              <button onClick={() => navigate('/refund-policy')} className="hover:text-white/60">Refunds</button>
            </div>

            <p className="text-center text-white/40 text-xs">
              © {new Date().getFullYear()} Ticketrack
            </p>
          </div>

          {/* Desktop Footer */}
          <div className="hidden md:block">
            <div className="grid grid-cols-4 gap-8">
              <div>
                <div className="mb-4">
                  <Logo className="h-12" variant="light" />
                </div>
                <p className="text-white/60 text-sm">
                  The best platform for discovering and booking events worldwide.
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
                  <li>
                    <button onClick={() => navigate('/refund-policy')} className="hover:text-white transition-colors">
                      Refund Policy
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate('/trust-safety')} className="hover:text-white transition-colors">
                      Trust & Safety
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
                  <li>
                    <button onClick={() => navigate('/blog')} className="hover:text-white transition-colors">
                      Blog
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate('/advertise')} className="hover:text-white transition-colors">
                      Advertise
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/10 mt-8 pt-8 text-center text-white/40 text-sm">
              <p>© {new Date().getFullYear()} Ticketrack. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
