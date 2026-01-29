#!/usr/bin/env node
/**
 * Generate SQL file from RLS policy JSON array
 * Usage: node generate-rls-from-json.js < input.json > output.sql
 * Or: node generate-rls-from-json.js input.json output.sql
 */

const fs = require('fs');
const path = require('path');

function generateSQL(policies) {
  const header = [
    '-- ============================================================================',
    '-- ADD ALL RLS POLICIES TO DATABASE',
    '-- ============================================================================',
    '-- This script adds all RLS policies from production',
    '-- Run this in your Supabase SQL Editor',
    '-- ============================================================================',
    '-- Note: Policies are wrapped in DO blocks with existence checks',
    '-- to prevent errors if tables or policies already exist',
    '-- ============================================================================',
    '',
  ];

  const sqlStatements = policies.map(policy => {
    return policy.create_policy_statement || '';
  }).filter(stmt => stmt.trim());

  return header.join('\n') + '\n' + sqlStatements.join('\n\n') + '\n';
}

// Main execution
if (require.main === module) {
  let inputData;
  let outputPath;

  if (process.argv.length >= 3) {
    // File mode: node script.js input.json [output.sql]
    const inputPath = process.argv[2];
    outputPath = process.argv[3] || path.join(__dirname, '..', 'database', 'add-all-rls-policies.sql');
    inputData = fs.readFileSync(inputPath, 'utf8');
  } else {
    // STDIN mode
    inputData = fs.readFileSync(0, 'utf8');
    outputPath = path.join(__dirname, '..', 'database', 'add-all-rls-policies.sql');
  }

  try {
    const policies = JSON.parse(inputData);
    const sql = generateSQL(policies);
    
    fs.writeFileSync(outputPath, sql, 'utf8');
    console.log(`✓ Generated ${outputPath} with ${policies.length} policies`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { generateSQL };
