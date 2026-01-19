# Help Center Screenshot Guide

This document lists all screenshots needed for the Help Center and provides guidance on how to capture them.

## Screenshot Requirements

### Total Screenshots Needed: 48

Each help article references a screenshot path. These should be placed in `/public/help/` directory.

## How to Capture Screenshots

### Option 1: Browser DevTools (Recommended)
1. Open the page/feature you want to capture
2. Open DevTools (F12 or Cmd+Option+I on Mac)
3. Click the device toolbar icon (or Cmd+Shift+M)
4. Select a responsive size (e.g., 1280x720 or desktop view)
5. Take a screenshot:
   - Chrome: Cmd+Shift+P → "Capture full size screenshot"
   - Firefox: Cmd+Shift+S → "Take a screenshot"
   - Or use browser extensions

### Option 2: Mac Screenshot Tool
- **Full screen**: `Cmd + Shift + 3`
- **Selected area**: `Cmd + Shift + 4`
- **Window**: `Cmd + Shift + 4` then press `Space`

### Option 3: Snipping Tool (Windows)
- Use Windows + Shift + S for quick screenshots
- Or use the Snipping Tool app

## Screenshot Checklist

### Attendee Screenshots (14 needed)
- [ ] `/public/help/browse-events.png`
- [ ] `/public/help/buy-tickets.png`
- [ ] `/public/help/my-tickets.png`
- [ ] `/public/help/request-refund.png`
- [ ] `/public/help/escalate-refund.png`
- [ ] `/public/help/refund-status.png`
- [ ] `/public/help/transfer-ticket.png`
- [ ] `/public/help/transferred-tickets.png`
- [ ] `/public/help/add-calendar.png`
- [ ] `/public/help/recommended-events.png`
- [ ] `/public/help/payment-methods.png`
- [ ] `/public/help/follow-organizers.png`
- [ ] `/public/help/multi-currency.png`
- [ ] `/public/help/recurring-selection.png` ⭐ NEW
- [ ] `/public/help/waitlist.png` ⭐ NEW
- [ ] `/public/help/location-sorting.png` ⭐ NEW

### Organizer Screenshots (23 needed)
- [ ] `/public/help/create-event.png`
- [ ] `/public/help/schedule-publishing.png`
- [ ] `/public/help/custom-forms.png`
- [ ] `/public/help/view-responses.png`
- [ ] `/public/help/export-csv.png`
- [ ] `/public/help/organizer-refunds.png`
- [ ] `/public/help/check-in.png`
- [ ] `/public/help/analytics.png`
- [ ] `/public/help/enable-transfers.png`
- [ ] `/public/help/organizer-transfers.png`
- [ ] `/public/help/stripe-connect.png`
- [ ] `/public/help/kyc-verification.png`
- [ ] `/public/help/view-payouts.png`
- [ ] `/public/help/multi-currency.png` (duplicate, can reuse)
- [ ] `/public/help/recurring-events.png` ⭐ NEW
- [ ] `/public/help/multi-day-events.png` ⭐ NEW
- [ ] `/public/help/venue-designer.png` ⭐ NEW
- [ ] `/public/help/manual-tickets.png` ⭐ NEW
- [ ] `/public/help/waitlist-management.png` ⭐ NEW
- [ ] `/public/help/auto-refund.png` ⭐ NEW
- [ ] `/public/help/virtual-events.png` ⭐ NEW
- [ ] `/public/help/free-events.png` ⭐ NEW
- [ ] `/public/help/venue-management.png` ⭐ NEW
- [ ] `/public/help/project-manager.png` ⭐ NEW
- [ ] `/public/help/team-management.png` ⭐ NEW
- [ ] `/public/help/post-event.png` ⭐ NEW

### Promoter Screenshots (5 needed)
- [ ] `/public/help/become-promoter.png`
- [ ] `/public/help/promo-link.png`
- [ ] `/public/help/track-referrals.png`
- [ ] `/public/help/commissions.png`
- [ ] `/public/help/request-payout.png`

### General Screenshots (4 needed)
- [ ] `/public/help/account-settings.png`
- [ ] `/public/help/notifications.png`
- [ ] `/public/help/contact-support.png`
- [ ] `/public/help/security.png`

## Screenshot Best Practices

1. **Resolution**: Use at least 1280x720 for clarity
2. **Format**: PNG format (lossless) recommended
3. **Annotate if needed**: Add arrows or highlights for clarity (optional)
4. **Remove sensitive data**: Blur any personal information, email addresses, or actual order numbers
5. **Consistency**: Use similar zoom levels and sections of the UI
6. **Naming**: Keep the exact filenames as listed above

## Quick Reference: Where to Capture Each Screenshot

### Common Pages:
- **Browse Events**: `/events` page
- **Event Details**: `/events/:id` page  
- **My Tickets**: `/my-tickets` page
- **Create Event**: `/organizer/events/create` page
- **Organizer Dashboard**: `/organizer` page
- **Check-In**: `/organizer/check-in` page
- **Analytics**: `/organizer/analytics` page
- **Venue Designer**: `/organizer/venues/:venueId/layouts` page

## Automation Options

If you want to automate screenshot capture:

1. **Playwright/Selenium**: Can be scripted to take screenshots automatically
2. **Browser Extensions**: Full Page Screen Capture, Awesome Screenshot
3. **Screenshot Tools**: Lightshot, ShareX, Snagit

## After Adding Screenshots

Once screenshots are added to `/public/help/`, they will automatically be accessible in the Help Center. No code changes needed - the paths are already configured in `HelpCenter.jsx`.

## Questions?

If certain screenshots are difficult to capture or if UI has changed, you can:
1. Use placeholder images temporarily
2. Update the screenshot paths in `HelpCenter.jsx` if filenames change
3. Remove screenshot references if not needed (the help articles will still work)
