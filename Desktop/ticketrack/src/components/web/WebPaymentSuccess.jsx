import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { NavigationHeader } from './NavigationHeader';

/**
 * PAYMENT SUCCESS PAGE
 * 
 * Shown after successful payment with order confirmation.
 */

export function WebPaymentSuccess() {
  const location = useLocation();
  const { order, event, tickets, reference } = location.state || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          {/* Success Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="mt-6 text-2xl font-bold text-gray-900">Payment Successful!</h1>
          <p className="mt-2 text-gray-600">
            Thank you for your purchase. Your tickets have been confirmed.
          </p>

          {/* Order Details */}
          {(order || reference) && (
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Order Reference</p>
              <p className="font-mono text-lg font-semibold text-gray-900">
                {order?.order_number || reference}
              </p>
            </div>
          )}

          {/* Event Info */}
          {event && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-900">{event.title}</h2>
              <p className="text-gray-600">{event.venue_name}</p>
            </div>
          )}

          {/* Tickets Summary */}
          {tickets && tickets.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                {tickets.reduce((sum, t) => sum + t.quantity, 0)} ticket(s) purchased
              </p>
            </div>
          )}

          {/* Email Notice */}
          <div className="mt-8 rounded-lg bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-left">
                <p className="font-medium text-blue-900">Check your email</p>
                <p className="text-sm text-blue-700">
                  We've sent your tickets and receipt to your email address.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/tickets"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              View My Tickets
            </Link>
            <Link
              to="/events"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Browse More Events
            </Link>
          </div>
        </div>

        {/* Help */}
        <p className="mt-8 text-center text-sm text-gray-500">
          Need help? Contact us at{' '}
          <a href="mailto:support@ticketrack.com" className="text-blue-600 hover:underline">
            support@ticketrack.com
          </a>
        </p>
      </div>
    </div>
  );
}
