# Comprehensive Test Bot Documentation

## Overview

The Comprehensive Test Bot is an automated testing script that validates all major functionality of the Ticketrack platform. It creates test data, simulates user flows, and verifies that core features work correctly.

## Features Tested

### 1. Account Management
- ✅ User account creation
- ✅ Organizer account creation
- ✅ Profile creation and validation

### 2. Event Management
- ✅ Single event creation
- ✅ Recurring event creation
- ✅ Free event creation
- ✅ Event fields and metadata

### 3. Ticket Management
- ✅ Ticket type creation
- ✅ Multiple ticket tiers (General, VIP)
- ✅ Ticket availability tracking

### 4. Order Processing
- ✅ Order creation
- ✅ Order items creation
- ✅ Fee calculation (platform fees)
- ✅ Order status management

### 5. Ticket Generation
- ✅ Ticket creation from orders
- ✅ Ticket codes and QR codes
- ✅ Ticket type association
- ✅ Quantity tracking

### 6. Promo Codes
- ✅ Promo code creation
- ✅ Discount configuration
- ✅ Usage limits

### 7. Waitlists
- ✅ Waitlist entry creation
- ✅ User-event association

### 8. Financial Calculations
- ✅ Payout calculations
- ✅ Net amount calculation (subtotal)
- ✅ Platform fee aggregation
- ✅ Multi-order support

### 9. Custom Fields
- ✅ Custom field creation
- ✅ Field types (text, dropdown)
- ✅ Required field configuration

### 10. Refunds
- ✅ Refund request creation
- ✅ Order-ticket association
- ✅ Refund status tracking

## Usage

### Prerequisites

1. **Environment Variables**: Ensure you have the following in your `.env.local` or `.env` file:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Node.js**: Requires Node.js 18+ with ES module support

### Running the Bot

```bash
# Run via npm script
npm run test:comprehensive

# Or run directly
node scripts/comprehensive-test-bot.js
```

### Output

The bot provides detailed output for each test:
- ✅ **PASS**: Test completed successfully
- ❌ **FAIL**: Test failed with error message
- ⚠️ **WARN**: Test skipped or non-critical issue

At the end, a summary is displayed:
```
📊 Test Summary

✅ Passed: 12
❌ Failed: 0
⚠️  Warnings: 1
```

## Test Flow

The bot runs tests in the following sequence:

1. **Create User Account** → Gets `userId`
2. **Create Organizer Account** → Gets `organizerId`
3. **Create Single Event** → Gets `eventId`
4. **Create Recurring Event** → Validates recurring logic
5. **Create Ticket Types** → Gets `ticketTypes[]`
6. **Create Order** → Simulates ticket purchase
7. **Create Tickets** → Generates tickets from order
8. **Create Promo Code** → Tests discount functionality
9. **Create Waitlist Entry** → Tests waitlist system
10. **Test Payout Calculation** → Validates financial logic
11. **Create Free Event** → Tests free event flow
12. **Create Custom Fields** → Tests event customization
13. **Test Refund Flow** → Validates refund requests

## Test Data

All test data is automatically generated with unique identifiers:
- **Emails**: `test-{timestamp}-{random}@testbot.ticketrack.com`
- **Names**: `{prefix} {timestamp-based-id}`
- **Order Numbers**: `TEST-ORD-{timestamp}`
- **Payment References**: `TEST-PAY-{timestamp}`
- **Ticket Codes**: `TEST-TKT-{timestamp}-{index}`

## Cleanup

⚠️ **Note**: The bot creates real data in your database. Test data includes:
- User accounts (profiles)
- Organizer accounts
- Events (published)
- Orders (completed)
- Tickets (active)
- Promo codes
- Waitlist entries
- Refund requests

Consider implementing cleanup logic or running in a test/staging environment.

## Customization

### Adding New Tests

To add a new test, create a function following this pattern:

```javascript
async function testYourNewFeature(dependencies) {
  try {
    // Your test logic here
    logTest('Test Your New Feature', 'PASS', 'Success message');
    return result;
  } catch (error) {
    logTest('Test Your New Feature', 'FAIL', error.message);
    return null;
  }
}
```

Then add it to the `runAllTests()` function:

```javascript
// Test X: Your New Feature
console.log('\n🎯 Test X: Your New Feature');
await testYourNewFeature(dependencies);
await delay(500);
```

### Modifying Test Data

You can customize test data by modifying the generator functions:
- `generateTestEmail()` - Email generation
- `generateTestName(prefix)` - Name generation

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   ❌ Missing required environment variables:
      - VITE_SUPABASE_URL or SUPABASE_URL
      - SUPABASE_SERVICE_ROLE_KEY
   ```
   **Solution**: Check your `.env.local` or `.env` file

2. **RLS Policy Errors**
   ```
   ❌ [FAIL] Create User Account: RLS policy violation
   ```
   **Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is the service role key (not anon key)

3. **Foreign Key Constraints**
   ```
   ❌ [FAIL] Create Order: Foreign key violation
   ```
   **Solution**: Ensure dependencies (user, event, ticket types) exist

4. **Database Connection Issues**
   ```
   ❌ [FAIL] Connection timeout
   ```
   **Solution**: Check Supabase URL and network connectivity

## Integration with CI/CD

You can integrate this bot into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Comprehensive Tests
  run: npm run test:comprehensive
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## Best Practices

1. **Run in Staging**: Always run in a test/staging environment first
2. **Review Output**: Check the test summary for any failures
3. **Clean Test Data**: Implement cleanup after tests complete
4. **Monitor Performance**: Track how long tests take to run
5. **Update Tests**: Keep tests updated as features evolve

## Related Documentation

- [Auto-Refund Test Bot](./AUTO_REFUND_TEST_BOT.md)
- [Security Test Bot](./SECURITY_TESTING.md)
- [Payment & Payout Audit](./PAYMENT_PAYOUT_AUDIT.md)
