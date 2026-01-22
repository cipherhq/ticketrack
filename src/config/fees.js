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
      donation_fee_percentage, donation_processing_fee_pct, donation_processing_fee_fixed,
      transfer_fee_percentage,
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
        donationProcessingPercent: parseFloat(country.donation_processing_fee_pct || 2.9) / 100,
        donationProcessingFixed: parseFloat(country.donation_processing_fee_fixed || 0.30),
        // Transfer fees (for ticket transfers)
        transferFeePercent: parseFloat(country.transfer_fee_percentage || 10) / 100,
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

// Default fees fallback (Eventbrite-style structure)
export const getDefaultFees = () => ({
  // USA - 3.7% + $1.79 + 2.9% processing
  USD: {
    countryCode: 'US',
    serviceFeePercent: 0.037,
    serviceFeeFixedPerTicket: 1.79,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.029,
    donationProcessingFixed: 0.30,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0.029,
    stripeProcessingFixed: 0.30,
    paystackProcessingPercent: 0,
    paystackProcessingFixed: 0,
    payoutFee: 0,
    minPayout: 50
  },
  // UK - 6.95% + £0.59 (processing included)
  GBP: {
    countryCode: 'GB',
    serviceFeePercent: 0.0695,
    serviceFeeFixedPerTicket: 0.59,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.014, // 1.4% + 20p for UK donations
    donationProcessingFixed: 0.20,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0, // Included in service fee
    stripeProcessingFixed: 0,
    paystackProcessingPercent: 0,
    paystackProcessingFixed: 0,
    payoutFee: 0,
    minPayout: 50
  },
  // EU - 6.95% + €0.59 (processing included)
  EUR: {
    countryCode: 'EU',
    serviceFeePercent: 0.0695,
    serviceFeeFixedPerTicket: 0.59,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.014, // 1.4% + €0.25
    donationProcessingFixed: 0.25,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0, // Included in service fee
    stripeProcessingFixed: 0,
    paystackProcessingPercent: 0,
    paystackProcessingFixed: 0,
    payoutFee: 0,
    minPayout: 50
  },
  // Australia - 5.35% + $1.19 AUD (processing included)
  AUD: {
    countryCode: 'AU',
    serviceFeePercent: 0.0535,
    serviceFeeFixedPerTicket: 1.19,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.017, // 1.7% + A$0.30
    donationProcessingFixed: 0.30,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0, // Included in service fee
    stripeProcessingFixed: 0,
    paystackProcessingPercent: 0,
    paystackProcessingFixed: 0,
    payoutFee: 0,
    minPayout: 50
  },
  // Canada - 3.7% + $1.79 CAD + 2.9% processing
  CAD: {
    countryCode: 'CA',
    serviceFeePercent: 0.037,
    serviceFeeFixedPerTicket: 1.79,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.029, // 2.9% + C$0.30
    donationProcessingFixed: 0.30,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0.029,
    stripeProcessingFixed: 0.30,
    paystackProcessingPercent: 0,
    paystackProcessingFixed: 0,
    payoutFee: 0,
    minPayout: 50
  },
  // Nigeria - 5% + ₦300 + 1.5% Paystack
  NGN: {
    countryCode: 'NG',
    serviceFeePercent: 0.05,
    serviceFeeFixedPerTicket: 300,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.015, // 1.5% + ₦100
    donationProcessingFixed: 100,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0,
    stripeProcessingFixed: 0,
    paystackProcessingPercent: 0.015,
    paystackProcessingFixed: 100,
    payoutFee: 50,
    minPayout: 5000
  },
  // Ghana - 5% + GHS 5 + 1.5% Paystack
  GHS: {
    countryCode: 'GH',
    serviceFeePercent: 0.05,
    serviceFeeFixedPerTicket: 5.00,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.019, // 1.9%
    donationProcessingFixed: 0,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0,
    stripeProcessingFixed: 0,
    paystackProcessingPercent: 0.015,
    paystackProcessingFixed: 2,
    payoutFee: 1,
    minPayout: 100
  },
  // South Africa - 5% + R20 (processing included)
  ZAR: {
    countryCode: 'ZA',
    serviceFeePercent: 0.05,
    serviceFeeFixedPerTicket: 20,
    serviceFeeCap: null,
    donationFeePercent: 0.05,
    donationProcessingPercent: 0.029, // 2.9%
    donationProcessingFixed: 0,
    transferFeePercent: 0.10,
    processingFeeFixedPerOrder: 0,
    stripeProcessingPercent: 0,
    stripeProcessingFixed: 0,
    paystackProcessingPercent: 0,
    paystackProcessingFixed: 0,
    payoutFee: 5,
    minPayout: 500
  }
});

