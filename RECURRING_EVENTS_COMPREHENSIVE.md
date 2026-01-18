# Recurring Events - Comprehensive Implementation & Considerations

## ✅ **FULLY IMPLEMENTED**

### 1. **Ticket Inventory Separation**
- ✅ Each child event has separate ticket types with its own `quantity_available` and `quantity_sold`
- ✅ Future purchases check child event's inventory, not parent's
- ✅ Ticket availability validation uses child event's ticket type IDs

### 2. **Payout Escrow System**
- ✅ Money held until child event's `end_date` passes
- ✅ Payouts calculated per child event date (separate from parent)
- ✅ Organizer sees "In Escrow" for future dates, "Available" for past dates

### 3. **Order & Ticket Tracking**
- ✅ Orders linked to child event ID (not parent)
- ✅ Orders page shows actual purchased event date
- ✅ Tickets created with child event ID
- ✅ Check-in works per date (already using child event_id)

### 4. **Event Creation & Display**
- ✅ Child events created on-the-fly when future date is purchased
- ✅ Each child event has unique slug: `parent-slug-YYYY-MM-DD`
- ✅ Browse/Search shows parent events only (with "Series" badge)
- ✅ Parent event page shows all dates (grid/calendar view)

### 5. **Cancellation Logic**
- ✅ `cancelSeries()` - Cancels parent + all child events
- ✅ `cancelSingleChildEvent()` - Cancels individual child event date
- ✅ Organizer can cancel entire series or specific dates

### 6. **Refund Eligibility**
- ✅ Uses `ticket.event_id` which is child event ID
- ✅ Refund deadline calculated from child event's `start_date` (correct!)

---

## ⚠️ **NEEDS IMPLEMENTATION/ENHANCEMENT**

### 1. **Auto-Refunds on Cancellation** ✅ **IMPLEMENTED**
**Status**: ✅ Fully implemented and ready for deployment
**Implementation**: 
- Created `auto-refund-on-cancellation` Edge Function
- Updated `cancelSeries()` to trigger auto-refunds for parent + all child events
- Updated `cancelSingleChildEvent()` to trigger auto-refunds for that specific date
- Added Flutterwave refund support to `process-refund` function
- Automatically creates refund requests, processes refunds, updates tickets/orders, and sends emails

**How It Works**:
1. When event is cancelled, `auto-refund-on-cancellation` function is invoked
2. Finds all completed tickets for that event (or all child events if parent cancelled)
3. Groups tickets by order to avoid duplicate refund processing
4. Creates refund request per order (using first ticket, refunding full order amount)
5. Processes refund via payment provider (Paystack/Stripe/PayPal/Flutterwave)
6. Updates all tickets for that order to "cancelled" and "refunded"
7. Updates order status to "refunded"
8. Sends cancellation + refund email to attendee (once per order)

**Next Step**: Deploy the Edge Function with `npx supabase functions deploy auto-refund-on-cancellation`

---

### 2. **Promo Codes for Recurring Events** ✅ **IMPLEMENTED**
**Status**: ✅ Parent event promo codes now apply to all child events
**Implementation**: 
- Updated `applyPromoCode()` in `WebCheckout.jsx`
- Checks `promo.event_id === event.parent_event_id` for child events
- Usage count is shared across all dates (same promo code record)

---

### 3. **Waitlist Strategy** ✅ **IMPLEMENTED**
**Status**: ✅ Separate waitlist per child event (per date)
**Implementation**: 
- Updated `WaitlistDialog` to use selected child event when date is chosen
- Waitlist entries are linked to specific child event ID (not parent)
- Each date has its own waitlist (June 15 waitlist ≠ June 22 waitlist)

---

### 4. **Event Modifications** (Medium Priority)
**Issue**: What happens when organizer updates parent event details?

**Considerations**:
- Price changes → Should future child events update?
- Venue changes → Should future child events update?
- Time changes → Should future child events update?

