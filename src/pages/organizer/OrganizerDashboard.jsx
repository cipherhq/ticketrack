import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  DollarSign,
  CheckCircle,
  UserCircle,
  Shield,
  Menu,
  X,
  Users,
  Mail,
  Plus,
  MessageSquare,
  Percent,
  Bell,
  TrendingUp,
  Home,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useOrganizer } from '../../contexts/OrganizerContext';
import { PaymentGatewayBanner } from '../../components/PaymentGatewayPrompt';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/organizer' },
  { icon: Calendar, label: 'Events', path: '/organizer/events' },
  { icon: Users, label: 'Attendees', path: '/organizer/attendees' },
  { icon: Users, label: 'Followers', path: '/organizer/followers' },
  { icon: BarChart3, label: 'Analytics', path: '/organizer/analytics' },
  { icon: DollarSign, label: 'Finance', path: '/organizer/finance' },
  { icon: CheckCircle, label: 'Check-in', path: '/organizer/checkin' },
  { icon: Percent, label: 'Promo Codes', path: '/organizer/promo-codes' },
  { icon: TrendingUp, label: 'Promoters', path: '/organizer/promoters' },
  { icon: Mail, label: 'Email Campaigns', path: '/organizer/email-campaigns' },
  // { icon: MessageSquare, label: 'WhatsApp', path: '/organizer/whatsapp' },
  { icon: Bell, label: 'SMS Campaigns', path: '/organizer/sms' },
  { icon: Shield, label: 'KYC', path: '/organizer/kyc' },
  { icon: UserCircle, label: 'Profile', path: '/organizer/profile' },
];

export function OrganizerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    organizer,
    showDashboardBanner,
    dismissDashboardBanner,
    snoozeDashboardBanner,
  } = useOrganizer();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Show banner only on main dashboard page
  const isMainDashboard = location.pathname === '/organizer';
  const showBanner = isMainDashboard && showDashboardBanner && !bannerDismissed;

  const handleBannerSetup = () => {
    navigate('/organizer/finance?tab=connect');
  };

  const handleBannerDismiss = async () => {
    setBannerDismissed(true);
    await dismissDashboardBanner();
  };

  const handleBannerRemindLater = async () => {
    setBannerDismissed(true);
    await snoozeDashboardBanner(7); // Snooze for 7 days
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#0F0F0F]/10">
        <div className="p-6 border-b border-[#0F0F0F]/10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2969FF] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold text-[#0F0F0F]">Ticketrack</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                location.pathname === item.path
                  ? 'bg-[#2969FF] text-white'
                  : 'text-[#0F0F0F]/60 hover:bg-[#F4F6FA]'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[#0F0F0F]/10">
          <Link
            to="/"
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-[#0F0F0F]/60 hover:bg-[#F4F6FA]"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#0F0F0F]/10 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2969FF] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">T</span>
                </div>
                <span className="text-xl font-bold text-[#0F0F0F]">Ticketrack</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6 text-[#0F0F0F]/60" />
              </button>
            </div>
            <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[#2969FF] text-white'
                      : 'text-[#0F0F0F]/60 hover:bg-[#F4F6FA]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-[#0F0F0F]/10 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden p-2 rounded-xl hover:bg-[#F4F6FA]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6 text-[#0F0F0F]" />
              </button>
              <h1 className="text-xl font-semibold text-[#0F0F0F]">Organizer Dashboard</h1>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate('/organizer/create-event')}
                className="bg-[#2969FF] hover:bg-[#2969FF]/90 text-white rounded-xl flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Event</span>
              </Button>
              <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                O
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Payment Gateway Setup Banner */}
          {showBanner && (
            <PaymentGatewayBanner
              onSetup={handleBannerSetup}
              onDismiss={handleBannerDismiss}
              onRemindLater={handleBannerRemindLater}
              countryCode={organizer?.country_code}
            />
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
