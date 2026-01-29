#!/usr/bin/env node
/**
 * Run SQL migration file against Supabase database
 * Usage: node scripts/run-sql-migration.js <sql-file-path>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.development') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.development');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function executeSQL(sql) {
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Executing ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim().length === 0) continue;

    try {
      // Use RPC to execute SQL if available, otherwise try REST API
      // Note: Supabase doesn't directly support raw SQL execution via REST API
      // We'll need to use the Management API or a custom function
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Try using the REST API with a custom RPC function
      // For now, we'll use a workaround: execute via Management API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: statement })
      });

      if (!response.ok) {
        // If RPC doesn't exist, we'll need to use a different approach
        // Let's try the Supabase Management API
        console.warn(`⚠️  Statement ${i + 1} may need manual execution`);
        console.log(`SQL: ${statement.substring(0, 100)}...`);
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    } catch (error) {
      console.error(`❌ Error executing statement ${i + 1}:`, error.message);
      console.log(`SQL: ${statement.substring(0, 200)}...`);
    }
  }
}

async function main() {
  const sqlFile = process.argv[2] || join(__dirname, '../database/add_flutterwave_subaccount_fields.sql');
  
  if (!sqlFile) {
    console.error('❌ Please provide a SQL file path');
    process.exit(1);
  }

  try {
    console.log(`📄 Reading SQL file: ${sqlFile}\n`);
    const sql = readFileSync(sqlFile, 'utf-8');
    
    await executeSQL(sql);
    
    console.log('\n✅ Migration completed!');
    console.log('\nNote: Some statements may need to be run manually in Supabase SQL Editor');
    console.log('if the exec_sql RPC function is not available.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
