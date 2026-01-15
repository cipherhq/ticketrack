-- Country Features Migration Script - Safe deployment
-- This script safely handles existing tables and data

-- Step 1: Check if country_features table exists and get its structure
DO $$
BEGIN
    -- If the table exists but has wrong structure, we'll recreate it
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'country_features') THEN
        -- Check if it has the right columns
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'country_features' AND column_name = 'feature_name'
        ) THEN
            -- Table exists but wrong structure - drop it
            RAISE NOTICE 'Dropping existing country_features table with incompatible structure';
            DROP TABLE country_features CASCADE;
        END IF;
    END IF;
END $$;

-- Step 2: Create the country_features table with proper structure
CREATE TABLE IF NOT EXISTS country_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL, -- NG, US, GB, CA, GH
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    description TEXT,
    category VARCHAR(100) DEFAULT 'events',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_country_features_unique 
ON country_features (country_code, feature_name);

CREATE INDEX IF NOT EXISTS idx_country_features_country 
ON country_features (country_code);

CREATE INDEX IF NOT EXISTS idx_country_features_feature 
ON country_features (feature_name);

CREATE INDEX IF NOT EXISTS idx_country_features_enabled 
ON country_features (is_enabled);

-- Step 4: Create feature_categories table
CREATE TABLE IF NOT EXISTS feature_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0
);

-- Step 5: Insert feature categories
INSERT INTO feature_categories (name, description, icon, sort_order) VALUES
('payments', 'Payment processing and financial features', 'CreditCard', 1),
('events', 'Event creation and management', 'Calendar', 2),
('tickets', 'Ticketing and registration', 'Ticket', 3),
('communication', 'Marketing and communication tools', 'Mail', 4),
('marketing', 'Promotion and discovery features', 'TrendingUp', 5),
('advanced', 'Advanced and enterprise features', 'Settings', 6),
('mobile', 'Mobile and digital wallet features', 'Smartphone', 7),
('compliance', 'Legal and compliance features', 'Shield', 8)
ON CONFLICT (name) DO NOTHING;

-- Step 6: Insert default features for all active countries
DO $$
DECLARE
    country_record RECORD;
    feature_count INTEGER;
BEGIN
    -- Check if we already have features
    SELECT COUNT(*) INTO feature_count FROM country_features;
    
    IF feature_count = 0 THEN
        RAISE NOTICE 'Inserting default features for all countries...';
        
        -- Loop through active countries
        FOR country_record IN 
            SELECT code FROM countries WHERE is_active = true
        LOOP
            RAISE NOTICE 'Setting up features for country: %', country_record.code;
            
            -- Payment & Financial Features
            INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
            (country_record.code, 'payment_processing', true, 'Enable payment processing for events', 'payments'),
            (country_record.code, 'refunds', true, 'Allow ticket refunds', 'payments'),
            (country_record.code, 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
            (country_record.code, 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
            
            -- Event Features  
            (country_record.code, 'recurring_events', true, 'Allow creation of recurring events', 'events'),
            (country_record.code, 'virtual_events', true, 'Support for virtual/online events', 'events'),
            (country_record.code, 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
            (country_record.code, 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
            (country_record.code, 'custom_event_fields', true, 'Custom registration fields', 'events'),
            
            -- Ticketing Features
            (country_record.code, 'free_events', true, 'Allow free events with RSVP', 'tickets'),
            (country_record.code, 'paid_events', true, 'Enable paid ticketing', 'tickets'),
            (country_record.code, 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
            (country_record.code, 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
            (country_record.code, 'promo_codes', true, 'Promotional discount codes', 'tickets'),
            
            -- Communication Features
            (country_record.code, 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
            (country_record.code, 'sms_campaigns', CASE WHEN country_record.code = 'NG' THEN true ELSE false END, 'SMS marketing campaigns', 'communication'),
            (country_record.code, 'whatsapp_campaigns', CASE WHEN country_record.code IN ('NG', 'GH') THEN true ELSE false END, 'WhatsApp marketing', 'communication'),
            (country_record.code, 'push_notifications', true, 'Mobile push notifications', 'communication'),
            
            -- Marketing & Promotion
            (country_record.code, 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
            (country_record.code, 'social_sharing', true, 'Social media event sharing', 'marketing'),
            (country_record.code, 'event_discovery', true, 'Public event listings', 'marketing'),
            (country_record.code, 'featured_events', true, 'Featured event promotions', 'marketing'),
            
            -- Advanced Features
            (country_record.code, 'venue_management', true, 'Venue layout designer', 'advanced'),
            (country_record.code, 'iot_integration', CASE WHEN country_record.code IN ('NG', 'US', 'GB') THEN true ELSE false END, 'IoT venue monitoring', 'advanced'),
            (country_record.code, 'api_access', CASE WHEN country_record.code IN ('US', 'GB') THEN true ELSE false END, 'API access for developers', 'advanced'),
            (country_record.code, 'white_label', false, 'White-label event platform', 'advanced'),
            
            -- Mobile Features
            (country_record.code, 'mobile_checkin', true, 'QR code check-in', 'mobile'),
            (country_record.code, 'apple_wallet', CASE WHEN country_record.code IN ('US', 'GB', 'CA') THEN true ELSE false END, 'Apple Wallet tickets', 'mobile'),
            (country_record.code, 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
            
            -- Compliance & Legal
            (country_record.code, 'gdpr_compliance', CASE WHEN country_record.code = 'GB' THEN true ELSE false END, 'GDPR data protection', 'compliance'),
            (country_record.code, 'tax_reporting', CASE WHEN country_record.code IN ('US', 'GB', 'CA') THEN true ELSE false END, 'Automated tax reporting', 'compliance'),
            (country_record.code, 'kyc_verification', CASE WHEN country_record.code = 'NG' THEN true ELSE false END, 'KYC for organizers', 'compliance')
            
            ON CONFLICT (country_code, feature_name) DO NOTHING;
        END LOOP;
        
        RAISE NOTICE 'Feature setup complete!';
    ELSE
        RAISE NOTICE 'Features already exist (% records), skipping default setup', feature_count;
    END IF;
END $$;

-- Step 7: Create admin logs table for feature changes
CREATE TABLE IF NOT EXISTS admin_feature_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID,
    country_code VARCHAR(2) NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    old_value BOOLEAN,
    new_value BOOLEAN,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 8: Verification queries
SELECT 'Migration completed successfully!' as status;

-- Show setup summary
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

-- Show feature distribution by category
SELECT 
    category,
    COUNT(*) as total_features,
    COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled_features,
    ARRAY_AGG(DISTINCT country_code) as countries
FROM country_features
GROUP BY category
ORDER BY category;