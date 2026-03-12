-- Backfill event country_code from organizer's country_code
-- This fixes events that were created with the hardcoded 'NG' default
-- when the organizer is actually from a different country.

UPDATE events e
SET country_code = o.country_code
FROM organizers o
WHERE e.organizer_id = o.id
  AND o.country_code IS NOT NULL
  AND o.country_code != e.country_code;
