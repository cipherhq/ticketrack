# Edge Functions Deployment Guide

## Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref bkvbvggngttrizbchygy
```

---

## Quick Deploy (All Functions)

Run this command from the project root:

```bash
npm run deploy:functions
```

Or manually:

```bash
supabase functions deploy --no-verify-jwt
```

This deploys all functions in the `supabase/functions/` folder.

---

## Deploy Individual Functions

```bash
# Communication
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy send-sms --no-verify-jwt
supabase functions deploy send-whatsapp --no-verify-jwt
supabase functions deploy send-telegram --no-verify-jwt
supabase functions deploy send-push-notification --no-verify-jwt
supabase functions deploy send-communication-campaign --no-verify-jwt
supabase functions deploy send-bulk-email --no-verify-jwt

# Automation
supabase functions deploy process-automation-jobs --no-verify-jwt
supabase functions deploy process-drip-campaigns --no-verify-jwt
supabase functions deploy send-event-reminders --no-verify-jwt
supabase functions deploy send-birthday-emails --no-verify-jwt

# Email Tracking
supabase functions deploy email-tracking --no-verify-jwt
supabase functions deploy email-inbound-webhook --no-verify-jwt

# Inbound Webhooks (Two-way messaging)
supabase functions deploy sms-inbound-webhook --no-verify-jwt
supabase functions deploy whatsapp-inbound-webhook --no-verify-jwt
supabase functions deploy telegram-webhook --no-verify-jwt

# Credits
supabase functions deploy create-credit-purchase --no-verify-jwt
supabase functions deploy verify-credit-purchase --no-verify-jwt

# Payment Providers
supabase functions deploy create-flutterwave-checkout --no-verify-jwt
supabase functions deploy create-flutterwave-subaccount --no-verify-jwt
supabase functions deploy flutterwave-webhook --no-verify-jwt
supabase functions deploy create-paystack-subaccount --no-verify-jwt
supabase functions deploy paystack-webhook --no-verify-jwt
supabase functions deploy trigger-paystack-payout --no-verify-jwt

# Stripe
supabase functions deploy create-stripe-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-stripe-connect-account --no-verify-jwt
supabase functions deploy stripe-connect-webhook --no-verify-jwt
supabase functions deploy trigger-stripe-connect-payout --no-verify-jwt
supabase functions deploy get-stripe-connect-balance --no-verify-jwt
supabase functions deploy process-stripe-connect-refund --no-verify-jwt
supabase functions deploy create-stripe-identity-session --no-verify-jwt
supabase functions deploy stripe-identity-webhook --no-verify-jwt

# PayPal
supabase functions deploy create-paypal-checkout --no-verify-jwt
supabase functions deploy capture-paypal-payment --no-verify-jwt

# Verification
supabase functions deploy verify-bank-account --no-verify-jwt
supabase functions deploy verify-bvn --no-verify-jwt
supabase functions deploy send-otp --no-verify-jwt
supabase functions deploy verify-otp --no-verify-jwt
supabase functions deploy get-banks --no-verify-jwt

# Other
supabase functions deploy generate-wallet-pass --no-verify-jwt
supabase functions deploy auto-refund-on-cancellation --no-verify-jwt
supabase functions deploy process-refund --no-verify-jwt
supabase functions deploy auto-trigger-payouts --no-verify-jwt
supabase functions deploy ai-compose --no-verify-jwt
supabase functions deploy ai-compose-email --no-verify-jwt
supabase functions deploy iot-sensor-data --no-verify-jwt
```

---

## Environment Variables (Secrets)

Set these in Supabase Dashboard → Settings → Edge Functions → Secrets:

### Required
```
SUPABASE_URL=https://bkvbvggngttrizbchygy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjczMjEsImV4cCI6MjA4MDEwMzMyMX0.aFgv85bMHQDSNglGFMCqsuLWoWHPnxsvxBMpCfCnWxY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI
```

### Email (Resend)
```
RESEND_API_KEY=re_xxxxx
```

### SMS (Termii - Nigeria)
```
TERMII_API_KEY=your-termii-key
TERMII_SENDER_ID=Ticketrack
```

### SMS (Twilio - International)
```
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### WhatsApp (Meta Business)
```
WHATSAPP_PHONE_NUMBER_ID=xxxxx
WHATSAPP_ACCESS_TOKEN=xxxxx
WHATSAPP_BUSINESS_ID=xxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token
```

### Telegram
```
TELEGRAM_BOT_TOKEN=123456:ABC-xxxxx
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret
```

### Flutterwave
```
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxx
FLUTTERWAVE_ENCRYPTION_KEY=xxxxx
FLUTTERWAVE_WEBHOOK_SECRET=your-webhook-secret
```

### Paystack
```
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

### Stripe
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_xxxxx
```

### PayPal
```
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
PAYPAL_MODE=live  # or 'sandbox'
```

### AI (OpenAI)
```
OPENAI_API_KEY=sk-xxxxx
```

### Push Notifications (Web Push)
```
VAPID_PUBLIC_KEY=xxxxx
VAPID_PRIVATE_KEY=xxxxx
VAPID_SUBJECT=mailto:support@ticketrack.com
```

---

## Setting Secrets via CLI

```bash
# Set a single secret
supabase secrets set RESEND_API_KEY=re_xxxxx

# Set multiple secrets at once
supabase secrets set \
  RESEND_API_KEY=re_xxxxx \
  TERMII_API_KEY=your-key \
  FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
```

---

## Webhook URLs

After deployment, configure these webhook URLs in your payment providers:

### Flutterwave
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/flutterwave-webhook
```

### Paystack
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/paystack-webhook
```

### Stripe
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/stripe-webhook
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/stripe-connect-webhook
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/stripe-identity-webhook
```

### Telegram Bot
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/telegram-webhook
```

### WhatsApp (Meta)
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/whatsapp-inbound-webhook
```

### SMS Inbound (Termii)
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/sms-inbound-webhook
```

### Email Inbound (for replies)
```
https://bkvbvggngttrizbchygy.supabase.co/functions/v1/email-inbound-webhook
```

---

## Cron Jobs Setup

After deploying functions, set up cron jobs for automated tasks.

### 1. Enable Extensions (run in SQL Editor)

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Create Cron Jobs

Run the contents of `database/setup_cron_jobs.sql` which has all URLs and keys hardcoded.

Or use these individual commands:

```sql
-- Process automation jobs every 5 minutes
SELECT cron.schedule(
  'process-automation-jobs',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/process-automation-jobs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
```

### 3. Verify Cron Jobs

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Check recent runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

---

## Testing Functions

### Test locally:
```bash
supabase functions serve send-email --env-file .env.local
```

### Test deployed function:
```bash
curl -X POST "https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjczMjEsImV4cCI6MjA4MDEwMzMyMX0.aFgv85bMHQDSNglGFMCqsuLWoWHPnxsvxBMpCfCnWxY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1>"
  }'
```

---

## Troubleshooting

### View Function Logs
Supabase Dashboard → Edge Functions → Select function → Logs

### Common Issues

1. **401 Unauthorized**: Check Authorization header and API keys
2. **500 Internal Error**: Check environment variables are set
3. **Function not found**: Verify deployment succeeded
4. **Timeout**: Function taking too long (max 60s default)

### Check Deployment Status
```bash
supabase functions list
```
