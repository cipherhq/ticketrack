import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useFinance } from '@/contexts/FinanceContext';
import {
  LayoutDashboard, Banknote, Users, Link2, History,
  TrendingUp, Globe, PieChart, FileText, Settings,
  LogOut, Menu, X, DollarSign, Shield, ChevronDown, ChevronRight,
  Calendar, UserCheck, Star, Bell, Home, Lock, Package,
  AlertTriangle, CheckCircle, Building, Receipt, BarChart3,
  Clock, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationBadge, useFinanceNotifications } from '@/components/NotificationBadge';
import { ThemeToggle } from '@/components/ThemeToggle';

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
      { label: 'Event Payouts', path: '/finance/payouts/events', icon: Calendar, notificationKey: 'pendingPayouts' },
      { label: 'Promoter Payouts', path: '/finance/payouts/promoters', icon: UserCheck, notificationKey: 'promoterPayouts' },
      { label: 'Affiliate Payouts', path: '/finance/payouts/affiliates', icon: Link2, notificationKey: 'affiliatePayouts' },
      { label: 'Payout History', path: '/finance/payouts/history', icon: History },
      { label: 'Back Office Funding', path: '/finance/payouts/funding', icon: Star },
    ]
  },
  {
    id: 'escrow',
    label: 'Escrow & Operations',
    icon: Lock,
    children: [
      { label: 'Escrow Management', path: '/finance/escrow', icon: Lock },
      { label: 'Payment Batching', path: '/finance/batching', icon: Package },
      { label: 'Pending Approvals', path: '/finance/approvals', icon: CheckCircle, notificationKey: 'pendingApprovals' },
    ]
  },
  {
    id: 'disputes',
    label: 'Disputes',
    icon: AlertTriangle,
    children: [
      { label: 'Chargebacks', path: '/finance/chargebacks', icon: AlertTriangle, notificationKey: 'openChargebacks' },
    ]
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    icon: Building,
    children: [
      { label: 'Settlements', path: '/finance/settlements', icon: Receipt },
      { label: 'Bank Reconciliation', path: '/finance/bank-reconciliation', icon: Building },
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
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    children: [
      { label: 'Platform P&L', path: '/finance/pnl', icon: BarChart3 },
      { label: 'Expenses', path: '/finance/expenses', icon: Receipt },
      { label: 'Revenue Forecast', path: '/finance/forecast', icon: Target },
      { label: 'Aging Reports', path: '/finance/aging', icon: Clock },
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/finance/reports',
    icon: FileText
  },
  {
    id: 'audit',
    label: 'Audit & Invoices',
    icon: FileText,
    children: [
      { label: 'Audit Log', path: '/finance/audit-log', icon: History },
      { label: 'Invoices', path: '/finance/invoices', icon: FileText },
    ]
  },
  {
    id: 'fees',
    label: 'Fee Management',
    path: '/finance/fees',
    icon: DollarSign
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
  const [expandedGroups, setExpandedGroups] = useState({
    payouts: true,
    escrow: false,
    disputes: false,
    reconciliation: false,
    revenue: false,
    analytics: false,
    audit: false
  });
  const { counts } = useFinanceNotifications();

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getTotalNotifications = () => counts.total;

  const getGroupNotifications = (group) => {
    if (!group.children) return 0;
    return group.children.reduce((sum, child) => {
      return sum + (child.notificationKey ? (counts[child.notificationKey] || 0) : 0);
    }, 0);
  };

  const getRoleBadge = () => {
    if (financeUser?.isSuperAdmin) return <Badge className="bg-red-100 text-red-800 text-xs">Super Admin</Badge>;
    if (financeUser?.financeRole === 'finance_admin') return <Badge className="bg-blue-100 text-blue-800 text-xs">Finance Admin</Badge>;
    return <Badge className="bg-gray-100 text-gray-900 text-xs">Finance Viewer</Badge>;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#0F0F0F] text-white transition-all duration-300 flex flex-col fixed h-full z-40`}>
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
                      <div className="flex items-center gap-2">
                        {getGroupNotifications(group) > 0 && (
                          <NotificationBadge count={getGroupNotifications(group)} size="sm" />
                        )}
                        {expandedGroups[group.id] 
                          ? <ChevronDown className="w-4 h-4" /> 
                          : <ChevronRight className="w-4 h-4" />
                        }
                      </div>
                    )}
                  </button>
                  {sidebarOpen && expandedGroups[group.id] && (
                    <div className="ml-4 mt-1 space-y-1">
                      {group.children.map((child) => (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={({ isActive }) =>
                            `flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              isActive 
                                ? 'bg-[#2969FF] text-white' 
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`
                          }
                        >
                          <span className="flex items-center gap-3">
                            <child.icon className="w-4 h-4" />
                            {child.label}
                          </span>
                          {child.notificationKey && counts[child.notificationKey] > 0 && (
                            <NotificationBadge count={counts[child.notificationKey]} size="sm" />
                          )}
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
              <div className="mt-3 space-y-2">
                <NavLink
                  to="/"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm"
                >
                  <Home className="w-4 h-4" />
                  Back to Website
                </NavLink>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Finance Portal</h1>
            <div className="flex items-center gap-4">
              <ThemeToggle className="text-gray-900/60" />
              <button className="relative p-2 rounded-lg hover:bg-gray-100 group" title="Notifications">
                <Bell className="w-5 h-5 text-gray-900/60" />
                {getTotalNotifications() > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
                {/* Tooltip */}
                {getTotalNotifications() > 0 && (
                  <div className="absolute right-0 top-full mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg
                                  opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap">
                    {getTotalNotifications()} pending payouts
                  </div>
                )}
              </button>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium text-sm">
                {financeUser?.email?.charAt(0)?.toUpperCase() || 'F'}
              </div>
            </div>
          </div>
        </header>
        
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
