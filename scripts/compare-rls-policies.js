/**
 * Compare RLS Policies between Production and Dev
 */

// Production policies (from user's input)
const prodPolicies = [
  // ... (I'll need to parse the JSON from the user's input)
];

// Dev policies (from user's previous input)
const devPolicies = [
  // ... (I'll need to parse the JSON from the user's previous input)
];

// Create a key for each policy: tablename + policyname
function createPolicyKey(policy) {
  return `${policy.tablename}::${policy.policyname}`;
}

// Compare
const prodKeys = new Set(prodPolicies.map(createPolicyKey));
const devKeys = new Set(devPolicies.map(createPolicyKey));

const missing = prodPolicies.filter(p => !devKeys.has(createPolicyKey(p)));

console.log(`Production: ${prodPolicies.length} policies`);
console.log(`Dev: ${devPolicies.length} policies`);
console.log(`Missing: ${missing.length} policies`);

// Group by table
const missingByTable = {};
missing.forEach(p => {
  if (!missingByTable[p.tablename]) {
    missingByTable[p.tablename] = [];
  }
  missingByTable[p.tablename].push(p);
});

console.log('\nMissing policies by table:');
Object.keys(missingByTable).sort().forEach(table => {
  console.log(`  ${table}: ${missingByTable[table].length} policies`);
});
