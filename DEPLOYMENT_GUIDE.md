# Ticketrack Deployment Guide

## 🚀 Simple Steps to Deploy to Production

Your code is ready! Follow these steps in order:

---

## Step 1: Merge to Production (GitHub)

1. Go to: https://github.com/cipherhq/ticketrack
2. You should see a yellow banner saying "payment-payout-improvements had recent pushes"
3. Click **"Compare & pull request"**
4. Review the changes, then click **"Create pull request"**
5. Click **"Merge pull request"** → **"Confirm merge"**

✅ Your code is now on production!

---

## Step 2: Deploy Database Changes (Supabase)

Go to your Supabase Dashboard → SQL Editor and run these files **in order**:

### 2a. Donation Payouts (REQUIRED)
Copy and paste the contents of: `database/donation_payout_schema.sql`

### 2b. Donation Fee Configuration (REQUIRED)
Copy and paste the contents of: `database/add_donation_fee_column.sql`
This adds the configurable donation fee percentage (Admin → Fee Management)

### 2c. Venue Layout System (OPTIONAL - run if you want venue designer)
Run in this order:
1. `database/venue_layout_tables.sql`
2. `database/venue_layout_policies.sql`
3. `database/venue_layout_functions.sql`

### 2d. IoT Venue System (OPTIONAL - advanced feature)
Run: `database/iot_venue_schema.sql`

---

## Step 3: Set Environment Variables (Supabase Secrets)

Go to: Supabase Dashboard → Project Settings → Edge Functions → Secrets

Add these secrets:

### For Apple Wallet (iPhone tickets):
```
APPLE_PASS_TYPE_ID = pass.com.ticketrack.tickets
APPLE_TEAM_ID = 2968MARM74
APPLE_PASS_CERTIFICATE = [Your base64 certificate - see below]
APPLE_PASS_CERTIFICATE_PASSWORD = [Your certificate password]
```

**To get APPLE_PASS_CERTIFICATE:**
Run this command in Terminal:
```bash
base64 -i /Users/bajideace/Documents/ticketrack-apple-wallet.p12
```
Copy the entire output as the value.

### For Google Wallet (Android tickets):
```
GOOGLE_ISSUER_ID = 3388000000023067205
GOOGLE_SERVICE_ACCOUNT_KEY = [Base64 of your JSON file - see below]
```

**To get GOOGLE_SERVICE_ACCOUNT_KEY:**
Run this command in Terminal:
```bash
base64 -i /Users/bajideace/Downloads/ticketrack-wallet-3bb4b010910f.json
```
Copy the entire output as the value.

### For Paystack Payouts (Nigeria/Ghana):
```
PAYSTACK_SECRET_KEY = sk_live_xxxxxxxxxxxxx
```
Get this from: https://dashboard.paystack.com/#/settings/developers

---

## Step 4: Deploy Edge Functions (Terminal)

Open Terminal and run these commands:

```bash
cd /Users/bajideace/Desktop/ticketrack

# Login to Supabase (if not already)
npx supabase login

# Deploy new functions
npx supabase functions deploy generate-wallet-pass
npx supabase functions deploy trigger-paystack-payout
npx supabase functions deploy paystack-webhook
npx supabase functions deploy iot-sensor-data
```

---

## Step 5: Set Up Webhooks

### Paystack Webhook (for payout notifications):
1. Go to: https://dashboard.paystack.com/#/settings/developers
2. Add webhook URL: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/paystack-webhook`
3. Select events: `transfer.success`, `transfer.failed`

---

## ✅ Done!

Your application now has:
- ✅ Apple/Google Wallet ticket passes
- ✅ Donation payouts for free events
- ✅ Multi-currency admin finance
- ✅ Venue layout designer
- ✅ Notification badges
- ✅ Improved security (XSS protection)

---

## 🆘 Need Help?

If something doesn't work:
1. Check Supabase Dashboard → Logs → Edge Functions for errors
2. Check browser console (F12) for frontend errors
3. Make sure all environment variables are set correctly

---

## What's New in This Release

| Feature | Description |
|---------|-------------|
| Apple/Google Wallet | Tickets can be saved to phone wallets |
| Donation Payouts | Free events with donations get automatic payouts |
| Venue Designer | Organizers can design event layouts |
| Multi-Currency Finance | Admin sees revenue in local currencies |
| Notification Badges | Visual alerts for pending tasks |
| Security Updates | XSS protection on all user content |
| Canada Support | Added CAD currency with Stripe |
