# Step-by-Step: Get RLS Policies from Production

## Step 1: Run Query in PRODUCTION SQL Editor

1. Open **Production** Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste this query:

```sql
SELECT 
    json_build_object(
        'policy_sql',
        'DO $$' || E'\n' ||
        'BEGIN' || E'\n' ||
        '    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' || tablename || ''') THEN' || E'\n' ||
        '        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''' || tablename || ''' AND policyname = ''' || policyname || ''') THEN' || E'\n' ||
        '            CREATE POLICY "' || policyname || '" ON public.' || tablename || E'\n' ||
        '                AS ' || permissive || E'\n' ||
        '                FOR ' || cmd || E'\n' ||
        '                TO ''public''' || E'\n' ||
        CASE 
            WHEN qual IS NOT NULL THEN '                USING (' || qual || ')' || E'\n'
            ELSE ''
        END ||
        CASE 
            WHEN with_check IS NOT NULL THEN '                WITH CHECK (' || with_check || ')' || E'\n'
            ELSE ''
        END ||
        '            ;' || E'\n' ||
        '        END IF;' || E'\n' ||
        '    END IF;' || E'\n' ||
        'END $$;'
    ) as policy_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

4. Click **Run**
5. You'll see results with a `policy_sql` column

## Step 2: Copy the Results

1. In the results panel, click the **download/export** button (usually at the top right)
2. Choose **JSON** format
3. Save it as `policies.json` in your project folder

**OR** manually:
1. Select all rows in the results
2. Copy them
3. Paste into a text file
4. Wrap with `[` at the start and `]` at the end
5. Save as `policies.json`

## Step 3: Generate SQL File

Run this command:

```bash
cd /Users/bajideace/Desktop/ticketrack
python3 scripts/create-rls-from-json-simple.py policies.json
```

This creates: `database/all-rls-policies-complete.sql`

## Step 4: Run in DEV SQL Editor

1. Open **Dev** Supabase Dashboard → SQL Editor
2. Open the file: `database/all-rls-policies-complete.sql`
3. Copy all the SQL
4. Paste into Dev SQL Editor
5. Click **Run**

## Done! ✅
