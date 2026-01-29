#!/usr/bin/env python3
"""
Simple script to extract RLS policies from JSON
Just paste your JSON when prompted, or save it to a file
"""

import json
import sys
import os

print("=" * 70)
print("RLS Policies Extractor")
print("=" * 70)
print()

# Try to read from file first, then stdin
json_data = None

if len(sys.argv) > 1:
    # Read from file
    try:
        with open(sys.argv[1], 'r') as f:
            json_data = f.read()
        print(f"✓ Read JSON from: {sys.argv[1]}")
    except FileNotFoundError:
        print(f"❌ File not found: {sys.argv[1]}")
        sys.exit(1)
else:
    # Read from stdin
    print("📋 Paste your JSON array and press Ctrl+D (or Ctrl+Z on Windows) when done:")
    print("   (Or save JSON to a file and run: python3 create-rls-from-json-simple.py policies.json)")
    print()
    json_data = sys.stdin.read()

# Parse JSON
try:
    policies = json.loads(json_data)
    print(f"✓ Found {len(policies)} policies")
except json.JSONDecodeError as e:
    print(f"❌ Error parsing JSON: {e}")
    sys.exit(1)

# Generate SQL
header = f"""-- ============================================================================
-- ADD ALL RLS POLICIES TO DEV DATABASE
-- ============================================================================
-- This script adds all {len(policies)} RLS policies from production
-- Run this in DEV Supabase SQL Editor
-- ============================================================================
-- Note: Policies are wrapped in DO blocks with existence checks
-- to prevent errors if tables or policies already exist
-- ============================================================================

"""

sql_statements = []
for i, policy in enumerate(policies, 1):
    stmt = policy.get('policy_sql', '')
    if stmt.strip():
        # Fix {public} to 'public'
        stmt = stmt.replace('{public}', "'public'")
        sql_statements.append(stmt)
        if i % 50 == 0:
            print(f"   Processed {i}/{len(policies)} policies...")

output = header + '\n\n'.join(sql_statements) + f'\n\n-- ============================================================================\n-- COMPLETED: {len(sql_statements)} policies added\n-- ============================================================================\n'

# Write to file
output_path = 'database/all-rls-policies-complete.sql'
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, 'w') as f:
    f.write(output)

print()
print("=" * 70)
print(f"✅ SUCCESS! Generated: {output_path}")
print(f"   Contains {len(sql_statements)} RLS policies")
print("=" * 70)
print()
print("📋 NEXT STEP:")
print("   1. Open Dev Supabase SQL Editor")
print("   2. Copy the contents of: database/all-rls-policies-complete.sql")
print("   3. Paste and run in Dev SQL Editor")
print()
print(f"   Quick copy: cat {output_path} | pbcopy")
print("=" * 70)
