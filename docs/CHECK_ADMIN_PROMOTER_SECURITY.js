// ============================================
// ADMIN & PROMOTER DATA SECURITY CHECK
// ============================================
// 
// INSTRUCTIONS:
// 1. Open DevTools (F12)
// 2. Go to Console tab
// 3. Copy and paste this entire script
// 4. Press Enter
//
// This will check if admin or promoter data is exposed publicly
// ============================================

(async function checkAdminPromoterSecurity() {
  console.log('🔍 Starting Admin & Promoter Security Check...\n');
  
  // Supabase configuration
  const SUPABASE_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjczMjEsImV4cCI6MjA4MDEwMzMyMX0.PjxWBbQX130Yf5jMRnTfeyRPZyh6t3nb2UP88FAumjM';
  
  const sensitiveAdminFields = [
    'is_admin',
    'admin_role',
    'admin_permissions',
    'super_admin',
    'role' // if role includes admin
  ];
  
  const sensitivePromoterFields = [
    'user_id',
    'commission_rate',
    'total_earnings',
    'available_balance',
    'pending_balance',
    'bank_account_details',
    'payment_methods'
  ];
  
  const sensitiveProfileFields = [
    'is_admin',
    'admin_role',
    'role',
    'phone',
    'address',
    'billing_address',
    'payment_methods',
    'kyc_status',
    'kyc_verified'
  ];
  
  try {
    console.log('='.repeat(60));
    console.log('TEST 1: Profiles Table (Public Access)');
    console.log('='.repeat(60));
    
    // Test 1: Try to access profiles without auth
    const profilesResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (profilesResponse.ok) {
      const profilesData = await profilesResponse.json();
      if (profilesData && profilesData.length > 0) {
        const profile = profilesData[0];
        const exposedAdminFields = sensitiveAdminFields.filter(f => 
          profile[f] !== undefined && profile[f] !== null
        );
        const exposedProfileFields = sensitiveProfileFields.filter(f => 
          profile[f] !== undefined && profile[f] !== null
        );
        
        if (exposedAdminFields.length > 0 || exposedProfileFields.length > 0) {
          console.error('❌ SECURITY ISSUE: Sensitive profile data exposed!');
          if (exposedAdminFields.length > 0) {
            console.error('   Admin fields exposed:', exposedAdminFields);
            exposedAdminFields.forEach(f => {
              console.error(`   ⚠️  ${f}: ${profile[f]}`);
            });
          }
          if (exposedProfileFields.length > 0) {
            console.error('   Sensitive profile fields exposed:', exposedProfileFields);
          }
        } else {
          console.log('✅ Profiles table: No sensitive admin/profile fields exposed');
        }
      } else {
        console.log('✅ Profiles table: RLS blocking access (good)');
      }
    } else {
      console.log(`✅ Profiles table: Access denied (${profilesResponse.status})`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Promoters Table (Public Access)');
    console.log('='.repeat(60));
    
    // Test 2: Try to access promoters without auth
    const promotersResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/promoters?select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (promotersResponse.ok) {
      const promotersData = await promotersResponse.json();
      if (promotersData && promotersData.length > 0) {
        const promoter = promotersData[0];
        const exposedPromoterFields = sensitivePromoterFields.filter(f => 
          promoter[f] !== undefined && promoter[f] !== null
        );
        
        if (exposedPromoterFields.length > 0) {
          console.error('❌ SECURITY ISSUE: Sensitive promoter data exposed!');
          console.error('   Exposed fields:', exposedPromoterFields);
          exposedPromoterFields.forEach(f => {
            console.error(`   ⚠️  ${f}: ${promoter[f]}`);
          });
        } else {
          console.log('✅ Promoters table: No sensitive fields exposed');
        }
      } else {
        console.log('✅ Promoters table: RLS blocking access (good)');
      }
    } else {
      console.log(`✅ Promoters table: Access denied (${promotersResponse.status})`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Admin Logs Table (Public Access)');
    console.log('='.repeat(60));
    
    // Test 3: Try to access admin_logs without auth
    const adminLogsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_logs?select=*&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (adminLogsResponse.ok) {
      const adminLogsData = await adminLogsResponse.json();
      if (adminLogsData && adminLogsData.length > 0) {
        console.error('❌ CRITICAL: Admin logs exposed publicly!');
        console.error('   Admin logs should NEVER be publicly accessible');
      } else {
        console.log('✅ Admin logs: RLS blocking access (good)');
      }
    } else {
      console.log(`✅ Admin logs: Access denied (${adminLogsResponse.status})`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ All tests completed');
    console.log('\n💡 Key Findings:');
    console.log('   - Admin data should only be accessible to authenticated admins');
    console.log('   - Promoter data should only be accessible to the promoter or their organizer');
    console.log('   - Admin logs should NEVER be publicly accessible');
    console.log('   - Profile data should respect RLS policies');
    
  } catch (error) {
    console.error('❌ Error during security check:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check that Supabase URL and key are correct');
    console.log('   2. Verify your network connection');
    console.log('   3. Check browser console for CORS errors');
  }
})();
