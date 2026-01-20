# Troubleshooting Signup 500 Error

## Issue: 500 Server Error During Signup

If you're getting a 500 error when users try to sign up, it's likely related to **Supabase SMTP configuration**.

## Root Cause

When a user signs up, Supabase:
1. Creates the user account
2. **Attempts to send a verification email** using your configured SMTP settings
3. If SMTP is misconfigured, this step fails and can cause a 500 error

## Quick Check: Verify SMTP Configuration

### 1. Check Supabase Dashboard
- Go to **Settings** → **Auth** → **SMTP Settings**
- Verify all fields are correct:
  - ✅ **Host**: `smtp.resend.com`
  - ✅ **Port**: `587` (not 583!)
  - ✅ **Username**: `resend` (lowercase)
  - ✅ **Password**: Your Resend API key (correct and active)
  - ✅ **Sender email**: `tickets@ticketrack.com` (must be verified in Resend)
  - ✅ **Sender name**: `Ticketrack`

### 2. Verify Domain in Resend
- Go to [Resend Dashboard](https://resend.com/domains)
- Ensure `ticketrack.com` is **verified**
- Check that `tickets@ticketrack.com` is allowed to send emails

### 3. Test SMTP Connection
- In Supabase dashboard, look for a "Test SMTP" button
- Or check Supabase logs for SMTP connection errors

## Common SMTP Issues

### Issue 1: Wrong Port Number
- ❌ **Wrong**: Port `583`
- ✅ **Correct**: Port `587` (TLS) or `465` (SSL)

### Issue 2: Wrong Username
- ❌ **Wrong**: `Resend` (capital R)
- ✅ **Correct**: `resend` (lowercase)

### Issue 3: Invalid API Key
- Check that your Resend API key is active
- Regenerate if needed: [Resend API Keys](https://resend.com/api-keys)

### Issue 4: Domain Not Verified
- The sender email domain must be verified in Resend
- Check Resend dashboard → Domains

### Issue 5: Sender Email Not Allowed
- The sender email must match a verified domain
- Or use Resend's default sending domain for testing

## How to Debug

### Step 1: Check Supabase Logs
1. Go to Supabase Dashboard → **Logs**
2. Filter by "Auth" or "Email"
3. Look for SMTP errors around the signup time
4. Common errors:
   - `SMTP connection failed`
   - `Authentication failed`
   - `Invalid credentials`
   - `Domain not verified`

### Step 2: Check Browser Console
1. Open DevTools → Network tab
2. Try to sign up
3. Look for the failed request (red status)
4. Check the response body for error details

### Step 3: Test Email Sending Manually
1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Try sending a test email
3. If this fails, SMTP is definitely misconfigured

## Temporary Workaround

If SMTP is broken, you can temporarily:

1. **Disable email confirmation** (not recommended for production):
   - Supabase Dashboard → **Settings** → **Auth**
   - Set `Enable email confirmations` to `false`
   - Users can sign up without email verification

2. **Use Supabase default email service** (temporary):
   - Disable custom SMTP in Supabase
   - Use Supabase's default email service
   - Note: This has rate limits and may go to spam

## Fix Steps

1. **Verify Resend Configuration**:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: [Your Resend API Key]
   ```

2. **Verify Domain in Resend**:
   - Add `ticketrack.com` to Resend
   - Verify DNS records (SPF, DKIM)
   - Wait for verification (can take a few minutes)

3. **Test SMTP**:
   - Use Supabase's test email feature
   - Or try signing up with a test account

4. **Check Logs**:
   - Monitor Supabase logs for SMTP errors
   - Fix any configuration issues

## Expected Behavior After Fix

- ✅ Signup succeeds
- ✅ User receives verification email
- ✅ No 500 errors in console
- ✅ User can verify email and log in

## Still Having Issues?

If SMTP is correctly configured but you still get 500 errors:

1. **Check Supabase Status**: [status.supabase.com](https://status.supabase.com)
2. **Check Resend Status**: [resend.com/status](https://resend.com/status)
3. **Review Supabase Logs**: Look for other errors beyond SMTP
4. **Check Database**: Ensure `profiles` table and triggers are working
5. **Check RLS Policies**: Ensure they allow user creation

## Related Files

- `src/contexts/AuthContext.jsx` - Signup logic
- `supabase/config.toml` - Local Supabase config
- `docs/EMAIL_VERIFICATION_SETUP.md` - Email setup guide
