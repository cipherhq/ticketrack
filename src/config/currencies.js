// Supported currencies configuration

export const currencies = {
  NGN: {
    code: 'NGN',
    symbol: '₦',
    name: 'Nigerian Naira',
    country: 'Nigeria',
    locale: 'en-NG',
    paymentProvider: 'paystack',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    country: 'United Kingdom',
    locale: 'en-GB',
    paymentProvider: 'stripe',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    country: 'United States',
    locale: 'en-US',
    paymentProvider: 'stripe',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    country: 'Canada',
    locale: 'en-CA',
    paymentProvider: 'stripe',
  },
  GHS: {
    code: 'GHS',
    symbol: 'GH₵',
    name: 'Ghanaian Cedi',
    country: 'Ghana',
    locale: 'en-GH',
    paymentProvider: 'paystack',
  },
};

// Get currency by code - returns null if not found (no fallback)
export const getCurrency = (code) => {
  if (!code || !currencies[code]) {
    console.warn(`getCurrency: Unknown or missing currency code: ${code}`);
    return null;
  }
  return currencies[code];
};

// Get currency symbol by code
export const getCurrencySymbol = (code) => {
  const currency = getCurrency(code);
  return currency?.symbol || '$';
};

// Format price with currency - currency is REQUIRED
export const formatPrice = (amount, currencyCode) => {
  if (!currencyCode) {
    console.warn('formatPrice: Currency code is required');
    return '—';
  }
  
  const currency = getCurrency(currencyCode);
  if (!currency) {
    return '—';
  }
  
  if (!amount && amount !== 0) return `${currency.symbol}0`;
  
  // Show cents when they exist (e.g. $49.95), hide for round numbers (e.g. $50)
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Get currencies as array for dropdowns
export const currencyOptions = Object.values(currencies).map(c => ({
  value: c.code,
  label: `${c.symbol} - ${c.name}`,
  symbol: c.symbol,
}));

// Format multiple currencies for display
// Input: { NGN: 5000, USD: 200, GBP: 150 }
// Output: "₦5,000 · $200 · £150"
export const formatMultiCurrency = (amountsByCurrency) => {
  if (!amountsByCurrency || typeof amountsByCurrency !== 'object') {
    return '—';
  }
  
  const entries = Object.entries(amountsByCurrency)
    .filter(([currency, amount]) => amount > 0 && getCurrency(currency))
    .sort((a, b) => b[1] - a[1]); // Sort by amount descending
  
  if (entries.length === 0) {
    return '—';
  }
  
  if (entries.length === 1) {
    return formatPrice(entries[0][1], entries[0][0]);
  }
  
  return entries
    .map(([currency, amount]) => formatPrice(amount, currency))
    .join(' · ');
};

// Format multiple currencies in compact form (for cards)
// Input: { NGN: 50000, USD: 200 }
// Output: "₦50K · $200"
export const formatMultiCurrencyCompact = (amountsByCurrency) => {
  if (!amountsByCurrency || typeof amountsByCurrency !== 'object') {
    return '—';
  }
  
  const entries = Object.entries(amountsByCurrency)
    .filter(([currency, amount]) => amount > 0 && getCurrency(currency))
    .sort((a, b) => b[1] - a[1]);
  
  if (entries.length === 0) {
    return '—';
  }
  
  const formatCompact = (amount, currencyCode) => {
    const currency = getCurrency(currencyCode);
    if (!currency) return '—';
    return `${currency.symbol}${amount.toLocaleString()}`;
  };
  
  if (entries.length === 1) {
    return formatCompact(entries[0][1], entries[0][0]);
  }
  
  return entries
    .map(([currency, amount]) => formatCompact(amount, currency))
    .join(' · ');
};

// Cache for user's default currency
let userDefaultCurrency = null;

// Cache for country currencies (country_code -> currency)
let countryCurrencyCache = {};

// Get user's default currency from their country
export const getUserDefaultCurrency = async (supabase, userId) => {
  if (userDefaultCurrency) return userDefaultCurrency;
  
  try {
    // Get user's country from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', userId)
      .single();
    
    if (profile?.country) {
      // Get default currency for that country
      const { data: country } = await supabase
        .from('countries')
        .select('default_currency')
        .eq('code', profile.country)
        .single();
      
      if (country?.default_currency) {
        userDefaultCurrency = country.default_currency;
        return userDefaultCurrency;
      }
    }
  } catch (err) {
    console.error('Error getting default currency:', err);
  }
  
  return null; // Let component decide fallback
};

// Get currency from country code (e.g., 'NG' -> 'NGN', 'GH' -> 'GHS')
// This is database-driven and cached for performance
export const getCurrencyFromCountryCode = async (supabase, countryCode) => {
  if (!countryCode) return null;
  
  // Check cache first
  if (countryCurrencyCache[countryCode]) {
    return countryCurrencyCache[countryCode];
  }
  
  try {
    const { data: country, error } = await supabase
      .from('countries')
      .select('default_currency')
      .eq('code', countryCode)
      .single();
    
    if (error) throw error;
    
    if (country?.default_currency) {
      // Cache the result
      countryCurrencyCache[countryCode] = country.default_currency;
      return country.default_currency;
    }
  } catch (err) {
    console.error('Error getting currency from country code:', err);
  }
  
  return null;
};

// Synchronous version using pre-loaded countries data
// Use this when you already have countries data loaded
export const getCurrencyFromCountryCodeSync = (countryCode, countriesData) => {
  if (!countryCode || !countriesData) return null;
  
  const country = countriesData.find(c => c.code === countryCode);
  return country?.default_currency || null;
};

// Load all country currencies into cache (call once on app init or admin pages)
export const loadCountryCurrencies = async (supabase) => {
  try {
    const { data: countries, error } = await supabase
      .from('countries')
      .select('code, default_currency');
    
    if (error) throw error;
    
    countries?.forEach(country => {
      if (country.code && country.default_currency) {
        countryCurrencyCache[country.code] = country.default_currency;
      }
    });
    
    return countryCurrencyCache;
  } catch (err) {
    console.error('Error loading country currencies:', err);
    return {};
  }
};

// Get cached currency (use after loadCountryCurrencies has been called)
export const getCachedCurrencyFromCountryCode = (countryCode) => {
  return countryCurrencyCache[countryCode] || null;
};

// Clear cache on logout
export const clearUserCurrencyCache = () => {
  userDefaultCurrency = null;
};

// Clear all caches
export const clearAllCurrencyCaches = () => {
  userDefaultCurrency = null;
  countryCurrencyCache = {};
};

// Get default currency for a country code
// Fallback chain: country code -> 'USD' (international standard)
export const getDefaultCurrency = (countryCode) => {
  if (!countryCode) return 'USD'; // Safe international fallback
  
  const countryDefaults = {
    NG: 'NGN',
    GB: 'GBP',
    US: 'USD',
    GH: 'GHS',
    CA: 'CAD',
  };
  
  return countryDefaults[countryCode] || 'USD';
};
