#!/bin/bash
# ============================================================================
# DUMP PRODUCTION DATABASE SCHEMA
# ============================================================================
# Dumps all schema objects (functions, triggers, views, policies, etc.)
# ============================================================================

set -e

PROD_REF="bkvbvggngttrizbchygy"
OUTPUT_FILE="database/production_full_schema.sql"

echo "📥 Dumping Production Database Schema..."
echo "   Project: $PROD_REF"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in. Please run: supabase login"
    exit 1
fi

# Method 1: Using Supabase CLI (if it supports full schema dump)
echo "   Attempting to dump schema using Supabase CLI..."

# Dump schema (structure only)
supabase db dump --project-ref $PROD_REF \
    --schema public \
    --data-only=false \
    --schema-only=true \
    > $OUTPUT_FILE 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Schema dumped to: $OUTPUT_FILE"
    echo ""
    echo "📊 File size: $(du -h $OUTPUT_FILE | cut -f1)"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Review the file: $OUTPUT_FILE"
    echo "   2. Run it in Dev Supabase SQL Editor"
    echo "   OR"
    echo "   3. Use: psql <connection_string> < $OUTPUT_FILE"
else
    echo "⚠️  Supabase CLI dump may not include all objects"
    echo ""
    echo "📋 Alternative: Use pg_dump with direct connection"
    echo "   You'll need the database connection string from Supabase Dashboard"
    echo "   Settings → Database → Connection string"
fi
