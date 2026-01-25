# Ticketrack - Pending Tasks

## Webhook Configuration

### SMS (Termii)
- [ ] Go to Termii Dashboard → Settings → Webhooks
- [ ] Add webhook URL: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/sms-inbound-webhook`

### WhatsApp (Meta)
- [ ] Go to Meta Developer Dashboard → Your App → WhatsApp → Configuration
- [ ] Set Webhook URL: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/whatsapp-inbound-webhook`
- [ ] Set Verify Token: `ticketrack_verify`
- [ ] Subscribe to: `messages`, `messaging_postbacks`

### Email (Resend/SendGrid)
- [ ] Configure inbound email parsing
- [ ] Set webhook URL: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/email-inbound-webhook`

---

## Database Migrations to Run

- [ ] `database/conversations_schema.sql` - Conversations & two-way messaging
- [ ] `database/message_templates_schema.sql` - Custom message templates
- [ ] `database/email_tracking_schema.sql` - Email open/click tracking
- [ ] `database/smart_segmentation_schema.sql` - RFM & engagement scoring
- [ ] `database/drip_campaigns_schema.sql` - Multi-step drip sequences

---

## Edge Functions to Deploy

```bash
supabase functions deploy sms-inbound-webhook
supabase functions deploy whatsapp-inbound-webhook
supabase functions deploy email-inbound-webhook
supabase functions deploy email-tracking
supabase functions deploy process-drip-campaigns
```

---

## Environment Variables Needed

### WhatsApp (Meta)
- [ ] `WHATSAPP_PHONE_ID` - Your WhatsApp Business phone number ID
- [ ] `WHATSAPP_TOKEN` - Permanent access token from Meta
- [ ] `WHATSAPP_VERIFY_TOKEN` - Set to `ticketrack_verify`

### Telegram
- [ ] `TELEGRAM_BOT_TOKEN` - From @BotFather

---

## Completed Features

- [x] Email Open/Click Tracking
- [x] Smart Segmentation (RFM & Engagement scoring)
- [x] Drip Campaigns (multi-step sequences)
- [x] Two-Way Communication (Inbox)

## Future Features (Backlog)

- [ ] A/B Testing for campaigns (split test subject lines/content)
