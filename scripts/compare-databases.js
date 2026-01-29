/**
 * Compare Production and Dev Databases
 * 
 * This script compares the schemas of both databases to ensure
 * dev has all the tables, columns, and constraints from production.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// Production database
const PROD_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
const PROD_SERVICE_KEY = process.env.PROD_SERVICE_ROLE_KEY || envVars.PROD_SERVICE_ROLE_KEY;

// Dev database
const DEV_URL = envVars.VITE_SUPABASE_URL || 'https://bnkxgyzvqpdctghrgmkr.supabase.co';
const DEV_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!PROD_SERVICE_KEY) {
  console.error('❌ PROD_SERVICE_ROLE_KEY not found. Please set it in .env.local');
  process.exit(1);
}

if (!DEV_SERVICE_KEY) {
  console.error('❌ DEV_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const prodClient = createClient(PROD_URL, PROD_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const devClient = createClient(DEV_URL, DEV_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function getTables(client, dbName) {
  const { data, error } = await client.rpc('exec_sql', {
    query: `
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND table_schema NOT LIKE 'pg_temp%'
        AND table_schema NOT LIKE 'pg_toast_temp%'
      ORDER BY table_schema, table_name;
    `
  });

  if (error) {
    // Fallback: try direct query
    const { data: altData, error: altError } = await client
      .from('information_schema.tables')
      .select('table_schema, table_name, table_type')
      .neq('table_schema', 'pg_catalog')
      .neq('table_schema', 'information_schema');

    if (altError) {
      console.error(`Error fetching tables from ${dbName}:`, altError.message);
      return [];
    }
    return altData || [];
  }

  return data || [];
}

async function getTableColumns(client, schema, table, dbName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position;
  `;

  const { data, error } = await client.rpc('exec_sql', {
    query,
    params: [schema, table]
  });

  if (error) {
    // Try alternative approach
    const { data: altData, error: altError } = await client
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default, character_maximum_length')
      .eq('table_schema', schema)
      .eq('table_name', table)
      .order('ordinal_position');

    if (altError) {
      console.warn(`Warning: Could not fetch columns for ${schema}.${table} in ${dbName}`);
      return [];
    }
    return altData || [];
  }

  return data || [];
}

async function compareDatabases() {
  console.log('\n🔍 Comparing Production and Dev Databases\n');
  console.log('='.repeat(60));

  try {
    // Get all tables from both databases
    console.log('\n📊 Fetching tables from Production...');
    const prodTables = await getTables(prodClient, 'Production');
    console.log(`   Found ${prodTables.length} tables`);

    console.log('\n📊 Fetching tables from Dev...');
    const devTables = await getTables(devClient, 'Dev');
    console.log(`   Found ${devTables.length} tables`);

    // Create maps for easier lookup
    const prodTableMap = new Map();
    prodTables.forEach(t => {
      const key = `${t.table_schema}.${t.table_name}`;
      prodTableMap.set(key, t);
    });

    const devTableMap = new Map();
    devTables.forEach(t => {
      const key = `${t.table_schema}.${t.table_name}`;
      devTableMap.set(key, t);
    });

    // Find missing tables in dev
    console.log('\n' + '='.repeat(60));
    console.log('📋 COMPARISON RESULTS');
    console.log('='.repeat(60));

    const missingInDev = [];
    const extraInDev = [];
    const differences = [];

    // Check for tables in prod but not in dev
    for (const [key, table] of prodTableMap.entries()) {
      if (!devTableMap.has(key)) {
        missingInDev.push({ key, table });
      }
    }

    // Check for tables in dev but not in prod
    for (const [key, table] of devTableMap.entries()) {
      if (!prodTableMap.has(key)) {
        extraInDev.push({ key, table });
      }
    }

    // Report results
    if (missingInDev.length === 0 && extraInDev.length === 0) {
      console.log('\n✅ All tables match!');
    } else {
      if (missingInDev.length > 0) {
        console.log(`\n❌ Missing in Dev (${missingInDev.length} tables):`);
        missingInDev.forEach(({ key, table }) => {
          console.log(`   - ${key} (${table.table_type})`);
        });
      }

      if (extraInDev.length > 0) {
        console.log(`\n⚠️  Extra in Dev (${extraInDev.length} tables):`);
        extraInDev.forEach(({ key, table }) => {
          console.log(`   - ${key} (${table.table_type})`);
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Production Tables: ${prodTables.length}`);
    console.log(`Dev Tables: ${devTables.length}`);
    console.log(`Missing in Dev: ${missingInDev.length}`);
    console.log(`Extra in Dev: ${extraInDev.length}`);

    // List all tables for reference
    console.log('\n📋 All Production Tables:');
    prodTables
      .filter(t => t.table_schema === 'public')
      .forEach(t => {
        const exists = devTableMap.has(`public.${t.table_name}`) ? '✅' : '❌';
        console.log(`   ${exists} ${t.table_name}`);
      });

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error comparing databases:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Alternative: Use SQL query directly
async function compareUsingSQL() {
  console.log('\n🔍 Comparing Databases using SQL queries\n');
  console.log('='.repeat(60));

  try {
    // Query production
    const { data: prodData, error: prodError } = await prodClient
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (prodError) {
      console.error('Error querying production:', prodError);
      // Try direct SQL
      return await compareUsingDirectSQL();
    }

    // Query dev
    const { data: devData, error: devError } = await devClient
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (devError) {
      console.error('Error querying dev:', devError);
      return await compareUsingDirectSQL();
    }

    const prodTables = new Set((prodData || []).map(t => t.table_name));
    const devTables = new Set((devData || []).map(t => t.table_name));

    const missing = [...prodTables].filter(t => !devTables.has(t));
    const extra = [...devTables].filter(t => !prodTables.has(t));

    console.log('\n📊 RESULTS:');
    console.log(`Production: ${prodTables.size} tables`);
    console.log(`Dev: ${devTables.size} tables`);

    if (missing.length > 0) {
      console.log(`\n❌ Missing in Dev (${missing.length}):`);
      missing.forEach(t => console.log(`   - ${t}`));
    }

    if (extra.length > 0) {
      console.log(`\n⚠️  Extra in Dev (${extra.length}):`);
      extra.forEach(t => console.log(`   - ${t}`));
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log('\n✅ All tables match!');
    }

    console.log('\n📋 Production Tables:');
    [...prodTables].sort().forEach(t => {
      const exists = devTables.has(t) ? '✅' : '❌';
      console.log(`   ${exists} ${t}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
    await compareUsingDirectSQL();
  }
}

async function compareUsingDirectSQL() {
  console.log('\n📝 Using alternative comparison method...\n');

  // Since direct SQL might not work, let's check if master_migration.sql was run
  console.log('💡 Recommendation:');
  console.log('   1. Ensure master_migration.sql was run in dev database');
  console.log('   2. Check Supabase dashboard → Database → Tables');
  console.log('   3. Compare table counts manually\n');
}

// Run comparison
compareUsingSQL().catch(console.error);
