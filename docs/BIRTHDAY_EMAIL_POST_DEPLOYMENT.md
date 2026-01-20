# Post-Deployment Checklist - Birthday Emails

After successfully deploying the `send-birthday-emails` function, follow these steps:

## ✅ Step 1: Verify Function is Deployed

1. Go to Supabase Dashboard → Edge Functions
2. You should see `send-birthday-emails` in the list
3. Click on it to view details
4. Verify it shows as "Active" or "Deployed"

**Your Function URL**: `https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails`

## ✅ Step 2: Verify Environment Variables

Go to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:

Verify these are set:
- ✅ `SUPABASE_URL` (auto-set)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` 
- ✅ `SUPABASE_ANON_KEY`
- ✅ `RESEND_API_KEY` (required for sending emails)

## ✅ Step 3: Test the Function

### Option A: Test via Supabase Dashboard
1. Go to Edge Functions → `send-birthday-emails`
2. Click "Invoke Function"
3. Use empty body: `{}`
4. Click "Invoke"
5. Check the response and logs

### Option B: Test via Terminal

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

Replace `YOUR_SERVICE_ROLE_KEY` with your actual key from Supabase Dashboard → Project Settings → API

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

## ✅ Step 4: Set Up Daily Cron Job

Once the function is deployed and tested, set up the daily cron job:

1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL (replace `YOUR_SERVICE_ROLE_KEY`):

```sql
-- Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create daily cron job (runs at 9:00 AM UTC)
SELECT cron.schedule(
  'send-birthday-emails-daily',
  '0 9 * * *', -- 9:00 AM UTC every day
  $$
  SELECT
    pg_net.http_post(
      url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'apikey', 'YOUR_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

3. Verify cron job was created:
```sql
SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
```

## ✅ Step 5: Verify Users Have Birthdays Set

Check if any users have birthdays:

```sql
SELECT 
  id, 
  email, 
  first_name, 
  birth_month, 
  birth_day, 
  email_notifications 
FROM profiles 
WHERE birth_month IS NOT NULL 
  AND birth_day IS NOT NULL 
  AND email IS NOT NULL
  AND email_notifications = true;
```

## Troubleshooting

### Function Returns "No birthdays found"
- This is normal if no users have today's date as their birthday
- Verify users have `birth_month` and `birth_day` set in their profiles
- Check that `email_notifications = true`

### Emails Not Sending
- Check `RESEND_API_KEY` is set in Edge Functions environment variables
- Verify domain is verified in Resend dashboard
- Check function logs in Supabase Dashboard for errors

### Cron Job Not Running
- Verify `pg_cron` extension is enabled
- Check `cron.job_run_details` table for execution history
- Ensure job hasn't been unscheduled

## Next Steps

After everything is set up:
1. Wait for a user's birthday to test the full flow
2. Or temporarily modify a user's birthday to today's date for testing
3. Monitor logs to ensure emails are being sent
4. Check Resend dashboard for email delivery status
