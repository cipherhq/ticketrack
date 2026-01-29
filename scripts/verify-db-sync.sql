-- ============================================================================
-- VERIFY DATABASE SYNC STATUS
-- ============================================================================
-- Run this in BOTH Production and Dev Supabase SQL Editors
-- Compare the results to see what's missing
-- ============================================================================

-- 1. Count Functions
SELECT 
    'Functions' as type, 
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_type = 'FUNCTION';

-- 2. Count Views
SELECT 
    'Views' as type, 
    COUNT(*) as count
FROM information_schema.views 
WHERE table_schema = 'public';

-- 3. Count Triggers
SELECT 
    'Triggers' as type, 
    COUNT(*) as count
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- 4. Count RLS Policies
SELECT 
    'RLS Policies' as type, 
    COUNT(*) as count
FROM pg_policies 
WHERE schemaname = 'public';

-- 5. Count Indexes
SELECT 
    'Indexes' as type, 
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public';

-- 6. Check Flutterwave Subaccount Fields (recently added)
SELECT 
    'Flutterwave Fields' as type,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'organizers'
    AND column_name LIKE 'flutterwave_subaccount%';

-- 7. Check Paystack Subaccount Fields
SELECT 
    'Paystack Fields' as type,
    COUNT(*) as count
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'organizers'
    AND column_name LIKE 'paystack_subaccount%';

-- 8. Total Tables
SELECT 
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
