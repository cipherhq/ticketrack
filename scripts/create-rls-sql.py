#!/usr/bin/env python3
"""
Create SQL file from RLS policies JSON
Paste your JSON array and run: python3 create-rls-sql.py
Or save JSON to file and run: python3 create-rls-sql.py < policies.json
"""

import json
import sys
import os

def main():
    # Read JSON
    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1], 'r') as f:
            json_data = f.read()
    else:
        # Read from stdin
        json_data = sys.stdin.read()
    
    # Parse JSON
    try:
        policies = json.loads(json_data)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Generate SQL
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
        if stmt.strip():
            sql_statements.append(stmt)
    
    output = header + '\n\n'.join(sql_statements) + '\n'
    
    # Write to file
    output_path = 'database/add-all-rls-policies.sql'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        f.write(output)
    
    print(f"✓ Generated {output_path} with {len(policies)} policies")

if __name__ == '__main__':
    main()
