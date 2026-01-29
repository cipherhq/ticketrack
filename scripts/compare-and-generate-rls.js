/**
 * Compare Production and Dev RLS Policies and Generate Migration
 * 
 * This script compares the two policy lists and generates CREATE POLICY
 * statements for all missing policies.
 */

// Production policies (from user's input - will be populated)
const prodPolicies = [];

// Dev policies (from user's previous input - will be populated)
const devPolicies = [];

// Create unique key for each policy
function policyKey(p) {
  return `${p.tablename}::${p.policyname}`;
}

// Format roles
function formatRoles(roles) {
  if (!roles) return 'public';
  const str = String(roles);
  if (str.startsWith('{') && str.endsWith('}')) {
    return str.slice(1, -1).replace(/"/g, '');
  }
  return str;
}

// Escape SQL
function escapeSQL(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

// Generate CREATE POLICY statement
function generatePolicy(policy) {
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

// Compare
if (prodPolicies.length === 0 || devPolicies.length === 0) {
  console.log('Please populate prodPolicies and devPolicies arrays with the JSON data');
  console.log('from production and dev RLS policy queries.');
  process.exit(1);
}

const prodKeys = new Set(prodPolicies.map(policyKey));
const devKeys = new Set(devPolicies.map(policyKey));

const missing = prodPolicies.filter(p => !devKeys.has(policyKey(p)));

console.log(`Production: ${prodPolicies.length} policies`);
console.log(`Dev: ${devPolicies.length} policies`);
console.log(`Missing: ${missing.length} policies\n`);

if (missing.length > 0) {
  // Group by table
  const byTable = {};
  missing.forEach(p => {
    if (!byTable[p.tablename]) byTable[p.tablename] = [];
    byTable[p.tablename].push(p);
  });
  
  console.log('Missing policies by table:');
  Object.keys(byTable).sort().forEach(table => {
    console.log(`  ${table}: ${byTable[table].length} policies`);
  });
  
  console.log('\n\n-- ============================================================================');
  console.log('-- ADD MISSING RLS POLICIES TO DEV DATABASE');
  console.log('-- ============================================================================\n');
  
  Object.keys(byTable).sort().forEach(table => {
    console.log(`-- ============================================================================`);
    console.log(`-- TABLE: ${table}`);
    console.log(`-- ============================================================================\n`);
    
    byTable[table].forEach(policy => {
      console.log(`-- Policy: ${policy.policyname}`);
      console.log(generatePolicy(policy));
      console.log('');
    });
  });
} else {
  console.log('✅ All policies match!');
}
