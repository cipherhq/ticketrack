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
import { Toaster } from './components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { ConfirmProvider } from './hooks/useConfirm';

// Retry wrapper for lazy imports - handles chunk loading failures after deployments
// If chunk fails to load (e.g., after deployment with new hashes), reload the page
function lazyWithRetry(importFn, moduleName) {
  return lazy(() => 
    importFn().catch((error) => {
      // Check if it's a chunk loading error
      const isChunkError = error.message?.includes('Failed to fetch dynamically imported module') ||
                           error.message?.includes('Loading chunk') ||
                           error.message?.includes('Loading CSS chunk');
      
      if (isChunkError) {
        console.warn(`Chunk loading failed for ${moduleName}, reloading page...`);
        // Only reload once to avoid infinite loops
        const hasReloaded = sessionStorage.getItem('chunk_reload_' + moduleName);
        if (!hasReloaded) {
          sessionStorage.setItem('chunk_reload_' + moduleName, 'true');
          window.location.reload();
        }
      }
      throw error;
    })
  );
}

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
import { WebPaymentLink } from './pages/WebPaymentLink';
import { WebAuth } from './pages/WebAuth';
import { AuthCallback } from './pages/AuthCallback';

// Less critical pages - lazy loaded with retry for chunk failures
const WebEventBrowse = lazyWithRetry(() => import('./pages/WebEventBrowse').then(m => ({ default: m.WebEventBrowse })), 'WebEventBrowse');
const WaitlistPurchase = lazyWithRetry(() => import('./pages/WaitlistPurchase').then(m => ({ default: m.WaitlistPurchase })), 'WaitlistPurchase');
const WebFreeRSVP = lazyWithRetry(() => import('./pages/WebFreeRSVP').then(m => ({ default: m.WebFreeRSVP })), 'WebFreeRSVP');
const WebTickets = lazyWithRetry(() => import('./pages/WebTickets').then(m => ({ default: m.WebTickets })), 'WebTickets');
const WebSearch = lazyWithRetry(() => import('./pages/WebSearch').then(m => ({ default: m.WebSearch })), 'WebSearch');
const WebCart = lazyWithRetry(() => import('./pages/WebCart').then(m => ({ default: m.WebCart })), 'WebCart');
const WebAbout = lazyWithRetry(() => import('./pages/WebAbout').then(m => ({ default: m.WebAbout })), 'WebAbout');
const WebContact = lazyWithRetry(() => import('./pages/WebContact').then(m => ({ default: m.WebContact })), 'WebContact');
const HelpCenter = lazyWithRetry(() => import('./pages/HelpCenter').then(m => ({ default: m.HelpCenter })), 'HelpCenter');
const WebSupport = lazyWithRetry(() => import('./pages/WebSupport').then(m => ({ default: m.WebSupport })), 'WebSupport');
const WebPricing = lazyWithRetry(() => import('./pages/WebPricing').then(m => ({ default: m.WebPricing })), 'WebPricing');
const WebPrivacy = lazyWithRetry(() => import('./pages/WebPrivacy').then(m => ({ default: m.WebPrivacy })), 'WebPrivacy');
const WebCookies = lazyWithRetry(() => import('./pages/WebCookies').then(m => ({ default: m.WebCookies })), 'WebCookies');
const GroupBuyJoin = lazyWithRetry(() => import('./pages/GroupBuyJoin').then(m => ({ default: m.GroupBuyJoin })), 'GroupBuyJoin');
const MyGroups = lazyWithRetry(() => import('./pages/MyGroups').then(m => ({ default: m.MyGroups })), 'MyGroups');
const PayYourShare = lazyWithRetry(() => import('./pages/PayYourShare').then(m => ({ default: m.PayYourShare })), 'PayYourShare');
const WebTerms = lazyWithRetry(() => import('./pages/WebTerms').then(m => ({ default: m.WebTerms })), 'WebTerms');
const WebTrustSafety = lazyWithRetry(() => import('./pages/WebTrustSafety').then(m => ({ default: m.WebTrustSafety })), 'WebTrustSafety');
const WebRefundPolicy = lazyWithRetry(() => import('./pages/WebRefundPolicy').then(m => ({ default: m.WebRefundPolicy })), 'WebRefundPolicy');
const WebCareers = lazyWithRetry(() => import('./pages/WebCareers').then(m => ({ default: m.WebCareers })), 'WebCareers');
const WebResources = lazyWithRetry(() => import('./pages/WebResources').then(m => ({ default: m.WebResources })), 'WebResources');
const WebBlog = lazyWithRetry(() => import('./pages/WebBlog').then(m => ({ default: m.WebBlog })), 'WebBlog');
const WebBlogPost = lazyWithRetry(() => import('./pages/WebBlogPost').then(m => ({ default: m.WebBlogPost })), 'WebBlogPost');
const AttendeeProfile = lazyWithRetry(() => import('./pages/AttendeeProfile').then(m => ({ default: m.AttendeeProfile })), 'AttendeeProfile');
const OrganizerPublicProfile = lazyWithRetry(() => import('./pages/OrganizerPublicProfile').then(m => ({ default: m.OrganizerPublicProfile })), 'OrganizerPublicProfile');
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })), 'ForgotPassword');
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })), 'ResetPassword');
const AccountDeleted = lazyWithRetry(() => import('./pages/AccountDeleted').then(m => ({ default: m.AccountDeleted })), 'AccountDeleted');
const AccountRecovery = lazyWithRetry(() => import('./pages/AccountRecovery').then(m => ({ default: m.AccountRecovery })), 'AccountRecovery');
const AcceptTeamInvitation = lazyWithRetry(() => import('./pages/AcceptTeamInvitation').then(m => ({ default: m.AcceptTeamInvitation })), 'AcceptTeamInvitation');
const TeamDashboard = lazyWithRetry(() => import('./pages/TeamDashboard').then(m => ({ default: m.TeamDashboard })), 'TeamDashboard');
const CreateEvent = lazyWithRetry(() => import('./pages/organizer/CreateEvent').then(m => ({ default: m.CreateEvent })), 'CreateEvent');
const NotFound = lazyWithRetry(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })), 'NotFound');

