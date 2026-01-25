-- Setup Birthday Email Cron Job
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create daily cron job (runs at 9:00 AM UTC every day)
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

-- Step 3: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';

-- Step 4: Test the function manually (optional)
-- SELECT
--   pg_net.http_post(
--     url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI',
--       'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI'
--     ),
--     body := '{}'::jsonb
--   ) AS request_id;
