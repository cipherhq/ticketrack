import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const AdminContext = createContext(null);

// Role-based permissions
const ROLE_PERMISSIONS = {
  super_admin: {
    canAccessFinance: true,
    canManageOrganizers: true,
    canManageUsers: true,
    canManageEvents: true,
    canManageKYC: true,
    canManageSupport: true,
    canManageSettings: true,
    canManageRoles: true,
    canManageAffiliates: true,
    canManageCommunications: true,
    canViewReports: true,
    canProcessPayouts: true,
    canProcessRefunds: true,
    canManageFees: true,
    canManagePaymentConnections: true,
    isFullAdmin: true,
  },
  admin: {
    canAccessFinance: true,
    canManageOrganizers: true,
    canManageUsers: true,
    canManageEvents: true,
    canManageKYC: true,
    canManageSupport: true,
    canManageSettings: true,
    canManageRoles: true,
    canManageAffiliates: true,
    canManageCommunications: true,
    canViewReports: true,
    canProcessPayouts: true,
    canProcessRefunds: true,
    canManageFees: true,
    canManagePaymentConnections: true,
    isFullAdmin: true,
  },
  support: {
    canAccessFinance: false,
    canManageOrganizers: true,
    canManageUsers: true,
    canManageEvents: true,
    canManageKYC: true,
    canManageSupport: true,
    canManageSettings: false,
    canManageRoles: false,
    canManageAffiliates: true,
    canManageCommunications: true,
    canViewReports: false,
    canProcessPayouts: false,
    canProcessRefunds: false,
    canManageFees: false,
    canManagePaymentConnections: false,
    isFullAdmin: false,
  },
};

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});
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

      const role = profile.admin_role || 'support';
      setAdmin({
        id: user.id,
        email: user.email,
        name: profile.full_name,
        role: role,
      });
      setPermissions(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.support);
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

  // Helper to check if user has a specific permission
  const hasPermission = (permission) => {
    if (!permission) return true;
    if (!permissions || Object.keys(permissions).length === 0) return false;
    return permissions[permission] === true;
  };

  // Check if user can access a route based on permission
  const canAccess = (requiredPermission) => {
    if (!requiredPermission) return true;
    return hasPermission(requiredPermission);
  };

  return (
    <AdminContext.Provider value={{
      admin,
      loading,
      permissions,
      hasPermission,
      canAccess,
      logAdminAction,
      refreshAdmin: checkAdminStatus
    }}>
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
