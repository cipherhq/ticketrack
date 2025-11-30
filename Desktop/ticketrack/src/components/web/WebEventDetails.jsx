import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { NavigationHeader } from './NavigationHeader';

/**
 * EVENT DETAILS PAGE
 * 
 * Shows full event information with ticket purchasing options.
 * URL: /event/:id
 */

// Sample event for demo (used when no real events exist)
const SAMPLE_EVENT = {
  id: 'sample-1',
  title: 'Lagos Tech Summit 2025',
  description: `Join us for the biggest tech conference in West Africa! 

The Lagos Tech Summit brings together innovators, entrepreneurs, investors, and tech enthusiasts from across the continent for two days of inspiring talks, hands-on workshops, and unparalleled networking opportunities.

**What to expect:**
• Keynote speeches from industry leaders
• Panel discussions on AI, Fintech, and Web3
• Startup pitch competition with ₦10M in prizes
• Networking sessions with 500+ attendees
• Free lunch and refreshments

Whether you're a seasoned developer, aspiring entrepreneur, or tech curious professional, this summit has something for you.`,
  image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop',
  start_date: '2025-02-15T09:00:00',
  end_date: '2025-02-16T18:00:00',
  venue_name: 'Landmark Centre',
  venue_address: 'Plot 2 & 3, Water Corporation Road, Victoria Island',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  category: 'Tech & Innovation',
  organizer: {
    business_name: 'TechNigeria Events',
    logo_url: null,
  },
  ticket_types: [
    {
      id: 'tt-1',
      name: 'Early Bird',
      description: 'Limited early bird tickets - save ₦10,000!',
      price: 15000,
      currency: 'NGN',
      quantity_available: 100,
      quantity_sold: 85,
    },
    {
      id: 'tt-2',
      name: 'Regular',
      description: 'Standard admission to all sessions',
      price: 25000,
      currency: 'NGN',
      quantity_available: 300,
      quantity_sold: 120,
    },
    {
      id: 'tt-3',
      name: 'VIP',
      description: 'Front row seating, VIP lounge access, exclusive swag bag',
      price: 75000,
      currency: 'NGN',
      quantity_available: 50,
      quantity_sold: 32,
    },
  ],
};

