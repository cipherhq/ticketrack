/**
 * Create Admin User in Dev Database
 * 
 * This script creates the admin user with organizer privileges
 * in the dev Supabase project.
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

// Dev database credentials
const SUPABASE_URL = envVars.VITE_SUPABASE_URL || 'https://bnkxgyzvqpdctghrgmkr.supabase.co';
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Admin user configuration
const ADMIN_USER = {
  email: 'bajideace@gmail.com',
  password: 'Admin123!', // You can change this after first login
  firstName: 'Babajide',
  lastName: 'Owosakin',
  phone: '+2348012345678',
  businessName: 'TickeTrack Admin',
};

async function createAdminUser() {
  console.log('\n🚀 Creating Admin User in Dev Database\n');
  console.log('='.repeat(50));
  console.log(`📧 Email: ${ADMIN_USER.email}`);
  console.log(`🔑 Password: ${ADMIN_USER.password}`);
  console.log('='.repeat(50));

  try {
    // Step 1: Create auth user
    console.log('\n📝 Step 1: Creating auth user...');
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_USER.email,
      password: ADMIN_USER.password,
      email_confirm: true, // Auto-confirm email
      phone: ADMIN_USER.phone,
      phone_confirm: true,
      user_metadata: {
        first_name: ADMIN_USER.firstName,
        last_name: ADMIN_USER.lastName,
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  User already exists, fetching existing user...');
        
        // Get existing user
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.users.find(u => u.email === ADMIN_USER.email);
        if (!existingUser) throw new Error('Could not find existing user');
        
        console.log(`✅ Found existing user: ${existingUser.id}`);
        return await setupUserProfile(existingUser.id);
      }
      throw authError;
    }

    console.log(`✅ Auth user created: ${authData.user.id}`);
    
    // Step 2: Create profile and organizer
    await setupUserProfile(authData.user.id);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

async function setupUserProfile(userId) {
  try {
    // Step 2: Create/update profile
    console.log('\n📝 Step 2: Creating profile...');
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        first_name: ADMIN_USER.firstName,
        last_name: ADMIN_USER.lastName,
        phone: ADMIN_USER.phone,
        is_admin: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile error:', profileError);
    } else {
      console.log('✅ Profile created/updated');
    }

    // Step 3: Create organizer record
    console.log('\n📝 Step 3: Creating organizer record...');
    
    const { data: existingOrg } = await supabase
      .from('organizers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingOrg) {
      console.log('✅ Organizer already exists');
    } else {
      const { error: orgError } = await supabase
        .from('organizers')
        .insert({
          user_id: userId,
          business_name: ADMIN_USER.businessName,
          email: ADMIN_USER.email,
          phone: ADMIN_USER.phone,
          is_verified: true,
          verification_status: 'verified',
          payout_preference: 'paystack',
          country: 'NG',
          currency: 'NGN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (orgError) {
        console.error('Organizer error:', orgError);
      } else {
        console.log('✅ Organizer record created');
      }
    }

    // Step 4: Add communication credits
    console.log('\n📝 Step 4: Adding communication credits...');
    
    const { data: orgData } = await supabase
      .from('organizers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (orgData) {
      const { error: creditsError } = await supabase
        .from('communication_credits')
        .upsert({
          organizer_id: orgData.id,
          total_credits: 10000,
          used_credits: 0,
          bonus_credits: 500,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organizer_id' });

      if (creditsError) {
        console.error('Credits error:', creditsError);
      } else {
        console.log('✅ Communication credits added (10,000 + 500 bonus)');
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 ADMIN USER SETUP COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${ADMIN_USER.email}`);
    console.log(`   Password: ${ADMIN_USER.password}`);
    console.log('\n💡 You can now login at http://localhost:5173/login');
    console.log('💡 Change your password after first login!\n');

  } catch (error) {
    console.error('\n❌ Setup error:', error.message);
    throw error;
  }
}

createAdminUser();
