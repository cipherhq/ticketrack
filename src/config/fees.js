import { supabase } from '@/lib/supabase';

// Cache fees to avoid repeated DB calls
let feesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get all country fees (cached)
export const getCountryFees = async () => {
  const now = Date.now();
  
  if (feesCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return feesCache;
  }

  const { data, error } = await supabase
    .from('countries')
    .select(`
      code, default_currency, 
      service_fee_percentage, service_fee_fixed_per_ticket, service_fee_cap,
      donation_fee_percentage,
      processing_fee_fixed_per_order,
      stripe_processing_fee_pct, stripe_processing_fee_fixed,
      paystack_processing_fee_pct, paystack_processing_fee_fixed,
      payout_fee, min_payout_amount
    `)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching country fees:', error);
    return getDefaultFees();
  }

  // Build lookup by currency
  const feesByCurrency = {};
  data?.forEach(country => {
    if (country.default_currency) {
      feesByCurrency[country.default_currency] = {
        countryCode: country.code,
        // Service fees (Ticketrack revenue)
        serviceFeePercent: parseFloat(country.service_fee_percentage || 5) / 100,
        serviceFeeFixedPerTicket: parseFloat(country.service_fee_fixed_per_ticket || 0),
        serviceFeeCap: country.service_fee_cap ? parseFloat(country.service_fee_cap) : null,
        // Donation fees (for free events)
        donationFeePercent: parseFloat(country.donation_fee_percentage || 5) / 100,
        // Processing fees (pass-through)
        processingFeeFixedPerOrder: parseFloat(country.processing_fee_fixed_per_order || 0),
        stripeProcessingPercent: parseFloat(country.stripe_processing_fee_pct || 2.9) / 100,
        stripeProcessingFixed: parseFloat(country.stripe_processing_fee_fixed || 0.30),
        paystackProcessingPercent: parseFloat(country.paystack_processing_fee_pct || 1.5) / 100,
        paystackProcessingFixed: parseFloat(country.paystack_processing_fee_fixed || 100),
        // Payout settings
        payoutFee: parseFloat(country.payout_fee || 0),
        minPayout: parseFloat(country.min_payout_amount || 0)
      };
    }
  });

  feesCache = feesByCurrency;
  cacheTimestamp = now;
  
  return feesByCurrency;
};

// Get fees for specific currency
export const getFeesByCurrency = async (currencyCode = 'NGN') => {
  const allFees = await getCountryFees();
  return allFees[currencyCode] || getDefaultFees().NGN;
};

// Default fees fallback
export const getDefaultFees = () => ({
  NGN: {
    countryCode: 'NG',
    serviceFeePercent: 0.05,
    serviceFeeFixedPerTicket: 200,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    processingFeeFixedPerOrder: 100,
    stripeProcessingPercent: 0.029,
    stripeProcessingFixed: 0.30,
    paystackProcessingPercent: 0.015,
    paystackProcessingFixed: 100,
    payoutFee: 50,
    minPayout: 5000
  }
});

// Synchronous default for initial render (before async fetch)
export const DEFAULT_FEES = {
  serviceFeePercent: 0.05,
  serviceFeeFixedPerTicket: 0,
  serviceFeeCap: null,
  donationFeePercent: 0.05,
  processingFeeFixedPerOrder: 0,
  stripeProcessingPercent: 0.029,
  stripeProcessingFixed: 0.30,
  paystackProcessingPercent: 0.015,
  paystackProcessingFixed: 100
};

// Clear cache (call when admin updates fees)
export const clearFeesCache = () => {
  feesCache = null;
  cacheTimestamp = null;
};

