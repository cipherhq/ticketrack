-- ============================================================================
-- SEED ALL PLATFORM SETTINGS DATA
-- ============================================================================
-- This script restores ALL platform settings data that may have been deleted:
-- 1. Currencies
-- 2. Countries (with fee settings)
-- 3. Event Categories
-- 4. Features
-- 5. Country Features
-- 6. Platform Settings
-- 7. Platform Branding
-- 8. Platform Limits
-- 9. Fast Payout Settings
-- 
-- Run this in your Supabase SQL Editor (Production or Dev)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: SEED CURRENCIES
-- ============================================================================

-- Insert currencies if they don't exist (with locale and sort_order)
INSERT INTO currencies (code, name, symbol, locale, is_active, created_at)
VALUES
    ('NGN', 'Nigerian Naira', '₦', 'en-NG', true, NOW()),
    ('USD', 'US Dollar', '$', 'en-US', true, NOW()),
    ('GBP', 'British Pound', '£', 'en-GB', true, NOW()),
    ('CAD', 'Canadian Dollar', 'C$', 'en-CA', true, NOW()),
    ('GHS', 'Ghanaian Cedi', 'GH₵', 'en-GH', true, NOW())
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    locale = EXCLUDED.locale,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 2: SEED COUNTRIES (with full fee configuration)
-- ============================================================================

