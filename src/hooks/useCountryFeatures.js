import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useEffect, useState } from 'react';

/**
 * Hook for checking country-specific feature flags
 * @param {string} currency - Currency code to determine country
 * @param {string} countryCode - Direct country code (optional, overrides currency)
 * @returns {object} Feature checking utilities
 */
export function useCountryFeatures(currency = 'NGN', countryCode = null) {
  const { 
    isEnabled, 
    isEnabledForCountry, 
    isEnabledForCurrency, 
    getCountryCode,
    currentCountry,
    loading 
  } = useFeatureFlags();

  const [country, setCountry] = useState(countryCode || currentCountry);

  useEffect(() => {
    if (countryCode) {
      setCountry(countryCode);
    } else if (currency) {
      const code = getCountryCode(currency);
      setCountry(code);
    }
  }, [currency, countryCode, getCountryCode]);

  /**
   * Check if a feature is enabled for the current country
   * @param {string} featureName - Name of the feature to check
   * @returns {boolean} Whether the feature is enabled
   */
  const isFeatureEnabled = (featureName) => {
    if (loading) return true; // Default to enabled while loading
    
    if (country) {
      return isEnabledForCountry(country, featureName);
    } else if (currency) {
      return isEnabledForCurrency(currency, featureName);
    }
    
    return isEnabled(featureName);
  };

  /**
   * Check multiple features at once
   * @param {string[]} featureNames - Array of feature names
   * @returns {object} Object with feature names as keys and enabled status as values
   */
  const checkFeatures = (featureNames) => {
    const results = {};
    featureNames.forEach(name => {
      results[name] = isFeatureEnabled(name);
    });
    return results;
  };

  /**
   * Check if any of the provided features are enabled
   * @param {string[]} featureNames - Array of feature names
   * @returns {boolean} True if at least one feature is enabled
   */
  const hasAnyFeature = (featureNames) => {
    return featureNames.some(name => isFeatureEnabled(name));
  };

  /**
   * Check if all of the provided features are enabled
   * @param {string[]} featureNames - Array of feature names  
   * @returns {boolean} True if all features are enabled
   */
  const hasAllFeatures = (featureNames) => {
    return featureNames.every(name => isFeatureEnabled(name));
  };

  return {
    // Current country information
    country,
    currency,
    loading,

    // Feature checking methods
    isFeatureEnabled,
    checkFeatures,
    hasAnyFeature, 
    hasAllFeatures,

    // Commonly used feature shortcuts
    canProcessPayments: isFeatureEnabled('payment_processing'),
    canSendSMS: isFeatureEnabled('sms_campaigns'),
    canSendWhatsApp: isFeatureEnabled('whatsapp_campaigns'),
    canUseAppleWallet: isFeatureEnabled('apple_wallet'),
    canUseGoogleWallet: isFeatureEnabled('google_wallet'),
    canTransferTickets: isFeatureEnabled('ticket_transfers'),
    canCreateVirtualEvents: isFeatureEnabled('virtual_events'),
    canUseVenueDesigner: isFeatureEnabled('venue_management'),
    canUseIoT: isFeatureEnabled('iot_integration'),
    canAccessAPI: isFeatureEnabled('api_access'),
    requiresKYC: isFeatureEnabled('kyc_verification'),
    requiresGDPR: isFeatureEnabled('gdpr_compliance'),
    supportsTaxReporting: isFeatureEnabled('tax_reporting'),
  };
}

/**
 * Component wrapper that conditionally renders based on feature flags
 * @param {object} props
 * @param {string|string[]} props.feature - Feature name(s) to check
 * @param {string} props.currency - Currency for country detection
 * @param {string} props.countryCode - Direct country code
 * @param {boolean} props.requireAll - If true, requires all features (for arrays)
 * @param {React.ReactNode} props.children - Content to render if feature is enabled
 * @param {React.ReactNode} props.fallback - Content to render if feature is disabled
 */
export function FeatureGate({ 
  feature, 
  currency, 
  countryCode, 
  requireAll = false,
  children, 
  fallback = null 
}) {
  const { isFeatureEnabled, hasAllFeatures, hasAnyFeature } = useCountryFeatures(currency, countryCode);

  let enabled = false;

  if (Array.isArray(feature)) {
    enabled = requireAll ? hasAllFeatures(feature) : hasAnyFeature(feature);
  } else {
    enabled = isFeatureEnabled(feature);
  }

  return enabled ? children : fallback;
}

/**
 * Hook specifically for payment-related features
 * @param {string} currency - Currency code
 * @returns {object} Payment feature flags
 */
export function usePaymentFeatures(currency = 'NGN') {
  const { checkFeatures } = useCountryFeatures(currency);

  return checkFeatures([
    'payment_processing',
    'refunds', 
    'payouts',
    'subscription_billing'
  ]);
}

/**
 * Hook specifically for communication features  
 * @param {string} currency - Currency code
 * @returns {object} Communication feature flags
 */
export function useCommunicationFeatures(currency = 'NGN') {
  const { checkFeatures } = useCountryFeatures(currency);

  return checkFeatures([
    'email_campaigns',
    'sms_campaigns', 
    'whatsapp_campaigns',
    'push_notifications'
  ]);
}