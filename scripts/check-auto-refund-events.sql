-- Check what auto-refund test events are remaining
-- Run this to see what events still exist

SELECT 
  id,
  title,
  slug,
  is_recurring,
  parent_event_id,
  status,
  created_at
FROM events
WHERE title ILIKE '%Auto-Refund Test%' 
   OR slug ILIKE 'test-auto-refund-%'
   OR title ILIKE '%auto-refund%'
   OR slug ILIKE '%auto-refund%'
ORDER BY created_at DESC;
