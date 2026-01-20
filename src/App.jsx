import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import * as Sentry from '@sentry/react';

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
import { CookieConsent } from './components/CookieConsent';
import { Loader2 } from 'lucide-react';

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA]">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#2969FF] mx-auto mb-4" />
      <p className="text-[#0F0F0F]/60">Loading...</p>
    </div>
  </div>
);

// Critical pages - loaded immediately (homepage, checkout, event details)
import { WebLayout } from './pages/WebLayout';
import { WebHome } from './pages/WebHome';
import { WebEventDetails } from './pages/WebEventDetails';
import { WebCheckout } from './pages/WebCheckout';
import { WebPaymentSuccess } from './pages/WebPaymentSuccess';
import { WebAuth } from './pages/WebAuth';
import { AuthCallback } from './pages/AuthCallback';

// Less critical pages - lazy loaded
const WebEventBrowse = lazy(() => import('./pages/WebEventBrowse').then(m => ({ default: m.WebEventBrowse })));
const WaitlistPurchase = lazy(() => import('./pages/WaitlistPurchase').then(m => ({ default: m.WaitlistPurchase })));
const WebFreeRSVP = lazy(() => import('./pages/WebFreeRSVP').then(m => ({ default: m.WebFreeRSVP })));
const WebTickets = lazy(() => import('./pages/WebTickets').then(m => ({ default: m.WebTickets })));
const WebSearch = lazy(() => import('./pages/WebSearch').then(m => ({ default: m.WebSearch })));
const WebCart = lazy(() => import('./pages/WebCart').then(m => ({ default: m.WebCart })));
const WebAbout = lazy(() => import('./pages/WebAbout').then(m => ({ default: m.WebAbout })));
const WebContact = lazy(() => import('./pages/WebContact').then(m => ({ default: m.WebContact })));
const HelpCenter = lazy(() => import('./pages/HelpCenter').then(m => ({ default: m.HelpCenter })));
const WebSupport = lazy(() => import('./pages/WebSupport').then(m => ({ default: m.WebSupport })));
const WebPricing = lazy(() => import('./pages/WebPricing').then(m => ({ default: m.WebPricing })));
const WebPrivacy = lazy(() => import('./pages/WebPrivacy').then(m => ({ default: m.WebPrivacy })));
const WebCookies = lazy(() => import('./pages/WebCookies').then(m => ({ default: m.WebCookies })));
const WebTerms = lazy(() => import('./pages/WebTerms').then(m => ({ default: m.WebTerms })));
const WebTrustSafety = lazy(() => import('./pages/WebTrustSafety').then(m => ({ default: m.WebTrustSafety })));
const WebRefundPolicy = lazy(() => import('./pages/WebRefundPolicy').then(m => ({ default: m.WebRefundPolicy })));
const WebCareers = lazy(() => import('./pages/WebCareers').then(m => ({ default: m.WebCareers })));
const WebResources = lazy(() => import('./pages/WebResources').then(m => ({ default: m.WebResources })));
const WebBlog = lazy(() => import('./pages/WebBlog').then(m => ({ default: m.WebBlog })));
const WebBlogPost = lazy(() => import('./pages/WebBlogPost').then(m => ({ default: m.WebBlogPost })));
const AttendeeProfile = lazy(() => import('./pages/AttendeeProfile').then(m => ({ default: m.AttendeeProfile })));
const OrganizerPublicProfile = lazy(() => import('./pages/OrganizerPublicProfile').then(m => ({ default: m.OrganizerPublicProfile })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const AccountDeleted = lazy(() => import('./pages/AccountDeleted').then(m => ({ default: m.AccountDeleted })));
const AcceptTeamInvitation = lazy(() => import('./pages/AcceptTeamInvitation').then(m => ({ default: m.AcceptTeamInvitation })));
const TeamDashboard = lazy(() => import('./pages/TeamDashboard').then(m => ({ default: m.TeamDashboard })));
const CreateEvent = lazy(() => import('./pages/organizer/CreateEvent').then(m => ({ default: m.CreateEvent })));
import { OrganizerProvider } from './contexts/OrganizerContext';

// Heavy routes - lazy loaded (admin, organizer, promoter, finance)
const OrganizerRoutes = lazy(() => import('./routes/OrganizerRoutes').then(m => ({ default: m.OrganizerRoutes })));
const AdminRoutes = lazy(() => import('./routes/AdminRoutes').then(m => ({ default: m.AdminRoutes })));
const PromoterRoutes = lazy(() => import('./routes/PromoterRoutes').then(m => ({ default: m.PromoterRoutes })));
const FinanceApp = lazy(() => import('./routes/FinanceRoutes').then(m => ({ default: m.FinanceApp })));

function App() {
  return (
    <AuthProvider><FeatureFlagsProvider>
      <CartProvider>
        <ImpersonationProvider>
          <SessionTimeoutProvider timeoutMs={SESSION_TIMEOUT_MS} warningMs={SESSION_WARNING_MS}>
          <Router>
            <ScrollToTop />
            <ImpersonationBanner />
            <Sentry.ErrorBoundary
              fallback={({ error, resetError }) => (
                <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA]">
                  <div className="text-center max-w-md px-6">
                    <h1 className="text-2xl font-bold mb-4 text-[#0F0F0F]">Something went wrong</h1>
                    <p className="text-[#0F0F0F]/60 mb-6">We've been notified and are working on fixing this issue.</p>
                    <button
                      onClick={resetError}
                      className="px-6 py-2 bg-[#2969FF] text-white rounded-lg hover:bg-[#2969FF]/90 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
              showDialog
            >
            <Routes>
              {/* Organizer Dashboard Routes - Lazy loaded */}
              <Route path="/organizer/*" element={
                <Suspense fallback={<PageLoader />}>
                  <OrganizerRoutes />
                </Suspense>
              } />

              {/* Admin Dashboard Routes - Lazy loaded */}
              <Route path="/admin/*" element={
                <Suspense fallback={<PageLoader />}>
                  <AdminRoutes />
                </Suspense>
              } />

              {/* Promoter Portal Routes - Lazy loaded */}
              <Route path="/promoter/*" element={
                <Suspense fallback={<PageLoader />}>
                  <PromoterRoutes />
                </Suspense>
              } />

              {/* Finance Portal Routes - Lazy loaded */}
              <Route path="/finance/*" element={
                <Suspense fallback={<PageLoader />}>
                  <FinanceApp />
                </Suspense>
              } />

              {/* Create Event - Lazy loaded */}
              <Route path="/create-event" element={
                <Suspense fallback={<PageLoader />}>
                  <OrganizerProvider>
                    <CreateEvent />
                  </OrganizerProvider>
                </Suspense>
              } />

              {/* Auth Routes */}
              <Route path="/login" element={<WebAuth />} />
              <Route path="/signup" element={<WebAuth />} />
              <Route path="/forgot-password" element={
                <Suspense fallback={<PageLoader />}>
                  <ForgotPassword />
                </Suspense>
              } />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/account-deleted" element={
                <Suspense fallback={<PageLoader />}>
                  <AccountDeleted />
                </Suspense>
              } />
              <Route path="/accept-invite" element={
                <Suspense fallback={<PageLoader />}>
                  <AcceptTeamInvitation />
                </Suspense>
              } />
              <Route path="/team-dashboard" element={
                <Suspense fallback={<PageLoader />}>
                  <TeamDashboard />
                </Suspense>
              } />

              {/* Web Routes with Layout */}
              <Route element={<WebLayout />}>
                <Route path="/" element={<WebHome />} />
                <Route path="/events" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebEventBrowse />
                  </Suspense>
                } />
                <Route path="/events/:id" element={<WebEventDetails />} />
                <Route path="/event/:id" element={<WebEventDetails />} />
                <Route path="/e/:id" element={<WebEventDetails />} />
                <Route path="/waitlist/purchase" element={
                  <Suspense fallback={<PageLoader />}>
                    <WaitlistPurchase />
                  </Suspense>
                } />
                <Route path="/checkout" element={<WebCheckout />} />
                <Route path="/free-rsvp" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebFreeRSVP />
                  </Suspense>
                } />
                <Route path="/payment-success" element={<WebPaymentSuccess />} />
                <Route path="/tickets" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebTickets />
                  </Suspense>
                } />
                <Route path="/my-tickets" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebTickets />
                  </Suspense>
                } />
                <Route path="/search" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebSearch />
                  </Suspense>
                } />
                <Route path="/cart" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebCart />
                  </Suspense>
                } />
                <Route path="/about" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebAbout />
                  </Suspense>
                } />
                <Route path="/contact" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebContact />
                  </Suspense>
                } />
                <Route path="/help" element={
                  <Suspense fallback={<PageLoader />}>
                    <HelpCenter />
                  </Suspense>
                } />
                <Route path="/support" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebSupport />
                  </Suspense>
                } />
                <Route path="/pricing" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebPricing />
                  </Suspense>
                } />
                <Route path="/privacy" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebPrivacy />
                  </Suspense>
                } />
                <Route path="/cookies" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebCookies />
                  </Suspense>
                } />
                <Route path="/terms" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebTerms />
                  </Suspense>
                } />
                <Route path="/trust-safety" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebTrustSafety />
                  </Suspense>
                } />
                <Route path="/refund-policy" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebRefundPolicy />
                  </Suspense>
                } />
                <Route path="/careers" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebCareers />
                  </Suspense>
                } />
                <Route path="/resources" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebResources />
                  </Suspense>
                } />
                <Route path="/blog" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebBlog />
                  </Suspense>
                } />
                <Route path="/blog/:slug" element={
                  <Suspense fallback={<PageLoader />}>
                    <WebBlogPost />
                  </Suspense>
                } />
                <Route path="/profile" element={
                  <Suspense fallback={<PageLoader />}>
                    <AttendeeProfile />
                  </Suspense>
                } />
                <Route path="/o/:id" element={
                  <Suspense fallback={<PageLoader />}>
                    <OrganizerPublicProfile />
                  </Suspense>
                } />
              </Route>
            </Routes>
            <CookieConsent />
            </Sentry.ErrorBoundary>
          </Router>
          </SessionTimeoutProvider>
        </ImpersonationProvider>
      </CartProvider>
    </FeatureFlagsProvider></AuthProvider>
  );
}

export default App;
