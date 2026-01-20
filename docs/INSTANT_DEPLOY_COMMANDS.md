# Instant Deploy Commands - Birthday Emails

**Copy and paste these commands directly into your terminal.**

## Quick Deploy (One Command)

```bash
./scripts/deploy-and-setup-birthday.sh
```

This script will:
1. ✅ Load your service role key from `.env.local`
2. ✅ Deploy the function
3. ✅ Test the function
4. ✅ Generate SQL with your key ready to paste

## Manual Commands

If you prefer to run commands manually:

### 1. Export Service Role Key from .env.local

```bash
# Get key from .env.local and export it
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")
```

### 2. Deploy Function

```bash
supabase functions deploy send-birthday-emails
```

### 3. Test Function

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails
```

### 4. Generate SQL with Your Key

```bash
# Get your service role key
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Generate SQL with your key
cat << EOF | sed "s/YOUR_SERVICE_ROLE_KEY/$SERVICE_KEY/g" > /tmp/birthday-cron.sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'send-birthday-emails-daily',
  '0 9 * * *',
  \$\$
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
  \$\$
);

SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
EOF

# Show the SQL
cat /tmp/birthday-cron.sql

echo ""
echo "📋 Copy the SQL above and paste it into Supabase Dashboard → SQL Editor"
```

## All-In-One Command (Copy Everything Below)

```bash
# Load service role key from .env.local
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'") && \
# Deploy function
supabase functions deploy send-birthday-emails && \
# Test function
echo "Testing function..." && \
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails | jq '.' && \
# Generate SQL
echo "" && \
echo "📋 SQL for Cron Job (copy and paste into Supabase Dashboard → SQL Editor):" && \
echo "" && \
cat << SQL
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'send-birthday-emails-daily',
  '0 9 * * *',
  \$\$
  SELECT
    pg_net.http_post(
      url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY',
        'apikey', '$SUPABASE_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  \$\$
);

SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
SQL
```

## After Running Commands

1. ✅ Function should be deployed (check Supabase Dashboard → Edge Functions)
2. ✅ Function should be tested (you'll see a JSON response)
3. ✅ SQL will be generated with your key
4. ✅ Copy the SQL and run it in Supabase Dashboard → SQL Editor

## Troubleshooting

If `.env.local` doesn't have `SUPABASE_SERVICE_ROLE_KEY`:
1. Go to: https://supabase.com/dashboard/project/bkvbvggngttrizbchygy/settings/api
2. Copy the `service_role` key
3. Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=your-key-here`
