-- Country-Based Feature Flag System for Admin Control
-- Allows admins to enable/disable features by country

-- Create country_features table if it doesn't exist
CREATE TABLE IF NOT EXISTS country_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL, -- NG, US, GB, CA, GH
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_country_features_unique 
ON country_features (country_code, feature_name);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_country_features_country ON country_features (country_code);
CREATE INDEX IF NOT EXISTS idx_country_features_feature ON country_features (feature_name);
CREATE INDEX IF NOT EXISTS idx_country_features_enabled ON country_features (is_enabled);

-- Insert default features for all active countries
-- First, get all active countries
DO $$
DECLARE
    country_record RECORD;
BEGIN
    -- Core Features
    FOR country_record IN SELECT code FROM countries WHERE is_active = true
    LOOP
        -- Payment & Financial Features
        INSERT INTO country_features (country_code, feature_name, is_enabled, description) VALUES
        (country_record.code, 'payment_processing', true, 'Enable payment processing for events'),
        (country_record.code, 'refunds', true, 'Allow ticket refunds'),
        (country_record.code, 'payouts', true, 'Enable automated payouts to organizers'),
        (country_record.code, 'subscription_billing', true, 'Subscription plans for organizers'),
        
        -- Event Features  
        (country_record.code, 'recurring_events', true, 'Allow creation of recurring events'),
        (country_record.code, 'virtual_events', true, 'Support for virtual/online events'),
        (country_record.code, 'multi_day_events', true, 'Enable multi-day event scheduling'),
        (country_record.code, 'event_analytics', true, 'Detailed analytics for organizers'),
        (country_record.code, 'custom_event_fields', true, 'Custom registration fields'),
        
        -- Ticketing Features
        (country_record.code, 'free_events', true, 'Allow free events with RSVP'),
        (country_record.code, 'paid_events', true, 'Enable paid ticketing'),
        (country_record.code, 'ticket_transfers', true, 'Allow ticket transfers between users'),
        (country_record.code, 'group_discounts', true, 'Bulk ticket discounts'),
        (country_record.code, 'promo_codes', true, 'Promotional discount codes'),
        
        -- Communication Features
        (country_record.code, 'email_campaigns', true, 'Email marketing to attendees'),
        (country_record.code, 'sms_campaigns', CASE WHEN country_record.code = 'NG' THEN true ELSE false END, 'SMS marketing campaigns'),
        (country_record.code, 'whatsapp_campaigns', CASE WHEN country_record.code IN ('NG', 'GH') THEN true ELSE false END, 'WhatsApp marketing'),
        (country_record.code, 'push_notifications', true, 'Mobile push notifications'),
        
        -- Marketing & Promotion
        (country_record.code, 'affiliate_program', true, 'Affiliate/promoter system'),
        (country_record.code, 'social_sharing', true, 'Social media event sharing'),
        (country_record.code, 'event_discovery', true, 'Public event listings'),
        (country_record.code, 'featured_events', true, 'Featured event promotions'),
        
        -- Advanced Features
        (country_record.code, 'venue_management', true, 'Venue layout designer'),
        (country_record.code, 'iot_integration', CASE WHEN country_record.code IN ('NG', 'US', 'GB') THEN true ELSE false END, 'IoT venue monitoring'),
        (country_record.code, 'api_access', CASE WHEN country_record.code IN ('US', 'GB') THEN true ELSE false END, 'API access for developers'),
        (country_record.code, 'white_label', false, 'White-label event platform'),
        
        -- Mobile Features
        (country_record.code, 'mobile_checkin', true, 'QR code check-in'),
        (country_record.code, 'apple_wallet', CASE WHEN country_record.code IN ('US', 'GB', 'CA') THEN true ELSE false END, 'Apple Wallet tickets'),
        (country_record.code, 'google_wallet', true, 'Google Wallet tickets'),
        
        -- Compliance & Legal
        (country_record.code, 'gdpr_compliance', CASE WHEN country_record.code = 'GB' THEN true ELSE false END, 'GDPR data protection'),
        (country_record.code, 'tax_reporting', CASE WHEN country_record.code IN ('US', 'GB', 'CA') THEN true ELSE false END, 'Automated tax reporting'),
        (country_record.code, 'kyc_verification', CASE WHEN country_record.code = 'NG' THEN true ELSE false END, 'KYC for organizers')
        
        ON CONFLICT (country_code, feature_name) DO NOTHING;
    END LOOP;
END $$;

-- Add some feature categories for better organization
CREATE TABLE IF NOT EXISTS feature_categories (
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
('compliance', 'Legal and compliance features', 'Shield', 8)
ON CONFLICT (name) DO NOTHING;

-- Add category to features table
ALTER TABLE country_features ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'events';

-- Update features with categories
UPDATE country_features SET category = 'payments' WHERE feature_name IN ('payment_processing', 'refunds', 'payouts', 'subscription_billing');
UPDATE country_features SET category = 'events' WHERE feature_name IN ('recurring_events', 'virtual_events', 'multi_day_events', 'event_analytics', 'custom_event_fields');
UPDATE country_features SET category = 'tickets' WHERE feature_name IN ('free_events', 'paid_events', 'ticket_transfers', 'group_discounts', 'promo_codes');
UPDATE country_features SET category = 'communication' WHERE feature_name IN ('email_campaigns', 'sms_campaigns', 'whatsapp_campaigns', 'push_notifications');
UPDATE country_features SET category = 'marketing' WHERE feature_name IN ('affiliate_program', 'social_sharing', 'event_discovery', 'featured_events');
UPDATE country_features SET category = 'advanced' WHERE feature_name IN ('venue_management', 'iot_integration', 'api_access', 'white_label');
UPDATE country_features SET category = 'mobile' WHERE feature_name IN ('mobile_checkin', 'apple_wallet', 'google_wallet');
UPDATE country_features SET category = 'compliance' WHERE feature_name IN ('gdpr_compliance', 'tax_reporting', 'kyc_verification');

-- Create admin logs table for feature changes
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

-- Verify the setup
SELECT 
    c.code as country,
    c.name as country_name,
    COUNT(cf.id) as total_features,
    COUNT(CASE WHEN cf.is_enabled = true THEN 1 END) as enabled_features,
    COUNT(CASE WHEN cf.is_enabled = false THEN 1 END) as disabled_features
FROM countries c
LEFT JOIN country_features cf ON c.code = cf.country_code
WHERE c.is_active = true
GROUP BY c.code, c.name
ORDER BY c.name;