# Email Verification Setup Guide

## Current Status

**Local Development:**
- ✅ Emails are captured by Inbucket (email testing server)
- 📧 View emails at: `http://localhost:54324`
- ⚠️ Emails are **not actually sent** - only captured for testing

**Production:**
- ✅ **SMTP is configured correctly:**
  - ✅ Port: `587` (TLS) ✓
  - ✅ Sender email: `tickets@ticketrack.com` ✓
  - ✅ Host: `smtp.resend.com` ✓
  - ✅ Username: `Resend` ✓ (Resend accepts both cases)
  - ✅ Password: Configured ✓
  - ✅ Sender name: `Ticketrack` ✓

## How to Check Emails

### Local Development
1. Start Supabase: `npx supabase start`
2. Sign up or request OTP
3. Open Inbucket: `http://localhost:54324`
4. Find your email in the inbox

### Production
- Check spam folder
- Check Supabase dashboard → Authentication → Email Templates (to see if emails are being sent)
- Monitor Supabase dashboard → Logs for email sending errors

## Setup Production Email (Recommended: Resend)

Since you already have Resend configured for your custom emails, let's configure Supabase to use Resend for auth emails too.

### Option 1: Configure Supabase to Use Resend SMTP (Recommended)

1. **Get Resend SMTP credentials:**
   - Go to https://resend.com/emails
   - Navigate to SMTP settings
   - Create SMTP credentials (or use API key for SMTP)

2. **Verify Configuration in Supabase Dashboard:**
   - ✅ **Host**: `smtp.resend.com` ✓
   - ✅ **Port**: `587` (TLS) ✓
   - ✅ **Username**: `Resend` ✓ (Resend accepts both cases)
   - ✅ **Password**: Your Resend API key ✓
   - ✅ **Sender email**: `tickets@ticketrack.com` ✓
   - ✅ **Sender name**: `Ticketrack` ✓
   
   **All settings are correct!** ✅

3. **Verify your domain in Resend:**
   - Go to Resend dashboard → Domains
   - Add and verify `ticketrack.com`
   - This improves deliverability

### Option 2: Configure via config.toml (For Self-Hosted)

If you're self-hosting Supabase, uncomment and update in `supabase/config.toml`:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 587
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "tickets@ticketrack.com"
sender_name = "Ticketrack"
```

### Option 3: Use SendGrid (Alternative)

If you prefer SendGrid:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"
admin_email = "tickets@ticketrack.com"
sender_name = "Ticketrack"
```

## Testing Email Verification

1. **Local:**
   - Sign up with an email
   - Check Inbucket at `http://localhost:54324`
   - Click the verification link or enter OTP

2. **Production:**
   - Sign up with a real email
   - Check inbox (and spam)
   - Verify the email

## Troubleshooting

### Emails Not Received (Production)

1. **Check Supabase Dashboard:**
   - Go to **Authentication** → **Users**
   - Check if user is created but email not confirmed
   - Check **Logs** for email sending errors

2. **Check Spam Folder:**
   - Supabase default emails often go to spam
   - Once SMTP is configured with a verified domain, this improves

3. **Check Email Service:**
   - Verify SMTP credentials are correct
   - Check Resend/SendGrid dashboard for delivery logs
   - Ensure domain is verified (if using custom domain)

4. **Rate Limits:**
   - Default Supabase email service has rate limits
   - Custom SMTP usually has higher limits

### Common Issues

**"Email not sending" errors:**
- SMTP not configured → Configure SMTP (see above)
- Invalid credentials → Check SMTP username/password
- Domain not verified → Verify domain in Resend/SendGrid

**Emails going to spam:**
- Use verified domain (not generic sender)
- Configure SPF/DKIM records (Resend/SendGrid does this automatically)
- Use proper sender name

## Current Configuration

- **Custom Emails (Resend)**: ✅ Configured (`send-email` edge function)
- **Auth Emails (Supabase)**: ⚠️ Using default service (needs SMTP configuration)

## Next Steps

1. ✅ **SMTP Configuration**: All settings are correct!
2. ✅ **Verify Domain**: Ensure `ticketrack.com` is verified in Resend dashboard
   - Go to Resend → Domains
   - Add and verify `ticketrack.com` if not already done
   - This improves deliverability and prevents spam
3. 🧪 **Test Email Delivery**:
   - Sign up with a real email address
   - Check inbox (and spam folder) for verification email
   - If emails don't arrive, check Supabase logs for errors
4. ✅ **Local Dev**: Check Inbucket at `http://localhost:54324` for local testing

## Quick Test

**Local:**
```bash
# Start Supabase
npx supabase start

# Sign up via web app
# Then check: http://localhost:54324
```

**Production:**
```bash
# After configuring SMTP
# Sign up with real email
# Check inbox for verification email
```
