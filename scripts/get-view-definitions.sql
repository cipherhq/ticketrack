-- ============================================================================
-- GET FULL VIEW DEFINITIONS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy the results to generate migration script
-- ============================================================================

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
