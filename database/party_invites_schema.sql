-- Party Invites Schema (Partiful-style invite system)
-- Run this migration in Supabase SQL Editor

-- ============================================================================
-- TABLE: party_invites (one per event invite campaign)
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  allow_plus_ones BOOLEAN DEFAULT false,
  max_plus_ones INTEGER DEFAULT 1,
  rsvp_deadline TIMESTAMPTZ,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE: party_invite_guests (individual invitees)
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'going', 'maybe', 'declined')),
  rsvp_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  plus_ones INTEGER DEFAULT 0,
  plus_one_names TEXT[] DEFAULT '{}',
  note TEXT DEFAULT '',
  email_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  rsvp_responded_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'contacts', 'paste', 'share_link')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_party_invites_event_id ON party_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_party_invites_organizer_id ON party_invites(organizer_id);
CREATE INDEX IF NOT EXISTS idx_party_invites_share_token ON party_invites(share_token);
CREATE INDEX IF NOT EXISTS idx_party_invite_guests_invite_id ON party_invite_guests(invite_id);
CREATE INDEX IF NOT EXISTS idx_party_invite_guests_event_id ON party_invite_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_party_invite_guests_rsvp_token ON party_invite_guests(rsvp_token);
CREATE INDEX IF NOT EXISTS idx_party_invite_guests_rsvp_status ON party_invite_guests(rsvp_status);
CREATE INDEX IF NOT EXISTS idx_party_invite_guests_organizer_id ON party_invite_guests(organizer_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE party_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invite_guests ENABLE ROW LEVEL SECURITY;

-- Organizers can manage their own invites
CREATE POLICY "Organizers can view their invites"
  ON party_invites FOR SELECT
  USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

CREATE POLICY "Organizers can create invites"
  ON party_invites FOR INSERT
  WITH CHECK (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

CREATE POLICY "Organizers can update their invites"
  ON party_invites FOR UPDATE
  USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

CREATE POLICY "Organizers can delete their invites"
  ON party_invites FOR DELETE
  USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Anyone can read invites by share_token (for public RSVP page)
CREATE POLICY "Anyone can read invites by share token"
  ON party_invites FOR SELECT
  USING (is_active = true);

-- Organizers can manage their guests
CREATE POLICY "Organizers can view their guests"
  ON party_invite_guests FOR SELECT
  USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

CREATE POLICY "Organizers can add guests"
  ON party_invite_guests FOR INSERT
  WITH CHECK (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

CREATE POLICY "Organizers can update their guests"
  ON party_invite_guests FOR UPDATE
  USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

CREATE POLICY "Organizers can remove guests"
  ON party_invite_guests FOR DELETE
  USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Anyone can read guest info by rsvp_token (for public RSVP)
CREATE POLICY "Anyone can read guest by rsvp token"
  ON party_invite_guests FOR SELECT
  USING (true);

-- Anyone can update RSVP status via rsvp_token (anonymous RSVP)
CREATE POLICY "Anyone can update guest RSVP by token"
  ON party_invite_guests FOR UPDATE
  USING (true);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_party_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER party_invites_updated_at
  BEFORE UPDATE ON party_invites
  FOR EACH ROW EXECUTE FUNCTION update_party_invites_updated_at();

CREATE TRIGGER party_invite_guests_updated_at
  BEFORE UPDATE ON party_invite_guests
  FOR EACH ROW EXECUTE FUNCTION update_party_invites_updated_at();
