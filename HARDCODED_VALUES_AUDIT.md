# Hardcoded Values Audit - Ticketrack

This document identifies hardcoded values in the codebase that should be moved to configuration or database settings.

## 🔴 Critical - Should Fix Immediately

### 1. Currency Fallbacks
Multiple files default to 'NGN' when currency is not specified. This should use a dynamic default based on user's country.

**Files affected:**
- `src/pages/organizer/PromoterManagement.jsx` (lines 221, 322, 413)
- `src/pages/promoter/PromoterPerformance.jsx` (line 34)
- `src/pages/organizer/EventManagement.jsx` (lines 270, 303)
- `src/pages/finance/AffiliatePayouts.jsx` (line 52)
- `src/pages/admin/AdminOrders.jsx` (multiple lines)
- `src/utils/ticketGenerator.js` (multiple lines)

**Recommended Fix:**
```javascript
// Instead of:
currency: event?.currency || 'NGN'

// Use:
import { getDefaultCurrency } from '@/config/currencies';
currency: event?.currency || getDefaultCurrency(user?.country)
```

### 2. OTP Generation (Security)
**File:** `src/pages/admin/AdminUserTypes.jsx` (line 342)
```javascript
const otp = Math.floor(100000 + Math.random() * 900000).toString();
```
**Issue:** Should use crypto-safe random number generation.

**Recommended Fix:**
```javascript
import { generateSecureOTP } from '@/lib/security';
const otp = generateSecureOTP(6);
```

---

## 🟡 Medium Priority - Should Fix

### 3. Session Timeout Values
**File:** `src/App.jsx` (now implemented, but values are hardcoded)
```javascript
timeoutMs={30 * 60 * 1000}  // 30 minutes
warningMs={5 * 60 * 1000}   // 5 minutes
```

**Recommended Fix:** Move to environment variables or admin settings.

### 4. Image Timeout
**File:** `src/utils/ticketGenerator.js` (lines 23, 109, 337, 567)
```javascript
await loadImageAsBase64(event.image_url, 5000)
```
**Issue:** 5 second timeout is hardcoded.

**Recommended Fix:** Use configuration constant.

### 5. Pagination Default
**File:** `src/components/ui/pagination.jsx` (line 45)
```javascript
defaultItemsPerPage = 20
```
**Issue:** Default page size is hardcoded.

**Recommended Fix:** Make configurable per context.

### 6. Phone Number Placeholder
**File:** `src/config/brand.js` (line 29)
```javascript
phone: '+234 XXX XXX XXXX',
```
**Issue:** Placeholder phone number should be removed or configured.

---

## 🟢 Low Priority - Nice to Have

### 7. Currency Symbols Mapping
**File:** `src/utils/ticketGenerator.js` (line 87)
```javascript
const symbols = { NGN: '₦', GBP: '£', USD: '$', GHS: '₵', CAD: 'C$' }
```
**Note:** This is acceptable but could be centralized to `@/config/currencies`.

### 8. Admin Fee Display
**File:** `src/pages/admin/AdminFeeManagement.jsx` (line 38)
```javascript
USD: '$', GBP: '£', EUR: '€', NGN: '₦', GHS: '₵',
```
**Note:** Currency symbols are duplicated across files.

### 9. Example Email Placeholders
These are acceptable for form placeholders:
- `promoter@example.com`
- `email@example.com`
- `team@example.com`
- `user@example.com`
- `john@example.com`

---

## 🔧 Configuration Files to Create

### 1. App Configuration (`src/config/app.js`)
```javascript
export const APP_CONFIG = {
  // Session
  SESSION_TIMEOUT_MS: parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MS) || 30 * 60 * 1000,
  SESSION_WARNING_MS: parseInt(import.meta.env.VITE_SESSION_WARNING_MS) || 5 * 60 * 1000,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Image Loading
  IMAGE_LOAD_TIMEOUT_MS: 5000,
  
  // Security
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 10,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
};
```

### 2. Currency Configuration Enhancement (`src/config/currencies.js`)
```javascript
// Add to existing file:
export const getDefaultCurrency = (countryCode) => {
  const countryDefaults = {
    NG: 'NGN',
    GB: 'GBP',
    US: 'USD',
    GH: 'GHS',
    CA: 'CAD',
  };
  return countryDefaults[countryCode] || 'USD';
};
```

---

## ✅ Already Implemented/Fixed

1. **Donation Fee Percentage** - Now configurable in `countries` table
2. **Transfer Fee Percentage** - Now configurable in `countries` table
3. **Platform Fees** - Now database-driven via `countries` table
4. **Affiliate Commission Rates** - Configurable per affiliate
5. **SMS Package Prices** - Database-driven via `sms_credit_packages` table

---

## 📊 Summary

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 2 | Needs Fix |
| 🟡 Medium | 5 | Should Fix |
| 🟢 Low | 3 | Nice to Have |

---

## Next Steps

1. Create `src/config/app.js` with centralized configuration
2. Add `getDefaultCurrency` function to currencies config
3. Replace hardcoded currency fallbacks across files
4. Implement crypto-safe OTP generation
5. Make session timeout configurable via admin settings
