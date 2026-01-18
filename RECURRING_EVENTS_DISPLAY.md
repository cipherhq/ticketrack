# Recurring Events Display Strategy

## Current Implementation

### 1. **Event Structure**
- **Parent Event**: The original recurring event (e.g., "Weekly Yoga Class")
- **Child Events**: Individual date instances with unique slugs (e.g., `yoga-class-2024-06-15`)
- **Virtual Events**: Future dates that haven't been created yet (generated on-the-fly)

### 2. **Slug Differentiation** ✅
- Child events use format: `{parent-slug}-{YYYY-MM-DD}`
- Example: `weekly-yoga-2024-06-15`
- This allows each date to have its own URL and be indexed separately

### 3. **Ticket Inventory** ✅ (Now Fixed)
- Each child event has **separate ticket types** with its own inventory
- When a child event is created, it gets its own `quantity_available` and `quantity_sold`
- Tickets are tracked per child event, not shared with parent

## Recommended Display Strategy

### **Option A: Show Parent Events Only (Recommended)**
Show parent events in browse/search with a "Series" badge:
- User clicks parent → sees all dates on event page (grid/calendar view)
- Each date links to the same parent event page with date pre-selected
- Simpler browsing, less clutter

**Pros:**
- Cleaner browse/search results
- Easier for users to find event series
- Parent event page shows all available dates

**Cons:**
- Need to handle date selection on parent page (already done ✅)

### **Option B: Show Child Events Separately**
Show individual child events in browse/search:
- Each date appears as a separate event
- Title shows date: "Weekly Yoga Class - Jun 15, 2024"

**Pros:**
- Direct access to specific dates
- Clear date differentiation

**Cons:**
- Can clutter browse results
- Users might not realize they're part of a series

### **Option C: Hybrid Approach (Best for SEO)**
- **Browse/Search**: Show parent events with "Series" badge + next upcoming date
- **Parent Event Page**: Show all dates (grid/calendar) ← Current implementation ✅
- **Individual Child Events**: Accessible via direct slug URLs for SEO

## Recommended Implementation (Option A + C)

1. **Browse/Search Pages** (`WebEventBrowse.jsx`, `WebSearch.jsx`):
   - Filter out child events (where `parent_event_id IS NOT NULL`)
   - Show only parent events
   - Add "Series" or "Recurring" badge for `is_recurring = true`

2. **Parent Event Page** (`WebEventDetails.jsx`):
   - Already shows all dates in grid/calendar view ✅
   - User selects date and proceeds to checkout

3. **Child Event URLs**:
   - Still accessible via direct slug (for SEO/bookmarking)
   - Redirect to parent event page with date pre-selected

4. **Display Badges**:
   - Parent events: Show "Series" or "Recurring Event" badge
   - Show next upcoming date as subtitle

## Implementation Checklist

- [x] Child events have separate ticket inventory
- [x] Child events use unique slugs (`parent-slug-YYYY-MM-DD`)
- [x] Parent event page shows all dates (grid/calendar)
- [ ] Update browse/search to filter out child events
- [ ] Add "Series" badge to recurring parent events
- [ ] Handle child event URL redirects to parent with date selection
