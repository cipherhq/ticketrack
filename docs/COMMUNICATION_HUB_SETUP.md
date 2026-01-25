# Communication Hub - Setup & Testing Guide

## Overview

The Communication Hub provides multi-channel messaging (Email, SMS, WhatsApp, Push, Telegram) with a credit-based system, automations, and analytics.

---

## 1. Database Setup

### Run the migration

```sql
-- Run in Supabase SQL Editor or via CLI
\i database/communication_hub_full_migration.sql
```

### Verify tables created

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'communication%' 
OR table_name IN ('contacts', 'contact_segments', 'push_subscriptions', 'telegram_link_requests');
```

Expected tables:
- contacts
- contact_segments
- communication_campaigns
- communication_messages
- communication_templates
- communication_credit_balances
- communication_credit_transactions
- communication_credit_packages
- communication_channel_pricing
- communication_credit_expiry
- communication_automations
- communication_automation_runs
- communication_scheduled_jobs
- push_subscriptions
- push_notification_log
- telegram_link_requests

---

## 2. Edge Functions Deployment

### Deploy all functions

```bash
# Navigate to project root
cd /Users/bajideace/Desktop/ticketrack

# Deploy communication functions
supabase functions deploy create-credit-purchase
supabase functions deploy send-communication-campaign
supabase functions deploy process-automation-jobs
supabase functions deploy send-push-notification
supabase functions deploy send-telegram
supabase functions deploy telegram-webhook
```

### Set up scheduled job for automation processor

In Supabase Dashboard → Database → Extensions, enable `pg_cron` if not already.

```sql
-- Run every 5 minutes to process pending automation jobs
SELECT cron.schedule(
  'process-automation-jobs',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/process-automation-jobs',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI"}'::jsonb
  );
  $$
);
```

---

## 3. Environment Variables

### Required Secrets (Supabase Dashboard → Project Settings → Edge Functions)

```bash
# Email (already configured)
RESEND_API_KEY=re_xxxxx

# SMS (already configured)
PAYSTACK_SECRET_KEY=sk_xxxxx  # For payments
TERMII_API_KEY=xxxxx          # For Nigeria SMS
TWILIO_ACCOUNT_SID=xxxxx      # For international SMS
TWILIO_AUTH_TOKEN=xxxxx

# WhatsApp (Meta Business)
WHATSAPP_PHONE_ID=xxxxx       # Phone number ID from Meta
WHATSAPP_TOKEN=xxxxx          # Access token from Meta

# Telegram Bot
TELEGRAM_BOT_TOKEN=xxxxx      # From @BotFather

# Push Notifications (Web Push)
VAPID_PUBLIC_KEY=xxxxx        # Generate at https://vapidkeys.com/
VAPID_PRIVATE_KEY=xxxxx
VAPID_SUBJECT=mailto:support@ticketrack.com
```

---

## 4. Telegram Bot Setup

### Create the bot

1. Message @BotFather on Telegram
2. Send `/newbot`
3. Follow prompts to name your bot
4. Copy the bot token

### Set webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://bkvbvggngttrizbchygy.supabase.co/functions/v1/telegram-webhook"
  }'
```

### Bot commands to register

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Start the bot"},
      {"command": "link", "description": "Link your Ticketrack account"},
      {"command": "unlink", "description": "Unlink your account"},
      {"command": "mytickets", "description": "View your upcoming tickets"},
      {"command": "help", "description": "Show help"}
    ]
  }'
```

---

## 5. WhatsApp Business API Setup

### Prerequisites
- Meta Business Account
- WhatsApp Business API access
- Phone number registered with WhatsApp Business

### Steps
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create/select your app
3. Add WhatsApp product
4. Set up a phone number
5. Get your Phone Number ID and Access Token
6. Add to Supabase secrets

### Message Templates
WhatsApp requires pre-approved templates for marketing messages. Create templates at:
Meta Business Suite → WhatsApp → Message Templates

---

## 6. Push Notification Setup

### Generate VAPID Keys

```bash
# Option 1: Use web-push CLI
npm install -g web-push
web-push generate-vapid-keys

# Option 2: Use online generator
# https://vapidkeys.com/
```

### Frontend Integration

Add to your service worker (`sw.js`):

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-72x72.png',
      image: data.image,
      data: data.data,
      actions: data.actions,
      requireInteraction: data.requireInteraction,
      tag: data.tag,
      renotify: data.renotify,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.openWindow(url)
  );
});
```

---

## 7. Testing Checklist

