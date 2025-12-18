import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Settings,
  LayoutDashboard,
  Shield,
  Calendar,
  Users,
  UserCheck,
  CreditCard,
  RefreshCw,
  Share2,
  HeadphonesIcon,
  Mail,
  Send,
  MessageSquare,
  Smartphone,
  UserCog,
  LogOut,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/lib/supabase';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/admin/kyc', icon: Shield, label: 'KYC Verification' },
  { path: '/admin/events', icon: Calendar, label: 'Events' },
  { path: '/admin/organizers', icon: Users, label: 'Organizers' },
  { path: '/admin/attendees', icon: UserCheck, label: 'Attendees' },
  { path: '/admin/payouts', icon: CreditCard, label: 'Payouts' },
  { path: '/admin/refunds', icon: RefreshCw, label: 'Refunds' },
  { path: '/admin/affiliates', icon: Share2, label: 'Affiliates' },
  { path: '/admin/support', icon: HeadphonesIcon, label: 'Support' },
  { path: '/admin/email-templates', icon: Mail, label: 'Email Templates' },
  { path: '/admin/send-emails', icon: Send, label: 'Send Emails' },
  { path: '/admin/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
  { path: '/admin/sms', icon: Smartphone, label: 'SMS Campaigns' },
  { path: '/admin/roles', icon: UserCog, label: 'Roles & Permissions' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminLayout() {
  const { admin, loading } = useAdmin();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#2969FF] animate-spin mx-auto" />
          <p className="text-[#0F0F0F]/60 mt-4">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#0F0F0F]/10 transform transition-transform lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-[#0F0F0F]/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2969FF] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">T</span>
                </div>
                <span className="font-semibold text-[#0F0F0F]">Ticketrack Admin</span>
              </div>
              <button
                className="lg:hidden p-1 rounded-lg hover:bg-[#F4F6FA]"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-[#2969FF] text-white'
                      : 'text-[#0F0F0F]/70 hover:bg-[#F4F6FA]'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Admin Profile & Logout */}
          <div className="p-4 border-t border-[#0F0F0F]/10">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-medium">
                {admin.name?.charAt(0) || admin.email?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F0F0F] truncate">
                  {admin.name || 'Admin'}
                </p>
                <p className="text-xs text-[#0F0F0F]/60 truncate">{admin.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full justify-start rounded-xl border-[#0F0F0F]/10 text-[#0F0F0F]/70 hover:text-red-500 hover:border-red-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#0F0F0F]/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-[#F4F6FA]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#0F0F0F]/60">
                Welcome, <span className="font-medium text-[#0F0F0F]">{admin.name || 'Admin'}</span>
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
