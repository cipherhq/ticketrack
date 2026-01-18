# How to Find API Requests in Browser DevTools

This guide shows you how to locate and inspect API requests, specifically the organizer API request.

## Quick Steps

1. **Open DevTools**: Press `F12` or `Right-click → Inspect`
2. **Go to Network tab**: Click the "Network" tab
3. **Enable "Preserve log"**: Check the checkbox to keep requests after navigation
4. **Filter by "Fetch/XHR"**: Click the "Fetch/XHR" filter button
5. **Look for requests** containing `organizers` in the URL

---

## Detailed Instructions

### Step 1: Open Developer Tools

**Method 1: Keyboard Shortcut**
- Press `F12` (Windows/Linux)
- Press `Cmd + Option + I` (Mac)

**Method 2: Right-click Menu**
- Right-click anywhere on the page
- Select "Inspect" or "Inspect Element"

**Method 3: Browser Menu**
- Chrome: Menu (⋮) → More Tools → Developer Tools
- Firefox: Menu (☰) → More Tools → Web Developer Tools

### Step 2: Navigate to Network Tab

1. In DevTools, click the **"Network"** tab
2. You should see a toolbar with options like:
   - Preserve log
   - Disable cache
   - No throttling

### Step 3: Configure Network Tab

1. **Enable "Preserve log"**:
   - Check the checkbox next to "Preserve log"
   - This keeps requests visible even after page navigation

2. **Disable cache** (optional but recommended):
   - Check "Disable cache"
   - Ensures you see fresh requests

### Step 4: Filter Requests

**Option A: Filter by Type**
1. Click the **"Fetch/XHR"** filter button
   - This shows only API requests (not images, CSS, etc.)
   - The organizer API request will be in this list

**Option B: Search by Name**
1. Use the **search/filter box** (usually at the top of the Network tab)
2. Type: `organizers`
3. This will filter to show only requests containing "organizers"

**Option C: Filter by Domain**
1. In the search box, type: `supabase.co`
2. This shows all Supabase API requests

### Step 5: Identify the Organizer Request

Look for requests with URLs like:
- `organizers?select=...`
- `organizers?select=id,business_name...`
- `rest/v1/organizers?...`

The request will typically show:
- **Name**: `organizers?select=...` or similar
- **Status**: `200` (success) or other status codes
- **Type**: `fetch` or `xhr`
- **Initiator**: `@supabase_supabase-js` or component name

### Step 6: Inspect the Request

**Click on the request** to see details:

#### A. Headers Tab
- **Request URL**: Full API endpoint
- **Request Method**: GET, POST, etc.
- **Request Headers**: 
  - `apikey`: Your Supabase anon key
  - `Authorization`: Bearer token (if authenticated)
- **Response Headers**: Server response headers

#### B. Payload Tab (for POST/PUT requests)
- Request body
- Query parameters

#### C. Response Tab
- **Response data**: The actual data returned
- This is where you check for sensitive fields

#### D. Preview Tab
- Formatted JSON response
- Easier to read than raw Response tab

---

## Example: Finding Organizer API Request

### Scenario: Viewing Public Organizer Profile

1. **Navigate to**: `/o/{organizer-id}` (public organizer profile page)

2. **Open DevTools** → Network tab

3. **Filter by "Fetch/XHR"** or search for `organizers`

4. **Look for request** like:
   ```
   Name: organizers?select=id,business_name,description...
   Status: 200
   Type: fetch
   Initiator: OrganizerPublicProfile.jsx:59
   ```

5. **Click the request** to inspect:
   - **Request URL**: `https://your-project.supabase.co/rest/v1/organizers?select=...`
   - **Response**: JSON data with organizer information

---

## What to Look For

### ✅ Good Request (Secure)
```json
// Response should only contain public fields:
{
  "id": "...",
  "business_name": "...",
  "description": "...",
  "logo_url": "...",
  "website_url": "...",
  "total_events": 10,
  "average_rating": 4.5
}
```

### ❌ Bad Request (Security Issue)
```json
// Response should NOT contain:
{
  "user_id": "...",              // ❌ Sensitive
  "available_balance": 1234.56,  // ❌ Sensitive
  "pending_balance": 567.89,      // ❌ Sensitive
  "stripe_connect_id": "...",     // ❌ Sensitive
  "paystack_subaccount_id": "...", // ❌ Sensitive
  "kyc_status": "...",            // ❌ Sensitive
  "email": "...",                  // ❌ Sensitive (if personal)
  "phone": "..."                   // ❌ Sensitive (if personal)
}
```

