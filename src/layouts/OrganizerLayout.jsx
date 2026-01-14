import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Ticket, BarChart3,
  DollarSign, Tag, UserPlus, Mail, MessageCircle, MessageSquare,
  Settings, LogOut, Menu, X, ChevronDown, Bell, Shield,
  QrCode, Building, CreditCard, RotateCcw, HelpCircle, Home, Receipt, ArrowRightLeft, ClipboardList, UsersRound
, FileText } from 'lucide-react';
import { useOrganizer } from '../contexts/OrganizerContext';
import { useAuth } from '../contexts/AuthContext';

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/organizer',
  },
  {
    title: 'Events',
    icon: Calendar,
    path: '/organizer/events',
  },
  {
    title: 'Venues',
    icon: Building,
    path: '/organizer/venues',
  },
  {
    title: 'Orders',
    icon: Receipt,
    path: '/organizer/orders',
  },
  {
    title: 'Attendees',
    icon: Users,
    path: '/organizer/attendees',
  },
  {
    title: 'Check-In',
    icon: QrCode,
    path: '/organizer/check-in',
  },
  {
    title: 'Analytics',
    icon: BarChart3,
    path: '/organizer/analytics',
  },
  {
    title: 'Payouts',
    icon: DollarSign,
    path: '/organizer/payouts',
  },
  {
    title: 'Refunds',
    icon: RotateCcw,
    path: '/organizer/refunds',
  },
  {
    title: 'Transfers',
    icon: ArrowRightLeft,
    path: '/organizer/transfers',
  },
  {
    title: 'Support',
    icon: HelpCircle,
    path: '/organizer/support',
  },
  {
    title: "Team",
    icon: UsersRound,
    path: "/organizer/team",
  },
  {
    title: "Projects",
    icon: ClipboardList,
    path: "/organizer/projects",
  },
  {
    title: 'Marketing',
    icon: Tag,
    submenu: [
      { title: 'Promo Codes', path: '/organizer/promo-codes' },
      { title: 'Promoters', path: '/organizer/promoters' },
      { title: 'Communications', path: '/organizer/communications' },
      // { title: 'WhatsApp', path: '/organizer/whatsapp' },
      { title: 'Send SMS', path: '/organizer/sms' },
      { title: 'SMS Credits', path: '/organizer/sms-credits' },
      // { title: 'WhatsApp Credits', path: '/organizer/whatsapp-credits' },
    ],
  },
  {
    title: 'Followers',
    icon: UserPlus,
    path: '/organizer/followers',
  },
  {
    title: 'Settings',
    icon: Settings,
    submenu: [
      { title: 'Profile', path: '/organizer/profile' },
      { title: 'Bank Account', path: '/organizer/bank-account' },
      { title: 'KYC Verification', path: '/organizer/kyc' },
      { title: 'Stripe Connect', path: '/organizer/stripe-connect' },
      { title: 'Tax Documents', path: '/organizer/tax-documents' },
    ],
  },
];

export function OrganizerLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { organizer } = useOrganizer();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState([]);

  const toggleSubmenu = (title) => {
    setExpandedMenus(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
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
        <Link to="/organizer" className="flex items-center gap-2">
<img src="/ticketrackLogo.png" alt="Ticketrack" className="h-10" />
        </Link>
        <button className="p-2 hover:bg-[#F4F6FA] rounded-lg relative">
          <Bell className="w-6 h-6 text-[#0F0F0F]" />
        </button>
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
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#0F0F0F]/10">
            <Link to="/organizer" className="flex items-center gap-2">
<img src="/ticketrackLogo.png" alt="Ticketrack" className="h-10" />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-[#F4F6FA] rounded-lg"
            >
              <X className="w-5 h-5 text-[#0F0F0F]" />
            </button>
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
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.title}>
                  {item.submenu ? (
                    <div>
                      <button
                        onClick={() => toggleSubmenu(item.title)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                          item.submenu.some(sub => isActive(sub.path))
                            ? 'bg-[#2969FF]/10 text-[#2969FF]'
                            : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          {item.title}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            expandedMenus.includes(item.title) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {expandedMenus.includes(item.title) && (
                        <ul className="mt-1 ml-8 space-y-1">
                          {item.submenu.map((subItem) => (
                            <li key={subItem.path}>
                              <Link
                                to={subItem.path}
                                onClick={() => setSidebarOpen(false)}
                                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isActive(subItem.path)
                                    ? 'bg-[#2969FF] text-white'
                                    : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
                                }`}
                              >
                                {subItem.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive(item.path)
                          ? 'bg-[#2969FF] text-white'
                          : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Back to Website */}
          <div className="px-4 pb-2">
            <Link
              to="/"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[#0F0F0F]/60 hover:bg-[#F4F6FA] transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Website
            </Link>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-[#0F0F0F]/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-[#0F0F0F]/10 items-center justify-between px-6">
          <div>
            <h2 className="font-medium text-[#0F0F0F]">Welcome back!</h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-[#F4F6FA] rounded-lg relative">
              <Bell className="w-5 h-5 text-[#0F0F0F]/60" />
            </button>
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
