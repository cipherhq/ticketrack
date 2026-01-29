# Sync Dev Database with Production

## Current Status

| Component | Production | Dev | Missing | Status |
|-----------|------------|-----|---------|--------|
| **Tables** | 100 | 100 | 0 | ✅ Complete |
| **Cron Jobs** | 8 | 8 | 0 | ✅ Complete |
| **Functions** | 103 | 60 | **43** | ❌ Need to add |
| **Views** | 4 | 0 | **4** | ❌ Need to add |
| **Triggers** | 40 | 29 | **11** | ❌ Need to add |
| **RLS Policies** | 479 | 386 | **93** | ❌ Need to add |
| **Indexes** | 640 | 413 | **227** | ❌ Need to add |

## Step-by-Step Sync Process

### Step 1: Get Production Lists

Run these queries in **Production SQL Editor** and save the results:

#### 1.1 Functions (Names Only)
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;
```

#### 1.2 Views (Names Only)
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

#### 1.3 Triggers (Names Only)
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;
```

### Step 2: Get Dev Lists

Run the same queries in **Dev SQL Editor**:

#### 2.1 Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;
```

#### 2.2 Views
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

#### 2.3 Triggers
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;
```

### Step 3: Compare Lists

Compare the production and dev lists to identify:
- Functions in production but not in dev
- Views in production but not in dev
- Triggers in production but not in dev

### Step 4: Get Full Definitions for Missing Items

For each missing item, get its full definition from production:

#### 4.1 Missing Functions
```sql
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('function1', 'function2', ...) -- Replace with missing function names
ORDER BY routine_name;
```

#### 4.2 Missing Views
```sql
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN ('view1', 'view2', ...) -- Replace with missing view names
ORDER BY table_name;
```

#### 4.3 Missing Triggers
```sql
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name IN ('trigger1', 'trigger2', ...) -- Replace with missing trigger names
ORDER BY event_object_table, trigger_name;
```

### Step 5: Create Migration Script

Once you have the missing definitions, I can help create a migration script to add them to dev.

## Alternative: Automated Approach

If you can share your **Production Service Role Key** (temporarily), I can:
1. Automatically compare both databases
2. Identify all missing items
3. Generate a complete migration script
4. Add all missing functions, views, triggers, policies, and indexes

## Quick Check Commands

### Verify Current Status
```sql
-- Run in both Production and Dev
SELECT 
    'Functions' as type, COUNT(*) as count
FROM information_schema.routines WHERE routine_schema = 'public'
UNION ALL
SELECT 'Views', COUNT(*) FROM information_schema.views WHERE table_schema = 'public'
UNION ALL
SELECT 'Triggers', COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'
UNION ALL
SELECT 'Policies', COUNT(*) FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'Indexes', COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
```

## Priority Order

1. **Functions** (43 missing) - Critical for app functionality
2. **Views** (4 missing) - May be used by queries
3. **Triggers** (11 missing) - Important for data integrity
4. **RLS Policies** (93 missing) - Critical for security
5. **Indexes** (227 missing) - Performance optimization

## Notes

- All tables already match ✅
- All cron jobs already match ✅
- Missing items are likely in migration files or were created manually in production
- Some may be auto-generated (like indexes on foreign keys)
- RLS policies might be created automatically with tables in some cases
