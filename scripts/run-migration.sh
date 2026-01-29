#!/bin/bash
# Run SQL migration using Supabase CLI
# Make sure you're logged in: supabase login

set -e

cd "$(dirname "$0")/.."

echo "🚀 Running Flutterwave subaccount fields migration..."
echo ""

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/20260125_add_flutterwave_subaccount_fields.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration file: $MIGRATION_FILE"
echo ""

# Check if linked
if [ ! -f ".supabase/config.toml" ] || ! grep -q "project_id" .supabase/config.toml 2>/dev/null; then
    echo "📋 Linking to Supabase project..."
    echo "   Project ref: bnkxgyzvqpdctghrgmkr (dev)"
    echo ""
    echo "⚠️  You need to be logged in first:"
    echo "   Run: supabase login"
    echo "   Then: supabase link --project-ref bnkxgyzvqpdctghrgmkr"
    echo ""
    read -p "Press Enter to continue after linking, or Ctrl+C to cancel..."
fi

echo "📤 Pushing migration to database..."
supabase db push

echo ""
echo "✅ Migration completed successfully!"
echo ""
echo "💡 Verify the migration:"
echo "   - Check Supabase Dashboard → Database → Tables → organizers"
echo "   - Look for flutterwave_subaccount_* and paystack_subaccount_* columns"
