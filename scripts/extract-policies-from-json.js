#!/usr/bin/env node
/**
 * Extract RLS Policies from JSON and create SQL file
 * Usage: node scripts/extract-policies-from-json.js < policies.json > database/all-rls-policies.sql
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read JSON from stdin or file
const jsonData = process.stdin.isTTY 
  ? readFileSync(process.argv[2] || 'temp_policies.json', 'utf8')
  : readFileSync(0, 'utf8');

try {
  const policies = JSON.parse(jsonData);
  
  // Header
  console.log(`-- ============================================================================
-- ADD ALL RLS POLICIES TO DEV DATABASE
-- ============================================================================
-- This script adds all ${policies.length} RLS policies from production
-- Run this in DEV Supabase SQL Editor
-- ============================================================================
-- Note: Policies are wrapped in DO blocks with existence checks
-- to prevent errors if tables or policies already exist
-- ============================================================================

`);

  // Extract and output each policy SQL
  policies.forEach((policy, index) => {
    if (policy.policy_sql) {
      // Fix the {public} issue - replace with 'public'
      const fixedSql = policy.policy_sql.replace(/\{public\}/g, "'public'");
      console.log(fixedSql);
      console.log(''); // Empty line between policies
    }
  });

  console.log(`-- ============================================================================
-- COMPLETED: ${policies.length} policies added
-- ============================================================================`);

} catch (error) {
  console.error('Error parsing JSON:', error.message);
  process.exit(1);
}
