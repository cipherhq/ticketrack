# Where to Run SQL Queries

## Overview

You have **TWO** Supabase projects:
1. **Production** (`bkvbvggngttrizbchygy`) - Your live database
2. **Dev** (`bnkxgyzvqpdctghrgmkr`) - Your development database

## Step-by-Step: Syncing Production to Dev

### Step 1: Run in PRODUCTION SQL Editor

**Location:** Supabase Dashboard → Production Project → SQL Editor

**Purpose:** Generate SQL code for all database objects

**What to run:**
- `scripts/dump-production-fixed.sql` (or `scripts/get-full-production-schema.sql`)

**What happens:**
- These queries GENERATE SQL code (they don't create objects)
- You'll get results with SQL statements in the output
- Copy ALL the SQL from the results

**Example:**
```sql
-- This query GENERATES SQL, it doesn't create anything
SELECT pg_get_functiondef(p.oid) || ';' as sql_output
FROM pg_proc p
...
```

**Result:** You'll see SQL CREATE statements in the results panel

### Step 2: Copy the Generated SQL

- Select all rows from the results
- Copy the SQL code from the `sql_output` column
- Save it to a file or keep it in clipboard

### Step 3: Run in DEV SQL Editor

**Location:** Supabase Dashboard → Dev Project → SQL Editor

**Purpose:** Actually create the database objects

**What to run:**
- Paste the SQL you copied from Step 1
- This is the actual CREATE FUNCTION, CREATE VIEW, CREATE TRIGGER, CREATE POLICY statements

**Example:**
```sql
-- This is what you paste and run in DEV
CREATE OR REPLACE FUNCTION public.some_function() ...
CREATE TRIGGER some_trigger ...
CREATE POLICY some_policy ...
```

## Quick Reference

| Step | Location | What to Run | Purpose |
|------|----------|-------------|---------|
| 1 | **Production** SQL Editor | `dump-production-fixed.sql` | Generate SQL code |
| 2 | Copy results | Copy SQL from results | Get the actual SQL |
| 3 | **Dev** SQL Editor | Paste copied SQL | Create objects in dev |

## Common Mistakes

❌ **Wrong:** Running the SELECT queries in Dev
- The SELECT queries are meant to GENERATE SQL, not create objects

✅ **Right:** 
1. Run SELECT queries in Production (to generate SQL)
2. Copy the generated SQL
3. Run the generated SQL in Dev (to create objects)

## How to Identify Which Project You're In

**Check the URL:**
- Production: `supabase.com/dashboard/project/bkvbvggngttrizbchygy/...`
- Dev: `supabase.com/dashboard/project/bnkxgyzvqpdctghrgmkr/...`

**Check the top bar:**
- Should show project name and environment

## Alternative: Direct SQL Queries

If you want to run queries directly (not generate SQL), use:

**In Production:**
- `scripts/get-rls-policies.sql` - Get list of policies
- `scripts/get-missing-function-defs.sql` - Get function definitions

**In Dev:**
- `database/add-missing-functions.sql` - Add functions
- `database/add-missing-views.sql` - Add views
- `database/add-missing-triggers.sql` - Add triggers
- `database/add-all-rls-policies.sql` - Add policies
