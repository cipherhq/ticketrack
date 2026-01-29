# Sync Production Database to Dev

## Method 1: Using Supabase CLI (Recommended)

### Step 1: Dump Production Schema

```bash
# Make sure you're logged in
supabase login

# Dump production schema
supabase db dump --project-ref bkvbvggngttrizbchygy \
    --schema public \
    --data-only=false \
    > database/production_schema.sql
```

### Step 2: Apply to Dev

```bash
# Link dev project (if not already linked)
supabase link --project-ref bnkxgyzvqpdctghrgmkr

# Option A: Convert to migration and push
# (Requires converting the dump to migration format)

# Option B: Run directly in SQL Editor
# Copy the SQL from production_schema.sql and run in Dev SQL Editor
```

## Method 2: Using pg_dump (Most Complete)

### Step 1: Get Database Connection String

1. Go to Supabase Dashboard → Production Project
2. Settings → Database → Connection string
3. Copy the "URI" connection string

### Step 2: Dump Schema

```bash
# Dump schema only (no data)
pg_dump "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
    --schema=public \
    --schema-only \
    --no-owner \
    --no-privileges \
    > database/production_schema.sql

# Or dump everything (schema + data)
pg_dump "postgresql://..." \
    --schema=public \
    --no-owner \
    --no-privileges \
    > database/production_full.sql
```

### Step 3: Apply to Dev

```bash
# Get dev connection string from Supabase Dashboard
# Then apply:
psql "postgresql://postgres.[DEV_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
    < database/production_schema.sql
```

## Method 3: Using SQL Queries (Manual but Precise)

### Step 1: Generate SQL for All Objects

Run `scripts/get-full-production-schema.sql` in Production SQL Editor to get:
- All functions
- All views  
- All triggers
- All RLS policies

### Step 2: Copy and Run in Dev

Copy the results and run in Dev SQL Editor.

## Method 4: Using Supabase Dashboard

1. **Export from Production:**
   - Go to Production Dashboard
   - Database → SQL Editor
   - Run queries to get function/view/trigger definitions
   - Copy results

2. **Import to Dev:**
   - Go to Dev Dashboard
   - Database → SQL Editor
   - Paste and run

## Quick Sync Script

Use the provided script:

```bash
chmod +x scripts/dump-production-schema.sh
./scripts/dump-production-schema.sh
```

## Important Notes

⚠️ **Warnings:**
- This will overwrite existing objects in dev
- Make sure to backup dev first if needed
- Some objects may fail if dependencies are missing
- RLS policies should be added last

✅ **Best Practice:**
1. Dump production schema
2. Review the SQL file
3. Run in dev SQL Editor (easier to see errors)
4. Fix any dependency issues
5. Verify all objects were created

## Verification

After syncing, verify with:

```sql
-- Run in both Production and Dev
SELECT 
    'Functions' as type, COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
UNION ALL
SELECT 'Views', COUNT(*) FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT 'Triggers', COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'
UNION ALL
SELECT 'RLS Policies', COUNT(*) FROM pg_policies WHERE schemaname = 'public';
```
