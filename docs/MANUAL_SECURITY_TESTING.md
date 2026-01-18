# Manual Security Testing Guide

This guide provides step-by-step instructions for manually testing security areas that cannot be fully automated.

## Prerequisites

- Access to the application (development or staging environment)
- Two test user accounts (for user isolation testing)
- Browser developer tools (Chrome DevTools, Firefox DevTools)
- Postman or similar API testing tool (optional)

---

## 1. Public Organizer Data - Sensitive Field Exposure

**Goal**: Verify that public organizer profiles don't expose sensitive data.

### Steps

1. **Open Browser DevTools** (F12 or Right-click → Inspect)
2. **Go to Network tab** and enable "Preserve log"
3. **Navigate to a public organizer profile**: `/o/{organizer-id}`
4. **Find the API request** to `organizers` table
5. **Click on the request** → View Response
6. **Check for sensitive fields** in the response:

```json
// ❌ BAD - These should NOT be in public response:
{
  "user_id": "...",
  "available_balance": 1234.56,
  "pending_balance": 567.89,
  "stripe_connect_id": "...",
  "paystack_subaccount_id": "...",
  "flutterwave_subaccount_id": "...",
  "kyc_status": "...",
  "kyc_verified": true
}

// ✅ GOOD - Only public fields should be present:
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

### Expected Result
- ✅ Only public-safe fields are returned
- ❌ No sensitive financial or personal data exposed

### Fix if Failed
- Update the query in `OrganizerPublicProfile.jsx` to use selective field selection (already fixed)
- Or create a database view with only public fields

---

## 2. Input Validation - Special Characters

**Goal**: Test how the application handles special characters in user input.

### Test Cases

#### A. Event Title with Special Characters
1. **Go to**: Create Event page (`/create-event`)
2. **Try entering** these in the "Event Title" field:
   ```
   <script>alert('XSS')</script>
   Event & Party!
   Event "Special" Name
   Event's Night
   Event @ 2024
   Event #1
   Event $100
   Event %50
   Event (VIP)
   Event [Sold Out]
   Event {Limited}
   ```
3. **Save the event** and check:
   - Does it save correctly?
   - Are special characters escaped/encoded?
   - Does it display correctly on the event page?

#### B. Description with HTML/JavaScript
1. **In Event Description** (rich text editor), try:
   ```html
   <h1>Test</h1>
   <script>alert('XSS')</script>
   <img src=x onerror=alert('XSS')>
   ```
2. **Check**:
   - Is HTML sanitized?
   - Does JavaScript execute? (It shouldn't)
   - Are only safe HTML tags allowed?

#### C. Venue Address with Special Characters
1. **In Venue Address field**, try:
   ```
   123 Main St. & Broadway
   "VIP" Section
   Building #5, Floor 2
   ```
2. **Check**:
   - Does it save correctly?
   - Does it display correctly on event page?

### Expected Result
- ✅ Special characters are handled safely
- ✅ HTML/JavaScript is sanitized
- ✅ No XSS vulnerabilities
- ✅ Data displays correctly

### Fix if Failed
- Add input sanitization (use `DOMPurify` for HTML)
- Escape special characters in database queries
- Validate input on both frontend and backend

---

## 3. CSRF (Cross-Site Request Forgery) Protection

**Goal**: Verify that CSRF tokens protect against unauthorized actions.

### Test A: Check for CSRF Tokens

1. **Open DevTools** → Network tab
2. **Perform an action** that modifies data (e.g., create event, update profile)
3. **Inspect the request**:
   - Look for CSRF token in headers or request body
   - Check if Supabase auth token is present

### Test B: Attempt CSRF Attack (Simulation)

1. **Create a test HTML file** on your local machine:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <h1>CSRF Test</h1>
     <form id="csrfForm" action="https://your-app.com/api/update-profile" method="POST">
       <input type="hidden" name="business_name" value="HACKED">
       <input type="submit" value="Click me">
     </form>
     <script>
       // Auto-submit form
       document.getElementById('csrfForm').submit();
     </script>
   </body>
   </html>
   ```