// Synchronous default for initial render (USA as default)
export const DEFAULT_FEES = {
  serviceFeePercent: 0.037,        // 3.7%
  serviceFeeFixedPerTicket: 1.79,  // $1.79
  serviceFeeCap: null,
  donationFeePercent: 0.05,        // 5%
  donationProcessingPercent: 0.029, // 2.9%
  donationProcessingFixed: 0.30,   // $0.30
  transferFeePercent: 0.10,
  processingFeeFixedPerOrder: 0,
  stripeProcessingPercent: 0.029,  // 2.9%
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
 * Calculate fees for donations on free events
 * @param {number} donationAmount - The donation amount
 * @param {object} fees - Fee config from getFeesByCurrency
 * @param {boolean} donorPaysFee - Whether the donor pays the processing fee
 * @returns {object} { platformFee, processingFee, totalFee, netDonation, donorPays, feePercent }
 */
export const calculateDonationFee = (donationAmount, fees, donorPaysFee = false) => {
  // Platform fee (Ticketrack revenue) - always from the donation amount
  const platformFeePercent = fees?.donationFeePercent ?? 0.05; // Default 5%
  const platformFee = Math.round(donationAmount * platformFeePercent * 100) / 100;
  
  // Processing fee (payment processor)
  const processingPercent = fees?.donationProcessingPercent ?? 0.029; // Default 2.9%
  const processingFixed = fees?.donationProcessingFixed ?? 0.30;
  const processingFee = Math.round((donationAmount * processingPercent + processingFixed) * 100) / 100;
  
  // Total fee (platform + processing)
  const totalFee = Math.round((platformFee + processingFee) * 100) / 100;
  
  // Net donation (what organizer receives after platform fee)
  // If donor pays fee: organizer gets donation - platformFee
  // If organizer absorbs: organizer gets donation - totalFee
  const netDonation = donorPaysFee 
    ? Math.round((donationAmount - platformFee) * 100) / 100
    : Math.round((donationAmount - totalFee) * 100) / 100;
  
  // What the donor actually pays
  const donorPays = donorPaysFee 
    ? Math.round((donationAmount + totalFee) * 100) / 100
    : donationAmount;
  
  return {
    platformFee,
    processingFee,
    totalFee,
    netDonation,
    donorPays,
    feePercent: Math.round((platformFeePercent + processingPercent) * 100) // Combined percentage
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

/**
 * Calculate platform fee for ticket transfers
 * @param {number} ticketPrice - The original ticket price
 * @param {object} fees - Fee config from getFeesByCurrency
 * @returns {object} { transferFee, netAmount, feePercent }
 */
export const calculateTransferFee = (ticketPrice, fees) => {
  const feePercent = fees?.transferFeePercent ?? 0.10; // Default 10%
  const transferFee = Math.round(ticketPrice * feePercent * 100) / 100;
  const netAmount = Math.round((ticketPrice - transferFee) * 100) / 100;
  
  return {
    transferFee,
    netAmount,
    feePercent: Math.round(feePercent * 100) // Return as percentage (e.g., 10)
  };
};

/**
 * Get transfer fee percentage for a currency
 * @param {string} currencyCode - Currency code (e.g., 'NGN')
 * @returns {Promise<number>} Fee percentage as decimal (e.g., 0.10 for 10%)
 */
export const getTransferFeePercent = async (currencyCode = 'NGN') => {
  const fees = await getFeesByCurrency(currencyCode);
  return fees?.transferFeePercent ?? 0.10;
};
