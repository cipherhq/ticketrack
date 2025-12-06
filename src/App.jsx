import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';

// Web Layout and Pages
import { WebLayout } from './pages/WebLayout';
import { WebHome } from './pages/WebHome';
import { WebEventBrowse } from './pages/WebEventBrowse';
import { WebEventDetails } from './pages/WebEventDetails';
import { WebCheckout } from './pages/WebCheckout';
import { WebPaymentSuccess } from './pages/WebPaymentSuccess';
import { WebTickets } from './pages/WebTickets';
import { WebSearch } from './pages/WebSearch';
import { WebCart } from './pages/WebCart';
import { WebAbout } from './pages/WebAbout';
import { WebContact } from './pages/WebContact';
import { WebHelp } from './pages/WebHelp';
import { WebPrivacy } from './pages/WebPrivacy';
import { WebTerms } from './pages/WebTerms';
import { WebCreateEvent } from './pages/WebCreateEvent';
import { AttendeeProfile } from './pages/AttendeeProfile';
import { OrganizerPublicProfile } from './pages/OrganizerPublicProfile';

// Auth Pages
import { WebAuth } from './pages/WebAuth';
import { ForgotPassword } from './pages/ForgotPassword';
import { AuthCallback } from './pages/AuthCallback';

// Organizer Routes
import { OrganizerRoutes } from './routes/OrganizerRoutes';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <Routes>
            {/* Organizer Dashboard Routes - MUST come first to avoid conflict */}
            <Route path="/organizer/*" element={<OrganizerRoutes />} />

            {/* Create Event - Public (no WebLayout, has its own header) */}
            <Route path="/create-event" element={<WebCreateEvent />} />

            {/* Auth Routes */}
            <Route path="/login" element={<WebAuth />} />
            <Route path="/signup" element={<WebAuth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Web Routes with Layout */}
            <Route element={<WebLayout />}>
              <Route path="/" element={<WebHome />} />
              <Route path="/events" element={<WebEventBrowse />} />
              <Route path="/events/:id" element={<WebEventDetails />} />
              <Route path="/checkout" element={<WebCheckout />} />
              <Route path="/payment-success" element={<WebPaymentSuccess />} />
              <Route path="/tickets" element={<WebTickets />} />
              <Route path="/search" element={<WebSearch />} />
              <Route path="/cart" element={<WebCart />} />
              <Route path="/about" element={<WebAbout />} />
              <Route path="/contact" element={<WebContact />} />
              <Route path="/help" element={<WebHelp />} />
              <Route path="/privacy" element={<WebPrivacy />} />
              <Route path="/terms" element={<WebTerms />} />
              <Route path="/profile" element={<AttendeeProfile />} />
              {/* Public organizer profile - use /o/:id to avoid conflict with /organizer/* */}
              <Route path="/o/:id" element={<OrganizerPublicProfile />} />
            </Route>
          </Routes>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
