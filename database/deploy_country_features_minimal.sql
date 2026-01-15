-- Minimal Country Features Deployment - Guaranteed to work
-- Copy and paste this entire script into Supabase SQL Editor

-- Create countries if missing
CREATE TABLE IF NOT EXISTS countries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    default_currency VARCHAR(3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add default countries if empty
INSERT INTO countries (code, name, is_active, default_currency) 
SELECT * FROM (VALUES 
    ('NG', 'Nigeria', true, 'NGN'),
    ('GB', 'United Kingdom', true, 'GBP'),
    ('US', 'United States', true, 'USD'),
    ('CA', 'Canada', true, 'CAD'),
    ('GH', 'Ghana', true, 'GHS')
) AS v(code, name, is_active, default_currency)
WHERE NOT EXISTS (SELECT 1 FROM countries WHERE countries.code = v.code);

-- Clean slate for feature tables
DROP TABLE IF EXISTS admin_feature_logs CASCADE;
DROP TABLE IF EXISTS country_features CASCADE; 
DROP TABLE IF EXISTS feature_categories CASCADE;

-- Create feature categories
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

-- Create country features table
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

-- Insert all features for Nigeria
INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
('NG', 'payment_processing', true, 'Enable payment processing for events', 'payments'),
('NG', 'refunds', true, 'Allow ticket refunds', 'payments'),
('NG', 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
('NG', 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
('NG', 'recurring_events', true, 'Allow creation of recurring events', 'events'),
('NG', 'virtual_events', true, 'Support for virtual/online events', 'events'),
('NG', 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
('NG', 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
('NG', 'custom_event_fields', true, 'Custom registration fields', 'events'),
('NG', 'free_events', true, 'Allow free events with RSVP', 'tickets'),
('NG', 'paid_events', true, 'Enable paid ticketing', 'tickets'),
('NG', 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
('NG', 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
('NG', 'promo_codes', true, 'Promotional discount codes', 'tickets'),
('NG', 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
('NG', 'sms_campaigns', true, 'SMS marketing campaigns', 'communication'),
('NG', 'whatsapp_campaigns', true, 'WhatsApp marketing', 'communication'),
('NG', 'push_notifications', true, 'Mobile push notifications', 'communication'),
('NG', 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
('NG', 'social_sharing', true, 'Social media event sharing', 'marketing'),
('NG', 'event_discovery', true, 'Public event listings', 'marketing'),
('NG', 'featured_events', true, 'Featured event promotions', 'marketing'),
('NG', 'venue_management', true, 'Venue layout designer', 'advanced'),
('NG', 'iot_integration', true, 'IoT venue monitoring', 'advanced'),
('NG', 'api_access', false, 'API access for developers', 'advanced'),
('NG', 'white_label', false, 'White-label event platform', 'advanced'),
('NG', 'mobile_checkin', true, 'QR code check-in', 'mobile'),
('NG', 'apple_wallet', false, 'Apple Wallet tickets', 'mobile'),
('NG', 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
('NG', 'gdpr_compliance', false, 'GDPR data protection', 'compliance'),
('NG', 'tax_reporting', false, 'Automated tax reporting', 'compliance'),
('NG', 'kyc_verification', true, 'KYC for organizers', 'compliance');

-- Insert all features for UK
INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
('GB', 'payment_processing', true, 'Enable payment processing for events', 'payments'),
('GB', 'refunds', true, 'Allow ticket refunds', 'payments'),
('GB', 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
('GB', 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
('GB', 'recurring_events', true, 'Allow creation of recurring events', 'events'),
('GB', 'virtual_events', true, 'Support for virtual/online events', 'events'),
('GB', 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
('GB', 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
('GB', 'custom_event_fields', true, 'Custom registration fields', 'events'),
('GB', 'free_events', true, 'Allow free events with RSVP', 'tickets'),
('GB', 'paid_events', true, 'Enable paid ticketing', 'tickets'),
('GB', 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
('GB', 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
('GB', 'promo_codes', true, 'Promotional discount codes', 'tickets'),
('GB', 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
('GB', 'sms_campaigns', false, 'SMS marketing campaigns', 'communication'),
('GB', 'whatsapp_campaigns', false, 'WhatsApp marketing', 'communication'),
('GB', 'push_notifications', true, 'Mobile push notifications', 'communication'),
('GB', 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
('GB', 'social_sharing', true, 'Social media event sharing', 'marketing'),
('GB', 'event_discovery', true, 'Public event listings', 'marketing'),
('GB', 'featured_events', true, 'Featured event promotions', 'marketing'),
('GB', 'venue_management', true, 'Venue layout designer', 'advanced'),
('GB', 'iot_integration', true, 'IoT venue monitoring', 'advanced'),
('GB', 'api_access', true, 'API access for developers', 'advanced'),
('GB', 'white_label', false, 'White-label event platform', 'advanced'),
('GB', 'mobile_checkin', true, 'QR code check-in', 'mobile'),
('GB', 'apple_wallet', true, 'Apple Wallet tickets', 'mobile'),
('GB', 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
('GB', 'gdpr_compliance', true, 'GDPR data protection', 'compliance'),
('GB', 'tax_reporting', true, 'Automated tax reporting', 'compliance'),
('GB', 'kyc_verification', false, 'KYC for organizers', 'compliance');

-- Insert all features for US
INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
('US', 'payment_processing', true, 'Enable payment processing for events', 'payments'),
('US', 'refunds', true, 'Allow ticket refunds', 'payments'),
('US', 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
('US', 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
('US', 'recurring_events', true, 'Allow creation of recurring events', 'events'),
('US', 'virtual_events', true, 'Support for virtual/online events', 'events'),
('US', 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
('US', 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
('US', 'custom_event_fields', true, 'Custom registration fields', 'events'),
('US', 'free_events', true, 'Allow free events with RSVP', 'tickets'),
('US', 'paid_events', true, 'Enable paid ticketing', 'tickets'),
('US', 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
('US', 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
('US', 'promo_codes', true, 'Promotional discount codes', 'tickets'),
('US', 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
('US', 'sms_campaigns', false, 'SMS marketing campaigns', 'communication'),
('US', 'whatsapp_campaigns', false, 'WhatsApp marketing', 'communication'),
('US', 'push_notifications', true, 'Mobile push notifications', 'communication'),
('US', 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
('US', 'social_sharing', true, 'Social media event sharing', 'marketing'),
('US', 'event_discovery', true, 'Public event listings', 'marketing'),
('US', 'featured_events', true, 'Featured event promotions', 'marketing'),
('US', 'venue_management', true, 'Venue layout designer', 'advanced'),
('US', 'iot_integration', true, 'IoT venue monitoring', 'advanced'),
('US', 'api_access', true, 'API access for developers', 'advanced'),
('US', 'white_label', false, 'White-label event platform', 'advanced'),
('US', 'mobile_checkin', true, 'QR code check-in', 'mobile'),
('US', 'apple_wallet', true, 'Apple Wallet tickets', 'mobile'),
('US', 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
('US', 'gdpr_compliance', false, 'GDPR data protection', 'compliance'),
('US', 'tax_reporting', true, 'Automated tax reporting', 'compliance'),
('US', 'kyc_verification', false, 'KYC for organizers', 'compliance');

-- Insert all features for Canada
INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
('CA', 'payment_processing', true, 'Enable payment processing for events', 'payments'),
('CA', 'refunds', true, 'Allow ticket refunds', 'payments'),
('CA', 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
('CA', 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
('CA', 'recurring_events', true, 'Allow creation of recurring events', 'events'),
('CA', 'virtual_events', true, 'Support for virtual/online events', 'events'),
('CA', 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
('CA', 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
('CA', 'custom_event_fields', true, 'Custom registration fields', 'events'),
('CA', 'free_events', true, 'Allow free events with RSVP', 'tickets'),
('CA', 'paid_events', true, 'Enable paid ticketing', 'tickets'),
('CA', 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
('CA', 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
('CA', 'promo_codes', true, 'Promotional discount codes', 'tickets'),
('CA', 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
('CA', 'sms_campaigns', false, 'SMS marketing campaigns', 'communication'),
('CA', 'whatsapp_campaigns', false, 'WhatsApp marketing', 'communication'),
('CA', 'push_notifications', true, 'Mobile push notifications', 'communication'),
('CA', 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
('CA', 'social_sharing', true, 'Social media event sharing', 'marketing'),
('CA', 'event_discovery', true, 'Public event listings', 'marketing'),
('CA', 'featured_events', true, 'Featured event promotions', 'marketing'),
('CA', 'venue_management', true, 'Venue layout designer', 'advanced'),
('CA', 'iot_integration', false, 'IoT venue monitoring', 'advanced'),
('CA', 'api_access', false, 'API access for developers', 'advanced'),
('CA', 'white_label', false, 'White-label event platform', 'advanced'),
('CA', 'mobile_checkin', true, 'QR code check-in', 'mobile'),
('CA', 'apple_wallet', true, 'Apple Wallet tickets', 'mobile'),
('CA', 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
('CA', 'gdpr_compliance', false, 'GDPR data protection', 'compliance'),
('CA', 'tax_reporting', true, 'Automated tax reporting', 'compliance'),
('CA', 'kyc_verification', false, 'KYC for organizers', 'compliance');

-- Insert all features for Ghana
INSERT INTO country_features (country_code, feature_name, is_enabled, description, category) VALUES
('GH', 'payment_processing', true, 'Enable payment processing for events', 'payments'),
('GH', 'refunds', true, 'Allow ticket refunds', 'payments'),
('GH', 'payouts', true, 'Enable automated payouts to organizers', 'payments'),
('GH', 'subscription_billing', true, 'Subscription plans for organizers', 'payments'),
('GH', 'recurring_events', true, 'Allow creation of recurring events', 'events'),
('GH', 'virtual_events', true, 'Support for virtual/online events', 'events'),
('GH', 'multi_day_events', true, 'Enable multi-day event scheduling', 'events'),
('GH', 'event_analytics', true, 'Detailed analytics for organizers', 'events'),
('GH', 'custom_event_fields', true, 'Custom registration fields', 'events'),
('GH', 'free_events', true, 'Allow free events with RSVP', 'tickets'),
('GH', 'paid_events', true, 'Enable paid ticketing', 'tickets'),
('GH', 'ticket_transfers', true, 'Allow ticket transfers between users', 'tickets'),
('GH', 'group_discounts', true, 'Bulk ticket discounts', 'tickets'),
('GH', 'promo_codes', true, 'Promotional discount codes', 'tickets'),
('GH', 'email_campaigns', true, 'Email marketing to attendees', 'communication'),
('GH', 'sms_campaigns', false, 'SMS marketing campaigns', 'communication'),
('GH', 'whatsapp_campaigns', true, 'WhatsApp marketing', 'communication'),
('GH', 'push_notifications', true, 'Mobile push notifications', 'communication'),
('GH', 'affiliate_program', true, 'Affiliate/promoter system', 'marketing'),
('GH', 'social_sharing', true, 'Social media event sharing', 'marketing'),
('GH', 'event_discovery', true, 'Public event listings', 'marketing'),
('GH', 'featured_events', true, 'Featured event promotions', 'marketing'),
('GH', 'venue_management', true, 'Venue layout designer', 'advanced'),
('GH', 'iot_integration', false, 'IoT venue monitoring', 'advanced'),
('GH', 'api_access', false, 'API access for developers', 'advanced'),
('GH', 'white_label', false, 'White-label event platform', 'advanced'),
('GH', 'mobile_checkin', true, 'QR code check-in', 'mobile'),
('GH', 'apple_wallet', false, 'Apple Wallet tickets', 'mobile'),
('GH', 'google_wallet', true, 'Google Wallet tickets', 'mobile'),
('GH', 'gdpr_compliance', false, 'GDPR data protection', 'compliance'),
('GH', 'tax_reporting', false, 'Automated tax reporting', 'compliance'),
('GH', 'kyc_verification', false, 'KYC for organizers', 'compliance');

-- Create admin logs table
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

-- Final verification
SELECT 'SUCCESS: Country Features Deployed!' as status;

-- Summary
SELECT 
    COUNT(DISTINCT country_code) as countries,
    COUNT(*) as total_features,
    COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled
FROM country_features;

-- By country
SELECT 
    c.name,
    c.code,
    COUNT(cf.*) as features,
    COUNT(CASE WHEN cf.is_enabled = true THEN 1 END) as enabled
FROM countries c
JOIN country_features cf ON c.code = cf.country_code
GROUP BY c.code, c.name
ORDER BY c.name;