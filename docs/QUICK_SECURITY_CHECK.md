# Quick Security Check Guide

## How to Verify Organizer API Response is Secure

Based on your current DevTools view, here's how to check if sensitive data is exposed.

### ✅ What You Should See (Safe Response)

When viewing the organizer API request in DevTools, the JSON response should **ONLY** contain these types of fields:

#### ✅ Safe Public Fields (OK to expose):
- `id` - Public identifier
- `business_name` - Organization name
- `description` - Public description
- `logo_url` - Public logo
- `cover_image_url` / `banner_url` - Public images
- `website_url` / `website` - Public website
- `social_twitter`, `social_facebook`, etc. - Public social links
- `country_code` - Public location
- `location` - Public location
- `is_verified` - Verification status (public info)
- `is_active` - Active status
- `total_events` - Public event count
- `total_tickets_sold` - Public ticket count (if allowed)
- `total_revenue` - Public revenue (if allowed)
- `average_rating` - Public rating
- `created_at` - Public creation date

### ❌ What You Should NOT See (Security Risk)

If you see any of these fields in the response, it's a **security issue**:

- ❌ `user_id` - Links to user account (sensitive)
- ❌ `available_balance` - Financial data (sensitive)
- ❌ `pending_balance` - Financial data (sensitive)
- ❌ `stripe_connect_id` - Payment integration ID (sensitive)
- ❌ `paystack_subaccount_id` - Payment integration ID (sensitive)
- ❌ `flutterwave_subaccount_id` - Payment integration ID (sensitive)
- ❌ `kyc_status` - KYC verification status (sensitive)
- ❌ `kyc_verified` - KYC verification flag (sensitive)
- ❌ `kyc_level` - KYC level (sensitive)
- ❌ `custom_fee_enabled` - Fee configuration (sensitive)
- ❌ `custom_service_fee_percentage` - Fee configuration (sensitive)
- ❌ `custom_service_fee_fixed` - Fee configuration (sensitive)
- ❌ `email` - Personal email (if different from business_email)
- ❌ `phone` - Personal phone (if different from business_phone)

---

## Quick Check Script

### Method 1: Ready-to-Use Console Script (Recommended)

**Copy the script from `docs/CONSOLE_SECURITY_CHECK.js` and paste it into your browser console.**

This script:
- ✅ Automatically gets the organizer ID from the URL
- ✅ Uses your Supabase credentials
- ✅ Checks all sensitive fields
- ✅ Provides detailed security report

**Steps:**
1. Open an organizer profile page (URL like `/o/...`)
2. Open DevTools (F12) → Console tab
3. Copy the entire contents of `docs/CONSOLE_SECURITY_CHECK.js`
4. Paste into console and press Enter
5. Review the security report

### Method 2: Check Network Response (Easiest - No Code Needed)

1. Open DevTools → **Network** tab
2. Find the `organizers?select=...` request
3. Click it → Go to **Preview** or **Response** tab
4. Press `Cmd+F` (Mac) or `Ctrl+F` (Windows)
5. Search for: `user_id`, `balance`, `stripe`, `kyc`, `subaccount`
6. If **none found** → ✅ Secure!

### Method 2: Console Script (Check Network Response)

**Easiest Method - Copy JSON from Network Tab:**

1. Go to **Network** tab → Find `organizers?select=...` request
2. Click it → Go to **Response** tab
3. Copy the entire JSON response
4. Paste it in console and run:

```javascript
// Paste the JSON response here
const response = { /* paste your JSON here */ };

// Check for sensitive fields
const sensitiveFields = [
  'user_id', 'available_balance', 'pending_balance',
  'stripe_connect_id', 'paystack_subaccount_id',
  'flutterwave_subaccount_id', 'kyc_status', 'kyc_verified'
];

const exposed = sensitiveFields.filter(f => 
  response[f] !== undefined && response[f] !== null
);

if (exposed.length > 0) {
  console.error('❌ SECURITY ISSUE:', exposed);
} else {
  console.log('✅ Secure - No sensitive fields found');
  console.log('Public fields:', Object.keys(response));
}
```

**Alternative: Direct API Check (Requires Supabase URL/Key)**

