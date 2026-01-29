/**
 * Generate CREATE POLICY statements for missing RLS policies
 * 
 * This script compares production and dev RLS policies and generates
 * CREATE POLICY statements for policies that exist in production but not in dev.
 */

// Helper to create a unique key for a policy
function policyKey(p) {
  return `${p.tablename}::${p.policyname}`;
}

// Helper to format roles array
function formatRoles(roles) {
  if (!roles || roles.length === 0) return 'public';
  if (Array.isArray(roles)) {
    return roles.join(', ');
  }
  // Handle PostgreSQL array format like "{public}" or "{anon,authenticated}"
  const str = String(roles);
  if (str.startsWith('{') && str.endsWith('}')) {
    return str.slice(1, -1);
  }
  return str;
}

// Helper to escape SQL strings
function escapeSQL(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

// Generate CREATE POLICY statement
function generateCreatePolicy(policy) {
  const roles = formatRoles(policy.roles);
  const permissive = policy.permissive || 'PERMISSIVE';
  const cmd = policy.cmd || 'ALL';
  const qual = policy.qual ? escapeSQL(policy.qual) : null;
  const withCheck = policy.with_check ? escapeSQL(policy.with_check) : null;
  
  let sql = `CREATE POLICY "${policy.policyname}" ON ${policy.schemaname}.${policy.tablename}\n`;
  sql += `    AS ${permissive}\n`;
  sql += `    FOR ${cmd}\n`;
  sql += `    TO ${roles}`;
  
  if (qual) {
    sql += `\n    USING (${qual})`;
  }
  
  if (withCheck) {
    sql += `\n    WITH CHECK (${withCheck})`;
  }
  
  sql += ';';
  
  return sql;
}

// This will be populated from the user's input
const prodPolicies = [];
const devPolicies = [];

// Compare and generate
const prodKeys = new Set(prodPolicies.map(policyKey));
const devKeys = new Set(devPolicies.map(policyKey));

const missing = prodPolicies.filter(p => !devKeys.has(policyKey(p)));

console.log(`📊 RLS Policy Comparison\n`);
console.log(`Production: ${prodPolicies.length} policies`);
console.log(`Dev: ${devPolicies.length} policies`);
console.log(`Missing: ${missing.length} policies\n`);

if (missing.length > 0) {
  console.log('Generating CREATE POLICY statements for missing policies...\n');
  console.log('-- ============================================================================');
  console.log('-- ADD MISSING RLS POLICIES TO DEV DATABASE');
  console.log('-- ============================================================================');
  console.log(`-- This script adds ${missing.length} RLS policies that exist in production but are missing in dev`);
  console.log('-- Run this in DEV Supabase SQL Editor');
  console.log('-- ============================================================================\n');
  
  missing.forEach((policy, index) => {
    console.log(`-- Policy ${index + 1}/${missing.length}: ${policy.tablename}.${policy.policyname}`);
    console.log(generateCreatePolicy(policy));
    console.log('');
  });
} else {
  console.log('✅ All policies are already in dev!');
}
