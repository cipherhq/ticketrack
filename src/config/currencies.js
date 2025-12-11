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
  KES: {
    code: 'KES',
    symbol: 'KSh',
    name: 'Kenyan Shilling',
    country: 'Kenya',
    locale: 'en-KE',
    paymentProvider: 'paystack',
  },
  GHS: {
    code: 'GHS',
    symbol: 'GH₵',
    name: 'Ghanaian Cedi',
    country: 'Ghana',
    locale: 'en-GH',
    paymentProvider: 'paystack',
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    country: 'South Africa',
    locale: 'en-ZA',
    paymentProvider: 'paystack',
  },
};

// Default currency
export const defaultCurrency = 'NGN';

// Get currency by code
export const getCurrency = (code) => currencies[code] || currencies[defaultCurrency];

// Format price with currency
export const formatPrice = (amount, currencyCode = 'NGN') => {
  const currency = getCurrency(currencyCode);
  
  if (amount === 0) return 'Free';
  if (!amount && amount !== 0) return `${currency.symbol}0`;
  
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Get currencies as array for dropdowns
export const currencyOptions = Object.values(currencies).map(c => ({
  value: c.code,
  label: `${c.symbol} - ${c.name}`,
  symbol: c.symbol,
}));
