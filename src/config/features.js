import { supabase } from '@/lib/supabase';

// Cache
let featuresCache = null;
let countriesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get all countries (to map currency -> country_code)
const getCountries = async () => {
  if (countriesCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return countriesCache;
  }

  const { data } = await supabase
    .from('countries')
    .select('code, default_currency')
    .eq('is_active', true);

  // Build currency -> country lookup
  const currencyToCountry = {};
  data?.forEach(c => {
    if (c.default_currency) {
      currencyToCountry[c.default_currency] = c.code;
    }
  });

  countriesCache = currencyToCountry;
  return currencyToCountry;
};

// Get all features (cached)
export const getAllFeatures = async () => {
  const now = Date.now();
  
  if (featuresCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return featuresCache;
  }

  const { data, error } = await supabase
    .from('country_features')
    .select('country_code, feature_name, is_enabled');

  if (error) {
    console.error('Error fetching features:', error);
    return {};
  }

  // Build lookup: { countryCode: { featureName: isEnabled } }
  const featuresByCountry = {};
  data?.forEach(f => {
    if (!featuresByCountry[f.country_code]) {
      featuresByCountry[f.country_code] = {};
    }
    featuresByCountry[f.country_code][f.feature_name] = f.is_enabled;
  });

  featuresCache = featuresByCountry;
  cacheTimestamp = now;
  
  return featuresByCountry;
};

// Get country code from currency (database-driven)
export const getCountryFromCurrency = async (currency) => {
  const countries = await getCountries();
  return countries[currency?.toUpperCase()] || null;
};

// Check if a feature is enabled for a country code
export const isFeatureEnabled = async (countryCode, featureName) => {
  if (!countryCode) return true;
  
  const features = await getAllFeatures();
  const countryFeatures = features[countryCode];
  
  if (!countryFeatures) return true;
  
  return countryFeatures[featureName] ?? true;
};

// Check feature by currency
export const isFeatureEnabledByCurrency = async (currency, featureName) => {
  const countryCode = await getCountryFromCurrency(currency);
  return isFeatureEnabled(countryCode, featureName);
};

// Get all enabled features for a country
export const getEnabledFeatures = async (countryCode) => {
  const features = await getAllFeatures();
  return features[countryCode] || {};
};

// Get all enabled features by currency
export const getEnabledFeaturesByCurrency = async (currency) => {
  const countryCode = await getCountryFromCurrency(currency);
  return getEnabledFeatures(countryCode);
};

// Clear cache (call when admin updates)
export const clearFeaturesCache = () => {
  featuresCache = null;
  countriesCache = null;
  cacheTimestamp = null;
};

// Bulk check multiple features
export const checkFeatures = async (countryCode, featureNames = []) => {
  const features = await getAllFeatures();
  const countryFeatures = features[countryCode] || {};
  
  const result = {};
  featureNames.forEach(name => {
    result[name] = countryFeatures[name] ?? true;
  });
  
  return result;
};

// Bulk check by currency
export const checkFeaturesByCurrency = async (currency, featureNames = []) => {
  const countryCode = await getCountryFromCurrency(currency);
  return checkFeatures(countryCode, featureNames);
};
