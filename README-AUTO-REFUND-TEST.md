# 🤖 Auto-Refund Test Bot

Automated testing bot for the auto-refund on cancellation feature.

## 📋 What It Tests

The bot simulates the complete flow:
1. ✅ Creates a recurring event
2. ✅ Creates a child event (future date)
3. ✅ Creates ticket types
4. ✅ Simulates ticket purchase (creates order + tickets)
5. ✅ Cancels the child event
6. ✅ Triggers auto-refund function
7. ✅ Verifies refunds were processed correctly

## 🚀 Quick Start

### Option 1: Node.js Script (Recommended - Faster)

```bash
npm run test:auto-refund
```

This runs a standalone Node.js script that:
- Directly interacts with Supabase
- Doesn't require the UI to be running
- Provides detailed console output
- Automatically cleans up test data

### Option 2: Playwright E2E Test

```bash
npm run test:auto-refund:e2e
```

This runs a Playwright test that:
- Tests the full UI flow
- Requires the dev server to be running
- More realistic user interaction

## 📝 Prerequisites

1. **Environment Variables**: Make sure you have `.env.local` or `.env` with:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Deploy Edge Function**: The `auto-refund-on-cancellation` function must be deployed:
   ```bash
   npx supabase functions deploy auto-refund-on-cancellation
   ```

3. **Payment Provider Config**: Make sure at least one payment provider (Paystack/Stripe/Flutterwave) is configured in your database.

## 🎯 What Gets Tested

### ✅ Success Criteria

The bot verifies:
- [ ] Refund request is created automatically
- [ ] Refund request status is "processed"
- [ ] Refund reference is stored
- [ ] Order status changes to "refunded"
- [ ] All tickets are marked as "cancelled" and "refunded"
- [ ] Refund amount matches order total

### 📊 Test Output

The bot provides colored console output:
- 🟢 **Green**: Success
- 🔴 **Red**: Error
- 🟡 **Yellow**: Warning
- 🔵 **Blue**: Info
- 🔷 **Cyan**: Step indicators

Example output:
```
🤖 AUTO-REFUND TEST BOT STARTING...

[1] Setting up test organizer...
  ✓ Using existing organizer

[2] Creating recurring event...
  ✓ Event created: abc123...

[3] Creating ticket types...
  ✓ Parent ticket type created

[4] Creating child event (future date)...
  ✓ Child event created: def456...
  ✓ Child ticket type created

[5] Simulating ticket purchase...
  ✓ Order created: xyz789
  ✓ Tickets created: 1

[6] Cancelling child event...
  ✓ Event cancelled

[7] Triggering auto-refund function...
  ✓ Refund function invoked
  📊 Result: { success: true, refundsProcessed: 1 }

[8] Verifying refund was processed...
  ✓ Refund request found: req123
  ✓ Status: processed
  ✓ Amount: NGN 5250
  ✓ Refund reference: REF-123456
  ✓ Order marked as refunded
  ✓ Ticket abc123 refunded

✅ VERIFICATION COMPLETE!

🎉 ALL TESTS PASSED!
```

## 🧹 Cleanup

The bot automatically cleans up all test data:
- Test tickets
- Test orders
- Test refund requests
- Test events
- Test ticket types

If the test fails, you may need to manually clean up. Check the console output for IDs.

## 🐛 Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY not found"
- Make sure `.env.local` or `.env` exists with the service role key
- The service role key is different from the anon key

### Error: "Function not found"
- Deploy the Edge Function: `npx supabase functions deploy auto-refund-on-cancellation`
- Check function name matches exactly

### Error: "Refund not processed"
- Check payment provider configuration in database
- Verify `payment_gateway_config` table has active providers
- Check Edge Function logs in Supabase dashboard

### Refund Status is "processing" instead of "processed"
- This is normal for some payment providers
- The refund may take time to process
- Check payment provider dashboard for actual status

## 📁 Files

- `scripts/test-auto-refund-bot.js` - Standalone Node.js test bot
- `tests/auto-refund-cancellation.spec.cjs` - Playwright E2E test
- `test-auto-refund.md` - Manual testing guide

## 🔄 Running Multiple Times

The bot is safe to run multiple times:
- Uses unique test data (timestamps in slugs)
- Cleans up after itself
- Won't interfere with existing data

## 💡 Tips

1. **Run in Test Environment**: Use a test/staging Supabase project
2. **Check Logs**: Monitor Supabase Edge Function logs during test
3. **Verify Payments**: Check your payment provider dashboard for actual refunds
4. **Test Different Providers**: Modify the script to test Paystack, Stripe, Flutterwave separately

## 🎓 Next Steps

After successful test:
1. ✅ Deploy to production
2. ✅ Test with real (small) payments
3. ✅ Monitor refund processing times
4. ✅ Set up alerts for failed refunds

---

**Happy Testing! 🚀**
