import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  User,
  Menu,
  X,
  Plus,
  LogOut,
  Ticket,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function WebLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Header */}
      <header className="bg-white border-b border-[#0F0F0F]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-[#2969FF]">Ticketrack</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link
                to="/events"
                className={cn(
                  "text-[#0F0F0F] hover:text-[#2969FF] transition-colors",
                  isActive('/events') && "text-[#2969FF] font-medium"
                )}
              >
                Browse Events
              </Link>
              {isAuthenticated && (
                <Link
                  to="/tickets"
                  className={cn(
                    "text-[#0F0F0F] hover:text-[#2969FF] transition-colors",
                    isActive('/tickets') && "text-[#2969FF] font-medium"
                  )}
                >
                  My Tickets
                </Link>
              )}
              <button
                onClick={() => navigate('/events')}
                className="text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </nav>

            {/* Auth Buttons / User Profile */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated && (profile?.role === 'organizer' || profile?.role === 'admin') && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/organizer/events/create')}
                  className="rounded-xl border-[#2969FF] text-[#2969FF] hover:bg-[#2969FF]/10 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Event
                </Button>
              )}

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-[#2969FF] text-white text-sm">
                          {getInitials(profile?.full_name || profile?.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left hidden lg:block">
                        <p className="text-sm text-[#0F0F0F]">
                          {profile?.full_name || profile?.email?.split('@')[0]}
                        </p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <div className="px-2 py-2">
                      <p className="text-sm font-medium text-[#0F0F0F]">
                        {profile?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-[#0F0F0F]/60">{profile?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate('/tickets')}
                      className="cursor-pointer rounded-lg"
                    >
                      <Ticket className="w-4 h-4 mr-2" />
                      My Tickets
                    </DropdownMenuItem>
                    {(profile?.role === 'organizer' || profile?.role === 'admin') && (
                      <DropdownMenuItem
                        onClick={() => navigate('/organizer')}
                        className="cursor-pointer rounded-lg"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Organizer Dashboard
                      </DropdownMenuItem>
                    )}
                    {profile?.role === 'admin' && (
                      <DropdownMenuItem
                        onClick={() => navigate('/admin')}
                        className="cursor-pointer rounded-lg"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Admin Portal
                      </DropdownMenuItem>
                    )}
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
                <Link
                  to="/events"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
                >
                  Browse Events
                </Link>
                {isAuthenticated && (
                  <Link
                    to="/tickets"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-[#0F0F0F] hover:text-[#2969FF] transition-colors"
                  >
                    My Tickets
                  </Link>
                )}
                <div className="flex flex-col gap-2 pt-4 border-t border-[#0F0F0F]/10">
                  {!isAuthenticated ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigate('/login');
                          setMobileMenuOpen(false);
                        }}
                        className="rounded-xl w-full"
                      >
                        Login
                      </Button>
                      <Button
                        onClick={() => {
                          navigate('/signup');
                          setMobileMenuOpen(false);
                        }}
                        className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl w-full"
                      >
                        Sign Up
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="rounded-xl w-full text-red-600 border-red-600"
                    >
                      Logout
                    </Button>
                  )}
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
              <Link to="/" className="flex items-center mb-4">
                <span className="text-2xl font-bold text-[#2969FF]">Ticketrack</span>
              </Link>
              <p className="text-[#0F0F0F]/60 text-sm">
                Africa's trusted event ticketing platform. Secure, simple, seamless.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-[#0F0F0F] mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-[#0F0F0F]/60">
                <li>
                  <Link to="/about" className="hover:text-[#2969FF]">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-[#2969FF]">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-[#0F0F0F] mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-[#0F0F0F]/60">
                <li>
                  <Link to="/help" className="hover:text-[#2969FF]">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-[#2969FF]">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-[#2969FF]">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-[#0F0F0F] mb-4">For Organizers</h4>
              <ul className="space-y-2 text-sm text-[#0F0F0F]/60">
                <li>
                  <Link to="/organizer" className="hover:text-[#2969FF]">
                    Organizer Dashboard
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#0F0F0F]/10 mt-8 pt-8 text-center text-sm text-[#0F0F0F]/60">
            © {new Date().getFullYear()} Ticketrack. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
