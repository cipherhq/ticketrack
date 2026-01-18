-- SQL Script to Delete All Auto-Refund Test Events
-- Run this in Supabase Dashboard > SQL Editor
-- This will delete all test events and related data

BEGIN;

-- Step 1: Delete tickets for all test events (including child events)
DELETE FROM tickets
WHERE event_id IN (
  -- Parent events
  SELECT id FROM events
  WHERE title ILIKE '%Auto-Refund Test%' 
     OR slug ILIKE 'test-auto-refund-%'
  
  UNION
  
  -- Child events
  SELECT e.id FROM events e
  INNER JOIN events te ON e.parent_event_id = te.id
  WHERE te.title ILIKE '%Auto-Refund Test%' 
     OR te.slug ILIKE 'test-auto-refund-%'
);

-- Step 2: Delete ticket types for all test events
DELETE FROM ticket_types
WHERE event_id IN (
  -- Parent events
  SELECT id FROM events
  WHERE title ILIKE '%Auto-Refund Test%' 
     OR slug ILIKE 'test-auto-refund-%'
  
  UNION
  
  -- Child events
  SELECT e.id FROM events e
  INNER JOIN events te ON e.parent_event_id = te.id
  WHERE te.title ILIKE '%Auto-Refund Test%' 
     OR te.slug ILIKE 'test-auto-refund-%'
);

-- Step 3: Delete order items for orders related to test events
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders
  WHERE event_id IN (
    -- Parent events
    SELECT id FROM events
    WHERE title ILIKE '%Auto-Refund Test%' 
       OR slug ILIKE 'test-auto-refund-%'
    
    UNION
    
    -- Child events
    SELECT e.id FROM events e
    INNER JOIN events te ON e.parent_event_id = te.id
    WHERE te.title ILIKE '%Auto-Refund Test%' 
       OR te.slug ILIKE 'test-auto-refund-%'
  )
);

-- Step 4: Delete refund requests for orders related to test events
DELETE FROM refund_requests
WHERE order_id IN (
  SELECT id FROM orders
  WHERE event_id IN (
    -- Parent events
    SELECT id FROM events
    WHERE title ILIKE '%Auto-Refund Test%' 
       OR slug ILIKE 'test-auto-refund-%'
    
    UNION
    
    -- Child events
    SELECT e.id FROM events e
    INNER JOIN events te ON e.parent_event_id = te.id
    WHERE te.title ILIKE '%Auto-Refund Test%' 
       OR te.slug ILIKE 'test-auto-refund-%'
  )
);

-- Step 5: Delete orders for test events
DELETE FROM orders
WHERE event_id IN (
  -- Parent events
  SELECT id FROM events
  WHERE title ILIKE '%Auto-Refund Test%' 
     OR slug ILIKE 'test-auto-refund-%'
  
  UNION
  
  -- Child events
  SELECT e.id FROM events e
  INNER JOIN events te ON e.parent_event_id = te.id
  WHERE te.title ILIKE '%Auto-Refund Test%' 
     OR te.slug ILIKE 'test-auto-refund-%'
);

-- Step 6: Delete child events first (before parent events)
-- This handles events where parent_event_id points to a test event
DELETE FROM events
WHERE parent_event_id IN (
  SELECT id FROM events
  WHERE title ILIKE '%Auto-Refund Test%' 
     OR slug ILIKE 'test-auto-refund-%'
     OR title ILIKE '%auto-refund%'
     OR slug ILIKE '%auto-refund%'
);

-- Step 7: Also delete any child events with test slugs that might have been orphaned
DELETE FROM events
WHERE (title ILIKE '%Auto-Refund Test%' 
    OR slug ILIKE 'test-auto-refund-%'
    OR title ILIKE '%auto-refund%'
    OR slug ILIKE '%auto-refund%')
  AND parent_event_id IS NOT NULL;

-- Step 8: Finally, delete parent events
DELETE FROM events
WHERE (title ILIKE '%Auto-Refund Test%' 
    OR slug ILIKE 'test-auto-refund-%'
    OR title ILIKE '%auto-refund%'
    OR slug ILIKE '%auto-refund%')
  AND parent_event_id IS NULL;

COMMIT;

-- Verification query (run this separately to check results)
-- SELECT COUNT(*) as remaining_events
-- FROM events
-- WHERE title ILIKE '%Auto-Refund Test%' 
--    OR slug ILIKE 'test-auto-refund-%';