-- Insert countries with complete fee settings
INSERT INTO countries (
    code, name, is_active, default_currency,
    platform_fee_percentage, service_fee_percentage, service_fee_fixed,
    payment_processing_fee_percentage, payout_fee, min_payout_amount,
    payment_provider,
    service_fee_fixed_per_ticket, processing_fee_fixed_per_order,
    stripe_processing_fee_pct, stripe_processing_fee_fixed,
    paystack_processing_fee_pct, paystack_processing_fee_fixed,
    flutterwave_processing_fee_pct, flutterwave_processing_fee_fixed,
    created_at, updated_at
)
VALUES
    -- Nigeria (Paystack/Flutterwave)
    ('NG', 'Nigeria', true, 'NGN', 
     10.00, 5.00, 0, 1.5, 50, 5000, 'paystack',
     0, 0, 2.9, 0.30, 1.5, 100, 1.4, 0,
     NOW(), NOW()),
    -- United States (Stripe)
    ('US', 'United States', true, 'USD',
     10.00, 5.00, 0, 2.9, 0.30, 50,
     'stripe',
     0, 0, 2.9, 0.30, 1.5, 100, 1.4, 0,
     NOW(), NOW()),
    -- United Kingdom (Stripe)
    ('GB', 'United Kingdom', true, 'GBP',
     10.00, 5.00, 0, 2.9, 0.30, 50,
     'stripe',
     0, 0, 2.9, 0.30, 1.5, 100, 1.4, 0,
     NOW(), NOW()),
    -- Canada (Stripe)
    ('CA', 'Canada', true, 'CAD',
     10.00, 5.00, 0, 2.9, 0.30, 50,
     'stripe',
     0, 0, 2.9, 0.30, 1.5, 100, 1.4, 0,
     NOW(), NOW()),
    -- Ghana (Paystack/Flutterwave)
    ('GH', 'Ghana', true, 'GHS',
     10.00, 5.00, 0, 1.5, 50, 5000,
     'paystack',
     0, 0, 2.9, 0.30, 1.5, 100, 1.4, 0,
     NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    default_currency = EXCLUDED.default_currency,
    platform_fee_percentage = EXCLUDED.platform_fee_percentage,
    service_fee_percentage = EXCLUDED.service_fee_percentage,
    service_fee_fixed = EXCLUDED.service_fee_fixed,
    payment_processing_fee_percentage = EXCLUDED.payment_processing_fee_percentage,
    payout_fee = EXCLUDED.payout_fee,
    min_payout_amount = EXCLUDED.min_payout_amount,
    payment_provider = EXCLUDED.payment_provider,
    updated_at = NOW();

-- ============================================================================
-- STEP 3: SEED EVENT CATEGORIES
-- ============================================================================

-- Insert event categories if they don't exist
INSERT INTO categories (name, slug, icon, description, is_active, created_at)
VALUES
    ('Music & Concerts', 'music-concerts', '🎵', 'Live music performances, concerts, and music festivals', true, NOW()),
    ('Conferences', 'conferences', '💼', 'Business conferences, seminars, and professional gatherings', true, NOW()),
    ('Parties & Nightlife', 'parties-nightlife', '🎉', 'Parties, club events, and nightlife experiences', true, NOW()),
    ('Workshops', 'workshops', '📚', 'Educational workshops, training sessions, and skill-building events', true, NOW()),
    ('Networking', 'networking', '🤝', 'Networking events, meetups, and professional connections', true, NOW()),
    ('Comedy', 'comedy', '😂', 'Comedy shows, stand-up performances, and humor events', true, NOW()),
    ('Art & Culture', 'art-culture', '🎨', 'Art exhibitions, cultural events, and creative showcases', true, NOW()),
    ('Food & Dining', 'food-dining', '🍽️', 'Food festivals, culinary events, and dining experiences', true, NOW()),
    ('Sports', 'sports', '⚽', 'Sports events, tournaments, and athletic competitions', true, NOW()),
    ('Theater', 'theater', '🎭', 'Theater performances, plays, and dramatic arts', true, NOW()),
    ('Festivals', 'festivals', '🎪', 'Cultural festivals, celebrations, and community events', true, NOW()),
    ('Weddings', 'weddings', '❤️', 'Wedding ceremonies and celebrations', true, NOW()),
    ('Charity & Fundraising', 'charity-fundraising', '🌟', 'Charity events, fundraisers, and community service', true, NOW()),
    ('Technology', 'technology', '💻', 'Tech meetups, hackathons, and technology conferences', true, NOW()),
    ('Health & Wellness', 'health-wellness', '🧘', 'Yoga classes, wellness retreats, and health events', true, NOW()),
    ('Fashion', 'fashion', '👗', 'Fashion shows, style events, and clothing exhibitions', true, NOW()),
    ('Gaming', 'gaming', '🎮', 'Gaming tournaments, esports events, and video game competitions', true, NOW()),
    ('Film & Cinema', 'film-cinema', '🎬', 'Film screenings, movie premieres, and cinema events', true, NOW()),
    ('Outdoor & Adventure', 'outdoor-adventure', '🏃', 'Outdoor activities, adventure sports, and nature events', true, NOW()),
    ('Other', 'other', '📅', 'Other types of events', true, NOW())
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- STEP 4: SEED FEATURES TABLE
-- ============================================================================

-- Insert available features (master list)
INSERT INTO features (id, name, description, category)
VALUES
    ('payment_processing', 'Payment Processing', 'Enable payment processing for events', 'payments'),
    ('refunds', 'Refunds', 'Allow ticket refunds', 'payments'),
    ('payouts', 'Payouts', 'Enable automated payouts to organizers', 'payments'),
    ('subscription_billing', 'Subscription Billing', 'Subscription plans for organizers', 'payments'),
    ('recurring_events', 'Recurring Events', 'Allow creation of recurring events', 'events'),
    ('virtual_events', 'Virtual Events', 'Support for virtual/online events', 'events'),
    ('multi_day_events', 'Multi-Day Events', 'Enable multi-day event scheduling', 'events'),
    ('event_analytics', 'Event Analytics', 'Detailed analytics for organizers', 'events'),
    ('custom_event_fields', 'Custom Event Fields', 'Custom registration fields', 'events'),
    ('free_events', 'Free Events', 'Allow free events with RSVP', 'tickets'),
    ('paid_events', 'Paid Events', 'Enable paid ticketing', 'tickets'),
    ('ticket_transfers', 'Ticket Transfers', 'Allow ticket transfers between users', 'tickets'),
    ('group_discounts', 'Group Discounts', 'Bulk ticket discounts', 'tickets'),
    ('promo_codes', 'Promo Codes', 'Promotional discount codes', 'tickets'),
    ('email_campaigns', 'Email Campaigns', 'Email marketing to attendees', 'communication'),
    ('sms_campaigns', 'SMS Campaigns', 'SMS marketing campaigns', 'communication'),
    ('whatsapp_campaigns', 'WhatsApp Campaigns', 'WhatsApp marketing', 'communication'),
    ('push_notifications', 'Push Notifications', 'Mobile push notifications', 'communication'),
    ('affiliate_program', 'Affiliate Program', 'Affiliate/promoter system', 'marketing'),
    ('social_sharing', 'Social Sharing', 'Social media event sharing', 'marketing'),
    ('event_discovery', 'Event Discovery', 'Public event listings', 'marketing'),
    ('featured_events', 'Featured Events', 'Featured event promotions', 'marketing'),
    ('venue_management', 'Venue Management', 'Venue layout designer', 'advanced'),
    ('iot_integration', 'IoT Integration', 'IoT venue monitoring', 'advanced'),
    ('api_access', 'API Access', 'API access for developers', 'advanced'),
    ('white_label', 'White Label', 'White-label event platform', 'advanced'),
    ('mobile_checkin', 'Mobile Check-in', 'QR code check-in', 'mobile'),
    ('apple_wallet', 'Apple Wallet', 'Apple Wallet tickets', 'mobile'),
    ('google_wallet', 'Google Wallet', 'Google Wallet tickets', 'mobile'),
    ('gdpr_compliance', 'GDPR Compliance', 'GDPR data protection', 'compliance'),
    ('tax_reporting', 'Tax Reporting', 'Automated tax reporting', 'compliance'),
    ('kyc_verification', 'KYC Verification', 'KYC for organizers', 'compliance')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- ============================================================================
-- STEP 5: SEED COUNTRY FEATURES
-- ============================================================================

-- Nigeria features
INSERT INTO country_features (country_code, feature_name, is_enabled)
VALUES
    ('NG', 'payment_processing', true),
    ('NG', 'refunds', true),
    ('NG', 'payouts', true),
    ('NG', 'subscription_billing', true),
    ('NG', 'recurring_events', true),
    ('NG', 'virtual_events', true),
    ('NG', 'multi_day_events', true),
    ('NG', 'event_analytics', true),
    ('NG', 'custom_event_fields', true),
    ('NG', 'free_events', true),
    ('NG', 'paid_events', true),
    ('NG', 'ticket_transfers', true),
    ('NG', 'group_discounts', true),
    ('NG', 'promo_codes', true),
    ('NG', 'email_campaigns', true),
    ('NG', 'sms_campaigns', true),
    ('NG', 'whatsapp_campaigns', true),
    ('NG', 'push_notifications', true),
    ('NG', 'affiliate_program', true),
    ('NG', 'social_sharing', true),
    ('NG', 'event_discovery', true),
    ('NG', 'featured_events', true),
    ('NG', 'venue_management', true),
    ('NG', 'iot_integration', true),
    ('NG', 'api_access', false),
    ('NG', 'white_label', false),
    ('NG', 'mobile_checkin', true),
    ('NG', 'apple_wallet', false),
    ('NG', 'google_wallet', true),
    ('NG', 'gdpr_compliance', false),
    ('NG', 'tax_reporting', false),
    ('NG', 'kyc_verification', true)
ON CONFLICT (country_code, feature_name) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled;

-- US features
INSERT INTO country_features (country_code, feature_name, is_enabled)
VALUES
    ('US', 'payment_processing', true),
    ('US', 'refunds', true),
    ('US', 'payouts', true),
    ('US', 'subscription_billing', true),
    ('US', 'recurring_events', true),
    ('US', 'virtual_events', true),
    ('US', 'multi_day_events', true),
    ('US', 'event_analytics', true),
    ('US', 'custom_event_fields', true),
    ('US', 'free_events', true),
    ('US', 'paid_events', true),
    ('US', 'ticket_transfers', true),
    ('US', 'group_discounts', true),
    ('US', 'promo_codes', true),
    ('US', 'email_campaigns', true),
    ('US', 'sms_campaigns', false),
    ('US', 'whatsapp_campaigns', false),
    ('US', 'push_notifications', true),
    ('US', 'affiliate_program', true),
    ('US', 'social_sharing', true),
    ('US', 'event_discovery', true),
    ('US', 'featured_events', true),
    ('US', 'venue_management', true),
    ('US', 'iot_integration', true),
    ('US', 'api_access', true),
    ('US', 'white_label', false),
    ('US', 'mobile_checkin', true),
    ('US', 'apple_wallet', true),
    ('US', 'google_wallet', true),
    ('US', 'gdpr_compliance', false),
    ('US', 'tax_reporting', true),
    ('US', 'kyc_verification', false)
ON CONFLICT (country_code, feature_name) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled;

-- UK features
INSERT INTO country_features (country_code, feature_name, is_enabled)
VALUES
    ('GB', 'payment_processing', true),
    ('GB', 'refunds', true),
    ('GB', 'payouts', true),
    ('GB', 'subscription_billing', true),
    ('GB', 'recurring_events', true),
    ('GB', 'virtual_events', true),
    ('GB', 'multi_day_events', true),
    ('GB', 'event_analytics', true),
    ('GB', 'custom_event_fields', true),
    ('GB', 'free_events', true),
    ('GB', 'paid_events', true),
    ('GB', 'ticket_transfers', true),
    ('GB', 'group_discounts', true),
    ('GB', 'promo_codes', true),
    ('GB', 'email_campaigns', true),
    ('GB', 'sms_campaigns', false),
    ('GB', 'whatsapp_campaigns', false),
    ('GB', 'push_notifications', true),
    ('GB', 'affiliate_program', true),
    ('GB', 'social_sharing', true),
    ('GB', 'event_discovery', true),
    ('GB', 'featured_events', true),
    ('GB', 'venue_management', true),
    ('GB', 'iot_integration', true),
    ('GB', 'api_access', true),
    ('GB', 'white_label', false),
    ('GB', 'mobile_checkin', true),
    ('GB', 'apple_wallet', true),
    ('GB', 'google_wallet', true),
    ('GB', 'gdpr_compliance', true),
    ('GB', 'tax_reporting', true),
    ('GB', 'kyc_verification', false)
ON CONFLICT (country_code, feature_name) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled;

-- Canada features
INSERT INTO country_features (country_code, feature_name, is_enabled)
VALUES
    ('CA', 'payment_processing', true),
    ('CA', 'refunds', true),
    ('CA', 'payouts', true),
    ('CA', 'subscription_billing', true),
    ('CA', 'recurring_events', true),
    ('CA', 'virtual_events', true),
    ('CA', 'multi_day_events', true),
    ('CA', 'event_analytics', true),
    ('CA', 'custom_event_fields', true),
    ('CA', 'free_events', true),
    ('CA', 'paid_events', true),
    ('CA', 'ticket_transfers', true),
    ('CA', 'group_discounts', true),
    ('CA', 'promo_codes', true),
    ('CA', 'email_campaigns', true),
    ('CA', 'sms_campaigns', false),
    ('CA', 'whatsapp_campaigns', false),
    ('CA', 'push_notifications', true),
    ('CA', 'affiliate_program', true),
    ('CA', 'social_sharing', true),
    ('CA', 'event_discovery', true),
    ('CA', 'featured_events', true),
    ('CA', 'venue_management', true),
    ('CA', 'iot_integration', false),
    ('CA', 'api_access', false),
    ('CA', 'white_label', false),
    ('CA', 'mobile_checkin', true),
    ('CA', 'apple_wallet', true),
    ('CA', 'google_wallet', true),
    ('CA', 'gdpr_compliance', false),
    ('CA', 'tax_reporting', true),
    ('CA', 'kyc_verification', false)
ON CONFLICT (country_code, feature_name) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled;

-- Ghana features
INSERT INTO country_features (country_code, feature_name, is_enabled)
VALUES
    ('GH', 'payment_processing', true),
    ('GH', 'refunds', true),
    ('GH', 'payouts', true),
    ('GH', 'subscription_billing', true),
    ('GH', 'recurring_events', true),
    ('GH', 'virtual_events', true),
    ('GH', 'multi_day_events', true),
    ('GH', 'event_analytics', true),
    ('GH', 'custom_event_fields', true),
    ('GH', 'free_events', true),
    ('GH', 'paid_events', true),
    ('GH', 'ticket_transfers', true),
    ('GH', 'group_discounts', true),
    ('GH', 'promo_codes', true),
    ('GH', 'email_campaigns', true),
    ('GH', 'sms_campaigns', false),
    ('GH', 'whatsapp_campaigns', true),
    ('GH', 'push_notifications', true),
    ('GH', 'affiliate_program', true),
    ('GH', 'social_sharing', true),
    ('GH', 'event_discovery', true),
    ('GH', 'featured_events', true),
    ('GH', 'venue_management', true),
    ('GH', 'iot_integration', false),
    ('GH', 'api_access', false),
    ('GH', 'white_label', false),
    ('GH', 'mobile_checkin', true),
    ('GH', 'apple_wallet', false),
    ('GH', 'google_wallet', true),
    ('GH', 'gdpr_compliance', false),
    ('GH', 'tax_reporting', false),
    ('GH', 'kyc_verification', false)
ON CONFLICT (country_code, feature_name) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled;

-- ============================================================================
-- STEP 6: SEED PLATFORM SETTINGS
-- ============================================================================

INSERT INTO platform_settings (key, value, category, description)
VALUES
    ('rsvp_max_tickets_per_email', '10', 'rsvp', 'Maximum tickets one email can RSVP for per event'),
    ('rsvp_max_tickets_per_order', '10', 'rsvp', 'Maximum tickets per RSVP order'),
    ('rsvp_require_phone', 'true', 'rsvp', 'Require phone number for RSVPs'),
    ('free_event_order_status', 'completed', 'rsvp', 'Default order status for free events'),
    ('donation_failed_still_rsvp', 'true', 'rsvp', 'Allow RSVP even if optional donation fails'),
    ('contact_email', 'support@ticketrack.com', 'contact', 'Primary support email address'),
    ('contact_phone', '+1 (800) TICKETS', 'contact', 'Primary support phone number'),
    ('social_twitter', 'https://twitter.com/ticketrack', 'social', 'Twitter/X profile URL'),
    ('social_instagram', 'https://instagram.com/ticketrack', 'social', 'Instagram profile URL'),
    ('social_facebook', 'https://facebook.com/ticketrack', 'social', 'Facebook page URL'),
    ('social_linkedin', 'https://linkedin.com/company/ticketrack', 'social', 'LinkedIn company URL')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- ============================================================================
-- STEP 7: SEED PLATFORM BRANDING
-- ============================================================================

INSERT INTO platform_branding (id, company_name, tagline, primary_color, secondary_color, support_email, updated_at)
VALUES
    ('default', 'Ticketrack', 'Your Global Event Ticketing Partner', '#2969FF', '#0F0F0F', 'support@ticketrack.com', NOW())
ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    tagline = EXCLUDED.tagline,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    support_email = EXCLUDED.support_email,
    updated_at = NOW();

-- ============================================================================
-- STEP 8: SEED LEGAL DOCUMENTS (Using actual content from website)
-- ============================================================================

INSERT INTO legal_documents (id, title, content, version, is_required, applies_to, published_at, updated_at)
VALUES
    (
        'privacy-policy',
        'Privacy Policy',
        'At Ticketrack, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully to understand our practices regarding your personal data.

## 1. Information We Collect

• Personal Information: When you create an account, we collect your name, email address, phone number, and payment information.
• Usage Data: We collect information about how you interact with our platform, including events viewed, searches made, and tickets purchased.
• Device Information: We collect information about the device you use to access our platform, including IP address, browser type, and operating system.

## 2. How We Use Your Information

• To process ticket purchases and send confirmations
• To communicate with you about events and updates
• To send transactional SMS messages (ticket confirmations, event reminders, check-in codes)
• To personalize your experience and recommend events
• To improve our platform and develop new features
• To detect and prevent fraud and ensure security

## 3. Information Sharing

• Event Organizers: We share your name and contact information with event organizers for events you attend.
• Payment Processors: We share payment information with our payment processors (Paystack, Stripe, PayPal) to complete transactions.
• SMS Service Providers: We share your phone number with our SMS providers (Twilio for US/UK/EU, Termii for Nigeria, Ghana, Kenya, and other supported countries) solely to deliver transactional messages.
• Service Providers: We may share information with third-party service providers who assist in operating our platform.

## 4. SMS/Text Messaging Policy

• By providing your phone number and opting in, you consent to receive transactional SMS messages from Ticketrack.
• Message types include: ticket confirmations, event reminders, check-in codes, order updates, and account security alerts.
• Message frequency varies based on your activity (typically 1-5 messages per event purchase).
• Message and data rates may apply depending on your mobile carrier and plan.
• SMS messages are sent via Twilio (US, UK, EU customers) and Termii (Nigeria, Ghana, Kenya, and other supported countries).
• We do not send promotional or marketing messages via SMS without separate explicit consent.
• Your phone number is never sold, rented, or shared for third-party marketing purposes.
• To opt-out of SMS messages, reply STOP to any message or update your notification preferences in account settings.
• For help with SMS, reply HELP to any message or contact support@ticketrack.com.

## 5. Data Security

• We implement industry-standard security measures including encryption, secure servers, and regular security audits.
• All payment information is processed through PCI-compliant payment processors.
• We never store your full payment card details on our servers.
• Phone numbers are stored securely and transmitted via encrypted connections to SMS providers.

## 6. Your Rights (GDPR/UK GDPR)

• Right of Access: You can request a copy of your personal data at any time via your Profile Settings.
• Right to Rectification: You can update or correct your information through your account settings.
• Right to Erasure ("Right to be Forgotten"): You can delete your account and all associated data via Profile → Settings → Delete Account.
• Right to Data Portability: You can export all your data in JSON format via Profile → Settings → Export My Data.
• Right to Object: You can opt-out of marketing communications at any time via your account settings or email unsubscribe links.
• Right to Restrict Processing: You can request we limit how we use your data by contacting support@ticketrack.com.
• Right to Withdraw Consent: Where we rely on consent, you can withdraw it at any time without affecting prior processing.
• SMS Opt-out: Reply STOP to any SMS message or manage preferences in your account settings.
• Automated Decision Making: We do not use automated decision-making or profiling that significantly affects you.

## 6a. Legal Basis for Processing (GDPR Article 6)

• Contract Performance: Processing your data to provide ticketing services, process payments, and deliver tickets you''ve purchased.
• Legitimate Interests: Improving our services, fraud prevention, security, analytics, and customer support.
• Consent: Marketing communications and optional features require your explicit opt-in consent.
• Legal Obligations: Tax compliance, regulatory requirements, and responding to lawful requests from authorities.

## 6b. UK & EU Specific Rights

• For UK users: Your rights are protected under the UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018.
• For EU users: Your rights are protected under the EU General Data Protection Regulation (GDPR).
• Data Controller: Ticketrack Ltd is the data controller for your personal information.
• Supervisory Authority: You have the right to lodge a complaint with your local data protection authority (e.g., ICO in the UK).
• Contact for Data Protection: privacy@ticketrack.com or support@ticketrack.com

## 7. Cookies and Tracking

• We use cookies and similar technologies to improve your experience and analyze platform usage.
• You can manage cookie preferences through your browser settings.
• Essential cookies are required for the platform to function properly.

## 8. Data Retention

• We retain your personal information for as long as your account is active or as needed to provide services.
• Transaction records are kept for legal and tax compliance purposes.
• SMS delivery records are retained for 90 days for troubleshooting and compliance.
• You can request deletion of your data by contacting our support team.

## 9. International Data Transfers

• Your data may be processed in different countries depending on your location and the services used.
• For users in Nigeria, Ghana, Kenya, and other supported countries: Data is processed through Termii (Nigeria-based) and Paystack for local compliance.
• For US/UK/EU users: Data is processed through Twilio (US-based) and Stripe with appropriate data protection measures.
• We ensure all data transfers comply with applicable data protection laws including GDPR and NDPR.

## 10. Changes to This Policy

• We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements.
• We will notify you of significant changes via email or platform notification.
• Continued use of the platform after changes constitutes acceptance of the updated policy.

## Contact Us About Privacy

If you have any questions about this Privacy Policy or our data practices, please contact us:
privacy@ticketrack.com',
        '1.0',
        true,
        'all',
        NOW(),
        NOW()
    ),
    (
        'terms-of-service',
        'Terms of Service',
        'Welcome to Ticketrack. These Terms of Service govern your use of our platform and services. By using Ticketrack, you agree to these terms in full. Please read them carefully before using our services.

## 1. Acceptance of Terms

By accessing or using the Ticketrack platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

## 2. User Accounts

You must create an account to purchase tickets or host events. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must be at least 18 years old to create an account.

## 3. Ticket Purchases

When you purchase a ticket through Ticketrack, you enter into a direct agreement with the event organizer. Ticketrack acts as an intermediary facilitating the transaction. All ticket sales are final unless the event is cancelled or the organizer offers refunds.

## 4. Refund Policy

Refund policies are set by individual event organizers. Ticketrack will process refunds according to the organizer''s policy. If an event is cancelled, Ticketrack will facilitate full refunds including service fees within 14 business days.

## 5. Event Organizer Responsibilities

Event organizers are responsible for accurate event information, delivering the promised event experience, handling attendee inquiries, and complying with all applicable laws and regulations.

## 6. Prohibited Conduct

Users may not resell tickets at inflated prices (scalping), create fake events or misleading listings, use automated systems to purchase tickets, harass other users or organizers, or attempt to circumvent our security measures.

## 7. Intellectual Property

All content on the Ticketrack platform, including logos, designs, and text, is protected by intellectual property rights. Users may not copy, modify, or distribute our content without permission.

## 8. Limitation of Liability

Ticketrack is not liable for event quality, cancellations, or changes made by organizers. Our liability is limited to the amount of fees paid to Ticketrack for the specific transaction in question.

## 9. Modifications to Terms

We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or platform notification.

## 10. Governing Law

These Terms of Service are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through arbitration in Lagos, Nigeria.

## Questions About Our Terms?

If you have any questions about these Terms of Service, please contact our legal team:
legal@ticketrack.com',
        '1.0',
        true,
        'all',
        NOW(),
        NOW()
    ),
    (
        'cookie-policy',
        'Cookie Policy',
        'This Cookie Policy explains how Ticketrack ("we", "us", or "our") uses cookies and similar technologies when you visit our website. We are committed to being transparent about the technologies we use and giving you control over your privacy in accordance with GDPR and UK GDPR.

## 1. What Are Cookies?

• Cookies are small text files stored on your device when you visit websites.
• They help websites remember your preferences and improve your experience.
• Cookies can be "session" (deleted when you close your browser) or "persistent" (remain until they expire or you delete them).

## 2. Essential Cookies (Required)

• Authentication cookies that keep you logged in securely.
• Security cookies that protect against fraud and unauthorized access.
• Session cookies that remember your cart and checkout progress.
• These cookies are necessary for the website to function and cannot be disabled.

## 3. Functional Cookies

• Remember your language and region preferences.
• Store your display preferences (dark mode, layout).
• Remember form data to save you time.
• You can disable these, but some features may not work properly.

## 4. Analytics Cookies

• Help us understand how visitors use our website.
• Measure page views, session duration, and user journeys.
• Identify popular content and areas for improvement.
• We use aggregated, anonymized data where possible.
• Analytics cookies require your consent under GDPR/UK GDPR.

## 5. Marketing Cookies

• Used to deliver relevant advertisements on other platforms.
• Track the effectiveness of our marketing campaigns.
• Help us reach people who may be interested in our events.
• Marketing cookies require your explicit consent under GDPR/UK GDPR.
• You can withdraw consent at any time via our cookie settings.

## 6. Third-Party Cookies

• Payment processors (Stripe, Paystack, PayPal) may set cookies to process transactions securely.
• Social media plugins may set cookies if you interact with share buttons.
• Analytics services (if enabled) may set tracking cookies.
• These third parties have their own privacy policies governing their cookies.

## 7. Managing Cookies

• Cookie Banner: Use our cookie consent banner to manage preferences when you first visit.
• Cookie Settings: Click the "Cookie Preferences" button to change your choices anytime.
• Browser Settings: Most browsers let you block or delete cookies in their settings.
• Opt-out Links: Use industry opt-out tools like YourAdChoices or NAI opt-out.

## 8. Your Rights (GDPR/UK GDPR)

• You have the right to accept or reject non-essential cookies.
• We will not set analytics or marketing cookies without your consent.
• You can withdraw consent at any time without affecting prior processing.
• Essential cookies do not require consent as they are necessary for the service.

## 9. Cookie Retention

• Session cookies: Deleted when you close your browser.
• Authentication cookies: Up to 30 days (or until you log out).
• Preference cookies: Up to 1 year.
• Analytics cookies: Up to 2 years (if consented).
• Marketing cookies: Up to 1 year (if consented).

## 10. Updates to This Policy

• We may update this Cookie Policy to reflect changes in our practices or legal requirements.
• Significant changes will be communicated via our website or email.
• The "Last updated" date indicates when the policy was last revised.

## Questions About Cookies?

If you have questions about our use of cookies, please contact us:
privacy@ticketrack.com
Ticketrack Ltd',
        '1.0',
        false,
        'all',
        NOW(),
        NOW()
    ),
    (
        'refund-policy',
        'Refund Policy',
        '## Refund Policy

Refund policies are set by individual event organizers. Ticketrack will process refunds according to the organizer''s policy. If an event is cancelled, Ticketrack will facilitate full refunds including service fees within 14 business days.

### General Policy

Refund eligibility is determined by the individual event organizer''s refund policy. Ticketrack facilitates the refund process but does not make refund decisions.

### Organizer Refund Policies

Each event organizer sets their own refund policy, which may include:
• Full refunds up to a certain date
• Partial refunds
• No refunds
• Credit toward future events

### How to Request a Refund

1. Contact the event organizer directly
2. If the organizer approves, they will process the refund through Ticketrack
3. Refunds are processed to the original payment method

### Processing Time

Refunds typically take 5-10 business days to appear in your account, depending on your payment provider. For cancelled events, refunds including service fees are processed within 14 business days.

### Event Cancellations

If an event is cancelled by the organizer, you will receive a full refund automatically, including all service fees.

### Service Fees

Service fees may or may not be refundable depending on the organizer''s policy and the circumstances of the refund. For cancelled events, service fees are always refunded.

### Disputes

If you disagree with a refund decision, contact the event organizer. Ticketrack can facilitate communication but cannot override organizer decisions.

### Contact

For refund questions, contact support@ticketrack.com.',
        '1.0',
        false,
        'all',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    version = EXCLUDED.version,
    is_required = EXCLUDED.is_required,
    applies_to = EXCLUDED.applies_to,
    updated_at = NOW();

-- ============================================================================
-- STEP 9: SEED PLATFORM LIMITS
-- ============================================================================

-- Global limits
INSERT INTO platform_limits (id, country_code, limit_key, limit_value, description)
VALUES
    (gen_random_uuid(), NULL, 'max_tickets_per_order', 10, 'Maximum tickets per order'),
    (gen_random_uuid(), NULL, 'max_events_per_organizer', 1000, 'Maximum events per organizer'),
    (gen_random_uuid(), NULL, 'max_ticket_types_per_event', 20, 'Maximum ticket types per event')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 10: SEED FAST PAYOUT SETTINGS
-- ============================================================================

INSERT INTO fast_payout_settings (
    id, enabled, fee_percentage, min_ticket_sales_percentage,
    cap_bronze, cap_silver, cap_gold, cap_trusted,
    require_kyc, require_bank_verified,
    max_requests_per_event, cooldown_hours,
    updated_at
)
VALUES (
    gen_random_uuid(), true, 0.005, 50.00,
    70.00, 80.00, 90.00, 95.00,
    true, true,
    3, 24,
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    fee_percentage = EXCLUDED.fee_percentage,
    min_ticket_sales_percentage = EXCLUDED.min_ticket_sales_percentage,
    cap_bronze = EXCLUDED.cap_bronze,
    cap_silver = EXCLUDED.cap_silver,
    cap_gold = EXCLUDED.cap_gold,
    cap_trusted = EXCLUDED.cap_trusted,
    require_kyc = EXCLUDED.require_kyc,
    require_bank_verified = EXCLUDED.require_bank_verified,
    max_requests_per_event = EXCLUDED.max_requests_per_event,
    cooldown_hours = EXCLUDED.cooldown_hours,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show what was seeded
SELECT 'Currencies' as table_name, COUNT(*) as count FROM currencies
UNION ALL
SELECT 'Countries', COUNT(*) FROM countries
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Features', COUNT(*) FROM features
UNION ALL
SELECT 'Country Features', COUNT(*) FROM country_features
UNION ALL
SELECT 'Platform Settings', COUNT(*) FROM platform_settings
UNION ALL
SELECT 'Platform Limits', COUNT(*) FROM platform_limits
UNION ALL
SELECT 'Legal Documents', COUNT(*) FROM legal_documents;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- ✅ All Platform Settings data has been restored!
-- 
-- You should now have:
-- - 5 currencies (NGN, USD, GBP, CAD, GHS)
-- - 5 countries with full fee configurations
-- - 20 event categories
-- - 32 features
-- - 160 country-feature mappings (32 features × 5 countries)
-- - 11 platform settings
-- - Default platform branding
-- - Platform limits
-- - Fast payout settings
-- 
-- You can verify by running:
-- SELECT * FROM currencies;
-- SELECT * FROM countries;
-- SELECT * FROM categories WHERE is_active = true;
-- SELECT * FROM features;
-- SELECT * FROM country_features;
-- SELECT * FROM platform_settings;
-- SELECT * FROM platform_branding;
-- SELECT * FROM platform_limits;
-- SELECT * FROM legal_documents;
-- SELECT * FROM fast_payout_settings;
-- ============================================================================
