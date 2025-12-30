import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Image,
  LayoutDashboard,
  Shield,
  Calendar,
  DollarSign,
  RefreshCw,
  MessageSquare,
  Users,
  Menu,
  X,
  Building,
  UserCheck,
  Mail,
  Send,
  Bell,
  TrendingUp,
  LogOut,
  Loader2,
  Settings,
  Clock,
  Home,
  FolderOpen, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Shield, label: 'KYC Verification', path: '/admin/kyc' },
  { icon: Calendar, label: 'Events', path: '/admin/events' },
  { icon: FolderOpen, label: 'Categories', path: '/admin/categories' }, // NEW: Categories link
  { icon: Building, label: 'Organizers', path: '/admin/organizers' },
  { icon: UserCheck, label: 'Attendees', path: '/admin/attendees' },
  { icon: DollarSign, label: 'Payouts', path: '/admin/payouts' },
  { icon: RefreshCw, label: 'Refunds', path: '/admin/refunds' },
  { icon: Receipt, label: 'Orders', path: '/admin/orders' },
  { icon: Settings, label: 'Refund Settings', path: '/admin/refund-settings' },
  { icon: Users, label: 'Affiliate Settings', path: '/admin/affiliate-settings' },
  { icon: Users, label: 'Affiliates', path: '/admin/affiliates' },
  { icon: AlertTriangle, label: 'Flagged Referrals', path: '/admin/flagged-referrals' },
  { icon: TrendingUp, label: 'Promoters', path: '/admin/promoters' },
  { icon: MessageSquare, label: 'Support', path: '/admin/support' },
  { icon: Mail, label: 'Email Templates', path: '/admin/email-templates' },
  { icon: Send, label: 'Send Emails', path: '/admin/send-emails' },
  { icon: MessageSquare, label: 'WhatsApp', path: '/admin/whatsapp' },
  { icon: MessageSquare, label: 'WhatsApp Packages', path: '/admin/whatsapp-packages' },
  { icon: Bell, label: 'SMS Campaigns', path: '/admin/sms' },
  { icon: Users, label: 'Roles & Permissions', path: '/admin/roles' },
  { icon: Clock, label: 'Waitlist', path: '/admin/waitlist' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

export function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, loading } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

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

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#0F0F0F]/10 fixed h-full">
        <div className="p-6 border-b border-[#0F0F0F]/10">
          <img src="/ticketrackLogo.png" alt="Ticketrack" className="h-10" />
          <p className="text-sm text-[#0F0F0F]/60 mt-1">Admin Portal</p>
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
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#0F0F0F]/10">
          <div className="flex items-center gap-3 mb-4 px-4">
            <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
              {admin.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F0F0F] truncate">{admin.name || 'Admin'}</p>
              <p className="text-xs text-[#0F0F0F]/60 truncate">{admin.role || 'Administrator'}</p>
            </div>
          </div>
          <Link
            to="/"
            className="w-full mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#0F0F0F]/10 text-[#0F0F0F]/60 hover:bg-[#F4F6FA] transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Website
          </Link>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full rounded-xl border-[#0F0F0F]/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

      </aside>
      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-white overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#0F0F0F]/10 flex items-center justify-between">
              <div>
                <img src="/ticketrackLogo.png" alt="Ticketrack" className="h-10" />
                <p className="text-sm text-[#0F0F0F]/60 mt-1">Admin Portal</p>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-6 h-6 text-[#0F0F0F]/60" />
              </button>
            </div>
            <nav className="p-4 space-y-1">
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
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-[#0F0F0F]/10">
              <Link
                to="/"
                className="w-full mb-2 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#0F0F0F]/10 text-[#0F0F0F]/60 hover:bg-[#F4F6FA] transition-colors"
              >
                <Home className="w-4 h-4" />
                Back to Website
              </Link>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full rounded-xl border-[#0F0F0F]/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
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
              <h1 className="text-xl font-semibold text-[#0F0F0F]">Admin Portal</h1>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-[#0F0F0F]/60 hidden md:block">{admin.email}</span>
              <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                {admin.name?.charAt(0) || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