### Credit System
- [ ] Purchase credits via UI → Check Paystack payment flow
- [ ] Verify webhook adds credits to balance
- [ ] Check balance displays correctly
- [ ] Test credit deduction when sending messages
- [ ] Verify transaction history

### Contact Management
- [ ] Import contacts via CSV
- [ ] Search and filter contacts
- [ ] Add/edit tags
- [ ] Delete contacts
- [ ] Export contacts

### Campaigns
- [ ] Create email campaign
- [ ] Create SMS campaign
- [ ] Create WhatsApp campaign
- [ ] Schedule campaign for future
- [ ] Send immediate campaign
- [ ] Check analytics after sending

### Automations
- [ ] Create event reminder automation
- [ ] Create ticket purchase automation
- [ ] Test automation trigger on ticket purchase
- [ ] Verify scheduled reminders

### Segments
- [ ] Create segment with conditions
- [ ] Preview matching contacts
- [ ] Use segment in campaign

### Telegram
- [ ] Link account via /start command
- [ ] View tickets with /mytickets
- [ ] Receive event reminder via Telegram
- [ ] Unlink account

### Push Notifications
- [ ] Register push subscription
- [ ] Receive test notification
- [ ] Click notification opens correct URL

---

## 8. API Reference

### Credit Purchase

```javascript
// Frontend
const response = await supabase.functions.invoke('create-credit-purchase', {
  body: {
    organizerId: 'uuid',
    packageId: 'uuid',
    credits: 5000,
    bonusCredits: 500,
    amount: 4500,
    currency: 'NGN',
    email: 'organizer@example.com',
    callbackUrl: 'https://ticketrack.com/organizer/credits?payment=success'
  }
});

// Returns: { authorization_url, access_code, reference }
```

### Send Campaign

```javascript
const response = await supabase.functions.invoke('send-communication-campaign', {
  body: {
    organizerId: 'uuid',
    channels: ['email', 'sms'],
    audienceType: 'event_attendees',
    eventId: 'uuid',
    content: {
      email: {
        subject: 'Event Reminder',
        body: '<p>Your event is tomorrow!</p>'
      },
      sms: {
        message: 'Your event is tomorrow!'
      }
    },
    sendNow: true
  }
});
```

### Send Telegram

```javascript
const response = await supabase.functions.invoke('send-telegram', {
  body: {
    chatId: 123456789,
    message: '*Event Reminder*\nYour event is tomorrow!',
    parseMode: 'Markdown'
  }
});
```

### Send Push Notification

```javascript
const response = await supabase.functions.invoke('send-push-notification', {
  body: {
    userId: 'uuid',
    title: 'Event Reminder',
    body: 'Your event is tomorrow!',
    url: '/tickets',
    type: 'event_reminder'
  }
});
```

---

## 9. Troubleshooting

### Credits not adding after payment
1. Check Paystack webhook is configured correctly
2. Verify `charge.success` event includes `metadata.type = 'credit_purchase'`
3. Check edge function logs for errors

### Telegram messages not sending
1. Verify bot token is correct
2. Check if user has linked their account
3. Ensure `telegram_chat_id` is set in profiles table

### Push notifications not received
1. Verify VAPID keys are correct
2. Check browser supports Web Push
3. Ensure service worker is registered
4. Check subscription is active in database

### Automations not running
1. Verify cron job is set up correctly
2. Check `process-automation-jobs` function logs
3. Ensure automation status is 'active'
4. Verify `scheduled_for` times are in the past

---

## 10. Channel Pricing Reference

| Channel | Credits/Message | Cost (NGN) |
|---------|----------------|------------|
| Email | 1 | ₦0.50 |
| SMS | 5 | ₦3.50 |
| SMS (DND) | 8 | ₦6.00 |
| WhatsApp Marketing | 100 | ₦80.00 |
| WhatsApp Utility | 20 | ₦15.00 |
| Telegram | 2 | Free |
| Push | 0 | Free |

---

## 11. Credit Packages

| Package | Credits | Bonus | Price (NGN) | Per Credit |
|---------|---------|-------|-------------|------------|
| Starter | 1,000 | 0 | ₦1,000 | ₦1.00 |
| Growth | 5,000 | 500 | ₦4,500 | ₦0.90 |
| Pro | 20,000 | 4,000 | ₦16,000 | ₦0.80 |
| Business | 50,000 | 15,000 | ₦35,000 | ₦0.70 |
| Enterprise | 200,000 | 80,000 | ₦120,000 | ₦0.60 |

---

## Need Help?

- Check edge function logs in Supabase Dashboard
- Review database audit logs
- Contact: support@ticketrack.com
