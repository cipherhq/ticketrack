#!/usr/bin/env node
/**
 * Manual Security Testing Helper Scripts
 * 
 * Copy and paste these scripts into your browser console to test security manually
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Manual Security Testing Helper Scripts                  ║
║        Copy these into your browser console                    ║
╚════════════════════════════════════════════════════════════════╝
`);

// ============================================================================
// 1. TEST RATE LIMITING
// ============================================================================
const testRateLimiting = `
// Test Rate Limiting
async function testRateLimit() {
  console.log('🚀 Testing rate limiting...');
  const SUPABASE_URL = '${process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'}';
  const ANON_KEY = '${process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'}';
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(\`\${SUPABASE_URL}/rest/v1/events?select=id&limit=1\`, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': \`Bearer \${ANON_KEY}\`
        }
      });
      
      results.push({
        request: i + 1,
        status: res.status,
        statusText: res.statusText,
        time: Date.now() - startTime
      });
      
      if (res.status === 429) {
        console.log(\`⚠️  Rate limited at request #\${i + 1}\`);
        break;
      }
    } catch (e) {
      results.push({ request: i + 1, error: e.message });
    }
  }
  
  const rateLimited = results.filter(r => r.status === 429).length;
  const successful = results.filter(r => r.status === 200).length;
  
  console.log(\`✅ Successful: \${successful}\`);
  console.log(\`⚠️  Rate Limited: \${rateLimited}\`);
  console.table(results);
  
  if (rateLimited === 0) {
    console.warn('⚠️  No rate limiting detected - check Supabase settings');
  } else {
    console.log('✅ Rate limiting is active');
  }
}

// Run: testRateLimit();
`;

// ============================================================================
// 2. TEST USER DATA ISOLATION
// ============================================================================
const testUserIsolation = `
// Test User Data Isolation
async function testUserIsolation() {
  console.log('🔍 Testing user data isolation...');
  
  // Replace with another user's ID (if you have access to test data)
  const otherUserId = 'ANOTHER_USER_ID_HERE';
  const otherOrganizerId = 'ANOTHER_ORGANIZER_ID_HERE';
  
  const tests = [];
  
  // Test 1: Try to access another user's tickets
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', otherUserId)
    .limit(5);
  
  tests.push({
    test: 'Access other user tickets',
    canAccess: tickets && tickets.length > 0,
    error: ticketsError?.message,
    status: tickets && tickets.length > 0 ? '❌ FAIL' : '✅ PASS'
  });
  
  // Test 2: Try to access another organizer's data
  const { data: organizer, error: orgError } = await supabase
    .from('organizers')
    .select('*')
    .eq('id', otherOrganizerId)
    .single();
  
  tests.push({
    test: 'Access other organizer data',
    canAccess: !!organizer,
    error: orgError?.message,
    status: organizer ? '❌ FAIL' : '✅ PASS'
  });
  
  // Test 3: Try to access another user's orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', otherUserId)
    .limit(5);
  
  tests.push({
    test: 'Access other user orders',
    canAccess: orders && orders.length > 0,
    error: ordersError?.message,
    status: orders && orders.length > 0 ? '❌ FAIL' : '✅ PASS'
  });
  
  console.table(tests);
  
  const failures = tests.filter(t => t.canAccess);
  if (failures.length > 0) {
    console.error('❌ SECURITY ISSUE: User isolation not working!');
    failures.forEach(f => console.error(\`  - \${f.test}\`));
  } else {
    console.log('✅ User isolation working correctly');
  }
}

// Run: testUserIsolation();
`;

// ============================================================================
// 3. TEST SENSITIVE DATA EXPOSURE
// ============================================================================
const testSensitiveData = `
// Test Sensitive Data Exposure
async function testSensitiveData() {
  console.log('🔍 Testing for sensitive data exposure...');
  
  // Test public organizer profile
  const { data: organizer, error } = await supabase
    .from('organizers')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();
  
  if (organizer) {
    const sensitiveFields = [
      'user_id',
      'available_balance',
      'pending_balance',
      'stripe_connect_id',
      'paystack_subaccount_id',
      'flutterwave_subaccount_id',
      'kyc_status',
      'kyc_verified'
    ];
    
    const exposedFields = sensitiveFields.filter(field => 
      organizer[field] !== undefined && organizer[field] !== null
    );
    
    if (exposedFields.length > 0) {
      console.error('❌ SECURITY ISSUE: Sensitive fields exposed!');
      console.error('Exposed fields:', exposedFields);
      console.error('Values:', exposedFields.map(f => ({ field: f, value: organizer[f] })));
    } else {
      console.log('✅ No sensitive fields exposed');
    }
  }
}

// Run: testSensitiveData();
`;

// ============================================================================
// 4. TEST XSS IN RENDERED CONTENT
// ============================================================================
const testXSSRendering = `
// Test XSS in Rendered Content
function testXSSRendering() {
  console.log('🔍 Testing XSS in rendered content...');
  
  // Check if DOMPurify or similar is loaded
  if (typeof DOMPurify !== 'undefined') {
    console.log('✅ DOMPurify is loaded');
  } else {
    console.warn('⚠️  DOMPurify not found - check if HTML sanitization is active');
  }
  
  // Check event descriptions for script tags
  const descriptions = document.querySelectorAll('[data-event-description], .event-description');
  descriptions.forEach((desc, i) => {
    const hasScript = desc.innerHTML.includes('<script>');
    const hasOnError = desc.innerHTML.includes('onerror=');
    const hasJavascript = desc.innerHTML.includes('javascript:');
    
    if (hasScript || hasOnError || hasJavascript) {
      console.error(\`❌ Potential XSS in description #\${i + 1}\`);
      console.error('Content:', desc.innerHTML.substring(0, 100));
    }
  });
  
  console.log('✅ XSS rendering test complete');
}

// Run: testXSSRendering();
`;

// ============================================================================
// 5. TEST FILE UPLOAD VALIDATION
// ============================================================================
const testFileUpload = `
// Test File Upload Validation (Run in browser console on create event page)
function testFileUpload() {
  console.log('🔍 Testing file upload validation...');
  
  // Create test files with different extensions
  const testFiles = [
    { name: 'test.jpg', type: 'image/jpeg', size: 1024 * 100 }, // 100 KB - should work
    { name: 'test.exe', type: 'application/x-msdownload', size: 1024 * 100 }, // Should be blocked
    { name: 'test.php', type: 'application/x-php', size: 1024 * 100 }, // Should be blocked
    { name: 'test.js', type: 'application/javascript', size: 1024 * 100 }, // Should be blocked
    { name: 'large.jpg', type: 'image/jpeg', size: 1024 * 1024 * 10 }, // 10 MB - check size limit
  ];
  
  testFiles.forEach(file => {
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const dataTransfer = new DataTransfer();
      const blob = new Blob(['test'], { type: file.type });
      const testFile = new File([blob], file.name, { type: file.type });
      dataTransfer.items.add(testFile);
      fileInput.files = dataTransfer.files;
      
      const event = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(event);
      
      console.log(\`Testing: \${file.name} (\${file.type}, \${(file.size / 1024).toFixed(0)} KB)\`);
      // Check if file was accepted or rejected
      setTimeout(() => {
        if (fileInput.files.length > 0) {
          console.log(\`  ✅ Accepted: \${file.name}\`);
        } else {
          console.log(\`  ❌ Rejected: \${file.name}\`);
        }
      }, 100);
    }
  });
}

// Run: testFileUpload();
`;

// ============================================================================
// OUTPUT ALL SCRIPTS
// ============================================================================
console.log(`
${'='.repeat(60)}
1. RATE LIMITING TEST
${'='.repeat(60)}
${testRateLimiting}

${'='.repeat(60)}
2. USER DATA ISOLATION TEST
${'='.repeat(60)}
${testUserIsolation}

${'='.repeat(60)}
3. SENSITIVE DATA EXPOSURE TEST
${'='.repeat(60)}
${testSensitiveData}

${'='.repeat(60)}
4. XSS RENDERING TEST
${'='.repeat(60)}
${testXSSRendering}

${'='.repeat(60)}
5. FILE UPLOAD VALIDATION TEST
${'='.repeat(60)}
${testFileUpload}

${'='.repeat(60)}
USAGE INSTRUCTIONS
${'='.repeat(60)}
1. Open your application in a browser
2. Open Browser DevTools (F12)
3. Go to Console tab
4. Copy and paste the script you want to test
5. Run the function (e.g., testRateLimit())
6. Review the results

For detailed manual testing instructions, see:
docs/MANUAL_SECURITY_TESTING.md
`);
