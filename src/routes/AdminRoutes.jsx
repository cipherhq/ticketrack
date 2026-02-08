import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AdminProvider } from '@/contexts/AdminContext';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminKYC } from '@/pages/admin/AdminKYC';
import { AdminKYCReview } from '@/pages/admin/AdminKYCReview';
import { AdminEvents } from '@/pages/admin/AdminEvents';
import { AdminOrganizers } from '@/pages/admin/AdminOrganizers';
import { AdminAttendees } from '@/pages/admin/AdminAttendees';
import { AdminPayouts } from '@/pages/admin/AdminPayouts';
import { AdminFinance } from '@/pages/admin/AdminFinance';
import { AdminProcessPayout } from '@/pages/admin/AdminProcessPayout';
import { AdminRefunds } from '@/pages/admin/AdminRefunds';
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminAffiliates } from '@/pages/admin/AdminAffiliates';
import { AdminSupport } from '@/pages/admin/AdminSupport';
import { AdminEmailTemplates } from '@/pages/admin/AdminEmailTemplates';
import { AdminSendEmails } from '@/pages/admin/AdminSendEmails';
import { AdminWhatsApp } from '@/pages/admin/AdminWhatsApp';
import { AdminWhatsAppSettings } from '@/pages/admin/AdminWhatsAppSettings';
import { AdminSMS } from '@/pages/admin/AdminSMS';
import { AdminSMSRevenue } from '@/pages/admin/AdminSMSRevenue';
import { AdminSMSSettings } from '@/pages/admin/AdminSMSSettings';
import { AdminSMSPackages } from '@/pages/admin/AdminSMSPackages';
import { AdminAffiliateSettings } from "@/pages/admin/AdminAffiliateSettings";
import { AdminAffiliatesManagement } from "@/pages/admin/AdminAffiliatesManagement";
import { AdminFlaggedReferrals } from "@/pages/admin/AdminFlaggedReferrals";
import AdminWhatsAppPackages from '@/pages/admin/AdminWhatsAppPackages';
import AdminAdverts from '../pages/admin/AdminAdverts';
import { AdminRoles } from '@/pages/admin/AdminRoles';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminFeeManagement } from "@/pages/admin/AdminFeeManagement";
import { AdminRefundSettings } from "@/pages/admin/AdminRefundSettings";
import { AdminWaitlist } from "@/pages/admin/AdminWaitlist";
import { AdminTransfers } from '@/pages/admin/AdminTransfers';
import { AdminCategories } from '@/pages/admin/AdminCategories'; // NEW: Categories management
import { AdminCountryFeatures } from '@/pages/admin/AdminCountryFeatures'; // NEW: Country feature management
import { AdminUserTypes } from '@/pages/admin/AdminUserTypes'; // NEW: User type management
import { AdminUsers } from '@/pages/admin/AdminUsers'; // NEW: All user management
import { AdminPaymentConnections } from '@/pages/admin/AdminPaymentConnections'; // Payment connections management
import { AdminContacts } from '@/pages/admin/AdminContacts'; // All contacts management
import { AdminCommunications } from '@/pages/admin/AdminCommunications'; // Platform broadcasts
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function AdminAuthGuard({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('role, is_admin, admin_role')
        .eq('id', user.id)
        .single();

      // Allow admin, super_admin roles OR users with is_admin flag and support admin_role
      const isAdminUser = data?.role === 'admin' || data?.role === 'super_admin' ||
                          (data?.is_admin && ['admin', 'super_admin', 'support'].includes(data?.admin_role));
      setIsAdmin(isAdminUser);
      setLoading(false);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Permission-based route protection component
function PermissionRoute({ children, permission, fallback = null }) {
  const { hasPermission, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2969FF]" />
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}

export function AdminRoutes() {
  return (
    <AdminAuthGuard>
      <AdminProvider>
        <AdminLayout>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/kyc" element={<AdminKYC />} />
            <Route path="/kyc-review" element={<AdminKYCReview />} />
            <Route path="/events" element={<AdminEvents />} />
            <Route path="/organizers" element={<AdminOrganizers />} />
            <Route path="/attendees" element={<AdminAttendees />} />
            <Route path="/finance" element={<PermissionRoute permission="canAccessFinance"><AdminFinance /></PermissionRoute>} />
            <Route path="/payouts" element={<PermissionRoute permission="canProcessPayouts"><AdminPayouts /></PermissionRoute>} />
            <Route path="/payouts/process" element={<PermissionRoute permission="canProcessPayouts"><AdminProcessPayout /></PermissionRoute>} />
            <Route path="/refunds" element={<PermissionRoute permission="canProcessRefunds"><AdminRefunds /></PermissionRoute>} />
            <Route path="/orders" element={<PermissionRoute permission="canAccessFinance"><AdminOrders /></PermissionRoute>} />
            <Route path="/promoters" element={<AdminAffiliates />} />
            <Route path="/affiliates" element={<AdminAffiliatesManagement />} />
            <Route path="/support" element={<AdminSupport />} />
            <Route path="/email-templates" element={<AdminEmailTemplates />} />
            <Route path="/send-emails" element={<AdminSendEmails />} />
            <Route path="/whatsapp" element={<AdminWhatsApp />} />
            <Route path="/whatsapp-settings" element={<AdminWhatsAppSettings />} />
            <Route path="/whatsapp-packages" element={<AdminWhatsAppPackages />} />
            <Route path="adverts" element={<AdminAdverts />} />
            <Route path="/sms" element={<AdminSMS />} />
            <Route path="/sms-packages" element={<AdminSMSPackages />} />
            <Route path="/sms-revenue" element={<AdminSMSRevenue />} />
            <Route path="/sms-settings" element={<AdminSMSSettings />} />
            <Route path="/affiliate-settings" element={<AdminAffiliateSettings />} />
            <Route path="/flagged-referrals" element={<AdminFlaggedReferrals />} />
            <Route path="/roles" element={<PermissionRoute permission="canManageRoles"><AdminRoles /></PermissionRoute>} />
            <Route path="/waitlist" element={<AdminWaitlist />} />
            <Route path="/transfers" element={<PermissionRoute permission="canAccessFinance"><AdminTransfers /></PermissionRoute>} />
            <Route path="/categories" element={<AdminCategories />} />  {/* NEW: Categories route */}
            <Route path="/country-features" element={<AdminCountryFeatures />} />  {/* NEW: Country features */}
            <Route path="/user-types" element={<AdminUserTypes />} />  {/* NEW: User type management */}
            <Route path="/users" element={<AdminUsers />} />  {/* NEW: All user management */}
            <Route path="/settings" element={<PermissionRoute permission="canManageSettings"><AdminSettings /></PermissionRoute>} />
            <Route path="/fees" element={<PermissionRoute permission="canManageFees"><AdminFeeManagement /></PermissionRoute>} />
            <Route path="/refund-settings" element={<PermissionRoute permission="canManageSettings"><AdminRefundSettings /></PermissionRoute>} />
            <Route path="/payment-connections" element={<PermissionRoute permission="canManagePaymentConnections"><AdminPaymentConnections /></PermissionRoute>} />
            <Route path="/contacts" element={<AdminContacts />} />
            <Route path="/communications" element={<AdminCommunications />} />
          </Routes>
        </AdminLayout>
      </AdminProvider>
    </AdminAuthGuard>
  );
}
