#!/bin/bash
# Complete Birthday Email Setup Script
# Reads from .env.local and sets everything up

set -e

echo "🎂 Birthday Email Setup Script"
echo "=============================="
echo ""

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    echo "📄 Loading .env.local..."
    export $(cat .env.local | grep -v '^#' | grep SUPABASE_SERVICE_ROLE_KEY | xargs)
fi

# Check if SUPABASE_SERVICE_ROLE_KEY is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not found!"
    echo ""
    echo "Please either:"
    echo "1. Add it to .env.local: SUPABASE_SERVICE_ROLE_KEY='your-key-here'"
    echo "2. Or export it manually: export SUPABASE_SERVICE_ROLE_KEY='your-key-here'"
    echo ""
    echo "Get your key from: https://supabase.com/dashboard/project/bkvbvggngttrizbchygy/settings/api"
    exit 1
fi

echo "✅ Service role key found"
echo ""

# Step 1: Deploy the function
echo "🚀 Step 1: Deploying function..."
supabase functions deploy send-birthday-emails

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
else
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""

# Step 2: Test the function
echo "🧪 Step 2: Testing function..."
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails)

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Function test complete!"
echo ""

# Step 3: Generate SQL for cron job
echo "📝 Step 3: Generating SQL for cron job..."
SQL_FILE="scripts/setup-birthday-cron-with-key.sql"

cat > "$SQL_FILE" << EOF
-- Birthday Email Cron Job Setup
-- Generated automatically - DO NOT COMMIT THIS FILE TO GIT
-- Replace YOUR_SERVICE_ROLE_KEY below with your actual key

-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create daily cron job (runs at 9:00 AM UTC every day)
-- REPLACE YOUR_SERVICE_ROLE_KEY with: $SUPABASE_SERVICE_ROLE_KEY
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

-- Step 3: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'send-birthday-emails-daily';
EOF

echo "✅ SQL file generated: $SQL_FILE"
echo ""
echo "📋 Next Steps:"
echo "1. Go to Supabase Dashboard → SQL Editor"
echo "2. Open the file: $SQL_FILE"
echo "3. Replace 'YOUR_SERVICE_ROLE_KEY' with your actual key: $SUPABASE_SERVICE_ROLE_KEY"
echo "4. Run the SQL"
echo ""
echo "Or copy this SQL directly (with key replaced):"
echo ""
echo "--- COPY BELOW ---"
echo ""
cat "$SQL_FILE" | sed "s/YOUR_SERVICE_ROLE_KEY/$SUPABASE_SERVICE_ROLE_KEY/g"
echo ""
echo "--- COPY ABOVE ---"
echo ""
echo "✨ Setup complete! Remember to set up the cron job in Supabase Dashboard."
