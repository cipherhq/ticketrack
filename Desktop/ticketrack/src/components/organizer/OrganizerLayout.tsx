import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  TicketIcon,
  QrCode,
  BarChart3,
  Wallet,
  User,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Plus,
  Bell,
  Settings,
  Users,
  MessageSquare,
  Mail,
  Phone,
  Gift,
  Shield,
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
import { Badge } from '@/components/ui/badge';
import { cn, getInitials } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/organizer', icon: LayoutDashboard },
  { name: 'Events', href: '/organizer/events', icon: Calendar },
  { name: 'Sales', href: '/organizer/sales', icon: TicketIcon },
  { name: 'Check-in', href: '/organizer/checkin', icon: QrCode },
  { name: 'Analytics', href: '/organizer/analytics', icon: BarChart3 },
  { name: 'Finance', href: '/organizer/finance', icon: Wallet },
];

const marketingNav = [
  { name: 'Promo Codes', href: '/organizer/promo-codes', icon: Gift },
  { name: 'Email Campaigns', href: '/organizer/email-campaigns', icon: Mail },
  { name: 'SMS Campaigns', href: '/organizer/sms-campaigns', icon: Phone },
  { name: 'WhatsApp', href: '/organizer/whatsapp-broadcast', icon: MessageSquare },
  { name: 'Followers', href: '/organizer/followers', icon: Users },
];

export function OrganizerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, organizer, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (href: string) => {
    if (href === '/organizer') {
      return location.pathname === '/organizer';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-[#0F0F0F]/10 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-[#0F0F0F]/10">
            <Link to="/organizer" className="flex items-center gap-2">
              <span className="text-xl font-bold text-[#2969FF]">Ticketrack</span>
              <Badge variant="secondary" className="text-xs">Organizer</Badge>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-[#2969FF] text-white'
                    : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA] hover:text-[#0F0F0F]'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}

            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-[#0F0F0F]/40 uppercase tracking-wider">
                Marketing
              </p>
            </div>

            {marketingNav.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-[#2969FF] text-white'
                    : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA] hover:text-[#0F0F0F]'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}

            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-[#0F0F0F]/40 uppercase tracking-wider">
                Settings
              </p>
            </div>

            <Link
              to="/organizer/profile"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive('/organizer/profile')
                  ? 'bg-[#2969FF] text-white'
                  : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA] hover:text-[#0F0F0F]'
              )}
            >
              <User className="w-5 h-5" />
              Profile
            </Link>

            <Link
              to="/organizer/request-verification"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive('/organizer/request-verification')
                  ? 'bg-[#2969FF] text-white'
                  : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA] hover:text-[#0F0F0F]'
              )}
            >
              <Shield className="w-5 h-5" />
              Verification
              {!organizer?.is_verified && (
                <Badge variant="destructive" className="ml-auto text-xs">
                  Required
                </Badge>
              )}
            </Link>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-[#0F0F0F]/10">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={organizer?.logo_url || undefined} />
                <AvatarFallback className="bg-[#2969FF] text-white">
                  {getInitials(organizer?.business_name || 'O')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F0F0F] truncate">
                  {organizer?.business_name || 'Organizer'}
                </p>
                <p className="text-xs text-[#0F0F0F]/60 truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#0F0F0F]/10">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[#0F0F0F]"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <Button
                onClick={() => navigate('/organizer/events/create')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl hidden sm:flex"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Event
              </Button>

              <button className="relative text-[#0F0F0F]/60 hover:text-[#0F0F0F]">
                <Bell className="w-5 h-5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-[#2969FF] text-white text-sm">
                        {getInitials(profile?.full_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="w-4 h-4 text-[#0F0F0F]/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{profile?.full_name}</p>
                    <p className="text-xs text-[#0F0F0F]/60">{profile?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/organizer/profile')} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/')} className="cursor-pointer">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Back to Website
                  </DropdownMenuItem>
                  {profile?.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Admin Portal
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
