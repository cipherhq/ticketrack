import { supabase } from '@/lib/supabase';

// Currency to payment provider mapping
const CURRENCY_PROVIDER_MAP = {
  // Paystack currencies (Africa)
  NGN: 'paystack',
  GHS: 'paystack',
  KES: 'paystack',
  ZAR: 'paystack',
  // Stripe currencies (International)
  USD: 'stripe',
  GBP: 'stripe',
  EUR: 'stripe',
  CAD: 'stripe',
  AUD: 'stripe',
};

// Get the appropriate payment provider for a currency
export const getPaymentProvider = (currency = 'NGN') => {
  return CURRENCY_PROVIDER_MAP[currency?.toUpperCase()] || 'paystack';
};

// Check if a provider is active for a country
export const getActiveGateway = async (countryCode, provider) => {
  const { data } = await supabase
    .from('payment_gateway_config')
    .select('*')
    .eq('country_code', countryCode)
    .eq('provider', provider)
    .eq('is_active', true)
    .single();
  
  return data;
};

// Get all active gateways
export const getActiveGateways = async () => {
  const { data } = await supabase
    .from('payment_gateway_config')
    .select('*')
    .eq('is_active', true);
  
  return data || [];
};

// Initialize Stripe Checkout
export const initStripeCheckout = async (orderId, successUrl, cancelUrl) => {
  const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
    body: { orderId, successUrl, cancelUrl }
  });

  if (error) throw new Error(error.message);
  return data;
};

// Payment method options per provider
export const PAYMENT_METHODS = {
  paystack: [
    { id: 'card', label: 'Card', icon: 'CreditCard' },
    { id: 'bank', label: 'Bank Transfer', icon: 'Building2' },
    { id: 'ussd', label: 'USSD', icon: 'Smartphone' },
  ],
  stripe: [
    { id: 'card', label: 'Card', icon: 'CreditCard', description: 'Credit/Debit Card' },
    // Apple Pay & Google Pay are automatically available via Stripe Checkout
  ],
  paypal: [
    { id: 'paypal', label: 'PayPal', icon: 'Wallet' },
  ],
};

// Get available payment methods for a currency
export const getPaymentMethods = (currency) => {
  const provider = getPaymentProvider(currency);
  return PAYMENT_METHODS[provider] || PAYMENT_METHODS.paystack;
};

// Provider display info
export const PROVIDER_INFO = {
  paystack: {
    name: 'Paystack',
    description: 'Secure payment via Paystack',
    supportedMethods: 'Cards, Bank Transfer, USSD',
  },
  stripe: {
    name: 'Stripe',
    description: 'Secure payment via Stripe',
    supportedMethods: 'Cards, Apple Pay, Google Pay',
  },
  paypal: {
    name: 'PayPal',
    description: 'Pay with PayPal',
    supportedMethods: 'PayPal Balance, Cards',
  },
};

export const getProviderInfo = (currency) => {
  const provider = getPaymentProvider(currency);
  return PROVIDER_INFO[provider] || PROVIDER_INFO.paystack;
};

// Initialize PayPal Checkout
export const initPayPalCheckout = async (orderId, successUrl, cancelUrl) => {
  const { data, error } = await supabase.functions.invoke('create-paypal-checkout', {
    body: { orderId, successUrl, cancelUrl }
  });

  if (error) throw new Error(error.message);
  return data;
};

// Capture PayPal payment after user approval
export const capturePayPalPayment = async (orderId, paypalOrderId) => {
  const { data, error } = await supabase.functions.invoke('capture-paypal-payment', {
    body: { orderId, paypalOrderId }
  });

  if (error) throw new Error(error.message);
  return data;
};
