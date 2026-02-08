/**
 * Stripe Connect Checkout Success Page
 *
 * This page is displayed after a successful checkout on a connected account's storefront.
 * It retrieves the checkout session details and displays a confirmation message.
 *
 * URL: /connect/checkout-success?session_id={CHECKOUT_SESSION_ID}&accountId={ACCOUNT_ID}
 *
 * The session_id is provided by Stripe when redirecting from Checkout.
 * The accountId is passed through from our storefront to identify which connected account
 * processed the payment.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  Store,
  ArrowLeft,
  Receipt,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

/**
 * Retrieve checkout session details from our backend
 *
 * This calls our edge function which uses Stripe's API with the connected account's
 * credentials (using stripe_account header) to retrieve the session details.
 */
const getCheckoutSession = async (sessionId, accountId) => {
  const { data, error } = await supabase.functions.invoke('stripe-connect-v2/get-checkout-session', {
    body: { sessionId, accountId },
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error);
  return data;
};

/**
 * Main Checkout Success Component
 */
export function ConnectCheckoutSuccess() {
  const [searchParams] = useSearchParams();

  // Get session ID and account ID from URL parameters
  const sessionId = searchParams.get('session_id');
  const accountId = searchParams.get('accountId');

  // State
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Load checkout session details on mount
   */
  useEffect(() => {
    if (sessionId && accountId) {
      loadSession();
    } else {
      setError('Missing session information');
      setLoading(false);
    }
  }, [sessionId, accountId]);

  const loadSession = async () => {
    try {
      const result = await getCheckoutSession(sessionId, accountId);
      setSession(result.session);
    } catch (err) {
      console.error('Error loading session:', err);
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#2969FF] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Something Went Wrong
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to={accountId ? `/connect/store/${accountId}` : '/connect/demo'}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Store
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Payment Successful!
            </h1>
            <p className="text-muted-foreground">
              Thank you for your purchase.
            </p>
          </div>

          {/* Order Details */}
          {session && (
            <div className="space-y-4 mb-6">
              {/* Amount */}
              <div className="bg-background rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Amount Paid</span>
                  <span className="text-xl font-bold text-[#2969FF]">
                    {session.currency?.toUpperCase()} {(session.amount_total / 100).toFixed(2)}
                  </span>
                </div>

                {/* Customer Email */}
                {session.customer_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>Receipt sent to {session.customer_email}</span>
                  </div>
                )}
              </div>

              {/* Payment Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment Status</span>
                <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {session.payment_status === 'paid' ? 'Paid' : session.payment_status}
                </span>
              </div>

              {/* Order ID */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Order Reference</span>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                  {sessionId?.substring(0, 20)}...
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {/* View Receipt (if available) */}
            {session?.receipt_url && (
              <a
                href={session.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full">
                  <Receipt className="w-4 h-4 mr-2" />
                  View Receipt
                </Button>
              </a>
            )}

            {/* Back to Store */}
            <Link to={accountId ? `/connect/store/${accountId}` : '/connect/demo'}>
              <Button className="w-full bg-[#2969FF] hover:bg-[#2969FF]/90">
                <Store className="w-4 h-4 mr-2" />
                Continue Shopping
              </Button>
            </Link>
          </div>

          {/* Platform Note */}
          <p className="text-xs text-center text-muted-foreground mt-6">
            This purchase was processed securely through Stripe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConnectCheckoutSuccess;
