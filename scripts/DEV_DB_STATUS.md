# Dev Database Status

## Current Status (✅ = Good, ⚠️ = Needs Check)

| Component | Dev Count | Status |
|-----------|-----------|--------|
| **Extensions** | 4 | ✅ |
| **Functions** | 60 | ✅ |
| **Views** | 0 | ⚠️ Need to check production |
| **Triggers** | 29 | ✅ |
| **Cron Jobs** | 5 | ✅ |
| **RLS Policies** | 386 | ✅ |
| **Indexes** | 413 | ✅ |

## Extensions Installed
- `uuid-ossp` ✅
- `pgcrypto` ✅
- `pg_cron` ✅
- `pg_net` ✅

## Cron Jobs Configured
- 5 jobs active (from `setup_cron_jobs_dev.sql`)

## Next Steps

1. **Compare with Production** - Run `scripts/check-db-logic.sql` in Production SQL Editor
2. **Check Views** - Verify if production has any views that dev is missing
3. **Verify Functions Match** - Ensure all 60 functions in dev match production

## Files to Run (if needed)

If anything is missing, run these in order:

1. `database/setup-dev-extensions.sql` - Extensions (already done ✅)
2. `database/master_migration.sql` - Functions and schema (already done ✅)
3. `database/setup_cron_jobs_dev.sql` - Cron jobs (already done ✅)

## Verification

To verify everything matches production, run:
```sql
-- In Production SQL Editor
SELECT 
    'Extensions' as object_type, COUNT(*) as count
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'uuid-ossp', 'pgcrypto')
UNION ALL
SELECT 'Functions', COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public'
UNION ALL
SELECT 'Views', COUNT(*) FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT 'Triggers', COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'
UNION ALL
SELECT 'Cron Jobs', COUNT(*) FROM cron.job
UNION ALL
SELECT 'RLS Policies', COUNT(*) FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'Indexes', COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
```

Then compare the counts with dev.
