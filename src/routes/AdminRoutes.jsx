import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AdminProvider } from '@/contexts/AdminContext';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminKYC } from '@/pages/admin/AdminKYC';
import { AdminEvents } from '@/pages/admin/AdminEvents';
import { AdminOrganizers } from '@/pages/admin/AdminOrganizers';
import { AdminAttendees } from '@/pages/admin/AdminAttendees';
import { AdminPayouts } from '@/pages/admin/AdminPayouts';
import { AdminProcessPayout } from '@/pages/admin/AdminProcessPayout';
import { AdminRefunds } from '@/pages/admin/AdminRefunds';
import { AdminAffiliates } from '@/pages/admin/AdminAffiliates';
import { AdminSupport } from '@/pages/admin/AdminSupport';
import { AdminEmailTemplates } from '@/pages/admin/AdminEmailTemplates';
import { AdminSendEmails } from '@/pages/admin/AdminSendEmails';
import { AdminWhatsApp } from '@/pages/admin/AdminWhatsApp';
import { AdminWhatsAppSettings } from '@/pages/admin/AdminWhatsAppSettings';
import { AdminSMS } from '@/pages/admin/AdminSMS';
import { AdminSMSRevenue } from '@/pages/admin/AdminSMSRevenue';
import { AdminSMSSettings } from '@/pages/admin/AdminSMSSettings';
import AdminWhatsAppPackages from '@/pages/admin/AdminWhatsAppPackages';
import AdminAdverts from '../pages/admin/AdminAdverts';
import { AdminRoles } from '@/pages/admin/AdminRoles';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAdmin(data?.is_admin || false);
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

export function AdminRoutes() {
  return (
    <AdminAuthGuard>
      <AdminProvider>
        <AdminLayout>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/kyc" element={<AdminKYC />} />
            <Route path="/events" element={<AdminEvents />} />
            <Route path="/organizers" element={<AdminOrganizers />} />
            <Route path="/attendees" element={<AdminAttendees />} />
            <Route path="/payouts" element={<AdminPayouts />} />
            <Route path="/payouts/process" element={<AdminProcessPayout />} />
            <Route path="/refunds" element={<AdminRefunds />} />
            <Route path="/affiliates" element={<AdminAffiliates />} />
            <Route path="/support" element={<AdminSupport />} />
            <Route path="/email-templates" element={<AdminEmailTemplates />} />
            <Route path="/send-emails" element={<AdminSendEmails />} />
            <Route path="/whatsapp" element={<AdminWhatsApp />} />
            <Route path="/whatsapp-settings" element={<AdminWhatsAppSettings />} />
            <Route path="/whatsapp-packages" element={<AdminWhatsAppPackages />} />
          <Route path="adverts" element={<AdminAdverts />} />
            <Route path="/sms" element={<AdminSMS />} />
            <Route path="/sms-revenue" element={<AdminSMSRevenue />} />
            <Route path="/sms-revenue" element={<AdminSMSRevenue />} />
            <Route path="/sms-settings" element={<AdminSMSSettings />} />
            <Route path="/roles" element={<AdminRoles />} />
            <Route path="/settings" element={<AdminSettings />} />
          </Routes>
        </AdminLayout>
      </AdminProvider>
    </AdminAuthGuard>
  );
}