// Get fees for a specific organizer (checks custom fees first, then falls back to country)
export const getOrganizerFees = async (organizerId, currencyCode = 'NGN') => {
  // Get country defaults first
  const countryFees = await getFeesByCurrency(currencyCode);
  
  if (!organizerId) {
    return countryFees;
  }

  try {
    // Check if organizer has custom fees
    const { data: organizer, error } = await supabase
      .from('organizers')
      .select('custom_fee_enabled, custom_service_fee_percentage, custom_service_fee_fixed, custom_service_fee_cap')
      .eq('id', organizerId)
      .single();

    if (error || !organizer || !organizer.custom_fee_enabled) {
      return countryFees;
    }

    // Return custom fees, falling back to country defaults for unset values
    return {
      ...countryFees,
      serviceFeePercent: organizer.custom_service_fee_percentage != null 
        ? parseFloat(organizer.custom_service_fee_percentage) / 100 
        : countryFees.serviceFeePercent,
      serviceFeeFixedPerTicket: organizer.custom_service_fee_fixed != null
        ? parseFloat(organizer.custom_service_fee_fixed)
        : countryFees.serviceFeeFixedPerTicket,
      serviceFeeCap: organizer.custom_service_fee_cap != null
        ? parseFloat(organizer.custom_service_fee_cap)
        : countryFees.serviceFeeCap,
      isCustom: true
    };
  } catch (err) {
    console.error('Error fetching organizer fees:', err);
    return countryFees;
  }
};

/**
 * Calculate total fees for an order
 * @param {number} ticketSubtotal - Total ticket price (before fees)
 * @param {number} ticketCount - Number of tickets
 * @param {object} fees - Fee config from getOrganizerFees
 * @param {string} paymentProvider - 'stripe' or 'paystack'
 * @returns {object} { serviceFee, processingFee, totalFee, displayFee }
 */
export const calculateFees = (ticketSubtotal, ticketCount, fees, paymentProvider = 'paystack') => {
  // 1. Calculate service fee (% of subtotal + fixed per ticket)
  let serviceFee = (ticketSubtotal * fees.serviceFeePercent) + (fees.serviceFeeFixedPerTicket * ticketCount);
  
  // 2. Apply cap if exists
  if (fees.serviceFeeCap && serviceFee > fees.serviceFeeCap) {
    serviceFee = fees.serviceFeeCap;
  }
  
  // 3. Calculate processing fee based on provider
  let processingFee = 0;
  const totalBeforeProcessing = ticketSubtotal + serviceFee;
  
  if (paymentProvider === 'stripe') {
    processingFee = (totalBeforeProcessing * fees.stripeProcessingPercent) + fees.stripeProcessingFixed;
  } else {
    // Paystack
    processingFee = (totalBeforeProcessing * fees.paystackProcessingPercent) + fees.paystackProcessingFixed;
  }
  
  // 4. Add per-order processing fixed fee
  processingFee += fees.processingFeeFixedPerOrder;
  
  return {
    serviceFee: Math.round(serviceFee * 100) / 100,
    processingFee: Math.round(processingFee * 100) / 100,
    totalFee: Math.round((serviceFee + processingFee) * 100) / 100,
    // For display to buyer (combined as "Service Fee")
    displayFee: Math.round((serviceFee + processingFee) * 100) / 100
  };
};

/**
 * Calculate platform fee for donations on free events
 * @param {number} donationAmount - The donation amount
 * @param {object} fees - Fee config from getFeesByCurrency
 * @returns {object} { platformFee, netDonation, feePercent }
 */
export const calculateDonationFee = (donationAmount, fees) => {
  const feePercent = fees?.donationFeePercent ?? 0.05; // Default 5%
  const platformFee = Math.round(donationAmount * feePercent * 100) / 100;
  const netDonation = Math.round((donationAmount - platformFee) * 100) / 100;
  
  return {
    platformFee,
    netDonation,
    feePercent: Math.round(feePercent * 100) // Return as percentage (e.g., 5)
  };
};

/**
 * Get donation fee percentage for a currency
 * @param {string} currencyCode - Currency code (e.g., 'NGN')
 * @returns {Promise<number>} Fee percentage as decimal (e.g., 0.05 for 5%)
 */
export const getDonationFeePercent = async (currencyCode = 'NGN') => {
  const fees = await getFeesByCurrency(currencyCode);
  return fees?.donationFeePercent ?? 0.05;
};