If you want to test programmatically, get the Supabase URL and anon key from any Network request header, then:

```javascript
// Get from Network tab → Headers → Request Headers → apikey
const SUPABASE_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY_FROM_NETWORK_TAB';

// Get organizer ID from URL
const organizerId = window.location.pathname.split('/o/')[1];

// Fetch directly
const response = await fetch(
  `${SUPABASE_URL}/rest/v1/organizers?id=eq.${organizerId}&select=*`,
  {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
const organizer = Array.isArray(data) ? data[0] : data;

// Check for sensitive fields
const sensitiveFields = [
  'user_id', 'available_balance', 'pending_balance',
  'stripe_connect_id', 'paystack_subaccount_id',
  'flutterwave_subaccount_id', 'kyc_status', 'kyc_verified'
];

const exposed = sensitiveFields.filter(f => 
  organizer[f] !== undefined && organizer[f] !== null
);

if (exposed.length > 0) {
  console.error('❌ SECURITY ISSUE:', exposed);
} else {
  console.log('✅ Secure - No sensitive fields found');
  console.log('Public fields:', Object.keys(organizer));
}
```


---

## Step-by-Step: Checking Your Current Response

Based on your DevTools view:

1. **You're viewing**: `organizers?select=id%2Cbusiness_name%2Cb...`
2. **Response shows**: JSON with fields like `business_name`, `total_events`, etc.
3. **Check**: Look through the JSON response for any sensitive fields listed above

### Your Current Response Analysis

From what I can see in your screenshot, the response contains:
- ✅ `id`, `business_name`, `total_events` - Safe
- ✅ `country_code`, `is_active`, `is_verified` - Safe
- ✅ `total_tickets_sold`, `total_revenue`, `average_rating` - Safe (public stats)
- ✅ Many `null` fields - Safe (no data exposed)

**Good news**: I don't see any of the sensitive fields (`user_id`, `available_balance`, etc.) in your response!

---

## How to Check in DevTools

### Method 1: Visual Inspection
1. In DevTools → Network tab
2. Click the `organizers?select=...` request
3. Go to **"Preview"** or **"Response"** tab
4. Scroll through the JSON
5. Look for any sensitive field names

### Method 2: Search in Response
1. Click the request
2. Go to **"Response"** tab
3. Press `Cmd+F` (Mac) or `Ctrl+F` (Windows)
4. Search for: `user_id`, `balance`, `stripe`, `kyc`
5. If found → Security issue!

### Method 3: Use Console Script
1. Open Console tab in DevTools
2. Paste the check script above
3. Run it
4. Review the output

---

## What to Do If You Find Sensitive Data

### Immediate Actions:
1. **Document the issue**: Note which fields are exposed
2. **Fix the query**: Update `OrganizerPublicProfile.jsx` to exclude sensitive fields
3. **Verify the fix**: Re-run the check
4. **Test in production**: Ensure fix works in production too

### Example Fix:
```javascript
// ❌ BAD - Exposes all fields
.select('*')

// ✅ GOOD - Only public fields
.select(`
  id,
  business_name,
  description,
  logo_url,
  website_url,
  total_events,
  average_rating
  // ... only public fields
`)
```

---

## Additional Checks

### Check 1: Verify RLS is Working
```javascript
// Try to access organizer data without auth
const { data } = await supabase
  .from('organizers')
  .select('*')
  .limit(1);

// Should return empty array or error if RLS is working
console.log('Data without auth:', data);
```

### Check 2: Verify User Isolation
```javascript
// Try to access another user's organizer data
const otherUserId = 'some-other-user-id';
const { data } = await supabase
  .from('organizers')
  .select('*')
  .eq('user_id', otherUserId);

// Should return empty array if isolation is working
console.log('Other user data:', data);
```

---

## Summary

✅ **Your current response looks secure** - I don't see sensitive fields exposed.

The response only contains:
- Public organization information
- Public statistics (event counts, ratings)
- Public contact/social links
- No financial data
- No payment integration IDs
- No KYC information

**Next steps:**
1. Run the console check script to verify programmatically
2. Check other API endpoints (events, tickets, orders)
3. Test with different user accounts
4. Review the manual testing guide for comprehensive checks
