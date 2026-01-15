-- Safe Country Features Deployment
-- This version handles all edge cases and division by zero errors

-- Step 1: Ensure countries table exists with default data
DO $$
BEGIN
    -- Create countries table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'countries') THEN
        RAISE NOTICE 'Creating countries table...';
        CREATE TABLE countries (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            code VARCHAR(2) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            default_currency VARCHAR(3),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Insert default countries
        INSERT INTO countries (code, name, is_active, default_currency) VALUES
        ('NG', 'Nigeria', true, 'NGN'),
        ('GB', 'United Kingdom', true, 'GBP'),
        ('US', 'United States', true, 'USD'),
        ('CA', 'Canada', true, 'CAD'),
        ('GH', 'Ghana', true, 'GHS');
        
        RAISE NOTICE '✅ Created countries table with 5 countries';
    ELSE
        RAISE NOTICE '✅ Countries table already exists';
    END IF;
END $$;

-- Step 2: Drop and recreate feature tables for clean setup
DROP TABLE IF EXISTS admin_feature_logs CASCADE;
DROP TABLE IF EXISTS country_features CASCADE; 
DROP TABLE IF EXISTS feature_categories CASCADE;

-- Step 3: Create feature categories
CREATE TABLE feature_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0
);

INSERT INTO feature_categories (name, description, icon, sort_order) VALUES
('payments', 'Payment processing and financial features', 'CreditCard', 1),
('events', 'Event creation and management', 'Calendar', 2),
('tickets', 'Ticketing and registration', 'Ticket', 3),
('communication', 'Marketing and communication tools', 'Mail', 4),
('marketing', 'Promotion and discovery features', 'TrendingUp', 5),
('advanced', 'Advanced and enterprise features', 'Settings', 6),
('mobile', 'Mobile and digital wallet features', 'Smartphone', 7),
('compliance', 'Legal and compliance features', 'Shield', 8);

-- Step 4: Create country features table
CREATE TABLE country_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    description TEXT,
    category VARCHAR(100) DEFAULT 'events',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, feature_name)
);

-- Create indexes
CREATE INDEX idx_country_features_country ON country_features (country_code);
CREATE INDEX idx_country_features_feature ON country_features (feature_name);
CREATE INDEX idx_country_features_enabled ON country_features (is_enabled);

-- Step 5: Insert features for all countries
DO $$
DECLARE
    country_record RECORD;
    total_countries INTEGER := 0;
    total_features INTEGER := 0;
