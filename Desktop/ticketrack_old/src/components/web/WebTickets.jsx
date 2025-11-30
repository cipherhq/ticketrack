import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { NavigationHeader } from './NavigationHeader';

/**
 * MY TICKETS PAGE
 * 
 * Shows all tickets purchased by the user with QR codes.
 * Based on Figma design with tabs for Active/Past tickets.
 */

// Format price helper
function formatPrice(amount, currency = 'NGN') {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// Format date helper
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// QR Code placeholder component
function QRCodeDisplay({ ticketNumber }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-gray-100 p-6">
      <div className="flex h-48 w-48 items-center justify-center rounded-xl border-2 border-gray-200 bg-white">
        {/* Simple QR code placeholder - in production you'd use a QR library */}
        <div className="relative h-40 w-40">
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-0.5">
            {[...Array(64)].map((_, i) => (
              <div
                key={i}
                className={`${
                  Math.random() > 0.5 ? 'bg-gray-900' : 'bg-white'
                }`}
              />
            ))}
          </div>
          {/* Center square */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 rounded bg-white flex items-center justify-center">
              <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-gray-500">
        Show this QR code at the venue
      </p>
      <p className="mt-1 font-mono text-xs text-gray-400">{ticketNumber}</p>
    </div>
  );
}

// Ticket Card Component
function TicketCard({ ticket, event, ticketType, order }) {
  const isActive = ticket.status === 'valid' && new Date(event.start_date) > new Date();
  const isUsed = ticket.status === 'used';
  const isPast = new Date(event.start_date) < new Date() && ticket.status !== 'used';

  const getStatusBadge = () => {
    if (isUsed) return { label: 'Used', className: 'bg-gray-100 text-gray-600' };
    if (isPast) return { label: 'Expired', className: 'bg-red-100 text-red-600' };
    if (isActive) return { label: 'Active', className: 'bg-blue-100 text-blue-600' };
    return { label: ticket.status, className: 'bg-gray-100 text-gray-600' };
  };

  const status = getStatusBadge();

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold">{event.title}</h3>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDate(event.start_date)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{event.venue_name}, {event.city}</span>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Ticket Details */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Order Number</p>
              <p className="font-medium text-gray-900">{order.order_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Ticket Type</p>
              <p className="font-medium text-gray-900">{ticketType.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Event Time</p>
              <p className="font-medium text-gray-900">{formatTime(event.start_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Attendee</p>
              <p className="font-medium text-gray-900">{ticket.attendee_name || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(order.total)}</p>
            </div>
          </div>

          {/* QR Code */}
          <QRCodeDisplay ticketNumber={ticket.ticket_number} />
        </div>

        {/* Action Buttons */}
        {isActive && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Ticket
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export function WebTickets() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?returnTo=/tickets');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch tickets
  useEffect(() => {
    async function fetchTickets() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            *,
            orders (*),
            ticket_types (*),
            events (*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTickets(data || []);
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (user) {
      fetchTickets();
    }
  }, [user]);

  // Filter tickets
  const now = new Date();
  const activeTickets = tickets.filter(t => 
    t.status === 'valid' && new Date(t.events?.start_date) > now
  );
  const pastTickets = tickets.filter(t => 
    t.status !== 'valid' || new Date(t.events?.start_date) <= now
  );

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader />
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">My Tickets</h1>
          </div>
          <p className="mt-2 text-gray-600">
            View and manage all your event tickets in one place
          </p>
        </div>

        {/* Empty State */}
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">No tickets yet</h3>
            <p className="mt-2 text-gray-500">
              Start exploring events and book your tickets
            </p>
            <Link
              to="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600"
            >
              Browse Events
            </Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-white p-1">
              <button
                onClick={() => setActiveTab('active')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'active'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({activeTickets.length})
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'past'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Past ({pastTickets.length})
              </button>
            </div>

            {/* Ticket List */}
            <div className="space-y-6">
              {activeTab === 'active' ? (
                activeTickets.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
                    <p className="text-gray-500">No active tickets</p>
                    <Link
                      to="/events"
                      className="mt-4 inline-flex text-blue-600 hover:text-blue-700"
                    >
                      Browse events →
                    </Link>
                  </div>
                ) : (
                  activeTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      event={ticket.events}
                      ticketType={ticket.ticket_types}
                      order={ticket.orders}
                    />
                  ))
                )
              ) : (
                pastTickets.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
                    <p className="text-gray-500">No past tickets</p>
                  </div>
                ) : (
                  pastTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      event={ticket.events}
                      ticketType={ticket.ticket_types}
                      order={ticket.orders}
                    />
                  ))
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          © 2025 Ticketrack. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
