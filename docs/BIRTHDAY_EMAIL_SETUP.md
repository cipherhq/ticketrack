# Birthday Email Setup Guide

This guide explains how to set up automated birthday emails for users.

## Overview

The birthday email system automatically sends personalized birthday wishes to users on their birthday. It checks user profiles for `birth_month` and `birth_day` fields and sends emails to users whose birthday matches today's date.

## Prerequisites

### Required Environment Variables

Before setting up the birthday email system, ensure the following environment variables are configured in your Supabase Edge Functions:

**In Supabase Dashboard → Project Settings → Edge Functions → Environment Variables:**

1. **`SUPABASE_URL`** (Required)
   - Your Supabase project URL (e.g., `https://abcdefghijklmnop.supabase.co`)
   - Automatically set by Supabase, but verify it exists

2. **`SUPABASE_SERVICE_ROLE_KEY`** (Required)
   - Your Supabase service role key (found in Project Settings → API)
   - ⚠️ **Keep this secret** - Never expose in client-side code
   - Required for bypassing RLS and calling edge functions

3. **`SUPABASE_ANON_KEY`** (Required for send-email function)
   - Your Supabase anonymous key (found in Project Settings → API)
   - Used by the send-email edge function for authentication

4. **`RESEND_API_KEY`** (Required for sending emails)
   - Your Resend API key (get from [resend.com](https://resend.com))
   - Required for the `send-email` function to actually send emails
   - Format: `re_xxxxxxxxxxxxxxxxxxxxxxxxxx`

### Verify Environment Variables

To verify your environment variables are set correctly:

1. Go to Supabase Dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Click on **Environment Variables**
4. Verify all required variables are present

**Note**: These environment variables are automatically available to all edge functions. You don't need to set them manually in each function's deployment settings.

## Deployment

### Deploy the Birthday Email Function

Before setting up the cron job, you need to deploy the `send-birthday-emails` edge function to Supabase:

1. **Use Supabase CLI** (already installed on your system):
   ```bash
   # Login to Supabase
   supabase login
   
   # Link your project
   supabase link --project-ref bkvbvggngttrizbchygy
   
   # Deploy the function
   supabase functions deploy send-birthday-emails
   ```
   
   **Your Project Reference**: `bkvbvggngttrizbchygy` (from your Supabase URL)

   **Alternative: Install globally** (if you prefer):
   ```bash
   # Fix npm permissions first (recommended)
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   npm install -g supabase
   
   # Then use commands without npx
   supabase login
   supabase link --project-ref bkvbvggngttrizbchygy
   supabase functions deploy send-birthday-emails
   ```

5. **Verify deployment**:
   - Go to Supabase Dashboard → Edge Functions
   - You should now see `send-birthday-emails` in the list
   - Click on it to view details and logs

**Alternative: Deploy via Supabase Dashboard**
- Go to Edge Functions → New Function
- However, it's recommended to use CLI for better version control

### Verify `send-email` Function is Deployed

Ensure the `send-email` function is also deployed (it should already be deployed based on your dashboard):

- Check Supabase Dashboard → Edge Functions → `send-email`
- If not present, deploy it: `supabase functions deploy send-email`

## Components

### 1. Birthday Email Template (`send-email` function)

The birthday email template has been added to `supabase/functions/send-email/index.ts`:

- **Type**: `birthday_wish`
- **Auth Level**: `SYSTEM_ONLY` (automated system emails)
- **Rate Limit**: `standard`

### 2. Birthday Email Sender Function

A new edge function has been created at `supabase/functions/send-birthday-emails/index.ts` that:

- Queries all users whose birthday is today
- Only sends to users with `email_notifications = true`
- Calls the `send-email` function for each user
- Returns a summary of sent/failed emails

## Setup Instructions

### Option 1: Using Supabase Cron (Recommended)

1. **Enable pg_cron extension** (if not already enabled):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

2. **Enable pg_net extension** (required for HTTP requests from cron):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

3. **Create a scheduled job** to run daily at 9:00 AM UTC:
   ```sql
   SELECT cron.schedule(
     'send-birthday-emails-daily',
     '0 9 * * *', -- 9:00 AM UTC every day
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
   
4. **Verify the cron job was created**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
   ```

5. **Test the function manually** (optional, before scheduling):
   ```sql
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
   ```

### Option 2: Using External Cron Service

You can use external cron services like:
- **GitHub Actions** (scheduled workflows)
- **Vercel Cron Jobs** (if deployed on Vercel)
- **AWS EventBridge / CloudWatch Events**
- **Google Cloud Scheduler**

Example GitHub Actions workflow (`.github/workflows/birthday-emails.yml`):

```yaml
name: Send Birthday Emails

on:
  schedule:
    - cron: '0 9 * * *' # 9:00 AM UTC daily
  workflow_dispatch: # Allow manual trigger

jobs:
  send-birthday-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Call Birthday Email Function
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

### Option 3: Manual Testing

You can manually trigger the function for testing:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

## User Profile Requirements

Users must have the following fields populated in their `profiles` table:

- `birth_month`: Integer (1-12)
- `birth_day`: Integer (1-31)
- `email`: Must not be null
- `email_notifications`: Boolean (must be `true` to receive emails)

Users can update their birthday in their profile settings.

## Email Template

The birthday email includes:

- Personalized greeting with user's first name
- Birthday wish message
- Special 20% discount offer for premium asset pack
- CTA button to claim gift
- Professional branding with Ticketrack logo

## Monitoring

### Check Cron Job Status

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Check recent job runs
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-birthday-emails-daily')
ORDER BY start_time DESC
LIMIT 10;
```

### View Function Logs

1. Go to Supabase Dashboard
2. Navigate to Edge Functions → `send-birthday-emails`
3. Click on "Logs" to view execution history

### Testing

To test with a specific date, you can temporarily modify the function:

```typescript
// In send-birthday-emails/index.ts, temporarily change:
const currentMonth = 12; // Test with December
const currentDay = 25;   // Test with day 25
```

## Troubleshooting

### Emails Not Sending

1. **Check user profiles**: Ensure users have `birth_month`, `birth_day`, and `email` populated
2. **Check email notifications**: Verify `email_notifications = true`
3. **Check function logs**: Review edge function logs for errors
4. **Check cron job**: Verify the cron job is scheduled and running
5. **Check Resend/SMTP**: Ensure email service is configured correctly

### Common Issues

- **No birthdays found**: Check if any users have today's date as their birthday
- **Email delivery failures**: Check Resend dashboard for delivery status
- **Cron job not running**: Verify pg_cron is enabled and job is scheduled correctly

## Security Notes

- The function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Only users with `email_notifications = true` receive emails
- The function is rate-limited to prevent abuse
- Service role key should be kept secret and not exposed to clients

## Cost Considerations

- Edge function invocations: Each birthday email = 1 function call
- Email delivery: Check your Resend/SMTP pricing
- Database queries: Minimal impact (one query per day)
- Cron job execution: Free on Supabase (included in plan)

## Future Enhancements

Potential improvements:

1. **Time zone support**: Send emails at 9 AM in user's local timezone
2. **Multiple discount offers**: Rotate between different birthday gifts
3. **Birthday reminders**: Send reminders to friends/followers
4. **Analytics**: Track open rates and engagement for birthday emails
5. **Personalization**: Include user's event history or recommendations
