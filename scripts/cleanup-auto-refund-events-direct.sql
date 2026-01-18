-- Direct SQL to Delete All Auto-Refund Test Events
-- This uses the event IDs directly to ensure deletion
-- Run this in Supabase Dashboard > SQL Editor

BEGIN;

-- Delete by event IDs (from your query results)
DELETE FROM tickets WHERE event_id IN (
  '96c1140c-ad7a-4678-b5bd-148e7e048108',
  '2e2166dd-395c-4183-896f-42711215fe75',
  '3e969226-585f-4122-b7a6-213d509d971c',
  '14c00654-d0bb-460d-8462-26ab79425699',
  '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e',
  '3b013bd6-c5e8-47d8-82b6-703b52e46642',
  '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58',
  '845cd4a2-1e11-4091-a16a-af71f0903341',
  '500fe300-5595-484b-b5d7-14e8deef0646',
  'b0f55f93-55f2-44ee-9186-d42040275bf5',
  'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'
);

DELETE FROM ticket_types WHERE event_id IN (
  '96c1140c-ad7a-4678-b5bd-148e7e048108',
  '2e2166dd-395c-4183-896f-42711215fe75',
  '3e969226-585f-4122-b7a6-213d509d971c',
  '14c00654-d0bb-460d-8462-26ab79425699',
  '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e',
  '3b013bd6-c5e8-47d8-82b6-703b52e46642',
  '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58',
  '845cd4a2-1e11-4091-a16a-af71f0903341',
  '500fe300-5595-484b-b5d7-14e8deef0646',
  'b0f55f93-55f2-44ee-9186-d42040275bf5',
  'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'
);

DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE event_id IN (
    '96c1140c-ad7a-4678-b5bd-148e7e048108',
    '2e2166dd-395c-4183-896f-42711215fe75',
    '3e969226-585f-4122-b7a6-213d509d971c',
    '14c00654-d0bb-460d-8462-26ab79425699',
    '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e',
    '3b013bd6-c5e8-47d8-82b6-703b52e46642',
    '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58',
    '845cd4a2-1e11-4091-a16a-af71f0903341',
    '500fe300-5595-484b-b5d7-14e8deef0646',
    'b0f55f93-55f2-44ee-9186-d42040275bf5',
    'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'
  )
);

DELETE FROM refund_requests WHERE order_id IN (
  SELECT id FROM orders WHERE event_id IN (
    '96c1140c-ad7a-4678-b5bd-148e7e048108',
    '2e2166dd-395c-4183-896f-42711215fe75',
    '3e969226-585f-4122-b7a6-213d509d971c',
    '14c00654-d0bb-460d-8462-26ab79425699',
    '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e',
    '3b013bd6-c5e8-47d8-82b6-703b52e46642',
    '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58',
    '845cd4a2-1e11-4091-a16a-af71f0903341',
    '500fe300-5595-484b-b5d7-14e8deef0646',
    'b0f55f93-55f2-44ee-9186-d42040275bf5',
    'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'
  )
);

DELETE FROM orders WHERE event_id IN (
  '96c1140c-ad7a-4678-b5bd-148e7e048108',
  '2e2166dd-395c-4183-896f-42711215fe75',
  '3e969226-585f-4122-b7a6-213d509d971c',
  '14c00654-d0bb-460d-8462-26ab79425699',
  '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e',
  '3b013bd6-c5e8-47d8-82b6-703b52e46642',
  '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58',
  '845cd4a2-1e11-4091-a16a-af71f0903341',
  '500fe300-5595-484b-b5d7-14e8deef0646',
  'b0f55f93-55f2-44ee-9186-d42040275bf5',
  'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'
);

-- Delete child events first (those with parent_event_id)
DELETE FROM events WHERE id IN (
  '96c1140c-ad7a-4678-b5bd-148e7e048108', -- child
  '3e969226-585f-4122-b7a6-213d509d971c', -- child
  '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e', -- child
  '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58', -- child
  'b0f55f93-55f2-44ee-9186-d42040275bf5'  -- child
);

-- Delete parent events last (those with parent_event_id = null)
DELETE FROM events WHERE id IN (
  '2e2166dd-395c-4183-896f-42711215fe75', -- parent
  '14c00654-d0bb-460d-8462-26ab79425699', -- parent
  '3b013bd6-c5e8-47d8-82b6-703b52e46642', -- parent
  '845cd4a2-1e11-4091-a16a-af71f0903341', -- parent
  '500fe300-5595-484b-b5d7-14e8deef0646', -- parent
  'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'  -- parent
);

COMMIT;

-- Verify deletion
-- SELECT COUNT(*) as remaining_events
-- FROM events
-- WHERE id IN (
--   '96c1140c-ad7a-4678-b5bd-148e7e048108',
--   '2e2166dd-395c-4183-896f-42711215fe75',
--   '3e969226-585f-4122-b7a6-213d509d971c',
--   '14c00654-d0bb-460d-8462-26ab79425699',
--   '9c4c8508-cf7f-4c3e-8fd3-1ba6e73e7b8e',
--   '3b013bd6-c5e8-47d8-82b6-703b52e46642',
--   '9bcdc43d-cfb0-48bf-b679-67c9ecf4ac58',
--   '845cd4a2-1e11-4091-a16a-af71f0903341',
--   '500fe300-5595-484b-b5d7-14e8deef0646',
--   'b0f55f93-55f2-44ee-9186-d42040275bf5',
--   'ca669d02-a2f6-4759-9871-2ab5b6f7a7fc'
-- );
