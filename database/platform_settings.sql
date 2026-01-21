-- Platform Settings Migration
-- Creates the platform_settings table for storing configurable platform values
-- All settings have defaults in the application code, so DB values are optional overrides

-- Create platform_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);

-- RLS Policies
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (settings are not sensitive)
DROP POLICY IF EXISTS "Platform settings are viewable by everyone" ON platform_settings;
CREATE POLICY "Platform settings are viewable by everyone" ON platform_settings
  FOR SELECT USING (true);

-- Only admins can update settings (handled at application level)
DROP POLICY IF EXISTS "Only authenticated users can update settings" ON platform_settings;
CREATE POLICY "Only authenticated users can update settings" ON platform_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Insert default settings (use ON CONFLICT to avoid duplicates)
-- NOTE: Currency is NOT a platform-wide setting - it's determined by organizer's country
INSERT INTO platform_settings (key, value, category, description) VALUES
  -- RSVP Settings
  ('rsvp_max_tickets_per_email', '10', 'rsvp', 'Maximum tickets one email can RSVP for per event'),
  ('rsvp_max_tickets_per_order', '10', 'rsvp', 'Maximum tickets per RSVP order'),
  ('rsvp_require_phone', 'true', 'rsvp', 'Require phone number for RSVPs'),
  ('free_event_order_status', 'completed', 'rsvp', 'Default order status for free events'),
  ('donation_failed_still_rsvp', 'true', 'rsvp', 'Allow RSVP even if optional donation fails'),
  
  -- Contact Information
  ('contact_email', 'support@ticketrack.com', 'contact', 'Primary support email address'),
  ('contact_phone', '+1 (800) TICKETS', 'contact', 'Primary support phone number'),
  
  -- Social Media Links
  ('social_twitter', 'https://twitter.com/ticketrack', 'social', 'Twitter/X profile URL'),
  ('social_instagram', 'https://instagram.com/ticketrack', 'social', 'Instagram profile URL'),
  ('social_facebook', 'https://facebook.com/ticketrack', 'social', 'Facebook page URL'),
  ('social_linkedin', 'https://linkedin.com/company/ticketrack', 'social', 'LinkedIn company URL')
  
ON CONFLICT (key) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_settings_updated_at ON platform_settings;
CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Verify creation
SELECT 'Platform settings table created with ' || COUNT(*) || ' default settings' AS status 
FROM platform_settings;
