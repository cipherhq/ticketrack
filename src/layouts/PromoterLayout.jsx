import { useState, useEffect } from 'react';
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
  Bell, FileText, HelpCircle, Home,
} from 'lucide-react';
import { usePromoter } from '@/contexts/PromoterContext';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBadge, PromoterNotificationDropdown } from '@/components/NotificationBadge';
import { supabase } from '@/lib/supabase';

// Helper functions for localStorage
const getLastViewed = (key) => {
  try {
    const stored = localStorage.getItem(`notification_viewed_${key}`)
    return stored ? new Date(stored) : null
  } catch {
    return null
  }
}

const setLastViewed = (key) => {
  try {
    localStorage.setItem(`notification_viewed_${key}`, new Date().toISOString())
  } catch {
    // localStorage not available
  }
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/promoter' },
  { icon: TrendingUp, label: 'Performance', path: '/promoter/performance', notificationKey: 'newSales' },
  { icon: CreditCard, label: 'Bank Accounts', path: '/promoter/bank-accounts' },
  { icon: History, label: 'Payment History', path: '/promoter/payment-history', notificationKey: 'pendingPayouts' },
  { icon: FileText, label: 'Tax Documents', path: '/promoter/tax-documents' },
  { icon: UserCircle, label: 'Profile', path: '/promoter/profile' },
  { icon: HelpCircle, label: 'Support', path: '/promoter/support', notificationKey: 'supportTickets' },
];

// Hook for promoter notifications
function usePromoterNotifications(promoterId) {
  const [counts, setCounts] = useState({
    newSales: 0,
    pendingPayouts: 0,
    supportTickets: 0,
    total: 0
  });

  const markAsViewed = (key) => {
    setLastViewed(key);
    setCounts(prev => ({
      ...prev,
      [key]: 0,
      total: prev.total - prev[key]
    }));
  };

  useEffect(() => {
    if (!promoterId) return;

    const fetchCounts = async () => {
      let newSales = 0;
      let pendingPayouts = 0;
      let supportTickets = 0;

      // Get last viewed times
      const salesLastViewed = getLastViewed('newSales');
      const payoutsLastViewed = getLastViewed('pendingPayouts');
      const supportLastViewed = getLastViewed('supportTickets');

      try {
        // Fetch new sales (since last viewed or last 24 hours)
        const sinceTime = salesLastViewed || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('promoter_id', promoterId)
          .in('status', ['completed', 'confirmed', 'paid'])
          .gte('created_at', sinceTime.toISOString());
        newSales = count || 0;
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch pending payouts for this promoter
        let query = supabase
          .from('promoter_payouts')
          .select('*', { count: 'exact', head: true })
          .eq('promoter_id', promoterId)
          .eq('status', 'pending');
        
        if (payoutsLastViewed) {
          query = query.gte('created_at', payoutsLastViewed.toISOString());
        }
        
        const { count } = await query;
        pendingPayouts = count || 0;
      } catch (e) { /* table may not exist */ }

      try {
        // Fetch open support tickets
        let query = supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('promoter_id', promoterId)
          .in('status', ['open', 'pending']);
        
        if (supportLastViewed) {
          query = query.gte('created_at', supportLastViewed.toISOString());
        }
        
        const { count } = await query;
        supportTickets = count || 0;
      } catch (e) { /* table may not exist */ }

      setCounts({
        newSales,
        pendingPayouts,
        supportTickets,
        total: newSales + pendingPayouts + supportTickets
      });
    };

    fetchCounts();
    // Refresh every 5 minutes (reduced from 60s to lower Disk IO)
    const interval = setInterval(fetchCounts, 300000);
    return () => clearInterval(interval);
  }, [promoterId]);

  return { counts, markAsViewed };
}

export function PromoterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { promoter } = usePromoter();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { counts, markAsViewed } = usePromoterNotifications(promoter?.id);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavClick = (item) => {
    setSidebarOpen(false);
    // Clear notification badge when tab is clicked
    if (item.notificationKey && counts[item.notificationKey] > 0) {
      markAsViewed(item.notificationKey);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border/10">
        <div className="p-6 border-b border-border/10">
          <Logo className="h-8" />
          <p className="text-sm text-muted-foreground mt-2">Promoter Portal</p>
        </div>

        {promoter && (
          <div className="p-4 border-b border-border/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                {promoter.full_name?.charAt(0) || 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{promoter.full_name || 'Promoter'}</p>
                <p className="text-xs text-muted-foreground">Code: {promoter.short_code || '---'}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => handleNavClick(item)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/60 hover:bg-muted'
              }`}
            >
              <span className="flex items-center space-x-3">
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
              </span>
              {item.notificationKey && counts[item.notificationKey] > 0 && (
                <NotificationBadge
                  count={counts[item.notificationKey]}
                  size="sm"
                  className={location.pathname === item.path ? 'bg-white text-primary' : ''}
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border/10 space-y-1">
          <Link to="/" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted">
            <Home className="w-5 h-5" />
            <span>Back to Platform</span>
          </Link>
          <button onClick={handleLogout} className="flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-500/10 w-full">
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-card z-50 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-border/10 flex items-center justify-between">
          <div>
            <Logo className="h-8" />
            <p className="text-sm text-muted-foreground mt-2">Promoter Portal</p>
          </div>
          <button onClick={() => setSidebarOpen(false)}><X className="w-6 h-6 text-muted-foreground" /></button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => handleNavClick(item)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${location.pathname === item.path ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:bg-muted'}`}>
              <span className="flex items-center space-x-3">
                <item.icon className="w-5 h-5" /><span>{item.label}</span>
              </span>
              {item.notificationKey && counts[item.notificationKey] > 0 && (
                <NotificationBadge
                  count={counts[item.notificationKey]}
                  size="sm"
                  className={location.pathname === item.path ? 'bg-white text-primary' : ''}
                />
              )}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-card border-b border-border/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button className="lg:hidden p-2 rounded-xl hover:bg-muted" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-6 h-6 text-foreground" />
              </button>
              <h1 className="text-foreground">Promoter Portal</h1>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle className="text-foreground/60" />
              <div className="relative">
                <button
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="p-2 hover:bg-muted rounded-lg relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5 text-foreground/60" />
                  {counts.total > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
                <PromoterNotificationDropdown
                  promoterId={promoter?.id}
                  isOpen={notificationOpen}
                  onClose={() => setNotificationOpen(false)}
                />
              </div>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
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
