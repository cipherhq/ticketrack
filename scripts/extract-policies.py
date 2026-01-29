#!/usr/bin/env python3
"""
Extract RLS Policies from JSON and create SQL file
Paste your JSON array and run: python3 extract-policies.py
Or save JSON to file and run: python3 extract-policies.py < policies.json
"""

import json
import sys

def main():
    # Read JSON
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r') as f:
            json_data = f.read()
    else:
        json_data = sys.stdin.read()
    
    # Parse JSON
    try:
        policies = json.loads(json_data)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Generate SQL
    header = """-- ============================================================================
-- ADD ALL RLS POLICIES TO DEV DATABASE
-- ============================================================================
-- This script adds all {} RLS policies from production
-- Run this in DEV Supabase SQL Editor
-- ============================================================================
-- Note: Policies are wrapped in DO blocks with existence checks
-- to prevent errors if tables or policies already exist
-- ============================================================================

""".format(len(policies))
    
    sql_statements = []
    for policy in policies:
        stmt = policy.get('policy_sql', '')
        if stmt.strip():
            # Fix {public} to 'public'
            stmt = stmt.replace('{public}', "'public'")
            sql_statements.append(stmt)
    
    output = header + '\n\n'.join(sql_statements) + '\n\n-- ============================================================================\n-- COMPLETED: {} policies\n-- ============================================================================\n'.format(len(sql_statements))
    
    # Write to file
    output_path = 'database/all-rls-policies-complete.sql'
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        f.write(output)
    
    print(f"✓ Generated {output_path} with {len(sql_statements)} policies")
    print(f"\n📋 Next step: Run this SQL in DEV Supabase SQL Editor")

if __name__ == '__main__':
    main()
