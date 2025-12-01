import { Routes, Route } from 'react-router-dom'
import { Navbar } from './components/ui/Navbar'
import { Footer } from './components/ui/Footer'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Events from './pages/Events'
import EventDetails from './pages/EventDetails'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        {/* Auth pages without navbar/footer */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Main pages with navbar/footer */}
        <Route
          path="*"
          element={
            <>
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/events/:id" element={<EventDetails />} />
                </Routes>
              </main>
              <Footer />
            </>
          }
        />
      </Routes>
    </div>
  )
}

export default App
