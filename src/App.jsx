import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import {
  WebLayout,
  WebHome,
  WebAuth,
  WebEventBrowse,
  WebEventDetails,
  WebSearch,
  WebCart,
  WebCheckout,
  WebPaymentSuccess,
  WebTickets,
  AttendeeProfile,
  OrganizerPublicProfile,
  WebAbout,
  WebContact,
  WebHelp,
  WebPrivacy,
  WebTerms,
} from './pages'

function App() {
  return (
    <Router>
      <Routes>
        {/* Main layout routes */}
        <Route path="/" element={<WebLayout />}>
          <Route index element={<WebHome />} />
          <Route path="events" element={<WebEventBrowse />} />
          <Route path="event/:id" element={<WebEventDetails />} />
          <Route path="search" element={<WebSearch />} />
          <Route path="cart" element={<WebCart />} />
          <Route path="checkout" element={<WebCheckout />} />
          <Route path="tickets" element={<WebTickets />} />
          <Route path="profile" element={<AttendeeProfile />} />
          <Route path="organizer/:id" element={<OrganizerPublicProfile />} />
          <Route path="about" element={<WebAbout />} />
          <Route path="contact" element={<WebContact />} />
          <Route path="help" element={<WebHelp />} />
          <Route path="privacy" element={<WebPrivacy />} />
          <Route path="terms" element={<WebTerms />} />
        </Route>

        {/* Auth routes (no layout) */}
        <Route path="login" element={<WebAuth />} />
        <Route path="signup" element={<WebAuth />} />

        {/* Payment success (no layout) */}
        <Route path="payment-success" element={<WebPaymentSuccess />} />
      </Routes>
    </Router>
  )
}

export default App
