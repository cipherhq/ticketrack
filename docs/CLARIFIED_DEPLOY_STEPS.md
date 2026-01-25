# Birthday Email Deployment - Step by Step

## ⚠️ IMPORTANT: Two Different Places

- **Terminal Commands** → Run in your **terminal/bash**
- **SQL Commands** → Run in **Supabase Dashboard → SQL Editor**

---

## STEP 1: Terminal Commands (Run These in Your Terminal)

Copy and paste these into your **terminal**, not SQL Editor:

```bash
# Load service role key from .env.local
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Deploy the function
supabase functions deploy send-birthday-emails

# Test the function
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

**OR use the automated script:**

```bash
./scripts/deploy-and-setup-birthday.sh
```

---

## STEP 2: SQL Commands (Run These in Supabase Dashboard → SQL Editor)

**After Step 1 is complete**, go to:
- Supabase Dashboard → SQL Editor
- Copy and paste **ONLY the SQL below**:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create daily cron job (runs at 9:00 AM UTC every day)
SELECT cron.schedule(
  'send-birthday-emails-daily',
  '0 9 * * *',
  $$
  SELECT
    pg_net.http_post(
      url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
```

---

## Summary

1. ✅ **Terminal**: Run deployment commands (Step 1)
2. ✅ **SQL Editor**: Run SQL to set up cron job (Step 2)

That's it! 🎉
