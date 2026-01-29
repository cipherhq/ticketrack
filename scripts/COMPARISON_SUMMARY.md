# Production vs Dev Database Comparison

## Summary

| Component | Production | Dev | Missing | Status |
|-----------|------------|-----|---------|--------|
| **Extensions** | 4 | 4 | 0 | ✅ Match |
| **Functions** | 103 | 60 | **43** | ❌ Need to add |
| **Views** | 4 | 0 | **4** | ❌ Need to add |
| **Triggers** | 40 | 29 | **11** | ❌ Need to add |
| **Cron Jobs** | 8 | 5 | **3** | ❌ Need to add |
| **RLS Policies** | 479 | 386 | **93** | ❌ Need to add |
| **Indexes** | 640 | 413 | **227** | ❌ Need to add |

## Action Plan

### Priority 1: Critical Missing Items

1. **Functions (43 missing)**
   - These are likely custom database functions
   - May be in migration files or created manually
   - Need to identify which functions are missing

2. **Cron Jobs (3 missing)**
   - Check `database/setup_cron_jobs.sql` vs `setup_cron_jobs_dev.sql`
   - May need to add missing jobs

3. **Views (4 missing)**
   - These are database views (virtual tables)
   - Need to identify and create them

### Priority 2: Important but Less Critical

4. **Triggers (11 missing)**
   - Database triggers for automation
   - May be in migration files

5. **RLS Policies (93 missing)**
   - Row Level Security policies
   - Critical for data access control
   - May be auto-created with tables or need manual setup

6. **Indexes (227 missing)**
   - Performance optimization
   - May be created automatically or need manual setup

## Next Steps

### Step 1: Get Lists from Production

Run these queries in **Production SQL Editor** and save the results:

```sql
-- 1. All Functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' ORDER BY routine_name;

-- 2. All Views
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' ORDER BY table_name;

-- 3. All Triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers 
WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;

-- 4. All Cron Jobs
SELECT jobname, schedule FROM cron.job ORDER BY jobname;
```

### Step 2: Compare with Dev

Run the same queries in **Dev SQL Editor** and compare the lists.

### Step 3: Create Missing Items

Once we identify what's missing, we can:
1. Find the SQL definitions in migration files
2. Create a migration script to add missing items
3. Run it in dev database

## Quick Fixes

### Missing Cron Jobs
Check if these exist in production but not dev:
- Review `database/setup_cron_jobs.sql` for all 8 jobs
- Compare with `database/setup_cron_jobs_dev.sql`

### Missing Views
Views are typically created in migration files. Search for:
```sql
CREATE VIEW
CREATE OR REPLACE VIEW
```

### Missing Functions
Functions are in migration files. Search for:
```sql
CREATE FUNCTION
CREATE OR REPLACE FUNCTION
```

## Recommendation

The safest approach is to:
1. Export the complete schema from production
2. Compare with dev
3. Create a migration script for missing items

Or we can identify specific missing items and add them one by one.
