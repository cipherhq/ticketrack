-- ============================================================================
-- CRON JOBS SETUP
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER deploying edge functions
-- 
-- Prerequisites:
-- 1. Deploy all edge functions first
-- 2. Enable pg_cron and pg_net extensions
-- ============================================================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- CRON JOB 1: Process Automation Jobs (every 5 minutes)
-- ============================================================================
-- Handles: Event reminders, scheduled campaigns, abandoned cart, etc.
SELECT cron.unschedule('process-automation-jobs') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-automation-jobs');

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

-- ============================================================================
-- CRON JOB 2: Process Drip Campaigns (every 10 minutes)
-- ============================================================================
-- Handles: Multi-step email sequences, nurture campaigns
SELECT cron.unschedule('process-drip-campaigns') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-drip-campaigns');

SELECT cron.schedule(
  'process-drip-campaigns',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/process-drip-campaigns',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- CRON JOB 3: Send Event Reminders (every hour)
-- ============================================================================
-- Handles: 7-day, 1-day, 2-hour reminders before events
SELECT cron.unschedule('send-event-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-event-reminders');

SELECT cron.schedule(
  'send-event-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- CRON JOB 4: Send Birthday Emails (daily at 9 AM UTC)
-- ============================================================================
-- Handles: Birthday greetings to contacts
SELECT cron.unschedule('send-birthday-emails') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-birthday-emails');

SELECT cron.schedule(
  'send-birthday-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- CRON JOB 5: Auto-Trigger Payouts (daily at 2 AM UTC)
-- ============================================================================
-- Handles: Automatic organizer payouts after events
SELECT cron.unschedule('auto-trigger-payouts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-trigger-payouts');

SELECT cron.schedule(
  'auto-trigger-payouts',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/auto-trigger-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
      'Content-Type', 'application/json'
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- VERIFY SETUP
-- ============================================================================
-- List all scheduled jobs
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
ORDER BY jobname;

-- ============================================================================
-- DONE!
-- ============================================================================
-- 
-- Cron Jobs Created:
-- 1. process-automation-jobs    - Every 5 minutes
-- 2. process-drip-campaigns     - Every 10 minutes
-- 3. send-event-reminders       - Every hour
-- 4. send-birthday-emails       - Daily at 9 AM UTC
-- 5. auto-trigger-payouts       - Daily at 2 AM UTC
--
-- To check job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- To disable a job:
-- SELECT cron.unschedule('job-name');
-- ============================================================================
