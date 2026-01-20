import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, BarChart3,
  DollarSign, Tag, UserPlus,
  Settings, LogOut, Menu, X, ChevronDown, Bell,
  QrCode, Building, RotateCcw, HelpCircle, Home, Receipt, ArrowRightLeft, ClipboardList, UsersRound
} from 'lucide-react';
import { useOrganizer } from '../contexts/OrganizerContext';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBadge, useOrganizerNotifications, OrganizerNotificationDropdown } from '@/components/NotificationBadge';
import { Logo } from '@/components/Logo';

// Grouped menu items for better organization
const menuGroups = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, path: '/organizer' },
      { title: 'Events', icon: Calendar, path: '/organizer/events' },
      { title: 'Venues', icon: Building, path: '/organizer/venues' },
      { title: 'Event Place', icon: Home, path: '/organizer/event-place' },
    ]
  },
  {
    id: 'sales',
    label: 'Sales & Attendees',
    items: [
      { title: 'Orders', icon: Receipt, path: '/organizer/orders', notificationKey: 'orders' },
      { title: 'Attendees', icon: Users, path: '/organizer/attendees' },
      { title: 'Check-In', icon: QrCode, path: '/organizer/check-in' },
      { title: 'Transfers', icon: ArrowRightLeft, path: '/organizer/transfers', notificationKey: 'transfers' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { title: 'Analytics', icon: BarChart3, path: '/organizer/analytics' },
      { title: 'Payouts', icon: DollarSign, path: '/organizer/payouts' },
      { title: 'Refunds', icon: RotateCcw, path: '/organizer/refunds', notificationKey: 'refunds' },
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { title: 'Promo Codes', icon: Tag, path: '/organizer/promo-codes' },
      { title: 'Promoters', icon: Users, path: '/organizer/promoters' },
      { title: 'Communications', icon: Tag, path: '/organizer/communications' },
      { title: 'Send SMS', icon: Tag, path: '/organizer/sms' },
      { title: 'SMS Credits', icon: Tag, path: '/organizer/sms-credits' },
      { title: 'Followers', icon: UserPlus, path: '/organizer/followers', notificationKey: 'followers' },
    ]
  },
  {
    id: 'team',
    label: 'Team & Support',
    items: [
      { title: 'Team', icon: UsersRound, path: '/organizer/team' },
      { title: 'Projects', icon: ClipboardList, path: '/organizer/projects', notificationKey: 'projects' },
      { title: 'Support', icon: HelpCircle, path: '/organizer/support', notificationKey: 'support' },
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { title: 'Profile', icon: Settings, path: '/organizer/profile' },
      { title: 'Bank Account', icon: DollarSign, path: '/organizer/bank-account' },
      { title: 'KYC Verification', icon: Settings, path: '/organizer/kyc' },
      { title: 'Stripe Connect', icon: Settings, path: '/organizer/stripe-connect' },
      { title: 'Tax Documents', icon: Settings, path: '/organizer/tax-documents' },
    ]
  },
];

export function OrganizerLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { counts, markAsViewed } = useOrganizerNotifications(organizer?.id);

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isActive = (path) => {
    if (path === '/organizer') {
      return location.pathname === '/organizer';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getTotalNotifications = () => counts.total;

  const handleNavClick = (item) => {
    setSidebarOpen(false);
    // Clear notification badge when tab is clicked
    if (item.notificationKey && counts[item.notificationKey] > 0) {
      markAsViewed(item.notificationKey);
    }
  };

  const renderNavItem = (item) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={() => handleNavClick(item)}
      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
        isActive(item.path)
          ? 'bg-[#2969FF] text-white'
          : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
      }`}
    >
      <span className="flex items-center gap-3">
        <item.icon className="w-4 h-4" />
        {item.title}
      </span>
      {item.notificationKey && counts[item.notificationKey] > 0 && (
        <NotificationBadge 
          count={counts[item.notificationKey]} 
          size="sm"
          className={isActive(item.path) ? 'bg-white text-[#2969FF]' : ''}
        />
      )}
    </Link>
  );

  const renderSidebar = (isMobile = false) => (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#0F0F0F]/10">
        <Logo className="h-10" />
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-[#F4F6FA] rounded-lg"
          >
            <X className="w-5 h-5 text-[#0F0F0F]" />
          </button>
        )}
      </div>

      {/* Organizer Info */}
      <div className="p-4 border-b border-[#0F0F0F]/10">
        <div className="flex items-center gap-3">
          {organizer?.logo_url ? (
            <img
              src={organizer.logo_url}
              alt={organizer.business_name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
              <Building className="w-5 h-5 text-[#2969FF]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#0F0F0F] truncate">
              {organizer?.business_name || 'My Organization'}
            </p>
            <p className="text-xs text-[#0F0F0F]/60">
              {organizer?.kyc_status === 'approved' ? 'Verified' : 'Basic'} Account
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {menuGroups.map((group) => (
          <div key={group.id}>
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-[#0F0F0F]/40 uppercase tracking-wider hover:text-[#0F0F0F]/60"
            >
              <span>{group.label}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${collapsedGroups[group.id] ? '-rotate-90' : ''}`} />
            </button>
            {!collapsedGroups[group.id] && (
              <div className="mt-1 space-y-0.5">
                {group.items.map(renderNavItem)}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Back to Website */}
      <div className="px-4 pb-2">
        <Link
          to="/"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[#0F0F0F]/60 hover:bg-[#F4F6FA] transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          Back to Website
        </Link>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-[#0F0F0F]/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#0F0F0F]/10 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-[#F4F6FA] rounded-lg"
        >
          <Menu className="w-6 h-6 text-[#0F0F0F]" />
        </button>
        <Logo className="h-10" />
        <div className="relative">
          <button 
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="p-2 hover:bg-[#F4F6FA] rounded-lg relative"
          >
            <Bell className="w-6 h-6 text-[#0F0F0F]" />
            {getTotalNotifications() > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
          <OrganizerNotificationDropdown 
            organizerId={organizer?.id}
            isOpen={notificationOpen}
            onClose={() => setNotificationOpen(false)}
          />
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-[#0F0F0F]/10 z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {renderSidebar(true)}
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-[#0F0F0F]/10 items-center justify-between px-6">
          <div>
            <h2 className="font-medium text-[#0F0F0F]">Welcome back!</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="p-2 hover:bg-[#F4F6FA] rounded-lg relative" 
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-[#0F0F0F]/60" />
                {getTotalNotifications() > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              <OrganizerNotificationDropdown 
                organizerId={organizer?.id}
                isOpen={notificationOpen}
                onClose={() => setNotificationOpen(false)}
              />
            </div>
            <Link
              to="/organizer/profile"
              className="flex items-center gap-2 hover:bg-[#F4F6FA] rounded-lg p-2"
            >
              {organizer?.logo_url ? (
                <img
                  src={organizer.logo_url}
                  alt={organizer.business_name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#2969FF]/10 flex items-center justify-center">
                  <Building className="w-4 h-4 text-[#2969FF]" />
                </div>
              )}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
