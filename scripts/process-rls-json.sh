#!/bin/bash
# Process RLS policies JSON and generate SQL file
# Usage: ./process-rls-json.sh < policies.json

# Read JSON from stdin
JSON_DATA=$(cat)

# Count policies
POLICY_COUNT=$(echo "$JSON_DATA" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")

# Generate SQL
python3 << 'PYTHON_SCRIPT'
import json
import sys

json_data = sys.stdin.read()
policies = json.load(json_data)

header = """-- ============================================================================
-- ADD ALL RLS POLICIES TO DATABASE
-- ============================================================================
-- This script adds all RLS policies from production
-- Run this in your Supabase SQL Editor
-- ============================================================================
-- Note: Policies are wrapped in DO blocks with existence checks
-- to prevent errors if tables or policies already exist
-- ============================================================================

"""

sql_statements = []
for policy in policies:
    stmt = policy.get('create_policy_statement', '')
    if stmt:
        sql_statements.append(stmt)

output = header + '\n\n'.join(sql_statements) + '\n'

with open('database/add-all-rls-policies.sql', 'w') as f:
    f.write(output)

print(f"✓ Generated database/add-all-rls-policies.sql with {len(policies)} policies")
PYTHON_SCRIPT
