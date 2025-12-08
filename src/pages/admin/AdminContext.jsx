import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const AdminContext = createContext(null);

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}

export function AdminProvider({ children }) {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_admin, admin_role')
        .eq('id', user.id)
        .single();

      if (error || !profile?.is_admin) {
        console.error('Not an admin or error:', error);
        navigate('/');
        return;
      }

      setAdmin({
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.admin_role || 'admin',
      });
    } catch (error) {
      console.error('Admin check error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const logAdminAction = async (action, targetType, targetId, details = null) => {
    try {
      if (!admin) return;

      await supabase.from('admin_logs').insert({
        admin_id: admin.id,
        action,
        target_type: targetType,
        target_id: targetId,
        details,
      });
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  };

  const refreshAdmin = () => {
    setLoading(true);
    checkAdminStatus();
  };

  const value = {
    admin,
    loading,
    logAdminAction,
    refreshAdmin,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}
