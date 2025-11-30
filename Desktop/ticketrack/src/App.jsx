import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Web Components
import { WebHome } from './components/web/WebHome';
import { WebAuth } from './components/web/WebAuth';
import { WebEventDetails } from './components/web/WebEventDetails';
import { WebEventBrowse } from './components/web/WebEventBrowse';
import { WebCheckout } from './components/web/WebCheckout';
import { WebPaymentSuccess } from './components/web/WebPaymentSuccess';
import { WebTickets } from './components/web/WebTickets';

// Organizer Components
import { OrganizerLayout } from './components/organizer/OrganizerLayout';
import { OrganizerHome } from './components/organizer/OrganizerHome';
import { OrganizerEvents } from './components/organizer/OrganizerEvents';
import { CreateEvent } from './components/organizer/CreateEvent';

/**
 * APP COMPONENT
 * 
 * Main routing configuration for Ticketrack.
 */

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Web Routes */}
        <Route path="/" element={<WebHome />} />
        <Route path="/login" element={<WebAuth />} />
        <Route path="/signup" element={<WebAuth />} />
        <Route path="/events" element={<WebEventBrowse />} />
        <Route path="/event/:id" element={<WebEventDetails />} />
        <Route path="/checkout" element={<WebCheckout />} />
        <Route path="/payment-success" element={<WebPaymentSuccess />} />
        <Route path="/tickets" element={<WebTickets />} />
        
        {/* Organizer Dashboard Routes */}
        <Route path="/organizer" element={<OrganizerLayout />}>
          <Route index element={<OrganizerHome />} />
          <Route path="events" element={<OrganizerEvents />} />
          <Route path="events/new" element={<CreateEvent />} />
        </Route>
        
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page not found</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default App;
