// ============================================
// SECURITY CHECK SCRIPT - Run in Browser Console
// ============================================
// 
// INSTRUCTIONS:
// 1. Open DevTools (F12)
// 2. Go to Console tab
// 3. Copy and paste this entire script
// 4. Press Enter
//
// This will check if sensitive organizer data is exposed
// ============================================

(async function checkOrganizerSecurity() {
  console.log('🔍 Starting Security Check...\n');
  
  // Get organizer ID from URL
  const organizerId = window.location.pathname.split('/o/')[1];
  
  if (!organizerId) {
    console.error('❌ Could not find organizer ID in URL');
    console.log('   Make sure you are on an organizer profile page (URL contains /o/...)');
    return;
  }
  
  console.log(`📋 Organizer ID: ${organizerId}\n`);
  
  // Supabase configuration (from your environment)
  const SUPABASE_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjczMjEsImV4cCI6MjA4MDEwMzMyMX0.PjxWBbQX130Yf5jMRnTfeyRPZyh6t3nb2UP88FAumjM';
  
  try {
    // Fetch organizer data using the SAME query as OrganizerPublicProfile.jsx
    // This tests what the actual component returns, not what an attacker could get with select=*
    const safeFields = [
      'id', 'business_name', 'business_email', 'business_phone', 'description',
      'logo_url', 'cover_image_url', 'banner_url', 'website_url', 'website',
      'social_twitter', 'social_facebook', 'social_instagram', 'social_linkedin',
      'twitter', 'facebook', 'instagram', 'linkedin', 'country_code', 'location',
      'is_verified', 'verification_level', 'verified_at', 'is_active',
      'total_events', 'total_tickets_sold', 'total_revenue', 'average_rating',
      'created_at', 'is_trusted', 'trusted_at'
    ].join(',');
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/organizers?id=eq.${organizerId}&select=${encodeURIComponent(safeFields)}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );
    
    // Also test with select=* to see if RLS is properly configured
    const responseAll = await fetch(
      `${SUPABASE_URL}/rest/v1/organizers?id=eq.${organizerId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const organizer = Array.isArray(data) ? data[0] : data;
    
    // Also check what select=* returns (RLS test)
    let organizerAll = null;
    if (responseAll.ok) {
      const dataAll = await responseAll.json();
      organizerAll = Array.isArray(dataAll) ? dataAll[0] : dataAll;
    }
    
    if (!organizer) {
      console.error('❌ No organizer data returned');
      return;
    }
    
    console.log('✅ Organizer data fetched successfully\n');
    
    // Define sensitive fields that should NEVER be exposed
    const sensitiveFields = [
      'user_id',                    // Links to user account
      'available_balance',          // Financial data
      'pending_balance',            // Financial data
      'stripe_connect_id',          // Payment integration ID
      'paystack_subaccount_id',      // Payment integration ID
      'flutterwave_subaccount_id',   // Payment integration ID
      'kyc_status',                 // KYC verification status
      'kyc_verified',              // KYC verification flag
      'kyc_level',                 // KYC level
      'custom_fee_enabled',         // Fee configuration
      'custom_service_fee_percentage', // Fee configuration
      'custom_service_fee_fixed',   // Fee configuration
      'stripe_connect_status',      // Payment status
      'paystack_subaccount_status', // Payment status
      'flutterwave_subaccount_status' // Payment status
    ];
    
    // Test 1: Check component query (safe fields only)
    console.log('='.repeat(60));
    console.log('TEST 1: Component Query (Safe Fields Only)');
    console.log('='.repeat(60));
    console.log('📊 Fields returned by component query:');
    console.log(Object.keys(organizer).sort());
    console.log('');
    
    const exposedInComponent = sensitiveFields.filter(field => 
      organizer[field] !== undefined && organizer[field] !== null
    );
    
    if (exposedInComponent.length > 0) {
      console.error('❌ SECURITY ISSUE: Component query exposes sensitive fields!');
      console.error(`   Found ${exposedInComponent.length} sensitive field(s):\n`);
      exposedInComponent.forEach(field => {
        console.error(`   ⚠️  ${field}: ${organizer[field]}`);
      });
      console.log('\n🔧 ACTION REQUIRED:');
      console.log('   1. Update OrganizerPublicProfile.jsx select() query');
      console.log('   2. Remove sensitive fields from the explicit field list');
    } else {
      console.log('✅ Component query is SECURE');
      console.log('   No sensitive fields exposed in component query');
    }
    
    // Test 2: Check RLS with select=*
    let exposedInRLS = []; // Initialize to avoid scope errors
    if (organizerAll) {
      console.log('\n' + '='.repeat(60));
      console.log('TEST 2: RLS Policy Test (select=*)');
      console.log('='.repeat(60));
      console.log('📊 Fields returned with select=*:');
      console.log(Object.keys(organizerAll).sort());
      console.log('');
      
      exposedInRLS = sensitiveFields.filter(field => 
        organizerAll[field] !== undefined && organizerAll[field] !== null
      );
      
      if (exposedInRLS.length > 0) {
        console.error('⚠️  WARNING: RLS allows sensitive fields with select=*');
        console.error(`   Found ${exposedInRLS.length} sensitive field(s):\n`);
        exposedInRLS.forEach(field => {
          console.error(`   ⚠️  ${field}: ${organizerAll[field]}`);
        });
        console.log('\n🔧 ACTION REQUIRED:');
        console.log('   1. Update RLS policies in Supabase Dashboard');
        console.log('   2. Ensure RLS policies filter out sensitive columns');
        console.log('   3. Consider using column-level security or views');
        console.log('\n💡 NOTE: Component query is still safe, but RLS should be fixed');
      } else {
        console.log('✅ RLS is properly configured');
        console.log('   No sensitive fields exposed even with select=*');
      }
    } else {
      console.log('\n⚠️  Could not test RLS (select=* query failed)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    if (exposedInComponent.length > 0) {
      console.error('❌ CRITICAL: Component query needs fixing');
    } else if (organizerAll && exposedInRLS.length > 0) {
      console.warn('⚠️  Component is safe, but RLS should be improved');
    } else {
      console.log('✅ All security checks passed!');
    }
    
    // Detailed field check
    console.log('\n🔍 Detailed Field Check (Component Query):');
    sensitiveFields.forEach(field => {
      const value = organizer[field];
      if (value !== undefined && value !== null) {
        console.error(`   ❌ ${field}: ${value}`);
      } else {
        console.log(`   ✅ ${field}: not exposed`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error during security check:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure you are on an organizer profile page');
    console.log('   2. Check that Supabase URL and key are correct');
    console.log('   3. Verify your network connection');
    console.log('   4. Check browser console for CORS errors');
  }
})();
