#!/usr/bin/env python3
"""
Generate SQL file from RLS policy JSON array
"""
import json
import sys

def main():
    # Read JSON from stdin
    json_data = sys.stdin.read()
    
    try:
        policies = json.loads(json_data)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Generate SQL header
    sql_lines = [
        "-- ============================================================================",
        "-- ADD ALL RLS POLICIES TO DATABASE",
        "-- ============================================================================",
        "-- This script adds all RLS policies from production",
        "-- Run this in your Supabase SQL Editor",
        "-- ============================================================================",
        "-- Note: Policies are wrapped in DO blocks with existence checks",
        "-- to prevent errors if tables or policies already exist",
        "-- ============================================================================",
        "",
    ]
    
    # Add each policy
    for policy in policies:
        sql_statement = policy.get('create_policy_statement', '')
        if sql_statement:
            sql_lines.append(sql_statement)
            sql_lines.append("")  # Add blank line between policies
    
    # Write to file
    output_file = 'database/add-all-rls-policies.sql'
    with open(output_file, 'w') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"✓ Generated {output_file} with {len(policies)} policies")

if __name__ == '__main__':
    main()
