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
  const reAuthAttemptsRef = useRef(0);
  const reAuthLockoutUntilRef = useRef(null);

  const MAX_REAUTH_ATTEMPTS = 3;
  const REAUTH_LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

  // Session timeout: 30 minutes of inactivity (use shorter values for testing)
  // Production: 30 * 60 * 1000 (30 min), Testing: 60 * 1000 (1 min)
  const SESSION_TIMEOUT = process.env.NODE_ENV === 'development' ? 60 * 1000 : 30 * 60 * 1000;
  // Warning: 5 minutes before timeout
  // Production: 5 * 60 * 1000 (5 min), Testing: 30 * 1000 (30 sec)
  const WARNING_TIME = process.env.NODE_ENV === 'development' ? 30 * 1000 : 5 * 60 * 1000;

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

  // Re-authenticate for sensitive actions (payouts) with rate limiting
  const reAuthenticate = async (password) => {
    try {
      // Check if currently locked out
      if (reAuthLockoutUntilRef.current && Date.now() < reAuthLockoutUntilRef.current) {
        const remainingSeconds = Math.ceil((reAuthLockoutUntilRef.current - Date.now()) / 1000);
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        await logFinanceAction('reauth_blocked_lockout', null, null, { remaining_seconds: remainingSeconds });
        return {
          success: false,
          error: `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
          locked: true
        };
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) return { success: false, error: 'No user found' };

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password
      });

      if (error) {
        reAuthAttemptsRef.current += 1;
        await logFinanceAction('reauth_failed', null, null, {
          reason: error.message,
          attempt: reAuthAttemptsRef.current
        });

        // Lock out after max attempts
        if (reAuthAttemptsRef.current >= MAX_REAUTH_ATTEMPTS) {
          reAuthLockoutUntilRef.current = Date.now() + REAUTH_LOCKOUT_DURATION;
          await logFinanceAction('reauth_lockout', null, null, {
            attempts: reAuthAttemptsRef.current,
            lockout_until: new Date(reAuthLockoutUntilRef.current).toISOString()
          });
          return {
            success: false,
            error: 'Too many failed attempts. You are locked out for 5 minutes.',
            locked: true
          };
        }

        const remaining = MAX_REAUTH_ATTEMPTS - reAuthAttemptsRef.current;
        return {
          success: false,
          error: `Invalid password. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
        };
      }

      // Success - clear attempts
      reAuthAttemptsRef.current = 0;
      reAuthLockoutUntilRef.current = null;
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