2. **Open this file** in a browser where you're logged into the app
3. **Check**:
   - Does the request succeed? (It shouldn't without proper auth)
   - Is the action blocked?

### Expected Result
- ✅ All state-changing requests require authentication
- ✅ CSRF tokens or auth tokens are validated
- ✅ Unauthorized requests are rejected

### Fix if Failed
- Ensure all POST/PUT/DELETE requests require authentication
- Verify Supabase RLS policies are active
- Add CSRF token validation if using custom endpoints

---

## 4. Rate Limiting - API Protection

**Goal**: Verify that rate limiting prevents abuse.

### Test A: Rapid Requests

1. **Open Browser Console** (F12 → Console)
2. **Run this script** to make rapid requests:
   ```javascript
   async function testRateLimit() {
     const requests = [];
     for (let i = 0; i < 50; i++) {
       requests.push(
         fetch('https://your-supabase-url.supabase.co/rest/v1/events?select=*', {
           headers: {
             'apikey': 'YOUR_ANON_KEY',
             'Authorization': 'Bearer YOUR_ANON_KEY'
           }
         })
       );
     }
     const responses = await Promise.all(requests);
     const errors = responses.filter(r => !r.ok);
     console.log(`Success: ${responses.length - errors.length}, Errors: ${errors.length}`);
     errors.forEach(r => console.log('Error:', r.status, r.statusText));
   }
   testRateLimit();
   ```
3. **Check**:
   - Do requests start failing after a certain number?
   - Do you see rate limit errors (429 status)?

### Test B: Supabase Dashboard Check

1. **Go to**: Supabase Dashboard → Settings → API
2. **Check Rate Limiting settings**:
   - Is rate limiting enabled?
   - What are the limits? (requests per second/minute)
3. **Review**: API usage and rate limit violations

### Expected Result
- ✅ Rate limiting is active
- ✅ Excessive requests are blocked (429 status)
- ✅ Limits are reasonable (not too strict, not too loose)

### Fix if Failed
- Enable rate limiting in Supabase Dashboard
- Configure appropriate limits based on your needs
- Consider implementing custom rate limiting for specific endpoints

---

## 5. Authorization - User Data Isolation

**Goal**: Verify that users can only access their own data.

### Test Setup

1. **Create two test accounts**:
   - User A: `testuserA@example.com`
   - User B: `testuserB@example.com`

### Test A: Organizer Data Isolation

1. **Login as User A**
2. **Create an event** (note the event ID)
3. **Create an organizer profile** (note the organizer ID)
4. **Logout**

5. **Login as User B**
6. **Try to access User A's data**:
   - Navigate to: `/organizer/events/{user-a-event-id}`
   - Try to edit User A's organizer profile
   - Check browser console for API requests

7. **Check**:
   - Can User B see User A's events? (Should only see their own)
   - Can User B edit User A's organizer profile? (Should be blocked)
   - Are API requests returning 403/401 errors?

### Test B: Order/Ticket Data Isolation

1. **As User A**: Purchase tickets for an event
2. **As User B**: Try to access User A's tickets
   - Check: `/my-tickets` page
   - Try API: `GET /tickets?user_id={user-a-id}`

3. **Check**:
   - Can User B see User A's tickets? (Should be blocked)
   - Are tickets filtered by authenticated user?

### Test C: Direct API Access

1. **As User B**, open Browser Console
2. **Try to fetch User A's data**:
   ```javascript
   // Get User A's organizer ID first (from User A's session)
   const userAOrganizerId = 'user-a-organizer-id';
   
   const { data, error } = await supabase
     .from('organizers')
     .select('*')
     .eq('id', userAOrganizerId)
     .single();
   
   console.log('Data:', data);
   console.log('Error:', error);
   ```

3. **Check**:
   - Does it return User A's data? (Should be blocked by RLS)
   - Is there an error? (Should be 403 or empty result)

### Expected Result
- ✅ Users can only see their own data
- ✅ RLS policies block unauthorized access
- ✅ API returns empty results or errors for other users' data

### Fix if Failed
- Review and update RLS policies in Supabase
- Ensure all queries filter by `auth.uid()`
- Test RLS policies in Supabase SQL Editor

---

## 6. File Upload - Type Validation

**Goal**: Verify that only allowed file types can be uploaded.

### Test Cases

#### A. Event Banner Image
1. **Go to**: Create Event page
2. **Try uploading different file types**:
   - ✅ Valid: `.jpg`, `.png`, `.webp`, `.gif`
   - ❌ Invalid: `.exe`, `.php`, `.js`, `.html`, `.zip`, `.pdf` (if not allowed)

3. **For each file type**, check:
   - Is the file accepted?
   - Is there an error message?
   - Does the file upload successfully?

#### B. Venue Layout Image
1. **Go to**: Create Event → Venue tab
2. **Try uploading**:
   - Image files (should work)
   - Executable files (should be blocked)
   - Script files (should be blocked)

#### C. Organizer Logo
1. **Go to**: Organizer Profile
2. **Try uploading**:
   - Valid image files
   - Invalid file types

### Expected Result
- ✅ Only allowed file types are accepted
- ✅ Invalid file types show clear error messages
- ✅ File type is validated on both frontend and backend

### Fix if Failed
- Add file type validation in frontend
- Add file type validation in Supabase Storage policies
- Check MIME type, not just file extension

---

## 7. File Upload - Size Limits

**Goal**: Verify that file size limits are enforced.

### Test Cases

#### A. Small Files (Should Work)
1. **Upload files** of various small sizes:
   - 100 KB image
   - 500 KB image
   - 1 MB image

#### B. Large Files (Should Be Blocked)
1. **Try uploading**:
   - 5 MB image
   - 10 MB image
   - 50 MB image
   - 100 MB image

2. **Check**:
   - Is there a size limit error?
   - What's the maximum allowed size?
   - Is the error message clear?

#### C. Check Storage Limits
1. **Go to**: Supabase Dashboard → Storage
2. **Check**:
   - What are the bucket size limits?
   - Are there per-file size limits?

### Expected Result
- ✅ Files within size limit upload successfully
- ✅ Files exceeding limit are rejected
- ✅ Clear error messages for oversized files
- ✅ Limits are reasonable (e.g., 5-10 MB for images)

### Fix if Failed
- Add file size validation in frontend (before upload)
- Configure Supabase Storage bucket policies
- Set appropriate size limits based on use case

---

## 8. Additional Manual Tests

### A. Session Management
1. **Login** to the application
2. **Copy your auth token** from browser storage
3. **Logout**
4. **Try to use the old token** in an API request
5. **Check**: Is the token invalidated? (Should be)

### B. Password Security
1. **Try weak passwords** during signup:
   - `password`
   - `123456`
   - `abc123`
2. **Check**: Are weak passwords rejected? (Should be)

### C. Email Verification
1. **Sign up** with a new email
2. **Try to login** without verifying email
3. **Check**: Is login blocked until email is verified?

### D. OTP Security
1. **Request OTP** multiple times rapidly
2. **Check**: Is there rate limiting on OTP requests?
3. **Try invalid OTPs** multiple times
4. **Check**: Is there a limit on failed OTP attempts?

---

## Testing Checklist

Use this checklist to track your manual testing progress:

### Critical Security Tests
- [ ] Public organizer data doesn't expose sensitive fields
- [ ] Special characters are handled safely (no XSS)
- [ ] CSRF protection is active
- [ ] Rate limiting prevents abuse
- [ ] Users can only access their own data
- [ ] File uploads validate file types
- [ ] File uploads enforce size limits

### Additional Tests
- [ ] Session tokens are invalidated on logout
- [ ] Weak passwords are rejected
- [ ] Email verification is required
- [ ] OTP requests are rate limited
- [ ] Failed login attempts are rate limited

---

## Reporting Issues

If you find security issues during manual testing:

1. **Document the issue**:
   - What you tested
   - What happened (actual result)
   - What should happen (expected result)
   - Steps to reproduce

2. **Create a security issue** (private, not public):
   - Title: "Security: [Issue Type]"
   - Description: Detailed steps and evidence
   - Severity: Critical / High / Medium / Low

3. **Fix priority**:
   - **Critical**: Fix immediately (data exposure, authentication bypass)
   - **High**: Fix before next release (authorization issues)
   - **Medium**: Fix soon (input validation, rate limiting)
   - **Low**: Fix when convenient (minor issues)

---

## Tools for Manual Testing

### Browser DevTools
- **Network Tab**: Monitor API requests/responses
- **Console Tab**: Run JavaScript tests
- **Application Tab**: Check cookies, localStorage, sessionStorage
- **Security Tab**: Check HTTPS, certificates

### Browser Extensions
- **ModHeader**: Modify HTTP headers for testing
- **Postman Interceptor**: Capture and replay requests
- **React DevTools**: Inspect React component state

### API Testing Tools
- **Postman**: Test API endpoints directly
- **curl**: Command-line API testing
- **Insomnia**: Alternative to Postman

### Security Testing Tools
- **OWASP ZAP**: Web application security scanner
- **Burp Suite**: Web vulnerability scanner (free version available)

---

## Example Test Scripts

### Test Rate Limiting (Browser Console)
```javascript
// Test rapid API requests
async function testRateLimit() {
  const results = [];
  for (let i = 0; i < 100; i++) {
    const start = Date.now();
    try {
      const res = await fetch('https://your-api.com/endpoint');
      results.push({ 
        request: i, 
        status: res.status, 
        time: Date.now() - start 
      });
    } catch (e) {
      results.push({ request: i, error: e.message });
    }
  }
  console.table(results);
}
testRateLimit();
```

### Test User Isolation (Browser Console)
```javascript
// Test if you can access another user's data
async function testUserIsolation() {
  const otherUserId = 'some-other-user-id';
  
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', otherUserId);
  
  if (data && data.length > 0) {
    console.error('❌ SECURITY ISSUE: Can access other user\'s tickets!');
  } else {
    console.log('✅ User isolation working correctly');
  }
}
testUserIsolation();
```

---

## Next Steps After Manual Testing

1. **Document findings**: Create a security testing report
2. **Fix issues**: Prioritize and fix identified vulnerabilities
3. **Re-test**: Verify fixes work correctly
4. **Update automated tests**: Add automated tests for issues found
5. **Schedule regular testing**: Set up quarterly security reviews

---

**Remember**: Security is an ongoing process. Regular manual testing combined with automated security testing helps maintain a secure application.
