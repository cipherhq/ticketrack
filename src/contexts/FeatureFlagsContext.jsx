import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const FeatureFlagsContext = createContext({});

export function FeatureFlagsProvider({ children, currency = null, countryCode = null }) {
  const [features, setFeatures] = useState({});
  const [countries, setCountries] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentCountry, setCurrentCountry] = useState(countryCode);

  // Load countries and features on mount
  useEffect(() => {
    loadData();
  }, []);

  // Update current country when currency/countryCode changes
  useEffect(() => {
    if (countryCode) {
      setCurrentCountry(countryCode);
    } else if (currency && countries[currency]) {
      setCurrentCountry(countries[currency]);
    }
  }, [currency, countryCode, countries]);

  const loadData = async () => {
    try {
      // Load countries (currency -> country mapping)
      const { data: countryData, error: countryError } = await supabase
        .from('countries')
        .select('code, default_currency')
        .eq('is_active', true);

      if (!countryError && countryData) {
        const currencyMap = {};
        countryData.forEach(c => {
          if (c.default_currency) {
            currencyMap[c.default_currency] = c.code;
          }
        });
        setCountries(currencyMap);
      } else {
        // Provide default currency -> country mapping if table doesn't exist
        setCountries({
          'USD': 'US',
          'NGN': 'NG',
          'GBP': 'GB',
          'EUR': 'EU',
          'GHS': 'GH',
          'KES': 'KE',
          'ZAR': 'ZA',
          'CAD': 'CA',
          'AUD': 'AU'
        });
      }

      // Load all features
      const { data: featureData, error: featureError } = await supabase
        .from('country_features')
        .select('country_code, feature_name, is_enabled');

      if (!featureError && featureData) {
        const featureMap = {};
        featureData.forEach(f => {
          if (!featureMap[f.country_code]) {
            featureMap[f.country_code] = {};
          }
          featureMap[f.country_code][f.feature_name] = f.is_enabled;
        });
        setFeatures(featureMap);
      } else {
        // All features enabled by default if table doesn't exist
        setFeatures({});
      }
    } catch (error) {
      console.error('Error loading feature flags:', error);
      // Set defaults on error
      setCountries({
        'USD': 'US',
        'NGN': 'NG',
        'GBP': 'GB',
        'EUR': 'EU',
        'GHS': 'GH',
        'KES': 'KE',
        'ZAR': 'ZA'
      });
      setFeatures({});
    } finally {
      setLoading(false);
    }
  };

  // Check if feature is enabled for current country
  const isEnabled = (featureName) => {
    if (!currentCountry) return true;
    const countryFeatures = features[currentCountry];
    if (!countryFeatures) return true;
    return countryFeatures[featureName] ?? true;
  };

  // Check if feature is enabled for specific country code
  const isEnabledForCountry = (countryCode, featureName) => {
    if (!countryCode) return true;
    const countryFeatures = features[countryCode];
    if (!countryFeatures) return true;
    return countryFeatures[featureName] ?? true;
  };

  // Check if feature is enabled for specific currency
  const isEnabledForCurrency = (currency, featureName) => {
    const country = countries[currency?.toUpperCase()];
    return isEnabledForCountry(country, featureName);
  };

  // Get country code from currency
  const getCountryCode = (currency) => {
    return countries[currency?.toUpperCase()] || null;
  };

  // Set current country (for checkout, etc.)
  const setCountry = (code) => {
    setCurrentCountry(code);
  };

  // Set current country by currency
  const setCountryByCurrency = (currency) => {
    const code = countries[currency?.toUpperCase()];
    if (code) setCurrentCountry(code);
  };

  // Refresh features (after admin update)
  const refresh = () => {
    loadData();
  };

  return (
    <FeatureFlagsContext.Provider value={{
      loading,
      features,
      countries,
      currentCountry,
      isEnabled,
      isEnabledForCountry,
      isEnabledForCurrency,
      getCountryCode,
      setCountry,
      setCountryByCurrency,
      refresh,
    }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
