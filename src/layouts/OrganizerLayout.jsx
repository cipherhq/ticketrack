import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, BarChart3,
  DollarSign, Tag, UserPlus,
  Settings, LogOut, Menu, X, ChevronDown, Bell,
  QrCode, Building, RotateCcw, HelpCircle, Home, Receipt, ArrowRightLeft, ClipboardList, UsersRound, Zap, Coins
} from 'lucide-react';
import { useOrganizer } from '../contexts/OrganizerContext';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBadge, useOrganizerNotifications, OrganizerNotificationDropdown } from '@/components/NotificationBadge';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

// Grouped menu items for better organization with helpful descriptions
const menuGroups = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, path: '/organizer', tip: 'Overview of your events, sales, and key metrics' },
      { title: 'Events', icon: Calendar, path: '/organizer/events', tip: 'Create, edit, and manage all your events' },
      { title: 'Venues', icon: Building, path: '/organizer/venues', tip: 'Design interactive seating layouts for your venues' },
    ]
  },
  {
    id: 'sales',
    label: 'Sales & Attendees',
    items: [
      { title: 'Orders', icon: Receipt, path: '/organizer/orders', notificationKey: 'orders', tip: 'View all ticket orders and payment details' },
      { title: 'Attendees', icon: Users, path: '/organizer/attendees', tip: 'Manage attendee list and resend tickets' },
      { title: 'Check-In', icon: QrCode, path: '/organizer/check-in', tip: 'Scan tickets and check in attendees at your event' },
      { title: 'Transfers', icon: ArrowRightLeft, path: '/organizer/transfers', notificationKey: 'transfers', tip: 'Review and approve ticket transfers between attendees' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { title: 'Analytics', icon: BarChart3, path: '/organizer/analytics', tip: 'Sales reports, revenue charts, and performance insights' },
      { title: 'Payouts', icon: DollarSign, path: '/organizer/payouts', tip: 'Track your earnings and withdrawal history' },
      { title: 'Refunds', icon: RotateCcw, path: '/organizer/refunds', notificationKey: 'refunds', tip: 'Process and manage refund requests from attendees' },
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { title: 'Communication Hub', icon: LayoutDashboard, path: '/organizer/hub', tip: 'Unified email, SMS, and WhatsApp campaigns' },
      { title: 'Contacts', icon: Users, path: '/organizer/contacts', tip: 'Manage your audience contacts and segments' },
      { title: 'Automations', icon: Zap, path: '/organizer/automations', tip: 'Event reminders and automated messages' },
      { title: 'Message Credits', icon: Coins, path: '/organizer/credits', tip: 'Buy credits for SMS and WhatsApp' },
      { title: 'Promo Codes', icon: Tag, path: '/organizer/promo-codes', tip: 'Create discount codes to boost ticket sales' },
      { title: 'Promoters', icon: Users, path: '/organizer/promoters', tip: 'Invite promoters to sell tickets and earn commission' },
      { title: 'Followers', icon: UserPlus, path: '/organizer/followers', notificationKey: 'followers', tip: 'See who follows your organizer profile' },
    ]
  },
  {
    id: 'team',
    label: 'Team & Support',
    items: [
      { title: 'Team', icon: UsersRound, path: '/organizer/team', tip: 'Add team members with specific permissions' },
      { title: 'Projects', icon: ClipboardList, path: '/organizer/projects', notificationKey: 'projects', tip: 'Organize tasks and track event preparation' },
      { title: 'Support', icon: HelpCircle, path: '/organizer/support', notificationKey: 'support', tip: 'Get help from our support team' },
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { title: 'Profile', icon: Settings, path: '/organizer/profile', tip: 'Update your organizer name, logo, and bio' },
      { title: 'Bank Account', icon: DollarSign, path: '/organizer/bank-account', tip: 'Add bank details to receive payouts' },
      { title: 'KYC Verification', icon: Settings, path: '/organizer/kyc', tip: 'Verify your identity to unlock payouts' },
      { title: 'Stripe Connect', icon: Settings, path: '/organizer/stripe-connect', tip: 'Connect Stripe for international payments' },
      { title: 'Direct Payments', icon: Zap, path: '/organizer/paystack-connect', tip: 'Connect Paystack/Flutterwave for direct African payments', countries: ['NG', 'GH', 'KE', 'ZA'] },
      { title: 'Tax Documents', icon: Settings, path: '/organizer/tax-documents', tip: 'Download tax statements and receipts' },
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
      title={item.tip} // Native tooltip on hover
      className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
        isActive(item.path)
          ? 'bg-primary text-primary-foreground'
          : 'text-gray-900/70 hover:bg-gray-100'
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
          className={isActive(item.path) ? 'bg-white text-primary' : ''}
        />
      )}
    </Link>
  );

  const renderSidebar = (isMobile = false) => (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        <Logo className="h-10" />
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-900" />
          </button>
        )}
      </div>

      {/* Organizer Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {organizer?.logo_url ? (
            <img
              src={organizer.logo_url}
              alt={organizer.business_name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {organizer?.business_name || 'My Organization'}
            </p>
            <p className="text-xs text-gray-600">
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
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-gray-900/40 uppercase tracking-wider hover:text-gray-900/60"
            >
              <span>{group.label}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${collapsedGroups[group.id] ? '-rotate-90' : ''}`} />
            </button>
            {!collapsedGroups[group.id] && (
              <div className="mt-1 space-y-0.5">
                {group.items
                  .filter(item => !item.countries || item.countries.includes(organizer?.country_code))
                  .map(renderNavItem)}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Back to Website */}
      <div className="px-4 pb-2">
        <Link
          to="/"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          Back to Website
        </Link>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-6 h-6 text-gray-900" />
        </button>
        <Logo className="h-10" />
        <div className="relative">
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg relative"
          >
            <Bell className="w-6 h-6 text-gray-900" />
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
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {renderSidebar(true)}
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-between px-6">
          <div>
            <h2 className="font-medium text-gray-900">Welcome back!</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle className="text-gray-900/60" />
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-900/60" />
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
              className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-2"
            >
              {organizer?.logo_url ? (
                <img
                  src={organizer.logo_url}
                  alt={organizer.business_name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="w-4 h-4 text-primary" />
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
