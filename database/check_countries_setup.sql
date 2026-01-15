-- Diagnostic Script: Check Countries Setup
-- Run this first to verify your countries table is properly set up

-- Check if countries table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'countries') 
        THEN '✅ Countries table exists' 
        ELSE '❌ Countries table does not exist' 
    END as countries_table_status;

-- Check countries data
SELECT 
    'Countries Data Check' as check_type,
    COUNT(*) as total_countries,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_countries,
    ARRAY_AGG(code) FILTER (WHERE is_active = true) as active_country_codes
FROM countries;

-- Show all countries if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'countries') THEN
        PERFORM 1; -- Countries table exists, show data
    ELSE
        RAISE NOTICE '❌ Countries table not found. Creating basic countries...';
        
        -- Create countries table if it doesn't exist
        CREATE TABLE countries (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            code VARCHAR(2) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            default_currency VARCHAR(3),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Insert basic countries
        INSERT INTO countries (code, name, is_active, default_currency) VALUES
        ('NG', 'Nigeria', true, 'NGN'),
        ('GB', 'United Kingdom', true, 'GBP'),
        ('US', 'United States', true, 'USD'),
        ('CA', 'Canada', true, 'CAD'),
        ('GH', 'Ghana', true, 'GHS');
        
        RAISE NOTICE '✅ Created countries table with 5 default countries';
    END IF;
END $$;

-- Show final countries status
SELECT 
    code,
    name,
    is_active,
    default_currency,
    'Ready for feature flags' as status
FROM countries
ORDER BY name;