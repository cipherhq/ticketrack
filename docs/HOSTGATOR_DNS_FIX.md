# HostGator DNS Records - Quick Fix Guide

## Current Status

Looking at your HostGator DNS records, I can see:

✅ **You have:**
- `resend._domainkey` TXT record (DKIM) - **BUT value might be incomplete**
- `send` TXT record with SPF value

❌ **Missing:**
- `send` MX record (required for email sending)

## Issues to Fix

### Issue 1: DKIM Value Might Be Truncated

Your current DKIM record shows:
```
Host Record: resend._domainkey
Point To: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBIQKBgQCipRD;
```

**Problem:** This value looks incomplete/truncated. DKIM values are usually much longer (200+ characters).

**Fix:**
1. Go to Resend Dashboard → Domains → Your domain
2. Copy the **FULL** DKIM value (the entire long string)
3. In HostGator, edit the `resend._domainkey` record
4. Paste the **complete** value (should be much longer)
5. Save

### Issue 2: Missing MX Record

You need to add an **MX record** for `send`:

**Add this record:**
- **Type:** `MX`
- **Host Record:** `send`
- **Point To:** `feedback-smtp.us-east-1.amazonses.com` (or as shown in Resend)
- **Priority:** `10`
- **TTL:** `4 Hours` or `3600`

**Steps:**
1. In HostGator DNS page, click **"+ ADD RECORD"**
2. Select **Type:** `MX`
3. **Host Record:** `send`
4. **Point To:** `feedback-smtp.us-east-1.amazonses.com` (copy from Resend)
5. **Priority:** `10`
6. **TTL:** `4 Hours`
7. Click **Save** or **Add**

### Issue 3: SPF Record Value

Your current SPF shows:
```
Host Record: send
Point To: v=spf1 include:amazonses.com -all
```

**Check:** Make sure this matches exactly what Resend shows. It should be:
- `v=spf1 include:amazonses.com ~all` (with `~all` - soft fail)
- OR `v=spf1 include:amazonses.com -all` (with `-all` - hard fail)

Both can work, but check what Resend expects.

## Step-by-Step Fix

### Step 1: Fix DKIM Record

1. Go to Resend Dashboard → Domains → `ticketrack.com`
2. Find the DKIM record
3. Copy the **ENTIRE** value (it's a very long string)
4. In HostGator:
   - Find the `resend._domainkey` TXT record
   - Click the three dots (⋮) → Edit
   - Replace the "Point To" value with the **complete** value from Resend
   - Save

### Step 2: Add MX Record

1. In HostGator DNS page, click **"+ ADD RECORD"**
2. Fill in:
   - **Type:** `MX`
   - **Host Record:** `send`
   - **Point To:** `feedback-smtp.us-east-1.amazonses.com` (from Resend)
   - **Priority:** `10`
   - **TTL:** `4 Hours`
3. Click **Save**

### Step 3: Verify SPF Record

1. Check Resend dashboard for the exact SPF value
2. Compare with your HostGator `send` TXT record
3. If different, edit to match exactly

### Step 4: Wait and Check

1. Wait **15-30 minutes** for DNS propagation
2. Go back to Resend Dashboard → Domains
3. Refresh the page
4. All records should show **"Verified"** ✅ (not "Failed")

## Expected Final DNS Records

After fixing, you should have:

1. **DKIM:**
   - Type: `TXT`
   - Host: `resend._domainkey`
   - Value: (long complete string from Resend)
   - Status: ✅ Verified

2. **SPF MX:**
   - Type: `MX`
   - Host: `send`
   - Value: `feedback-smtp.us-east-1.amazonses.com`
   - Priority: `10`
   - Status: ✅ Verified

3. **SPF TXT:**
   - Type: `TXT`
   - Host: `send`
   - Value: `v=spf1 include:amazonses.com ~all` (or `-all`)
   - Status: ✅ Verified

## Troubleshooting

### Records Still Show "Failed"

1. **Wait longer:** DNS changes can take 24-48 hours (usually 15-30 min)
2. **Check values:** Copy EXACTLY from Resend (no extra spaces, complete values)
3. **Verify in HostGator:** Make sure records are saved and visible
4. **Check DNS propagation:** Use [MXToolbox](https://mxtoolbox.com/) to verify records are live

### DKIM Value Too Long for HostGator

If HostGator truncates the DKIM value:
1. Try editing the record again
2. Make sure you're copying the complete value
3. Some DNS providers have character limits - check HostGator's limit
4. If still truncated, contact HostGator support

## After All Records Are Verified

Once Resend shows all records as "Verified":
1. ✅ SMTP will work in Supabase
2. ✅ Signup will succeed (no more 500 errors)
3. ✅ Verification emails will be sent successfully

## Quick Checklist

- [ ] DKIM value is complete (not truncated) - check length
- [ ] MX record for `send` is added with priority 10
- [ ] SPF TXT record matches Resend exactly
- [ ] All records show "Verified" in Resend (wait 15-30 min)
- [ ] Test signup - should work now!
