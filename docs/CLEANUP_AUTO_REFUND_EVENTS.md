# Cleanup Auto-Refund Test Events

## Quick Method: SQL Script (Recommended)

1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Copy and paste the contents of `scripts/cleanup-auto-refund-events.sql`
3. Click **Run** or press `Ctrl+Enter` (or `Cmd+Enter` on Mac)
4. All auto-refund test events will be deleted along with related data

## Alternative: Node.js Script

If you prefer using the command line:

```bash
npm run cleanup:auto-refund
```

**Note:** This requires `SUPABASE_SERVICE_ROLE_KEY` to be set in your `.env.local` file.

## What Gets Deleted

The cleanup script removes:
- All events with title matching "Auto-Refund Test" or slug matching "test-auto-refund-*"
- All child events (if any are recurring)
- All tickets for those events
- All ticket types for those events
- All orders and order items
- All refund requests related to those orders

## Verification

After running the cleanup, you can verify by running this SQL query:

```sql
SELECT COUNT(*) as remaining_events
FROM events
WHERE title ILIKE '%Auto-Refund Test%' 
   OR slug ILIKE 'test-auto-refund-%';
```

This should return `0` if all test events were deleted successfully.
