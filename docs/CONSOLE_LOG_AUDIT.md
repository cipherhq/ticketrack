# Console.log Security Audit

This document tracks console.log statements that may expose sensitive data in production.

## ✅ Safe Console.logs (No Action Needed)

These logs are safe for production:
- Error messages without sensitive data
- User actions (e.g., "User logged in")
- Non-sensitive status updates
- Debug messages that don't contain secrets

## ⚠️  Needs Review

### Frontend (`src/`)

1. **`src/pages/WebCheckout.jsx`**
   - Line 74: `console.log('Promoter credited:', { promoter_id: promoter.id, commission: commissionAmount })`
     - ✅ Safe - IDs and amounts are not sensitive
   - Line 255: `console.log('Affiliate commission recorded:', commissionAmount, currency)`
     - ✅ Safe - Amounts are not sensitive
   - Line 731: `console.log('Creating tickets:', ticketsToCreate)`
     - ⚠️  Review - May contain user email/phone if in ticket data
   - Line 822: `console.log("DEBUG PDF:", { ticketCount, tickets, ... })`
     - ⚠️  Review - May contain sensitive ticket data (codes, emails)

2. **`src/pages/WebEventDetails.jsx`**
   - Line 419: `console.log('Affiliate code stored:', affCode)`
     - ✅ Safe - Affiliate codes are not sensitive

### Backend (`supabase/functions/`)

1. **`auto-refund-on-cancellation/index.ts`**
   - Line 142: `console.log(`Test order detected (${order.payment_reference}), skipping gateway refund`)`
     - ⚠️  Consider masking - Payment references could be considered sensitive

2. **`send-otp/index.ts`**
   - Line 78: `console.log('Twilio Verify response:', JSON.stringify(data))`
     - ⚠️  Consider masking - API responses may contain sensitive data
   - Line 114: `console.log('Termii response:', JSON.stringify(data))`
     - ⚠️  Consider masking - API responses may contain sensitive data

## 🔒 Recommended Actions

1. **Mask sensitive data in logs:**
   ```javascript
   // Instead of:
   console.log('Payment reference:', paymentRef);
   
   // Use:
   console.log('Payment reference:', maskPaymentRef(paymentRef));
   ```

2. **Use environment-based logging:**
   ```javascript
   const isDev = import.meta.env.DEV;
   if (isDev) {
     console.log('Debug info:', data);
   }
   ```

3. **Remove or comment out DEBUG logs in production:**
   - Line 822 in `WebCheckout.jsx`: "DEBUG PDF" log should be removed or gated

4. **Use structured logging:**
   - Consider replacing `console.log` with a logging utility that:
     - Automatically masks sensitive fields
     - Only logs in development
     - Sends logs to error tracking service in production

## 📝 Notes

- All `console.error` statements are safe - they're for error tracking
- Payment amounts and IDs are not considered sensitive
- API keys, passwords, tokens, and full payment references should be masked
- User emails/phones in ticket data should be masked in production logs
