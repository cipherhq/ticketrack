-- ============================================================================
-- SETUP DEV DATABASE EXTENSIONS AND BASIC CONFIGURATION
-- ============================================================================
-- Run this in Dev Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Verify extensions
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'uuid-ossp', 'pgcrypto')
ORDER BY extname;

-- ============================================================================
-- NOTE: After running this, also run:
-- 1. database/setup_cron_jobs_dev.sql (to set up cron jobs)
-- 2. Check for functions/triggers in master_migration.sql
-- ============================================================================