// Format price helper
function formatPrice(amount, currency = 'NGN') {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// Format date helpers
function formatEventDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatEventTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Ticket Type Card Component
function TicketTypeCard({ ticket, quantity, onQuantityChange, disabled }) {
  const remaining = ticket.quantity_available - ticket.quantity_sold;
  const isSoldOut = remaining <= 0;
  const isLowStock = remaining > 0 && remaining <= 10;

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${
      quantity > 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
    } ${isSoldOut ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{ticket.name}</h3>
            {isSoldOut && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                Sold Out
              </span>
            )}
            {isLowStock && !isSoldOut && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                Only {remaining} left
              </span>
            )}
          </div>
          {ticket.description && (
            <p className="mt-1 text-sm text-gray-500">{ticket.description}</p>
          )}
        </div>
        <div className="ml-4 text-right">
          <p className="text-xl font-bold text-gray-900">
            {formatPrice(ticket.price, ticket.currency)}
          </p>
        </div>
      </div>

      {/* Quantity Selector */}
      {!isSoldOut && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            onClick={() => onQuantityChange(ticket.id, Math.max(0, quantity - 1))}
            disabled={quantity === 0 || disabled}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="w-8 text-center font-semibold text-gray-900">{quantity}</span>
          <button
            onClick={() => onQuantityChange(ticket.id, Math.min(10, quantity + 1, remaining))}
            disabled={quantity >= 10 || quantity >= remaining || disabled}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Main Event Details Component
export function WebEventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Fetch event details
  useEffect(() => {
    async function fetchEvent() {
      try {
        // Try to fetch from Supabase
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            categories (name),
            organizers (business_name, logo_url),
            ticket_types (*)
          `)
          .eq('id', id)
          .single();

        if (error) {
          // If not found in DB, use sample event for demo
          if (error.code === 'PGRST116' || id.startsWith('sample')) {
            setEvent(SAMPLE_EVENT);
          } else {
            throw error;
          }
        } else {
          setEvent({
            ...data,
            category: data.categories?.name,
            organizer: data.organizers,
          });
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        // Use sample event as fallback
        setEvent(SAMPLE_EVENT);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvent();
  }, [id]);

  // Handle quantity change
  const handleQuantityChange = (ticketTypeId, quantity) => {
    setSelectedTickets(prev => ({
      ...prev,
      [ticketTypeId]: quantity,
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!event?.ticket_types) return { items: 0, subtotal: 0 };

    let items = 0;
    let subtotal = 0;

    event.ticket_types.forEach(ticket => {
      const qty = selectedTickets[ticket.id] || 0;
      items += qty;
      subtotal += qty * ticket.price;
    });

    return { items, subtotal };
  };

  const { items: totalItems, subtotal } = calculateTotals();
  const fees = Math.round(subtotal * 0.05); // 5% service fee
  const total = subtotal + fees;

  // Handle checkout
  const handleCheckout = () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate(`/login?returnTo=/event/${id}`);
      return;
    }

    // Prepare tickets array for checkout
    const ticketsForCheckout = event.ticket_types
      .filter(ticket => selectedTickets[ticket.id] > 0)
      .map(ticket => ({
        id: ticket.id,
        name: ticket.name,
        price: ticket.price,
        quantity: selectedTickets[ticket.id],
      }));

    // Navigate to checkout with data
    navigate('/checkout', {
      state: {
        event: {
          id: event.id,
          title: event.title,
          image_url: event.image_url,
          venue_name: event.venue_name,
          start_date: event.start_date,
        },
        tickets: ticketsForCheckout,
        subtotal: subtotal,
        fees: fees,
        total: total,
      }
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader />
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader />
        <div className="flex h-96 flex-col items-center justify-center px-4">
          <div className="text-6xl">😕</div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Event Not Found</h1>
          <p className="mt-2 text-gray-500">The event you're looking for doesn't exist or has been removed.</p>
          <Link
            to="/"
            className="mt-6 rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600"
          >
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      {/* Hero Image */}
      <div className="relative h-64 w-full overflow-hidden bg-gray-200 sm:h-80 md:h-96">
        <img
          src={event.image_url || 'https://placehold.co/1200x400/e2e8f0/64748b?text=Event'}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Back Button */}
        <Link
          to="/"
          className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-gray-700 backdrop-blur-sm transition-colors hover:bg-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>

        {/* Category Badge */}
        {event.category && (
          <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-gray-700 backdrop-blur-sm">
            {event.category}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Left Column - Event Details */}
          <div className="lg:col-span-2">
            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {event.title}
            </h1>

            {/* Organizer */}
            {event.organizer && (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  {event.organizer.logo_url ? (
                    <img src={event.organizer.logo_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Organized by</p>
                  <p className="font-medium text-gray-900">{event.organizer.business_name}</p>
                </div>
              </div>
            )}

            {/* Date, Time, Location Cards */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {/* Date & Time */}
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {formatEventDate(event.start_date)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatEventTime(event.start_date)}
                      {event.end_date && ` - ${formatEventTime(event.end_date)}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{event.venue_name}</p>
                    <p className="text-sm text-gray-500">
                      {event.venue_address && `${event.venue_address}, `}
                      {event.city}, {event.state || event.country}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900">About This Event</h2>
              <div className="mt-4 whitespace-pre-line text-gray-600">
                {event.description}
              </div>
            </div>
          </div>

          {/* Right Column - Ticket Selection */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-2xl bg-white p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-900">Select Tickets</h2>
              
              {/* Ticket Types */}
              <div className="mt-4 space-y-3">
                {event.ticket_types?.map(ticket => (
                  <TicketTypeCard
                    key={ticket.id}
                    ticket={ticket}
                    quantity={selectedTickets[ticket.id] || 0}
                    onQuantityChange={handleQuantityChange}
                    disabled={isAddingToCart}
                  />
                ))}
              </div>

              {/* Order Summary */}
              {totalItems > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{totalItems} ticket{totalItems !== 1 ? 's' : ''}</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={totalItems === 0 || isAddingToCart}
                className="mt-6 w-full rounded-xl bg-blue-500 py-4 font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                {totalItems === 0 ? (
                  'Select Tickets'
                ) : isAuthenticated ? (
                  `Buy Now - ${formatPrice(subtotal)}`
                ) : (
                  'Login to Continue'
                )}
              </button>

              {/* Security Note */}
              <p className="mt-4 text-center text-xs text-gray-400">
                <svg className="mr-1 inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure checkout powered by Paystack
              </p>
            </div>
          </div>
        </div>
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
