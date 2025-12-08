// =====================================================
// ADD THESE IMPORTS TO YOUR App.jsx
// =====================================================

// Admin Context
import { AdminProvider } from '@/contexts/AdminContext';
import { AdminLayout } from '@/layouts/AdminLayout';

// Admin Pages
import {
  AdminDashboard,
  AdminKYC,
  AdminEvents,
  AdminOrganizers,
  AdminAttendees,
  AdminPayouts,
  AdminRefunds,
  AdminAffiliates,
  AdminSupport,
  AdminEmailTemplates,
  AdminSendEmails,
  AdminWhatsApp,
  AdminSMS,
  AdminRoles,
} from '@/pages/admin';

// =====================================================
// ADD THESE ROUTES INSIDE YOUR <Routes> COMPONENT
// =====================================================

{/* Admin Routes */}
<Route
  path="/admin"
  element={
    <AdminProvider>
      <AdminLayout />
    </AdminProvider>
  }
>
  <Route index element={<AdminDashboard />} />
  <Route path="kyc" element={<AdminKYC />} />
  <Route path="events" element={<AdminEvents />} />
  <Route path="organizers" element={<AdminOrganizers />} />
  <Route path="attendees" element={<AdminAttendees />} />
  <Route path="payouts" element={<AdminPayouts />} />
  <Route path="refunds" element={<AdminRefunds />} />
  <Route path="affiliates" element={<AdminAffiliates />} />
  <Route path="support" element={<AdminSupport />} />
  <Route path="email-templates" element={<AdminEmailTemplates />} />
  <Route path="send-emails" element={<AdminSendEmails />} />
  <Route path="whatsapp" element={<AdminWhatsApp />} />
  <Route path="sms" element={<AdminSMS />} />
  <Route path="roles" element={<AdminRoles />} />
</Route>

// =====================================================
// FULL EXAMPLE App.jsx (combine with your existing routes)
// =====================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { AdminProvider } from '@/contexts/AdminContext';
import { AdminLayout } from '@/layouts/AdminLayout';

// Your existing imports...
// import { Home } from '@/pages/Home';
// import { Login } from '@/pages/auth/Login';
// etc...

// Admin Pages
import {
  AdminDashboard,
  AdminKYC,
  AdminEvents,
  AdminOrganizers,
  AdminAttendees,
  AdminPayouts,
  AdminRefunds,
  AdminAffiliates,
  AdminSupport,
  AdminEmailTemplates,
  AdminSendEmails,
  AdminWhatsApp,
  AdminSMS,
  AdminRoles,
} from '@/pages/admin';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Your existing routes here */}
          {/* <Route path="/" element={<Home />} /> */}
          {/* <Route path="/login" element={<Login />} /> */}
          {/* <Route path="/events/:id" element={<EventDetails />} /> */}
          {/* etc... */}

          {/* Admin Routes - Protected by AdminContext */}
          <Route
            path="/admin"
            element={
              <AdminProvider>
                <AdminLayout />
              </AdminProvider>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="kyc" element={<AdminKYC />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="organizers" element={<AdminOrganizers />} />
            <Route path="attendees" element={<AdminAttendees />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="affiliates" element={<AdminAffiliates />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="email-templates" element={<AdminEmailTemplates />} />
            <Route path="send-emails" element={<AdminSendEmails />} />
            <Route path="whatsapp" element={<AdminWhatsApp />} />
            <Route path="sms" element={<AdminSMS />} />
            <Route path="roles" element={<AdminRoles />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
