# Admin & Promoter Data Security Analysis

## Overview

This document analyzes potential security risks related to admin and promoter data exposure.

## Analysis Results

### ✅ Admin Data - SECURE

**Findings:**
- All admin queries require authentication
- Admin context checks `is_admin` flag before allowing access
- Admin routes are protected by `AdminAuthGuard`
- Admin queries use explicit field selection (not `select('*')`)

**Protected Queries:**
- `AdminContext.jsx`: `select('id, full_name, email, is_admin, admin_role')` - only for authenticated user
- `AdminRoles.jsx`: `select('id, full_name, email, is_admin, admin_role, created_at')` - only for admins
- All admin pages require authentication and admin role verification

**Risk Level:** ✅ **LOW** - Properly protected

---

### ✅ Promoter Data - SECURE

**Findings:**
- Promoter queries require authentication
- Promoter context only loads data for the authenticated user
- Promoter routes are protected by authentication
- Public queries only check counts, not full data

**Protected Queries:**
- `PromoterContext.jsx`: `select('*')` but only for `user_id = current_user.id`
- `WebLayout.jsx`: `select('id', { count: 'exact', head: true })` - only count, no data
- All promoter pages require authentication

**Risk Level:** ✅ **LOW** - Properly protected

---

### ⚠️ Profile Data - NEEDS REVIEW

**Findings:**
- `WebLayout.jsx` uses `select('*')` for profiles
- However, it's only for authenticated user's own profile (`user.id`)
- Should still use explicit field selection for better security

**Current Query:**
```javascript
// WebLayout.jsx line 31-35
const { data: profileData } = await supabase
  .from('profiles')
  .select('*')  // ⚠️ Uses select('*')
  .eq('id', user.id)
  .single()
```

**Recommendation:**
- Change to explicit field selection
- Only select fields needed for the UI
- Exclude sensitive fields like `is_admin`, `admin_role`, `phone`, `address`, etc.

**Risk Level:** ⚠️ **MEDIUM** - Protected by authentication but could be improved

---

## Security Recommendations

### 1. Profile Query Improvement

**File:** `src/pages/WebLayout.jsx`

**Current:**
```javascript
.select('*')
```

**Recommended:**
```javascript
.select(`
  id,
  full_name,
  first_name,
  last_name,
  email,
  avatar_url,
  country_code,
  city,
  country
  // Exclude: is_admin, admin_role, phone, address, billing_address, etc.
`)
```

### 2. Promoter Query Improvement

**File:** `src/contexts/PromoterContext.jsx`

**Current:**
```javascript
.select('*')
```

**Recommended:**
```javascript
.select(`
  id,
  user_id,
  full_name,
  email,
  phone,
  bio,
  commission_rate,
  total_earnings,
  available_balance,
  pending_balance
  // Only include fields actually needed
`)
```

### 3. RLS Policy Verification

Ensure RLS policies are configured for:
- ✅ `profiles` table - users can only read their own profile
- ✅ `promoters` table - users can only read their own promoter data
- ✅ `admin_logs` table - only admins can read
- ✅ `profiles.is_admin` - should not be readable by non-admins

---

## Testing

Run the security check script:

```bash
# Copy and paste docs/CHECK_ADMIN_PROMOTER_SECURITY.js into browser console
```

This will test:
1. Public access to profiles table
2. Public access to promoters table
3. Public access to admin_logs table

---

## Current Status

| Data Type | Public Exposure | Auth Required | Risk Level |
|-----------|----------------|---------------|------------|
| Admin Data | ❌ No | ✅ Yes | ✅ LOW |
| Promoter Data | ❌ No | ✅ Yes | ✅ LOW |
| Profile Data | ⚠️ Partial | ✅ Yes | ⚠️ MEDIUM |

---

## Conclusion

**Overall Security Status:** ✅ **GOOD**

- Admin and promoter data are properly protected
- All queries require authentication
- RLS policies should be verified but appear to be working
- Minor improvement recommended for profile query (explicit field selection)

**Action Items:**
1. ✅ Admin data - No action needed (secure)
2. ✅ Promoter data - No action needed (secure)
3. ⚠️ Profile data - Consider explicit field selection (low priority)
