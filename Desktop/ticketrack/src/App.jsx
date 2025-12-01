import { Routes, Route, useLocation } from 'react-router-dom'
import { Navbar } from './components/ui/Navbar'
import { Footer } from './components/ui/Footer'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Events from './pages/Events'
import EventDetails from './pages/EventDetails'
import Search from './pages/Search'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import PaymentSuccess from './pages/PaymentSuccess'
import MyTickets from './pages/MyTickets'
import Profile from './pages/Profile'
import OrganizerProfile from './pages/OrganizerProfile'
import About from './pages/About'
import Contact from './pages/Contact'
import Help from './pages/Help'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

// Auth pages without navbar/footer
const authPages = ['/login', '/signup', '/forgot-password']

function App() {
  const location = useLocation()
  const isAuthPage = authPages.includes(location.pathname)

  return (
    <div className="min-h-screen flex flex-col">
      {!isAuthPage && <Navbar />}
      
      <main className="flex-1">
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/search" element={<Search />} />
          <Route path="/organizer/:id" element={<OrganizerProfile />} />
          
          {/* Auth Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* User Pages */}
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/profile" element={<Profile />} />
          
          {/* Static Pages */}
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          
          {/* 404 */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
                <p className="text-xl text-gray-600">Page not found</p>
                <a href="/" className="text-primary-500 hover:underline mt-4 inline-block">
                  Go back home
                </a>
              </div>
            </div>
          } />
        </Routes>
      </main>
      
      {!isAuthPage && <Footer />}
    </div>
  )
}

export default App
