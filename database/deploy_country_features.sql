-- Deploy Country Features System
-- Run this script in Supabase SQL Editor to set up country-based feature flags

-- Step 1: Create the database schema
\i database/country_features_schema.sql

-- Step 2: Verify the deployment
SELECT 'Country Features Setup Complete' as status;

-- Show summary
SELECT 
    'Setup Summary' as section,
    COUNT(DISTINCT country_code) as countries_configured,
    COUNT(*) as total_feature_flags,
    COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled_features,
    COUNT(CASE WHEN is_enabled = false THEN 1 END) as disabled_features
FROM country_features;

-- Show features by country
SELECT 
    c.name as country_name,
    c.code as country_code,
    c.default_currency,
    COUNT(cf.id) as total_features,
    COUNT(CASE WHEN cf.is_enabled = true THEN 1 END) as enabled_features,
    ROUND(
        (COUNT(CASE WHEN cf.is_enabled = true THEN 1 END) * 100.0) / COUNT(cf.id), 
        1
    ) as enabled_percentage
FROM countries c
LEFT JOIN country_features cf ON c.code = cf.country_code
WHERE c.is_active = true
GROUP BY c.code, c.name, c.default_currency
ORDER BY c.name;

-- Show feature categories
SELECT 
    fc.name as category,
    fc.description,
    COUNT(cf.id) as feature_count,
    COUNT(CASE WHEN cf.is_enabled = true THEN 1 END) as enabled_count
FROM feature_categories fc
LEFT JOIN country_features cf ON fc.name = cf.category
GROUP BY fc.name, fc.description, fc.sort_order
ORDER BY fc.sort_order;