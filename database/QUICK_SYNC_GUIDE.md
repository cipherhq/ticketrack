# Quick Database Sync Guide

## Step 1: Get Production Lists

Run these queries in **Production SQL Editor** and copy the results:

### Functions (Names)
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;
```

### Views (Names)
```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Triggers (Names)
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;
```

## Step 2: Get Dev Lists

Run the **same queries** in **Dev SQL Editor** and copy the results.

## Step 3: Share Results

Share both sets of results (production and dev) and I'll:
1. Identify what's missing
2. Get the full definitions from production
3. Create a complete migration script

## Alternative: Get Full Definitions Directly

If you want to get full definitions immediately, run these in **Production SQL Editor**:

### All Functions with Definitions
```sql
SELECT 
    routine_name,
    pg_get_functiondef(p.oid) as definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.routine_schema = 'public'
    AND n.nspname = 'public'
ORDER BY r.routine_name;
```

### All Views with Definitions
```sql
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

### All Triggers with Definitions
```sql
SELECT 
    trigger_name,
    event_object_table,
    pg_get_triggerdef(t.oid) as definition
FROM information_schema.triggers it
JOIN pg_trigger t ON t.tgname = it.trigger_name
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE it.trigger_schema = 'public'
    AND n.nspname = 'public'
    AND NOT t.tgisinternal
ORDER BY it.event_object_table, it.trigger_name;
```

## What We Know So Far

- **Functions**: Production has 103, Dev has 60 → **43 missing**
- **Views**: Production has 4, Dev has 0 → **4 missing**
- **Triggers**: Production has 40, Dev has 29 → **11 missing**
- **RLS Policies**: Production has 479, Dev has 386 → **93 missing**
- **Indexes**: Production has 640, Dev has 413 → **227 missing**

Once you share the lists or definitions, I can create the complete migration script!
