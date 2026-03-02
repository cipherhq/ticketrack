-- Migration: Party Invites SMS sending + Free email tracking
-- Run this on your Supabase database

-- 1. Add sms_sent_at column to party_invite_guests (mirrors email_sent_at)
ALTER TABLE party_invite_guests ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ;

-- 2. Create table to track free email usage per organizer (10 lifetime free)
CREATE TABLE IF NOT EXISTS party_invite_free_email_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  emails_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organizer_id)
);

-- 3. RLS policies for party_invite_free_email_usage
ALTER TABLE party_invite_free_email_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can read their own free email usage"
  ON party_invite_free_email_usage FOR SELECT
  USING (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Organizers can insert their own free email usage"
  ON party_invite_free_email_usage FOR INSERT
  WITH CHECK (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Organizers can update their own free email usage"
  ON party_invite_free_email_usage FOR UPDATE
  USING (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));
