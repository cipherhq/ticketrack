# Direct Commands to Deploy Birthday Email Function

Copy and paste these commands directly into your terminal.

## Prerequisites Check

First, verify you're logged in and linked:

```bash
# Check if already linked
supabase projects list

# If not linked, link your project
supabase link --project-ref bkvbvggngttrizbchygy
```

## Deploy the Function

```bash
supabase functions deploy send-birthday-emails
```

## Test the Function (After Deployment)

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

## Set Up Daily Cron Job

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create daily cron job (runs at 9:00 AM UTC every day)
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

-- Step 3: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
```

## Quick Verification Commands

```bash
# Check if function is deployed
curl -X OPTIONS https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails

# List all cron jobs
# Run this SQL in Supabase Dashboard → SQL Editor:
SELECT * FROM cron.job;
```

## Where to Find Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/bkvbvggngttrizbchygy/settings/api
2. Scroll down to "Project API keys"
3. Copy the `service_role` key (⚠️ Keep this secret!)
4. Replace `YOUR_SERVICE_ROLE_KEY` in the SQL above
