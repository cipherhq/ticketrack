-- Setup Birthday Email Cron Job
-- Run this in Supabase Dashboard → SQL Editor
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key from .env.local

-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create daily cron job (runs at 9:00 AM UTC every day)
-- IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key!
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

-- Step 3: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';

-- Step 4: Test the function manually (optional)
-- SELECT
--   pg_net.http_post(
--     url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--       'apikey', 'YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{}'::jsonb
--   ) AS request_id;
