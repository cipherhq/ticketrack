-- ============================================================================
-- UNIQUE PHONE NUMBER CONSTRAINT
-- Ensures phone numbers are unique across all users (required for phone login)
-- ============================================================================

-- 1. First, check for existing duplicates
SELECT phone, COUNT(*) as count, ARRAY_AGG(id) as user_ids
FROM profiles 
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone 
HAVING COUNT(*) > 1;

-- If duplicates exist, you'll need to resolve them manually before adding the constraint
-- Options:
--   a) Contact users to update their phone numbers
--   b) Clear the phone for duplicate accounts (they'll need to re-add)
--   c) Keep the first user's phone, clear others

-- 2. (Optional) Clear duplicate phones - keeps the earliest registered user's phone
-- DO $$
-- DECLARE
--     dup RECORD;
-- BEGIN
--     FOR dup IN (
--         SELECT phone, ARRAY_AGG(id ORDER BY created_at) as user_ids
--         FROM profiles 
--         WHERE phone IS NOT NULL AND phone != ''
--         GROUP BY phone 
--         HAVING COUNT(*) > 1
--     ) LOOP
--         -- Keep first user, clear others
--         UPDATE profiles 
--         SET phone = NULL 
--         WHERE id = ANY(dup.user_ids[2:]);
--     END LOOP;
-- END $$;

-- 3. Add unique constraint on phone (allows multiple NULLs)
ALTER TABLE profiles 
ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- Note: PostgreSQL UNIQUE allows multiple NULL values, so users without phone are fine

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Constraint added successfully' as status;

-- Check constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'profiles' AND constraint_name = 'profiles_phone_unique';