**Recommendation**: 
- **Price**: Only affect future child events with no sales (don't change existing ones)
- **Venue/Time**: Can update if no tickets sold for that date
- **Description**: Can update all future child events

---

### 5. **Ticket Transfers Between Dates** (Medium Priority)
**Current**: Ticket transfers are supported
**Needs**: Allow transfers between dates in same recurring series

**Implementation**:
```javascript
// Check if source and target events share parent
const isSameSeries = sourceEvent.parent_event_id === targetEvent.parent_event_id ||
                     sourceEvent.id === targetEvent.parent_event_id ||
                     targetEvent.id === sourceEvent.parent_event_id;

if (isSameSeries) {
  // Allow transfer
  // Check target event availability
  // Apply date change fee if configured
  // Update ticket.event_id to target child event
}
```

---

### 6. **Analytics Per Date** (Low Priority)
**Current**: Analytics aggregate by event_id
**Enhancement**: Show per-date breakdown for recurring events

**Needs**:
- Parent event analytics → Aggregate all child events
- Individual child event analytics → Per-date stats
- Revenue dashboard → Per-date breakdown option

---

### 7. **Event Reminders** (Already Works ✅)
**Status**: ✅ Reminders use child event's `start_date` automatically
**Enhancement**: Make it clear in reminder email which specific date

---

### 8. **Bulk Operations** (Low Priority)
**Needs**:
- Bulk cancel future dates
- Bulk price update for future dates (only if no sales)
- Bulk notifications to all attendees across dates

---

### 9. **Reporting & Export** (Low Priority)
**Enhancement**:
- CSV exports should clearly show parent vs child events
- Per-date revenue breakdown in exports
- Attendance reports per date

---

### 10. **Search/SEO** (Already Works ✅)
**Status**: ✅ Each child event has unique slug for SEO
**Enhancement**: Consider showing child events in search results (currently filtered out)

---

## 📋 **PRIORITY IMPLEMENTATION CHECKLIST**

### **High Priority** 🔴
1. ✅ **Ticket Availability** - Fixed (uses child event inventory)
2. ✅ **Payout Escrow** - Implemented (based on child event's end_date)
3. ✅ **Promo Codes** - FIXED (parent codes now apply to all children)
4. ✅ **Refund Eligibility** - Already correct (uses child event's start_date)

### **Medium Priority** 🟡
5. ✅ **Cancellation Refunds** - IMPLEMENTED (auto-refund on cancellation)
6. ⚠️ **Ticket Transfers** - Allow transfers between dates in series
7. ⚠️ **Event Modifications** - Define rules for updating future child events
8. ✅ **Waitlist Strategy** - IMPLEMENTED (separate waitlist per child event)

### **Low Priority** 🟢
9. ⚠️ **Analytics Per Date** - Enhanced reporting per child event
10. ⚠️ **Bulk Operations** - Bulk cancel/update for future dates
11. ⚠️ **Reporting Enhancements** - Better CSV exports with date breakdown

---

## 🎯 **KEY INSIGHTS**

1. **Most Core Features Work** ✅
   - Ticket inventory, payouts, orders, refunds all use child event data correctly

2. **Main Gaps**:
   - Promo code scope (parent vs child)
   - Cancellation auto-refunds
   - Ticket transfers between dates
   - Event modification rules

3. **Best Practices Implemented**:
   - Each date is treated as individual event
   - Separate inventory per date
   - Separate payouts per date
   - Unique slugs for SEO

---

## 💡 **RECOMMENDATIONS**

1. **Promo Codes**: Apply parent event codes to all child events automatically
2. **Cancellation**: Auto-refund tickets when parent event or child event is cancelled
3. **Modifications**: Only allow updates to future dates with no sales
4. **Transfers**: Allow date changes within same series with availability check
5. **Analytics**: Add toggle to show aggregate (parent) vs per-date breakdown
