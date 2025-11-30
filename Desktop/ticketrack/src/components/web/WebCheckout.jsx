import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { NavigationHeader } from './NavigationHeader';

// Ensure Paystack script loads in <head> immediately
if (typeof window !== "undefined" && !document.getElementById("paystack-script")) {
  const script = document.createElement("script");
  script.id = "paystack-script";
  script.src = "https://js.paystack.co/v1/inline.js";
  script.async = true;
  document.head.appendChild(script);
}

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

  // Debug log to verify data integrity
  console.log("checkoutData =", checkoutData);

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
    if (!checkoutData) navigate('/events');
  }, [checkoutData, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) navigate('/login?returnTo=/checkout');
  }, [isAuthenticated, navigate]);

  if (!checkoutData) {
    return null;
  }

  const { event, tickets, subtotal, fees, total } = checkoutData;

  // EXTRA VALIDATION FIX — prevents Paystack crash
  const validateCheckout = () => {
    if (!event || !event.id) {
      setError("Event data missing. Please go back and try again.");
      console.error("Missing event data:", event);
      return false;
    }

    if (!Array.isArray(tickets) || tickets.length === 0) {
      setError("No tickets selected.");
      console.error("Invalid ticket array:", tickets);
      return false;
    }

    for (const t of tickets) {
      if (!t.price || !t.quantity) {
        setError("Ticket price or quantity missing.");
        console.error("Invalid ticket:", t);
        return false;
      }
    }

    if (!total || isNaN(total)) {
      setError("Unable to calculate total. Please refresh.");
      console.error("Invalid total:", total);
      return false;
    }

    return true;
  };

  // Load Paystack script
  const loadPaystackScript = () => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) return resolve(window.PaystackPop);

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

    // Validate fields
    if (!validateCheckout()) return;

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
      const PaystackPop = await loadPaystackScript();
      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

      if (!paystackKey) {
          console.log('Demo mode: Paystack key not configured');
          await handlePaymentSuccess({ reference: 'DEMO-' + Date.now() });
          return;
      }

      // Convert total to kobo safely
      const amountKobo = Number(total) * 100;
      if (!amountKobo || isNaN(amountKobo)) {
        console.error("Invalid amountKobo:", amountKobo, "total:", total);
        setError("Invalid total amount. Please refresh.");
        setIsProcessing(false);
        return;
      }

      const handler = PaystackPop.setup({
        key: paystackKey,
        email: customerEmail,
        amount: amountKobo,
        currency: 'NGN',
        ref: `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        metadata: {
          event_id: event.id,
          event_title: event.title,
          customer_name: customerName,
          tickets: tickets,
        },
        callback: async (response) => {
          await handlePaymentSuccess(response);
        },
        onClose: () => setIsProcessing(false),
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
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          status: 'completed',
          subtotal,
          fees,
          total,
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

      navigate('/payment-success', {
        state: { order, event, tickets }
      });

    } catch (err) {
      console.error('Order creation error:', err);
      navigate('/payment-success', {
        state: { reference: response.reference, event }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to={`/event/${event.id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to event
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">Checkout</h1>
