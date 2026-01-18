# Security Testing Bot

This document describes the security testing bot that performs automated security testing on the Ticketrack application.

## Overview

The security testing bot (`scripts/security-test-bot.js`) performs legitimate security testing to identify common vulnerabilities and security issues. It tests various attack vectors to ensure the application is properly protected.

## ⚠️ Important Notice

**This bot is for testing YOUR OWN application only.**
- Do NOT use this on applications you don't own
- Do NOT use this on applications without explicit permission
- Unauthorized security testing may be illegal in your jurisdiction

## Security Tests Performed

### 1. SQL Injection Testing
Tests if SQL injection attacks are properly blocked:
- `' OR '1'='1` (classic SQL injection)
- `'; DROP TABLE users; --` (destructive SQL)
- `' UNION SELECT * FROM users --` (data extraction)
- Authentication bypass attempts

### 2. XSS (Cross-Site Scripting) Testing
Tests if XSS attacks are properly sanitized:
- `<script>alert("XSS")</script>` (script injection)
- `<img src=x onerror=alert("XSS")>` (event handler XSS)
- `javascript:alert("XSS")` (protocol handler XSS)

### 3. Authentication Security
Tests authentication mechanisms:
- Row Level Security (RLS) enforcement
- Invalid credentials rejection
- SQL injection in authentication fields
- Unauthorized access prevention

### 4. Input Validation
Tests input validation:
- Extremely long input strings (10,000+ characters)
- Special characters and symbols
- Malformed data

### 5. CSRF (Cross-Site Request Forgery)
Checks CSRF protection mechanisms (relies on Supabase auth tokens)

### 6. Rate Limiting
Tests if rate limiting is active by making multiple rapid requests

### 7. Authorization (Access Control)
Checks user data isolation (requires manual testing)

### 8. Data Exposure
Tests if sensitive data is exposed in error messages

### 9. File Upload Security
Warns about file upload security (requires manual testing)

### 10. API Security
Tests if sensitive API endpoints require authentication

## Usage

### Prerequisites

1. **Environment Variables**: Ensure your `.env.local` or `.env` file contains:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Node.js**: Requires Node.js 14+ with ES modules support

### Running the Bot

```bash
npm run test:security
```

Or directly:

```bash
node scripts/security-test-bot.js
```

### Output

The bot will output:
- ✅ **PASS**: Security test passed (vulnerability properly protected)
- ❌ **FAIL**: Security test failed (vulnerability found - **FIX IMMEDIATELY**)
- ⚠️ **WARN**: Manual review recommended (test cannot be automated or requires manual verification)

### Example Output

```
🚀 Starting Security Testing Bot for Ticketrack...

🔍 Testing SQL Injection...
✅ [PASS] SQL Injection (title: ' OR '1'='1...): SQL error properly caught
✅ [PASS] SQL Injection (title: '; DROP TABLE...): SQL error properly caught

🔍 Testing XSS (Cross-Site Scripting)...
✅ [PASS] XSS (description: <script>alert(...): Query blocked or sanitized

🔍 Testing Authentication Security...
✅ [PASS] Authentication: RLS Active: Row Level Security blocks unauthorized access
✅ [PASS] Authentication: Invalid Credentials: Invalid login properly rejected

============================================================
📊 SECURITY TEST SUMMARY
============================================================
✅ Passed: 15
❌ Failed: 2
⚠️  Warnings: 8
⏱️  Duration: 12.34s
============================================================

❌ FAILED TESTS:
  - API Security: Sensitive Endpoints: Sensitive payment config exposed without auth!
  - Authentication: Invalid Credentials: Invalid credentials accepted!

⚠️  WARNINGS (Manual Review Recommended):
  - File Upload: Type Validation: Manual test required: Try uploading .exe, .php, .js files
  - Rate Limiting: API Protection: No rate limiting detected - check Supabase settings

💡 Next Steps:
   1. Review failed tests and fix security issues
   2. Investigate warnings - may require manual testing
   3. Run additional manual security tests
   4. Consider professional security audit for production
```

## Interpreting Results

### ✅ Passed Tests
These tests indicate that the security mechanism is working correctly. No action needed.

### ❌ Failed Tests
**CRITICAL**: These indicate actual security vulnerabilities that need immediate attention:
1. Fix the security issue immediately
2. Re-run the test to verify the fix
3. Consider a security audit if multiple failures occur

### ⚠️ Warnings
These indicate areas that require manual testing or cannot be fully automated:
- Some tests require manual verification (e.g., file upload testing)
- Some tests depend on external services (e.g., rate limiting)
- Review these areas manually and add additional tests if needed

## Common Security Issues Found

### 1. SQL Injection
**Symptom**: Failed SQL Injection test
**Fix**: Ensure all database queries use parameterized queries or ORM methods (Supabase handles this automatically)

### 2. XSS (Cross-Site Scripting)
**Symptom**: Failed XSS test
**Fix**: Sanitize user input before rendering. Use libraries like `DOMPurify` for HTML content

### 3. Authentication Bypass
**Symptom**: Failed Authentication test
**Fix**: Ensure Row Level Security (RLS) is enabled on all sensitive tables in Supabase

### 4. Data Exposure
**Symptom**: Failed Data Exposure test
**Fix**: Remove sensitive field names from error messages. Return generic error messages

### 5. Missing Rate Limiting
**Symptom**: Warning about rate limiting
**Fix**: Enable rate limiting in Supabase or add middleware to limit requests

## Best Practices

1. **Run Regularly**: Run security tests before each production deployment
2. **Fix Immediately**: Address all failed tests before deploying
3. **Review Warnings**: Investigate warnings and add manual tests where needed
4. **Keep Updated**: Update the security test bot as new vulnerabilities are discovered
5. **Professional Audit**: Consider a professional security audit for production applications

## Limitations

The security testing bot:
- Cannot test all possible attack vectors (manual testing required for some)
- Does not test frontend XSS rendering (requires browser testing)
- Cannot test CSRF tokens without browser automation
- Relies on Supabase's security mechanisms (cannot test database-level exploits)
- Some tests may produce false positives (requires manual verification)

## Additional Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [React Security Best Practices](https://react.dev/learn/escape-hatches)

## Support

If you find a security vulnerability:
1. **DO NOT** create a public issue
2. Contact the security team directly
3. Follow responsible disclosure practices

---

## Manual Testing

For areas that require manual verification, see the [Manual Security Testing Guide](./MANUAL_SECURITY_TESTING.md).

---

**Remember**: Security is an ongoing process. Regular testing and updates are essential for maintaining a secure application.
