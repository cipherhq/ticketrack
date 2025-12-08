import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
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
        setLoading(false);
        navigate('/');
        return;
      }

      setAdmin({
        id: user.id,
        email: user.email,
        name: profile.full_name,
        role: profile.admin_role,
      });
    } catch (error) {
      console.error('Admin check error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const logAdminAction = async (action, targetType = null, targetId = null, details = null) => {
    if (!admin) return;
    
    try {
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

  return (
    <AdminContext.Provider value={{ admin, loading, logAdminAction, refreshAdmin: checkAdminStatus }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
