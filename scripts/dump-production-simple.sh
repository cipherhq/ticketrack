#!/bin/bash
# ============================================================================
# DUMP PRODUCTION SCHEMA (NO DOCKER REQUIRED)
# ============================================================================
# Alternative method using direct database connection
# ============================================================================

echo "📥 Dumping Production Schema (No Docker Required)"
echo "=================================================="
echo ""
echo "⚠️  This requires:"
echo "   1. psql installed (PostgreSQL client)"
echo "   2. Database connection string from Supabase Dashboard"
echo ""
echo "📋 Steps:"
echo "   1. Go to Production Supabase Dashboard"
echo "   2. Settings → Database → Connection string"
echo "   3. Copy the 'URI' connection string"
echo ""
read -p "Enter production database connection string (or press Enter to skip): " DB_URL

if [ -z "$DB_URL" ]; then
    echo ""
    echo "💡 Alternative: Use SQL Editor method"
    echo "   Run scripts/dump-production-without-docker.sql in Production SQL Editor"
    echo "   Copy results and save to database/production_schema.sql"
    exit 0
fi

echo ""
echo "📥 Dumping schema..."
pg_dump "$DB_URL" \
    --schema=public \
    --schema-only \
    --no-owner \
    --no-privileges \
    --no-tablespaces \
    > database/production_schema.sql 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Schema dumped to: database/production_schema.sql"
    echo "📊 File size: $(du -h database/production_schema.sql | cut -f1)"
    echo ""
    echo "📋 Next: Run this SQL in Dev Supabase SQL Editor"
else
    echo "❌ Dump failed. Check the error above."
    echo ""
    echo "💡 Try the SQL Editor method instead:"
    echo "   Run scripts/dump-production-without-docker.sql in Production SQL Editor"
fi
