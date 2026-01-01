import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const FinanceContext = createContext({});

export const useFinance = () => useContext(FinanceContext);

export function FinanceProvider({ children }) {
  const navigate = useNavigate();
  const [financeUser, setFinanceUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionTimerRef = useRef(null);
  const hasCheckedAccess = useRef(false);

  // Session timeout: 30 minutes of inactivity
  const SESSION_TIMEOUT = 30 * 60 * 1000;

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

  // Activity tracker for session timeout
  useEffect(() => {
    if (!financeUser) return;

    const resetTimer = () => {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
      }
      sessionTimerRef.current = setTimeout(() => {
        logFinanceAction('session_timeout', null, null, { reason: 'inactivity' });
        handleLogout();
      }, SESSION_TIMEOUT);
    };

    // Reset on activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer(); // Initialize

    return () => {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
      }
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('click', resetTimer);
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
