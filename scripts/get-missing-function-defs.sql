-- ============================================================================
-- GET MISSING FUNCTION DEFINITIONS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy the results to generate migration script
-- ============================================================================

SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    pg_get_functiondef(p.oid) as full_definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.routine_schema = 'public'
    AND n.nspname = 'public'
    AND r.routine_name IN (
        'advance_drip_enrollment',
        'calculate_contact_engagement',
        'calculate_contact_rfm',
        'calculate_layout_capacity',
        'calculate_organizer_scores',
        'check_fast_payout_eligibility',
        'cleanup_expired_sessions',
        'complete_group_member',
        'create_default_smart_segments',
        'create_fast_payout_request',
        'create_group_session',
        'create_section_capacity_for_event',
        'create_split_payment',
        'enroll_in_drip_campaign',
        'expire_group_sessions',
        'expire_split_payments',
        'find_or_create_conversation',
        'generate_group_code',
        'get_inferred_preferences',
        'get_pending_drip_steps',
        'get_personalized_recommendations',
        'get_share_by_token',
        'get_split_payment',
        'join_group_session',
        'log_security_event',
        'mark_conversation_read',
        'mark_reminder_sent',
        'record_email_tracking_event',
        'record_event_interaction',
        'record_share_payment',
        'schedule_event_reminders',
        'toggle_saved_event',
        'update_campaign_analytics',
        'update_member_selection',
        'update_paystack_payout_status',
        'update_smart_segment_counts'
    )
ORDER BY r.routine_name;
