-- =====================================================
-- ADDITIONAL TABLES FOR ADMIN PANEL
-- Run this in your Supabase SQL Editor
-- =====================================================

-- WhatsApp Broadcasts Table
CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES organizers(id),
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  recipient_type VARCHAR(50) DEFAULT 'event',
  event_id UUID REFERENCES events(id),
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Campaigns Table
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES organizers(id),
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  recipient_type VARCHAR(50) DEFAULT 'event',
  event_id UUID REFERENCES events(id),
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add refund columns to tickets table if not exists
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_rejection_reason TEXT;

-- RLS Policies for new tables
ALTER TABLE whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin can manage all WhatsApp broadcasts
CREATE POLICY "Admins can manage whatsapp_broadcasts" ON whatsapp_broadcasts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Organizers can manage their own broadcasts
CREATE POLICY "Organizers can manage own broadcasts" ON whatsapp_broadcasts
  FOR ALL USING (
    organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
  );

-- Admin can manage all SMS campaigns
CREATE POLICY "Admins can manage sms_campaigns" ON sms_campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Organizers can manage their own campaigns
CREATE POLICY "Organizers can manage own campaigns" ON sms_campaigns
  FOR ALL USING (
    organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
  );

-- Grant permissions
GRANT ALL ON whatsapp_broadcasts TO authenticated;
GRANT ALL ON sms_campaigns TO authenticated;

-- =====================================================
-- DON'T FORGET TO MAKE YOURSELF ADMIN!
-- Replace 'your-email@example.com' with your email
-- =====================================================
-- UPDATE profiles 
-- SET is_admin = true, admin_role = 'super_admin' 
-- WHERE email = 'your-email@example.com';
