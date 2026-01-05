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
    .select('code, default_currency, platform_fee_percentage, service_fee_percentage, payment_processing_fee_percentage, payout_fee, min_payout_amount')
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
        platformFee: (country.platform_fee_percentage || 10) / 100,
        serviceFee: (country.service_fee_percentage || 5) / 100,
        processingFee: (country.payment_processing_fee_percentage || 1.5) / 100,
        payoutFee: country.payout_fee || 50,
        minPayout: country.min_payout_amount || 5000
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
    platformFee: 0.10,
    serviceFee: 0.05,
    processingFee: 0.015,
    payoutFee: 50,
    minPayout: 5000
  }
});

// Synchronous default for initial render (before async fetch)
export const DEFAULT_FEES = {
  platformFee: 0.10,
  serviceFee: 0.05,
  processingFee: 0.015,
  payoutFee: 50,
  minPayout: 5000
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
      .select('custom_fee_enabled, custom_service_fee_percentage, custom_service_fee_fixed')
      .eq('id', organizerId)
      .single();

    if (error || !organizer || !organizer.custom_fee_enabled) {
      return countryFees;
    }

    // Return custom fees, falling back to country defaults for unset values
    return {
      ...countryFees,
      serviceFee: organizer.custom_service_fee_percentage != null 
        ? organizer.custom_service_fee_percentage / 100 
        : countryFees.serviceFee,
      serviceFeeFi: organizer.custom_service_fee_fixed != null
        ? organizer.custom_service_fee_fixed
        : null,
      isCustom: true
    };
  } catch (err) {
    console.error('Error fetching organizer fees:', err);
    return countryFees;
  }
};
