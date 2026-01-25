# Database Migration Order

Run these migrations in order in the **Supabase SQL Editor** (https://supabase.com/dashboard → SQL Editor).

## Quick Start (Recommended)

Run `database/master_migration.sql` which combines all essential migrations in the correct order.

---

## Manual Migration Order

If you prefer to run migrations individually, follow this order:

### Phase 1: Core Communication Hub
1. **`communication_hub_full_migration.sql`** - Core communication schema (contacts, campaigns, messages, templates, credits, automations, push notifications, telegram)

### Phase 2: Advanced Features
2. **`smart_segmentation_schema.sql`** - RFM scoring, engagement scoring, predictive segments
3. **`drip_campaigns_schema.sql`** - Multi-step automated message sequences
4. **`email_tracking_schema.sql`** - Email open/click tracking analytics
5. **`conversations_schema.sql`** - Two-way messaging inbox

### Phase 3: Payment Provider Extensions
6. **`add_flutterwave_subaccount_fields.sql`** - Flutterwave & Paystack subaccount fields

### Phase 4: Data Migration
7. **`migrate_sms_to_message_credits.sql`** - Migrate old SMS credits to unified message credits (run ONCE)

---

## Already Applied (Check First)

Before running, check if these tables already exist:
- `contacts`
- `communication_campaigns`
- `communication_credit_balances`

If they exist, the migrations use `IF NOT EXISTS` so they're safe to re-run.

---

## Post-Migration Steps

1. **Deploy Edge Functions** - See `supabase/functions/` folder
2. **Set up Cron Jobs** - See `docs/AUTOMATION_CRON_SETUP.md`
3. **Configure Environment Variables** - WhatsApp API keys, Telegram bot token, etc.
