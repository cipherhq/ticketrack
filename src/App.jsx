import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}
import { AuthProvider } from './contexts/AuthContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';
import { CartProvider } from './contexts/CartContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { SessionTimeoutProvider } from './hooks/useSessionTimeout.jsx';
import { SESSION_TIMEOUT_MS, SESSION_WARNING_MS } from './config/app';

// Web Layout and Pages
import { WebLayout } from './pages/WebLayout';
import { WebHome } from './pages/WebHome';
import { WebEventBrowse } from './pages/WebEventBrowse';
import { WebEventDetails } from './pages/WebEventDetails';
import { WebCheckout } from './pages/WebCheckout';
import { WaitlistPurchase } from './pages/WaitlistPurchase';
import { WebFreeRSVP } from './pages/WebFreeRSVP';
import { WebPaymentSuccess } from './pages/WebPaymentSuccess';
import { WebTickets } from './pages/WebTickets';
import { WebSearch } from './pages/WebSearch';
import { WebCart } from './pages/WebCart';
import { WebAbout } from './pages/WebAbout';
import { WebContact } from './pages/WebContact';
import { HelpCenter } from './pages/HelpCenter';
import { WebSupport } from './pages/WebSupport';
import { WebPricing } from './pages/WebPricing';
import { WebPrivacy } from './pages/WebPrivacy';
import { WebTerms } from './pages/WebTerms';
import { WebTrustSafety } from './pages/WebTrustSafety';
import { WebRefundPolicy } from './pages/WebRefundPolicy';
import { WebCareers } from './pages/WebCareers';
import { WebResources } from './pages/WebResources';
import { CreateEvent } from './pages/organizer/CreateEvent';
import { OrganizerProvider } from './contexts/OrganizerContext';
import { AcceptTeamInvitation } from "./pages/AcceptTeamInvitation";
import { TeamDashboard } from "./pages/TeamDashboard";
import { AttendeeProfile } from './pages/AttendeeProfile';
import { AccountDeleted } from './pages/AccountDeleted';
import { OrganizerPublicProfile } from './pages/OrganizerPublicProfile';

// Auth Pages
import { WebAuth } from './pages/WebAuth';
import { ForgotPassword } from './pages/ForgotPassword';
import { AuthCallback } from './pages/AuthCallback';

// Organizer Routes
import { OrganizerRoutes } from './routes/OrganizerRoutes';

// Admin Routes
import { AdminRoutes } from './routes/AdminRoutes';

// Promoter Routes
import { PromoterRoutes } from './routes/PromoterRoutes';

// Finance Routes
import { FinanceApp } from './routes/FinanceRoutes';

function App() {
  return (
    <AuthProvider><FeatureFlagsProvider>
      <CartProvider>
        <ImpersonationProvider>
          <SessionTimeoutProvider timeoutMs={SESSION_TIMEOUT_MS} warningMs={SESSION_WARNING_MS}>
          <Router>
            <ScrollToTop />
            <ImpersonationBanner />
            <Routes>
              {/* Organizer Dashboard Routes */}
              <Route path="/organizer/*" element={<OrganizerRoutes />} />

              {/* Admin Dashboard Routes */}
              <Route path="/admin/*" element={<AdminRoutes />} />

              {/* Promoter Portal Routes */}
              <Route path="/promoter/*" element={<PromoterRoutes />} />

              {/* Finance Portal Routes */}
              <Route path="/finance/*" element={<FinanceApp />} />

              {/* Create Event */}
              <Route path="/create-event" element={<OrganizerProvider><CreateEvent /></OrganizerProvider>} />

              {/* Auth Routes */}
              <Route path="/login" element={<WebAuth />} />
              <Route path="/signup" element={<WebAuth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/account-deleted" element={<AccountDeleted />} />
              <Route path="/accept-invite" element={<AcceptTeamInvitation />} />
              <Route path="/team-dashboard" element={<TeamDashboard />} />

              {/* Web Routes with Layout */}
              <Route element={<WebLayout />}>
                <Route path="/" element={<WebHome />} />
                <Route path="/events" element={<WebEventBrowse />} />
                <Route path="/events/:id" element={<WebEventDetails />} />
                <Route path="/event/:id" element={<WebEventDetails />} />
                <Route path="/e/:id" element={<WebEventDetails />} />
                <Route path="/waitlist/purchase" element={<WaitlistPurchase />} />
                <Route path="/checkout" element={<WebCheckout />} />
                <Route path="/free-rsvp" element={<WebFreeRSVP />} />
                <Route path="/payment-success" element={<WebPaymentSuccess />} />
                <Route path="/tickets" element={<WebTickets />} />
                <Route path="/search" element={<WebSearch />} />
                <Route path="/cart" element={<WebCart />} />
                <Route path="/about" element={<WebAbout />} />
                <Route path="/contact" element={<WebContact />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/support" element={<WebSupport />} />
                <Route path="/pricing" element={<WebPricing />} />
                <Route path="/privacy" element={<WebPrivacy />} />
                <Route path="/terms" element={<WebTerms />} />
                <Route path="/trust-safety" element={<WebTrustSafety />} />
                <Route path="/refund-policy" element={<WebRefundPolicy />} />
                <Route path="/careers" element={<WebCareers />} />
                <Route path="/resources" element={<WebResources />} />
                <Route path="/profile" element={<AttendeeProfile />} />
                <Route path="/o/:id" element={<OrganizerPublicProfile />} />
              </Route>
            </Routes>
          </Router>
          </SessionTimeoutProvider>
        </ImpersonationProvider>
      </CartProvider>
    </FeatureFlagsProvider></AuthProvider>
  );
}

export default App;
