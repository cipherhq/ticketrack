import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentRequestButtonElement, useStripe } from '@stripe/react-stripe-js';

// Inner component that uses the Stripe context
function PaymentRequestButton({
  amount,
  currency,
  label,
  onAvailable,
  onNotAvailable,
  onBeforePayment,
  onPaymentSuccess,
  onPaymentError,
  initPaymentIntent,
  disabled,
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!stripe || !amount || amount <= 0) return;

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: currency?.toLowerCase() || 'usd',
      total: {
        label: label || 'Ticket Purchase',
        amount: Math.round(amount * 100),
      },
      requestPayerName: false,
      requestPayerEmail: false,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setReady(true);
        onAvailable?.(result);
      } else {
        onNotAvailable?.();
      }
    });
  }, [stripe, amount, currency, label]);

  // Handle the paymentmethod event
  useEffect(() => {
    if (!paymentRequest) return;

    const handler = async (ev) => {
      try {
        // Step 1: validate form, create order, return orderId
        const orderId = await onBeforePayment();
        if (!orderId) {
          ev.complete('fail');
          onPaymentError?.('Failed to create order');
          return;
        }

        // Step 2: create PaymentIntent via edge function
        const { clientSecret, paymentIntentId } = await initPaymentIntent(orderId);
        if (!clientSecret) {
          ev.complete('fail');
          onPaymentError?.('Failed to initialize payment');
          return;
        }

        // Step 3: confirm the payment with the wallet payment method
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (error) {
          ev.complete('fail');
          onPaymentError?.(error.message);
          return;
        }

        // Step 4: handle 3D Secure if needed
        if (paymentIntent.status === 'requires_action') {
          ev.complete('success');
          const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
          if (actionError) {
            onPaymentError?.(actionError.message);
            return;
          }
          onPaymentSuccess?.(paymentIntentId, orderId);
        } else if (paymentIntent.status === 'succeeded') {
          ev.complete('success');
          onPaymentSuccess?.(paymentIntentId, orderId);
        } else {
          ev.complete('fail');
          onPaymentError?.('Payment failed. Please try again.');
        }
      } catch (err) {
        ev.complete('fail');
        onPaymentError?.(err.message || 'Payment failed');
      }
    };

    paymentRequest.on('paymentmethod', handler);

    return () => {
      paymentRequest.off('paymentmethod', handler);
    };
  }, [paymentRequest, stripe, onBeforePayment, initPaymentIntent, onPaymentSuccess, onPaymentError]);

  // Update the payment request amount when it changes
  useEffect(() => {
    if (!paymentRequest || !amount || amount <= 0) return;
    paymentRequest.update({
      total: {
        label: label || 'Ticket Purchase',
        amount: Math.round(amount * 100),
      },
    });
  }, [paymentRequest, amount, label]);

  if (!ready || !paymentRequest) return null;

  return (
    <div className="w-full">
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: {
            paymentRequestButton: {
              type: 'default',
              theme: 'dark',
              height: '48px',
            },
          },
        }}
      />
    </div>
  );
}

// Outer wrapper that loads Stripe and provides Elements context
export default function StripeExpressCheckout({
  stripePublishableKey,
  amount,
  currency,
  label,
  onAvailable,
  onNotAvailable,
  onBeforePayment,
  onPaymentSuccess,
  onPaymentError,
  initPaymentIntent,
  disabled,
}) {
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    if (stripePublishableKey) {
      setStripePromise(loadStripe(stripePublishableKey));
    }
  }, [stripePublishableKey]);

  if (!stripePromise || !amount || amount <= 0) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: 'payment',
        amount: Math.round(amount * 100),
        currency: currency?.toLowerCase() || 'usd',
      }}
    >
      <PaymentRequestButton
        amount={amount}
        currency={currency}
        label={label}
        onAvailable={onAvailable}
        onNotAvailable={onNotAvailable}
        onBeforePayment={onBeforePayment}
        onPaymentSuccess={onPaymentSuccess}
        onPaymentError={onPaymentError}
        initPaymentIntent={initPaymentIntent}
        disabled={disabled}
      />
    </Elements>
  );
}
