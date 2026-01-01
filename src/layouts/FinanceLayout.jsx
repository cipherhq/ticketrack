import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useFinance } from '@/contexts/FinanceContext';
import { 
  LayoutDashboard, Banknote, Users, Link2, History, 
  TrendingUp, Globe, PieChart, FileText, Settings,
  LogOut, Menu, X, DollarSign, Shield, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navGroups = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    path: '/finance/dashboard'
  },
  {
    id: 'payouts',
    label: 'Payouts',
    icon: Banknote,
    children: [
      { label: 'Event Payouts', path: '/finance/payouts/events', icon: Users },
      { label: 'Affiliate Payouts', path: '/finance/payouts/affiliates', icon: Link2 },
      { label: 'Payout History', path: '/finance/payouts/history', icon: History },
    ]
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    children: [
      { label: 'Overview', path: '/finance/revenue/overview', icon: TrendingUp },
      { label: 'By Country', path: '/finance/revenue/country', icon: Globe },
      { label: 'By Category', path: '/finance/revenue/category', icon: PieChart },
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/finance/reports',
    icon: FileText
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/finance/settings',
    icon: Settings
  },
];

export function FinanceLayout() {
  const navigate = useNavigate();
  const { financeUser, handleLogout, isFinanceAdmin } = useFinance();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({ payouts: true, revenue: false });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getRoleBadge = () => {
    if (financeUser?.isSuperAdmin) return <Badge className="bg-red-100 text-red-800">Super Admin</Badge>;
    if (financeUser?.financeRole === 'finance_admin') return <Badge className="bg-blue-100 text-blue-800">Finance Admin</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Finance Viewer</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#0F0F0F] text-white transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#2969FF] rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-lg">Finance</h1>
                <p className="text-xs text-white/60">Ticketrack</p>
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.id} className="mb-1">
              {group.children ? (
                <>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <group.icon className="w-5 h-5" />
                      {sidebarOpen && <span className="text-sm font-medium">{group.label}</span>}
                    </div>
                    {sidebarOpen && (
                      expandedGroups[group.id] 
                        ? <ChevronDown className="w-4 h-4" /> 
                        : <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {sidebarOpen && expandedGroups[group.id] && (
                    <div className="ml-4 mt-1 space-y-1">
                      {group.children.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive 
                                ? 'bg-[#2969FF] text-white' 
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`
                          }
                        >
                          <child.icon className="w-4 h-4" />
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <NavLink
                  to={group.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-[#2969FF] text-white' 
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <group.icon className="w-5 h-5" />
                  {sidebarOpen && group.label}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 rounded-xl bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#2969FF] rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{financeUser?.email}</p>
                  <div className="mt-1">{getRoleBadge()}</div>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full mt-3 text-white/60 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
