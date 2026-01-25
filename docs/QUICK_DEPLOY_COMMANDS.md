# Quick Deploy Commands - Birthday Emails

Copy and paste these commands directly.

## Option 1: Manual Commands

### 1. Deploy the Function

```bash
supabase functions deploy send-birthday-emails
```

### 2. Test the Function

**First, get your service role key:**
```bash
# Get service role key from .env.local (if it exists)
grep SUPABASE_SERVICE_ROLE_KEY .env.local

# Or export it manually:
export SUPABASE_SERVICE_ROLE_KEY='your-actual-key-here'
```

**Then test:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

### 3. Set Up Cron Job

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job
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
```

## Option 2: Use the Deployment Script

```bash
# Make script executable (if not already)
chmod +x scripts/deploy-birthday-emails.sh

# Run the script (it will read from .env.local)
./scripts/deploy-birthday-emails.sh
```

**Note**: The script expects `SUPABASE_SERVICE_ROLE_KEY` in your `.env.local` file.

## Get Your Service Role Key

1. **From Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/bkvbvggngttrizbchygy/settings/api
   - Copy the `service_role` key

2. **Or from your .env.local:**
   ```bash
   grep SUPABASE_SERVICE_ROLE_KEY .env.local
   ```

## Quick Test After Setup

```bash
# Test the function
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Processed X birthday(s)",
  "results": {
    "total": 0,
    "sent": 0,
    "failed": 0,
    "errors": []
  }
}
```

If you see this, everything is working! ✅
