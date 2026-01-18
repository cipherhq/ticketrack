# Codebase Cleanup Summary

## Completed Cleanup Tasks

### 1. ✅ Removed Unused Files
- **Deleted**: `src/pages/WebHome_old.jsx` - Old version not imported anywhere
- **Deleted**: `src/components/AddressAutocomplete.jsx` - Duplicate of `src/components/ui/AddressAutocomplete.jsx`

### 2. ✅ IoT Venue Features
**Status**: User confirmed not needed, UI references removed
- **Files**: `src/pages/organizer/VenueIoTDashboard.jsx`, `src/services/iotVenueService.js` (kept for potential future use)
- **Actions Completed**:
  - Removed IoT button from venue cards in `VenueManagement.jsx`
  - Disabled IoT checkbox in venue creation form
  - Removed `Wifi` and `WifiOff` icon imports
  - Set `iot_enabled` to always `false` in form submissions
- **Note**: Database fields and service files kept but not exposed in UI

### 3. 📝 Console.log Statements
**Status**: 597 matches across 145 files found
- **Priority**: Focus on production-critical files first
- **Recommendation**: 
  - Remove debug `console.log` statements
  - Keep `console.error` for error tracking but integrate with Sentry
  - Gate remaining logs with `if (import.meta.env.DEV)`

### 4. 🔄 Duplicate Cleanup Scripts
**Status**: Three similar SQL scripts found
- `scripts/cleanup-auto-refund-events.sql` - Pattern-based deletion
- `scripts/cleanup-auto-refund-events-direct.sql` - Direct ID deletion
- `scripts/cleanup-auto-refund-events-complete.sql` - Complete version
- **Action**: Keep `cleanup-auto-refund-events.sql` as the main script, archive others

### 5. 📋 TODO Comments
- `src/pages/organizer/EventPlaceDesigner.jsx:734` - "TODO: Save to Supabase `event_floor_plans` table"
- **Action**: Address or document as future enhancement

## Recommendations

### High Priority
1. **Console.log Audit**: Review and remove/gate all console.log statements in production code
2. **Error Tracking**: Replace `console.error` with Sentry error reporting in critical paths
3. **Code Comments**: Review and update outdated comments

### Medium Priority
1. **Unused Imports**: Run ESLint to detect and remove unused imports
2. **Dead Code**: Identify and remove unused functions/components
3. **Type Safety**: Consider adding TypeScript or PropTypes for better type checking

### Low Priority
1. **Documentation**: Update README with current features
2. **Test Coverage**: Expand test coverage for critical flows
3. **Performance**: Review bundle size and optimize imports

## Files to Review

### Console.log Heavy Files (>10 statements)
- `src/pages/organizer/EventManagement.jsx` (13)
- `src/pages/WebCheckout.jsx` (26)
- `src/pages/organizer/PromoterManagement.jsx` (13)
- `src/pages/WebPaymentSuccess.jsx` (13)
- `src/pages/organizer/CreateEvent.jsx` (11)
- `src/pages/admin/AdminSettings.jsx` (11)
- `src/pages/organizer/ProjectManager.jsx` (11)
- `src/pages/WebTickets.jsx` (11)
- `src/utils/ticketGenerator.js` (21)

### Potential Dead Code
- `src/pages/organizer/EventPlaceDesigner.jsx` - Check if still in use
- IoT Venue related files (kept but not exposed)

## Next Steps

1. Run automated cleanup for console.log statements
2. Review and consolidate duplicate code
3. Update documentation
4. Run linter and fix warnings
