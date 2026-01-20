# Resend DNS Records Setup Guide

## Problem: Domain Not Verified in Resend

If you see "Failed" status for DKIM and SPF records in Resend, your domain is not verified and **SMTP will fail with 500 errors**.

## Solution: Add DNS Records

You need to add DNS records to your domain registrar (where you bought `ticketrack.com`).

## Step-by-Step Instructions

### Step 1: Get DNS Records from Resend

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click on **Domains** in the left sidebar
3. Click on your domain (`ticketrack.com` or `cipherhq.com`)
4. You'll see a list of DNS records that need to be added

### Step 2: Add Records to Your Domain Registrar

Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add these records:

#### Record 1: DKIM (Domain Verification)

**Purpose:** Verifies you own the domain

**Add this record:**
- **Type:** `TXT`
- **Name/Host:** `resend._domainkey` (or exactly as shown in Resend)
- **Value/Content:** The long string from Resend (starts with `p=MIGfMAOGCSqGSIb3...`)
- **TTL:** `3600` or `Auto`

**Example:**
```
Type: TXT
Name: resend._domainkey
Value: p=MIGfMAOGCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
TTL: 3600
```

#### Record 2: SPF - MX Record (Email Sending)

**Purpose:** Allows Resend to send emails from your domain

**Add this record:**
- **Type:** `MX`
- **Name/Host:** `send` (or `@` for root domain)
- **Value/Content:** `feedback-smtp.us-east-1.amazonses.com` (or as shown in Resend)
- **Priority:** `10`
- **TTL:** `3600` or `Auto`

**Example:**
```
Type: MX
Name: send
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
TTL: 3600
```

#### Record 3: SPF - TXT Record (Email Sending)

**Purpose:** Authorizes Resend to send emails

**Add this record:**
- **Type:** `TXT`
- **Name/Host:** `send` (or `@` for root domain)
- **Value/Content:** `v=spf1 include:amazonses.com ~all` (or as shown in Resend)
- **TTL:** `3600` or `Auto`

**Example:**
```
Type: TXT
Name: send
Value: v=spf1 include:amazonses.com ~all
TTL: 3600
```

### Step 3: Wait for DNS Propagation

- DNS changes can take **5 minutes to 48 hours**
- Usually takes **15-30 minutes**
- Resend automatically checks every few minutes

### Step 4: Verify in Resend

1. Go back to Resend → Domains → Your domain
2. Wait for status to update (refresh the page)
3. All records should show:
   - ✅ **Status: Verified** (green checkmark)
   - ❌ **NOT "Failed"** (red)

### Step 5: Test SMTP

Once all records show "Verified":
1. Go to Supabase → Settings → Authentication → Email
2. Test SMTP connection (if available)
3. Try signing up a test user
4. Check that verification email is received

## Common Domain Registrars

### HostGator (Your Setup)
1. Log in to HostGator
2. Go to **Domains** → **Domain Center**
3. Click on your domain (`ticketrack.com`)
4. Click **"DNS"** tab
5. Click **"+ ADD RECORD"** button
6. Add each record:
   - Select **Type** (TXT or MX)
   - Enter **Host Record** (name)
   - Enter **Point To** (value)
   - Set **TTL** to 4 Hours or 3600

**Important Notes for HostGator:**
- For root domain records, use `@` as the Host Record
- For subdomain records (like `send`), just use the name without the domain
- Make sure to copy the FULL value from Resend (don't truncate)

### GoDaddy
1. Log in → My Products → Domains
2. Click your domain → DNS
3. Click "Add" to add each record

### Namecheap
1. Log in → Domain List
2. Click "Manage" next to your domain
3. Go to "Advanced DNS" tab
4. Click "Add New Record" for each

### Cloudflare
1. Log in → Select your domain
2. Go to "DNS" → "Records"
3. Click "Add record" for each

### Google Domains
1. Log in → My domains
2. Click your domain → DNS
3. Click "Custom records" → Add each record

## Troubleshooting

### Records Still Show "Failed" After Adding

1. **Wait longer:** DNS can take up to 48 hours (usually 15-30 min)
2. **Check record values:** Copy EXACTLY from Resend (no extra spaces)
3. **Check record name:** Must match exactly (case-sensitive)
4. **Verify at registrar:** Make sure records are saved and published
5. **Use DNS checker:** Check with [MXToolbox](https://mxtoolbox.com/) or [DNS Checker](https://dnschecker.org/)

### Still Getting 500 Errors

1. **Verify all records are "Verified" in Resend** (not "Failed")
2. **Check Supabase SMTP settings** are correct
3. **Check Supabase logs** for specific SMTP errors
4. **Test with a different email** to rule out email-specific issues

## Quick Checklist

- [ ] Added DKIM TXT record (`resend._domainkey`)
- [ ] Added SPF MX record (`send` with priority 10)
- [ ] Added SPF TXT record (`send` with SPF value)
- [ ] All records show "Verified" in Resend (not "Failed")
- [ ] Waited at least 15-30 minutes after adding records
- [ ] Tested signup and received verification email

## After DNS is Verified

Once all DNS records are verified:
1. ✅ SMTP will work in Supabase
2. ✅ Signup will succeed (no more 500 errors)
3. ✅ Verification emails will be sent
4. ✅ Emails will have better deliverability

## Need Help?

If you're still having issues:
1. Check Resend dashboard for exact record values
2. Verify records are added correctly at your registrar
3. Wait for DNS propagation (can take time)
4. Check Supabase logs for specific error messages
