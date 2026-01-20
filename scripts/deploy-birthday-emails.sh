#!/bin/bash
# Deploy Birthday Email Function
# This script reads from .env.local and deploys the function

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

echo "🚀 Deploying Birthday Email Function..."

# Check if SUPABASE_SERVICE_ROLE_KEY is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
    echo "Please add it or set it manually:"
    echo "export SUPABASE_SERVICE_ROLE_KEY='your-key-here'"
    exit 1
fi

# Deploy the function
echo "📦 Deploying function..."
supabase functions deploy send-birthday-emails

# Test the function
echo ""
echo "🧪 Testing function..."
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  https://bkvbvggngttrizbchygy.supabase.co/functions/v1/send-birthday-emails

echo ""
echo "✅ Done!"
echo ""
echo "Next steps:"
echo "1. Set up the cron job in Supabase Dashboard → SQL Editor"
echo "2. See docs/BIRTHDAY_EMAIL_SETUP.md for SQL commands"
