import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, FileText, ArrowRightLeft,
  LayoutDashboard, Shield, Calendar, DollarSign, RefreshCw,
  MessageSquare, Users, Menu, X, Building, UserCheck,
  Mail, Send, Bell, TrendingUp, LogOut, Loader2, Settings,
  Clock, Home, FolderOpen, Receipt, ChevronDown, Globe, Megaphone, CreditCard,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';
import { NotificationBadge, useAdminNotifications } from '@/components/NotificationBadge';

// Grouped navigation items for cleaner organization
const navGroups = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    ]
  },
  {
    id: 'verification',
    label: 'Verification',
    items: [
      { icon: Shield, label: 'KYC Verification', path: '/admin/kyc', notificationKey: 'kycPending' },
      { icon: FileText, label: 'KYC Review', path: '/admin/kyc-review' },
    ]
  },
  {
    id: 'users',
    label: 'Users',
    items: [
      { icon: Users, label: 'All Users', path: '/admin/users' },
      { icon: Building, label: 'Organizers', path: '/admin/organizers' },
      { icon: UserCheck, label: 'Attendees', path: '/admin/attendees' },
    ]
  },
  {
    id: 'management',
    label: 'Events & Content',
    items: [
      { icon: Calendar, label: 'Events', path: '/admin/events' },
      { icon: FolderOpen, label: 'Categories', path: '/admin/categories' },
      { icon: Megaphone, label: 'Adverts', path: '/admin/adverts' },
    ]
  },
  {
    id: 'finance',
    label: 'Finance & Orders',
    items: [
      { icon: DollarSign, label: 'Finance', path: '/admin/finance' },
      { icon: Receipt, label: 'Orders', path: '/admin/orders' },
      { icon: RefreshCw, label: 'Refunds', path: '/admin/refunds', notificationKey: 'refundsPending' },
      { icon: Settings, label: 'Refund Settings', path: '/admin/refund-settings' },
      { icon: ArrowRightLeft, label: 'Transfers', path: '/admin/transfers' },
      { icon: CreditCard, label: 'Payment Connections', path: '/admin/payment-connections' },
      { icon: DollarSign, label: 'Fee Management', path: '/admin/fees' },
    ]
  },
  {
    id: 'affiliates',
    label: 'Affiliates & Promoters',
    items: [
      { icon: Settings, label: 'Affiliate Settings', path: '/admin/affiliate-settings' },
      { icon: Users, label: 'Affiliates', path: '/admin/affiliates' },
      { icon: AlertTriangle, label: 'Flagged Referrals', path: '/admin/flagged-referrals', notificationKey: 'flaggedReferrals' },
      { icon: TrendingUp, label: 'Promoters', path: '/admin/promoters' },
    ]
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { icon: MessageSquare, label: 'Support', path: '/admin/support', notificationKey: 'supportOpen' },
      { icon: Mail, label: 'Email Templates', path: '/admin/email-templates' },
      { icon: Send, label: 'Send Emails', path: '/admin/send-emails' },
      { icon: Bell, label: 'SMS Campaigns', path: '/admin/sms' },
      { icon: Bell, label: 'SMS Packages', path: '/admin/sms-packages' },
      { icon: DollarSign, label: 'SMS Revenue', path: '/admin/sms-revenue' },
      { icon: Settings, label: 'SMS Settings', path: '/admin/sms-settings' },
      { icon: MessageSquare, label: 'WhatsApp', path: '/admin/whatsapp' },
      { icon: Settings, label: 'WhatsApp Settings', path: '/admin/whatsapp-settings' },
      { icon: DollarSign, label: 'WhatsApp Packages', path: '/admin/whatsapp-packages' },
    ]
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { icon: Globe, label: 'Country Features', path: '/admin/country-features' },
      { icon: Shield, label: 'User Access Control', path: '/admin/user-types' },
      { icon: Users, label: 'Roles & Permissions', path: '/admin/roles' },
      { icon: Clock, label: 'Waitlist', path: '/admin/waitlist', notificationKey: 'waitlist' },
      { icon: Settings, label: 'Settings', path: '/admin/settings' },
    ]
  },
];

export function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, loading } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const { counts } = useAdminNotifications();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isActive = (path) => location.pathname === path;

  const getTotalNotifications = () => counts.total;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  const renderNavItem = (item) => (
    <Link
      key={item.path}
      to={item.path}
      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
        isActive(item.path)
          ? 'bg-[#2969FF] text-white'
          : 'text-[#0F0F0F]/60 hover:bg-[#F4F6FA] hover:text-[#0F0F0F]'
      }`}
      title={item.label}
    >
      <span className="flex items-center gap-3">
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
      {item.notificationKey && counts[item.notificationKey] > 0 && (
        <NotificationBadge 
          count={counts[item.notificationKey]} 
          size="sm"
          pulse={counts[item.notificationKey] > 5}
        />
      )}
    </Link>
  );

  const renderSidebar = (isMobile = false) => (
    <>
      <div className="p-4 border-b border-[#0F0F0F]/10 flex items-center justify-between">
        <div>
          <Logo className="h-8" />
          <p className="text-xs text-[#0F0F0F]/60 mt-1">Admin Portal</p>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6 text-[#0F0F0F]/60" />
          </button>
        )}
      </div>
      
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
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

      <div className="p-3 border-t border-[#0F0F0F]/10">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium text-sm">
            {admin.name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F0F0F] truncate">{admin.name || 'Admin'}</p>
            <p className="text-xs text-[#0F0F0F]/60 truncate">{admin.role || 'Administrator'}</p>
          </div>
        </div>
        <Link
          to="/"
          className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#0F0F0F]/10 text-[#0F0F0F]/60 hover:bg-[#F4F6FA] transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          Back to Website
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full rounded-lg border-[#0F0F0F]/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#0F0F0F]/10 fixed h-full">
        {renderSidebar()}
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-white overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebar(true)}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b border-[#0F0F0F]/10 px-4 lg:px-6 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-[#F4F6FA]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5 text-[#0F0F0F]" />
              </button>
              <h1 className="text-lg font-semibold text-[#0F0F0F]">Admin Portal</h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Notification Bell */}
              <button className="relative p-2 rounded-lg hover:bg-[#F4F6FA]" title="Notifications">
                <Bell className="w-5 h-5 text-[#0F0F0F]/60" />
                {getTotalNotifications() > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              <span className="text-sm text-[#0F0F0F]/60 hidden md:block">{admin.email}</span>
              <div className="w-8 h-8 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium text-sm">
                {admin.name?.charAt(0) || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
