import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const FinanceContext = createContext({});

export const useFinance = () => useContext(FinanceContext);

export function FinanceProvider({ children }) {
  const navigate = useNavigate();
  const [financeUser, setFinanceUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const hasCheckedAccess = useRef(false);

  // Session timeout: 30 minutes of inactivity
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  // Warning: 5 minutes before timeout
  const WARNING_TIME = 5 * 60 * 1000;

  const checkFinanceAccess = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setFinanceUser(null);
        setLoading(false);
        return;
      }

      // Check if user is super_admin in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // Super admins always have access
      if (profile?.role === 'super_admin') {
        setFinanceUser({
          ...user,
          financeRole: 'super_admin',
          isSuperAdmin: true
        });
        setLoading(false);
        return;
      }

      // Check finance_users table
      const { data: financeData, error } = await supabase
        .from('finance_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !financeData) {
        setFinanceUser(null);
      } else {
        setFinanceUser({
          ...user,
          financeRole: financeData.role,
          financeId: financeData.id,
          isSuperAdmin: false
        });

        // Update last login
        await supabase
          .from('finance_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', financeData.id);
      }
    } catch (error) {
      console.error('Error checking finance access:', error);
      setFinanceUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasCheckedAccess.current) {
      hasCheckedAccess.current = true;
      checkFinanceAccess();
    }
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setFinanceUser(null);
        navigate('/finance/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [checkFinanceAccess, navigate]);

  // Activity tracker for session timeout with warning
  useEffect(() => {
    if (!financeUser) return;

    const clearTimers = () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };

    const resetTimer = () => {
      clearTimers();

      // Dismiss any existing warning toast
      toast.dismiss('finance-session-warning');

      // Set warning timer (5 minutes before timeout)
      warningTimerRef.current = setTimeout(() => {
        toast.warning(
          'Your finance session will expire in 5 minutes due to inactivity.',
          {
            duration: 60000,
            id: 'finance-session-warning',
            description: 'Move your mouse or press any key to stay logged in.',
          }
        );
      }, SESSION_TIMEOUT - WARNING_TIME);

      // Set logout timer
      sessionTimerRef.current = setTimeout(() => {
        toast.error('Session expired due to inactivity.', { id: 'finance-session-expired' });
        logFinanceAction('session_timeout', null, null, { reason: 'inactivity' });
        handleLogout();
      }, SESSION_TIMEOUT);
    };

    // Reset on activity
    const activityEvents = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer(); // Initialize

    return () => {
      clearTimers();
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [financeUser]);

  const logFinanceAction = async (action, resourceType = null, resourceId = null, details = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('finance_audit_log').insert({
        user_id: user?.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: null,
        user_agent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging finance action:', error);
    }
  };

  const handleLogout = async () => {
    await logFinanceAction('logout');
    await supabase.auth.signOut();
    setFinanceUser(null);
    navigate('/finance/login');
  };

  // Re-authenticate for sensitive actions (payouts)
  const reAuthenticate = async (password) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) return { success: false, error: 'No user found' };

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password
      });

      if (error) {
        await logFinanceAction('reauth_failed', null, null, { reason: error.message });
        return { success: false, error: 'Invalid password' };
      }

      await logFinanceAction('reauth_success');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    financeUser,
    loading,
    logFinanceAction,
    handleLogout,
    reAuthenticate,
    checkFinanceAccess,
    isFinanceAdmin: financeUser?.financeRole === 'finance_admin' || financeUser?.isSuperAdmin,
    canProcessPayouts: financeUser?.financeRole !== 'finance_viewer'
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}
