#!/bin/bash
# ============================================================================
# SYNC PRODUCTION DATABASE TO DEV
# ============================================================================
# This script dumps the production database schema and applies it to dev
# ============================================================================

set -e

echo "🚀 Syncing Production Database to Dev"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

# Production project ref
PROD_REF="bkvbvggngttrizbchygy"
DEV_REF="bnkxgyzvqpdctghrgmkr"

echo "📥 Step 1: Dumping Production Database Schema..."
echo "   Project: $PROD_REF"
echo ""

# Dump production schema (structure only - no data)
supabase db dump --project-ref $PROD_REF --schema public --data-only=false > database/production_schema_dump.sql

if [ $? -eq 0 ]; then
    echo "✅ Production schema dumped to: database/production_schema_dump.sql"
else
    echo "❌ Failed to dump production schema"
    echo "   Make sure you're logged in: supabase login"
    exit 1
fi

echo ""
echo "📤 Step 2: Applying Schema to Dev Database..."
echo "   Project: $DEV_REF"
echo ""

# Check if dev is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Dev project not linked. Linking now..."
    supabase link --project-ref $DEV_REF
fi

# Apply the schema to dev
echo "   This will apply the production schema to dev..."
read -p "   Continue? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Use db push to apply migrations, or use psql if available
    if command -v psql &> /dev/null; then
        echo "   Using psql to apply schema..."
        # You would need the connection string here
        echo "   ⚠️  psql method requires database connection string"
    else
        echo "   Using Supabase CLI db push..."
        echo "   ⚠️  Note: db push only works with migration files"
        echo "   Consider using the SQL Editor to run the dump file"
    fi
else
    echo "   Cancelled."
    exit 0
fi

echo ""
echo "✅ Schema dump created: database/production_schema_dump.sql"
echo ""
echo "📋 Next Steps:"
echo "   1. Review the dump file: database/production_schema_dump.sql"
echo "   2. Run it in Dev Supabase SQL Editor"
echo "   OR"
echo "   3. Use: supabase db push (if converted to migration format)"