// Stripe Connect V2 Demo Pages - Lazy loaded
const StripeConnectV2Demo = lazyWithRetry(() => import('./pages/connect/StripeConnectV2Demo').then(m => ({ default: m.StripeConnectV2Demo })), 'StripeConnectV2Demo');
const ConnectStorefront = lazyWithRetry(() => import('./pages/connect/ConnectStorefront').then(m => ({ default: m.ConnectStorefront })), 'ConnectStorefront');
const ConnectCheckoutSuccess = lazyWithRetry(() => import('./pages/connect/ConnectCheckoutSuccess').then(m => ({ default: m.ConnectCheckoutSuccess })), 'ConnectCheckoutSuccess');

import { OrganizerProvider } from './contexts/OrganizerContext';

// Heavy routes - lazy loaded with retry (admin, organizer, promoter, finance)
// These use lazyWithRetry to auto-reload page if chunk fails after deployment
const OrganizerRoutes = lazyWithRetry(
  () => import('./routes/OrganizerRoutes').then(m => ({ default: m.OrganizerRoutes })),
  'OrganizerRoutes'
);
const AdminRoutes = lazyWithRetry(
  () => import('./routes/AdminRoutes').then(m => ({ default: m.AdminRoutes })),
  'AdminRoutes'
);
const PromoterRoutes = lazyWithRetry(
  () => import('./routes/PromoterRoutes').then(m => ({ default: m.PromoterRoutes })),
  'PromoterRoutes'
);
const FinanceApp = lazyWithRetry(
  () => import('./routes/FinanceRoutes').then(m => ({ default: m.FinanceApp })),
  'FinanceApp'
);

function App() {
  return (
    <AuthProvider><FeatureFlagsProvider>
      <CartProvider>
        <ImpersonationProvider>
          <ConfirmProvider>
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
              <Route path="/reset-password" element={
                <Suspense fallback={<PageLoader />}>
                  <ResetPassword />
                </Suspense>
              } />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/account-deleted" element={
                <Suspense fallback={<PageLoader />}>
                  <AccountDeleted />
                </Suspense>
              } />
              <Route path="/account-recovery" element={
                <Suspense fallback={<PageLoader />}>
                  <AccountRecovery />
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
                <Route path="/group/:code" element={
                  <Suspense fallback={<PageLoader />}>
                    <GroupBuyJoin />
                  </Suspense>
                } />
                <Route path="/group" element={
                  <Suspense fallback={<PageLoader />}>
                    <GroupBuyJoin />
                  </Suspense>
                } />
                <Route path="/my-groups" element={
                  <Suspense fallback={<PageLoader />}>
                    <MyGroups />
                  </Suspense>
                } />
                <Route path="/pay-share/:token" element={
                  <Suspense fallback={<PageLoader />}>
                    <PayYourShare />
                  </Suspense>
                } />
                <Route path="/waitlist/purchase" element={
                  <Suspense fallback={<PageLoader />}>
                    <WaitlistPurchase />
                  </Suspense>
                } />
                <Route path="/checkout" element={<WebCheckout />} />
                <Route path="/pay/:token" element={<WebPaymentLink />} />
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

              {/* Stripe Connect V2 Demo Routes - Standalone (no WebLayout) */}
              <Route path="/connect/demo" element={
                <Suspense fallback={<PageLoader />}>
                  <StripeConnectV2Demo />
                </Suspense>
              } />
              <Route path="/connect/store/:accountId" element={
                <Suspense fallback={<PageLoader />}>
                  <ConnectStorefront />
                </Suspense>
              } />
              <Route path="/connect/checkout-success" element={
                <Suspense fallback={<PageLoader />}>
                  <ConnectCheckoutSuccess />
                </Suspense>
              } />

              {/* 404 Catch-all Route */}
              <Route path="*" element={
                <Suspense fallback={<PageLoader />}>
                  <NotFound />
                </Suspense>
              } />
            </Routes>
            <CookieConsent />
            <Toaster />
            </Sentry.ErrorBoundary>
          </Router>
          </SessionTimeoutProvider>
          </ConfirmProvider>
        </ImpersonationProvider>
      </CartProvider>
    </FeatureFlagsProvider></AuthProvider>
  );
}

export default App;