BEGIN
    FOR country_record IN SELECT code FROM countries WHERE is_active = true LOOP
        total_countries := total_countries + 1;
        RAISE NOTICE 'Setting up features for: %', country_record.code;
        
        -- Insert all features for this country
        INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
        -- Payments
        (country_record.code, 'payment_processing', true, 'Enable payment processing for events', 'payments'),
        (country_record.code, 'refunds', true, 'Allow ticket refunds', 'payments'),
        (country_record.code, 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
        (country_record.code, 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
        
        -- Events
        (country_record.code, 'recurring_events', true, 'Allow creation of recurring events', 'events'),
        (country_record.code, 'virtual_events', true, 'Support for virtual/online events', 'events'),
        (country_record.code, 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
        (country_record.code, 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
        (country_record.code, 'custom_event_fields', true, 'Custom registration fields', 'events'),
        
        -- Tickets
        (country_record.code, 'free_events', true, 'Allow free events with RSVP', 'tickets'),
        (country_record.code, 'paid_events', true, 'Enable paid ticketing', 'tickets'),
        (country_record.code, 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
        (country_record.code, 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
        (country_record.code, 'promo_codes', true, 'Promotional discount codes', 'tickets'),
        
        -- Communication (country-specific)
        (country_record.code, 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
        (country_record.code, 'sms_campaigns', CASE WHEN country_record.code = 'NG' THEN true ELSE false END, 'SMS marketing campaigns', 'communication'),
        (country_record.code, 'whatsapp_campaigns', CASE WHEN country_record.code IN ('NG', 'GH') THEN true ELSE false END, 'WhatsApp marketing', 'communication'),
        (country_record.code, 'push_notifications', true, 'Mobile push notifications', 'communication'),
        
        -- Marketing
        (country_record.code, 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
        (country_record.code, 'social_sharing', true, 'Social media event sharing', 'marketing'),
        (country_record.code, 'event_discovery', true, 'Public event listings', 'marketing'),
        (country_record.code, 'featured_events', true, 'Featured event promotions', 'marketing'),
        
        -- Advanced (country-specific)
        (country_record.code, 'venue_management', true, 'Venue layout designer', 'advanced'),
        (country_record.code, 'iot_integration', CASE WHEN country_record.code IN ('NG', 'US', 'GB') THEN true ELSE false END, 'IoT venue monitoring', 'advanced'),
        (country_record.code, 'api_access', CASE WHEN country_record.code IN ('US', 'GB') THEN true ELSE false END, 'API access for developers', 'advanced'),
        (country_record.code, 'white_label', false, 'White-label event platform', 'advanced'),
        
        -- Mobile (country-specific)
        (country_record.code, 'mobile_checkin', true, 'QR code check-in', 'mobile'),
        (country_record.code, 'apple_wallet', CASE WHEN country_record.code IN ('US', 'GB', 'CA') THEN true ELSE false END, 'Apple Wallet tickets', 'mobile'),
        (country_record.code, 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
        
        -- Compliance (country-specific)
        (country_record.code, 'gdpr_compliance', CASE WHEN country_record.code = 'GB' THEN true ELSE false END, 'GDPR data protection', 'compliance'),
        (country_record.code, 'tax_reporting', CASE WHEN country_record.code IN ('US', 'GB', 'CA') THEN true ELSE false END, 'Automated tax reporting', 'compliance'),
        (country_record.code, 'kyc_verification', CASE WHEN country_record.code = 'NG' THEN true ELSE false END, 'KYC for organizers', 'compliance');
        
        total_features := total_features + 30; -- 30 features per country
    END LOOP;
    
    RAISE NOTICE '✅ Inserted % features for % countries', total_features, total_countries;
END $$;

-- Step 6: Create admin logs table
CREATE TABLE admin_feature_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID,
    country_code VARCHAR(2) NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    old_value BOOLEAN,
    new_value BOOLEAN,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Final verification (no division by zero)
SELECT '🎉 Country Features Setup Complete!' as status;

-- Safe summary query
SELECT 
    'Setup Summary' as section,
    COUNT(DISTINCT country_code) as countries_configured,
    COUNT(*) as total_feature_flags,
    COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled_features,
    COUNT(CASE WHEN is_enabled = false THEN 1 END) as disabled_features
FROM country_features;

-- Safe country breakdown
SELECT 
    c.name as country_name,
    c.code as country_code,
    c.default_currency,
    COALESCE(stats.total_features, 0) as total_features,
    COALESCE(stats.enabled_features, 0) as enabled_features,
    CASE 
        WHEN COALESCE(stats.total_features, 0) = 0 THEN 0 
        ELSE ROUND((COALESCE(stats.enabled_features, 0) * 100.0) / stats.total_features, 1) 
    END as enabled_percentage
FROM countries c
LEFT JOIN (
    SELECT 
        country_code,
        COUNT(*) as total_features,
        COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled_features
    FROM country_features 
    GROUP BY country_code
) stats ON c.code = stats.country_code
WHERE c.is_active = true
ORDER BY c.name;

-- Feature categories summary
SELECT 
    category,
    COUNT(*) as total_features,
    COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled_features,
    ARRAY_AGG(DISTINCT country_code ORDER BY country_code) as countries
FROM country_features
GROUP BY category
ORDER BY category;