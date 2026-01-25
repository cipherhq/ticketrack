# Automation Cron Job Setup

This document explains how to set up the cron job for processing communication automations (event reminders, scheduled campaigns, etc.).

## Overview

The `process-automation-jobs` edge function processes scheduled automation jobs like:
- Event reminder sequences (7 days, 1 day, 2 hours before)
- Post-event thank you messages
- Abandoned cart recovery
- Credit expiry notifications
- Scheduled campaigns

## Setup Instructions

### Option 1: Supabase Cron (Recommended)

1. Go to **Supabase Dashboard** → **Database** → **Extensions**
2. Enable the `pg_cron` extension if not already enabled
3. Go to **SQL Editor** and run:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job to run every 5 minutes
SELECT cron.schedule(
  'process-automation-jobs',
  '*/5 * * * *',  -- Every 5 minutes
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

**For all cron jobs**, run the complete `database/setup_cron_jobs.sql` file which includes:
- process-automation-jobs (every 5 minutes)
- process-drip-campaigns (every 10 minutes)
- send-event-reminders (every hour)
- send-birthday-emails (daily at 9 AM UTC)
- auto-trigger-payouts (daily at 2 AM UTC)

### Option 2: External Cron Service

If pg_cron isn't available, use an external service like:

#### GitHub Actions (Free)

Create `.github/workflows/automation-cron.yml`:

```yaml
name: Process Automation Jobs

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger automation processor
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/process-automation-jobs" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"source": "github-actions"}'
```

Add these secrets to your GitHub repository:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your anon/public key

#### Render Cron Jobs

1. Go to Render Dashboard
2. Create a new **Cron Job**
3. Command: 
```bash
curl -X POST "$SUPABASE_URL/functions/v1/process-automation-jobs" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "render-cron"}'
```
4. Schedule: `*/5 * * * *`
5. Add environment variables

#### Vercel Cron

In `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/process-automations",
    "schedule": "*/5 * * * *"
  }]
}
```

Create `/api/process-automations.js`:
```javascript
export default async function handler(req, res) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/process-automation-jobs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'vercel-cron' }),
    }
  );
  
  const data = await response.json();
  res.json(data);
}
```

## Verifying the Cron Job

### Check if cron is running:

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- View recent job runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Check automation processing:

```sql
-- View pending jobs
SELECT * FROM communication_scheduled_jobs 
WHERE status = 'pending' 
AND scheduled_for <= NOW()
ORDER BY scheduled_for;

-- View recent job runs
SELECT * FROM communication_automation_runs 
ORDER BY started_at DESC 
LIMIT 20;
```

## Troubleshooting

### Job not running?

1. Check if pg_cron extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Check if pg_net is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

3. Verify the cron schedule:
```sql
SELECT * FROM cron.job WHERE jobname = 'process-automation-jobs';
```

### Edge function failing?

1. Check edge function logs in Supabase Dashboard
2. Verify environment variables are set:
   - `RESEND_API_KEY`
   - `TERMII_API_KEY` or `TWILIO_*`
   - `WHATSAPP_*` (if using WhatsApp)

## Disabling the Cron Job

```sql
-- Disable temporarily
SELECT cron.unschedule('process-automation-jobs');

-- Or delete completely
DELETE FROM cron.job WHERE jobname = 'process-automation-jobs';
```

## Manual Testing

You can manually trigger the automation processor:

```bash
curl -X POST "https://bkvbvggngttrizbchygy.supabase.co/functions/v1/process-automation-jobs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjczMjEsImV4cCI6MjA4MDEwMzMyMX0.aFgv85bMHQDSNglGFMCqsuLWoWHPnxsvxBMpCfCnWxY" \
  -H "Content-Type: application/json" \
  -d '{"source": "manual-test"}'
```
