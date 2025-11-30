import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { NavigationHeader } from './NavigationHeader';

/**
 * CHECKOUT PAGE WITH PAYSTACK
 * 
 * Handles the payment flow:
 * 1. Show order summary
 * 2. Collect customer details
 * 3. Process payment via Paystack
 * 4. Create order and tickets on success
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

export function WebCheckout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated } = useAuth();

  // Get checkout data from navigation state
  const checkoutData = location.state;

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  
  // Customer form
  const [customerName, setCustomerName] = useState(profile?.full_name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(profile?.phone || '');

  // Update form when profile loads
  useEffect(() => {
    if (profile?.full_name) setCustomerName(profile.full_name);
    if (user?.email) setCustomerEmail(user.email);
    if (profile?.phone) setCustomerPhone(profile.phone);
  }, [profile, user]);

  // Redirect if no checkout data
  useEffect(() => {
    if (!checkoutData) {
      navigate('/events');
    }
  }, [checkoutData, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?returnTo=/checkout');
    }
  }, [isAuthenticated, navigate]);

  if (!checkoutData) {
    return null;
  }

  const { event, tickets, subtotal, fees, total } = checkoutData;

  // Load Paystack script
  const loadPaystackScript = () => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) {
        resolve(window.PaystackPop);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve(window.PaystackPop);
      script.onerror = () => reject(new Error('Failed to load Paystack'));
      document.body.appendChild(script);
    });
  };

  // Handle payment
  const handlePayment = async (e) => {
    e.preventDefault();
    setError('');

    // Validate form
    if (!customerName || !customerEmail) {
      setError('Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsProcessing(true);

    try {
      // Load Paystack
      const PaystackPop = await loadPaystackScript();

      // Get Paystack public key from environment
      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      
      if (!paystackKey) {
        // Demo mode - simulate successful payment
        console.log('Demo mode: Paystack key not configured');
        await handlePaymentSuccess({ reference: 'DEMO-' + Date.now() });
        return;
      }

      // Initialize Paystack payment
      const handler = PaystackPop.setup({
        key: paystackKey,
        email: customerEmail,
        amount: total * 100, // Paystack uses kobo (smallest currency unit)
        currency: 'NGN',
        ref: 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        metadata: {
          event_id: event.id,
          event_title: event.title,
          customer_name: customerName,
          tickets: tickets,
        },
        callback: async (response) => {
          // Payment successful
          await handlePaymentSuccess(response);
        },
        onClose: () => {
          setIsProcessing(false);
        },
      });

      handler.openIframe();
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to initialize payment. Please try again.');
      setIsProcessing(false);
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (response) => {
    try {
      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          status: 'completed',
          subtotal: subtotal,
          fees: fees,
          total: total,
          currency: 'NGN',
          payment_method: 'card',
          payment_reference: response.reference,
          payment_provider: 'paystack',
          paid_at: new Date().toISOString(),
          customer_email: customerEmail,
          customer_phone: customerPhone,
          customer_name: customerName,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create tickets for each ticket type
      const ticketInserts = [];
      tickets.forEach(ticket => {
        for (let i = 0; i < ticket.quantity; i++) {
          ticketInserts.push({
            order_id: order.id,
            ticket_type_id: ticket.id,
            event_id: event.id,
            user_id: user.id,
            status: 'valid',
            attendee_name: customerName,
            attendee_email: customerEmail,
          });
        }
      });

      if (ticketInserts.length > 0) {
        const { error: ticketError } = await supabase
          .from('tickets')
          .insert(ticketInserts);

        if (ticketError) throw ticketError;
      }

      // Navigate to success page
      navigate('/payment-success', {
        state: {
          order: order,
          event: event,
          tickets: tickets,
        }
      });
    } catch (err) {
      console.error('Error creating order:', err);
      // Still navigate to success since payment was received
      navigate('/payment-success', {
        state: {
          reference: response.reference,
          event: event,
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          to={`/event/${event.id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to event
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">Checkout</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Left - Customer Details Form */}
          <div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Your Details</h2>
              
              <form onSubmit={handlePayment} className="mt-6 space-y-4">
                {/* Error Message */}
                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="mt-1 text-xs text-gray-500">Tickets will be sent to this email</p>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="mt-6 w-full rounded-xl bg-blue-500 py-4 font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Pay ${formatPrice(total)}`
                  )}
                </button>
              </form>

              {/* Security Note */}
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secured by Paystack</span>
              </div>
            </div>
          </div>

          {/* Right - Order Summary */}
          <div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>

              {/* Event Info */}
              <div className="mt-4 flex gap-4">
                <img
                  src={event.image_url || 'https://placehold.co/100x100/e2e8f0/64748b?text=Event'}
                  alt={event.title}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <div>
                  <h3 className="font-medium text-gray-900">{event.title}</h3>
                  <p className="text-sm text-gray-500">{event.venue_name}</p>
                </div>
              </div>

              {/* Tickets */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900">Tickets</h3>
                <ul className="mt-2 space-y-2">
                  {tickets.map((ticket) => (
                    <li key={ticket.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {ticket.name} × {ticket.quantity}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatPrice(ticket.price * ticket.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Totals */}
              <div className="mt-6 border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Service Fee</span>
                  <span className="text-gray-900">{formatPrice(fees)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <p className="mt-4 text-center text-xs text-gray-500">
              By completing this purchase you agree to our{' '}
              <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
