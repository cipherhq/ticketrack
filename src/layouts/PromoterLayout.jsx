import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  UserCircle,
  Menu,
  X,
  History,
  LogOut,
  Bell, FileText, HelpCircle,
} from 'lucide-react';
import { usePromoter } from '@/contexts/PromoterContext';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/promoter' },
  { icon: TrendingUp, label: 'Performance', path: '/promoter/performance' },
  { icon: CreditCard, label: 'Bank Accounts', path: '/promoter/bank-accounts' },
  { icon: History, label: 'Payment History', path: '/promoter/payment-history' },
  { icon: FileText, label: 'Tax Documents', path: '/promoter/tax-documents' },
  { icon: UserCircle, label: 'Profile', path: '/promoter/profile' },
  { icon: HelpCircle, label: 'Support', path: '/promoter/support' },
];

export function PromoterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { promoter } = usePromoter();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#0F0F0F]/10">
        <div className="p-6 border-b border-[#0F0F0F]/10">
          <Link to="/promoter" className="text-xl font-bold text-[#2969FF]">
<img src="/ticketrackLogo.png" alt="Ticketrack" className="h-8" />
          </Link>
          <p className="text-sm text-[#0F0F0F]/60 mt-2">Promoter Portal</p>
        </div>

        {promoter && (
          <div className="p-4 border-b border-[#0F0F0F]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-bold">
                {promoter.full_name?.charAt(0) || 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#0F0F0F] truncate">{promoter.full_name || 'Promoter'}</p>
                <p className="text-xs text-[#0F0F0F]/60">Code: {promoter.short_code || '---'}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
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

        <div className="p-4 border-t border-[#0F0F0F]/10 space-y-1">
          <Link to="/" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-[#0F0F0F]/60 hover:bg-[#F4F6FA]">
            <span>Back to Platform</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 w-full">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#0F0F0F]/10 flex items-center justify-between">
          <div>
            <Link to="/promoter"><img src="/ticketrackLogo.png" alt="Ticketrack" className="h-8" /></Link>
            <p className="text-sm text-[#0F0F0F]/60 mt-2">Promoter Portal</p>
          </div>
          <button onClick={() => setSidebarOpen(false)}><X className="w-6 h-6 text-[#0F0F0F]/60" /></button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${location.pathname === item.path ? 'bg-[#2969FF] text-white' : 'text-[#0F0F0F]/60 hover:bg-[#F4F6FA]'}`}>
              <item.icon className="w-5 h-5" /><span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#0F0F0F]/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button className="lg:hidden p-2 rounded-xl hover:bg-[#F4F6FA]" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-6 h-6 text-[#0F0F0F]" />
              </button>
              <h1 className="text-[#0F0F0F]">Promoter Portal</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button className="p-2 hover:bg-[#F4F6FA] rounded-lg relative"><Bell className="w-5 h-5 text-[#0F0F0F]/60" /></button>
              <div className="w-10 h-10 rounded-full bg-[#2969FF] flex items-center justify-center text-white font-bold">
                {promoter?.full_name?.charAt(0) || 'P'}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