---

## Common Request Patterns

### Pattern 1: Public Organizer Profile
```
URL: /rest/v1/organizers?select=id,business_name,...&id=eq.{organizer-id}
Method: GET
Status: 200
```

### Pattern 2: Authenticated Organizer Data
```
URL: /rest/v1/organizers?select=*&user_id=eq.{user-id}
Method: GET
Status: 200
Headers: Authorization: Bearer {token}
```

### Pattern 3: Failed Request (RLS Blocked)
```
URL: /rest/v1/organizers?select=*
Method: GET
Status: 200 (but empty array) OR 403/401
Response: [] (empty array)
```

---

## Troubleshooting

### Issue: Can't find the request

**Solution 1: Clear and reload**
1. Click the **clear button** (🚫) in Network tab
2. Reload the page (`F5` or `Cmd+R`)
3. Watch for new requests

**Solution 2: Check filters**
- Make sure "All" or "Fetch/XHR" is selected
- Remove any search filters
- Check that "Preserve log" is enabled

**Solution 3: Check timing**
- The request might happen before you opened DevTools
- Reload the page with DevTools already open

### Issue: Request shows 406 or other error

**Status 406**: Not Acceptable
- Check the request headers
- Verify the `Accept` header is correct
- Check if the query parameters are valid

**Status 403**: Forbidden
- RLS is blocking the request (good for security!)
- This is expected for protected resources

**Status 401**: Unauthorized
- Missing or invalid authentication token
- Check if user is logged in

---

## Quick Reference: Network Tab Shortcuts

- **Clear requests**: Click 🚫 icon or `Cmd+K` (Mac) / `Ctrl+K` (Windows)
- **Search**: `Cmd+F` (Mac) / `Ctrl+F` (Windows)
- **Filter by type**: Click filter buttons (Fetch/XHR, Doc, etc.)
- **Inspect request**: Click on any request in the list
- **Copy request**: Right-click → Copy → Copy as cURL / Copy as fetch

---

## Example: Complete Workflow

1. **Open your app**: `http://localhost:5173/o/{organizer-id}`
2. **Open DevTools**: `F12`
3. **Go to Network tab**
4. **Enable "Preserve log"**
5. **Click "Fetch/XHR" filter**
6. **Reload page**: `F5`
7. **Look for**: Request with `organizers` in the name
8. **Click the request**
9. **Go to "Response" or "Preview" tab**
10. **Check the JSON data** for sensitive fields

---

## Pro Tips

1. **Use the search box**: Type `organizers` to quickly filter
2. **Check the Initiator column**: Shows which component made the request
3. **Look at Status codes**: 
   - `200` = Success
   - `401` = Unauthorized
   - `403` = Forbidden
   - `406` = Not Acceptable
   - `429` = Rate Limited
4. **Copy as cURL**: Right-click request → Copy → Copy as cURL (useful for testing)
5. **Export HAR**: Right-click → Save all as HAR (for sharing/debugging)

---

## Visual Guide

```
┌─────────────────────────────────────────────────────────┐
│ DevTools - Network Tab                                   │
├─────────────────────────────────────────────────────────┤
│ [Preserve log] [Disable cache] [No throttling]         │
│                                                           │
│ [All] [Fetch/XHR] [Doc] [CSS] [JS] ... [Search: ___]   │
├─────────────────────────────────────────────────────────┤
│ Name              │ Status │ Type │ Size │ Time        │
├─────────────────────────────────────────────────────────┤
│ organizers?select │ 200    │ fetch│ 2.1kB│ 45ms        │ ← Click this
│ events?select=...  │ 200    │ fetch│ 5.3kB│ 67ms        │
│ followers?select  │ 406    │ fetch│ 0.8kB│ 23ms        │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ Request Details (after clicking)                        │
├─────────────────────────────────────────────────────────┤
│ [Headers] [Payload] [Response] [Preview]                │
│                                                           │
│ Response Tab:                                            │
│ {                                                        │
│   "id": "...",                                           │
│   "business_name": "...",                                │
│   ...                                                    │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
```

---

For more detailed security testing instructions, see `docs/MANUAL_SECURITY_TESTING.md`.
