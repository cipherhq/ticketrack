# Quick Guide: Add RLS Policies to Dev

## Step 1: Save Your JSON

1. Copy your JSON array (the one with all the `policy_sql` entries)
2. Save it to a file called `policies.json` in the project root

## Step 2: Run the Script

```bash
cd /Users/bajideace/Desktop/ticketrack
python3 scripts/create-rls-from-json-simple.py policies.json
```

This will create: `database/all-rls-policies-complete.sql`

## Step 3: Run in Dev SQL Editor

1. Open **Dev** Supabase Dashboard
2. Go to SQL Editor
3. Open the file: `database/all-rls-policies-complete.sql`
4. Copy all the SQL
5. Paste into Dev SQL Editor
6. Click "Run"

## That's it! ✅

The script automatically:
- Extracts all SQL from JSON
- Fixes `{public}` to `'public'`
- Creates a ready-to-run SQL file
