import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Web Pages
import { WebLayout } from './components/web/WebLayout';
import { WebHome } from './components/web/WebHome';
import { WebEventBrowse } from './components/web/WebEventBrowse';
import { WebEventDetails } from './components/web/WebEventDetails';
import { WebAuth } from './components/web/WebAuth';
import { WebCheckout } from './components/web/WebCheckout';
import { WebPaymentSuccess } from './components/web/WebPaymentSuccess';
import { WebTickets } from './components/web/WebTickets';
import { WebAbout } from './components/web/WebAbout';
import { WebPrivacy } from './components/web/WebPrivacy';
import { WebTerms } from './components/web/WebTerms';
import { WebContact } from './components/web/WebContact';
import { WebHelp } from './components/web/WebHelp';

// Organizer Pages
import { OrganizerLayout } from './components/organizer/OrganizerLayout';
import { OrganizerHome } from './components/organizer/OrganizerHome';
import { EventManagement } from './components/organizer/EventManagement';
import { CreateEvent } from './components/organizer/CreateEvent';
import { TicketingSales } from './components/organizer/TicketingSales';
import { CheckInTools } from './components/organizer/CheckInTools';
import { Analytics } from './components/organizer/Analytics';
import { FinancePayouts } from './components/organizer/FinancePayouts';
import { OrganizerProfile } from './components/organizer/OrganizerProfile';

// Admin Pages
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { OrganizerVerification } from './components/admin/OrganizerVerification';
import { AdminEventManagement } from './components/admin/AdminEventManagement';
import { PayoutManagement } from './components/admin/PayoutManagement';
import { RefundManagement } from './components/admin/RefundManagement';
import { SupportTickets } from './components/admin/SupportTickets';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'organizer' | 'admin' }) {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'admin' && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'organizer' && profile?.role !== 'organizer' && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public Web Routes */}
      <Route element={<WebLayout />}>
        <Route path="/" element={<WebHome />} />
        <Route path="/events" element={<WebEventBrowse />} />
        <Route path="/event/:id" element={<WebEventDetails />} />
        <Route path="/login" element={<WebAuth mode="login" />} />
        <Route path="/signup" element={<WebAuth mode="signup" />} />
        <Route path="/about" element={<WebAbout />} />
        <Route path="/privacy" element={<WebPrivacy />} />
        <Route path="/terms" element={<WebTerms />} />
        <Route path="/contact" element={<WebContact />} />
        <Route path="/help" element={<WebHelp />} />
        
        {/* Protected Web Routes */}
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <WebCheckout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-success"
          element={
            <ProtectedRoute>
              <WebPaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <WebTickets />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Organizer Routes */}
      <Route
        path="/organizer"
        element={
          <ProtectedRoute requiredRole="organizer">
            <OrganizerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OrganizerHome />} />
        <Route path="events" element={<EventManagement />} />
        <Route path="events/create" element={<CreateEvent />} />
        <Route path="sales" element={<TicketingSales />} />
        <Route path="checkin" element={<CheckInTools />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="finance" element={<FinancePayouts />} />
        <Route path="profile" element={<OrganizerProfile />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="verification" element={<OrganizerVerification />} />
        <Route path="events" element={<AdminEventManagement />} />
        <Route path="payouts" element={<PayoutManagement />} />
        <Route path="refunds" element={<RefundManagement />} />
        <Route path="support" element={<SupportTickets />} />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
