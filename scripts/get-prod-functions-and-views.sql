-- ============================================================================
-- GET PRODUCTION FUNCTIONS AND VIEWS
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy results for both queries
-- ============================================================================

-- Query 1: Function Names (for comparison)
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Query 2: View Definitions (all 4 views)
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN (
        'donation_analytics',
        'email_campaign_performance',
        'inbox_summary',
        'public_organizer_profiles'
    )
ORDER BY table_name;
