# Testing Auto-Refund on Cancellation

## 🚀 Deployment Instructions

### Option 1: Deploy via Supabase CLI (Recommended)
```bash
# Make sure you're logged in
npx supabase login

# Deploy the function
npx supabase functions deploy auto-refund-on-cancellation

# Or if you're using a linked project
npx supabase functions deploy auto-refund-on-cancellation --project-ref YOUR_PROJECT_REF
```

### Option 2: Deploy via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click **Create a new function** (or find existing)
4. Upload the `supabase/functions/auto-refund-on-cancellation/index.ts` file
5. Name it `auto-refund-on-cancellation`
6. Deploy

---

## 🧪 Testing Steps

### **Test 1: Cancel a Single Child Event**

1. **Create a test recurring event** (or use existing):
   - Go to `/organizer/create-event`
   - Create a recurring event with at least one future date
   - Make it paid (not free)

2. **Purchase a ticket** for a future date:
   - Navigate to the event details page
   - Select a future date
   - Purchase at least 1 ticket
   - Complete payment (use test payment method)

3. **Verify order created**:
   - Go to `/organizer/orders`
   - Confirm order shows with status "completed"
   - Note the order number

4. **Cancel the child event**:
   - Go to `/organizer/events`
   - Find your recurring event
   - Expand the series (click chevron)
   - Find the specific date you purchased
   - Click the menu (⋮) on that child event
   - Click "Cancel This Date"
   - Confirm the cancellation

5. **Check results**:
   - **Orders page**: Order status should change to "refunded"
   - **Tickets**: Ticket status should be "cancelled" and "refunded"
   - **Refund Requests**: Should see a refund request with status "processed"
   - **Email**: Attendee should receive cancellation + refund email

---

### **Test 2: Cancel Entire Series**

1. **Create/purchase tickets for multiple dates** in a recurring series

2. **Cancel the entire series**:
   - Go to `/organizer/events`
   - Find the recurring event (parent)
   - Click "Cancel Series" button
   - Confirm cancellation

3. **Check results**:
   - **All child events** should be marked as "cancelled"
   - **All orders** for all dates should be "refunded"
   - **All tickets** should be "cancelled" and "refunded"
   - **Refund requests** created for all orders

---

## 🔍 What to Check

### ✅ Success Indicators:
- [ ] Event status changes to "cancelled"
- [ ] Refund requests created automatically (status: "approved" → "processed")
- [ ] Order status changes to "refunded"
- [ ] All tickets for that order marked as "cancelled" and "refunded"
- [ ] Refund reference number stored in refund_request
- [ ] Email sent to attendee (check logs or attendee's inbox)

### ⚠️ Common Issues:

1. **Function not deployed**: Check Supabase Edge Functions dashboard
2. **No tickets found**: Make sure tickets are from "completed" orders with payment_provider set
3. **Refund fails**: Check payment provider configuration (Paystack/Stripe keys)
4. **Email not sent**: Check if `send-email` function exists and is working

---

## 🐛 Debugging

### Check Function Logs:
```bash
npx supabase functions logs auto-refund-on-cancellation
```

### Manual Function Invocation (Testing):
```javascript
// In browser console (on organizer page)
const testEventId = "YOUR_EVENT_ID"; // Replace with actual event ID
const organizerId = "YOUR_ORGANIZER_ID"; // Replace with actual organizer ID

const { data, error } = await supabase.functions.invoke('auto-refund-on-cancellation', {
  body: {
    eventId: testEventId,
    reason: 'Test cancellation',
    organizerId: organizerId
  }
});

console.log('Result:', data);
console.log('Error:', error);
```

### Check Database:
```sql
-- Check refund requests created
SELECT * FROM refund_requests 
WHERE event_id = 'YOUR_EVENT_ID' 
ORDER BY created_at DESC;

-- Check order status
SELECT id, order_number, status, notes 
FROM orders 
WHERE event_id = 'YOUR_EVENT_ID';

-- Check ticket status
SELECT id, ticket_code, status, payment_status, refunded_at 
FROM tickets 
WHERE event_id = 'YOUR_EVENT_ID';
```

---

## 📝 Test Checklist

- [ ] Function deployed successfully
- [ ] Test event created with tickets purchased
- [ ] Single child event cancellation works
- [ ] Full series cancellation works
- [ ] Refunds processed correctly (check payment provider dashboard)
- [ ] Tickets updated correctly
- [ ] Orders updated correctly
- [ ] Emails sent to attendees
- [ ] No errors in function logs

---

## 🎯 Expected Behavior

When an event is cancelled:

1. ✅ Event marked as "cancelled"
2. ✅ All completed tickets found for that event
3. ✅ Refund requests created automatically (one per order)
4. ✅ Refunds processed via payment provider
5. ✅ All tickets updated to "cancelled" + "refunded"
6. ✅ Order status updated to "refunded"
7. ✅ Cancellation + refund email sent to attendee
8. ✅ Refund reference stored for tracking

---

**Note**: For production, test with small amounts first and verify refunds appear in your payment provider dashboard!
