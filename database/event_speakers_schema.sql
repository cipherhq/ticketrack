-- Event Speakers / Artists / Headliners Table
-- Allows organizers to showcase speakers, artists, performers, or headliners for their events

-- Create the event_speakers table
CREATE TABLE IF NOT EXISTS event_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),  -- e.g., "Keynote Speaker", "DJ", "Headliner", "Artist", "Panelist"
  bio TEXT,
  image_url TEXT,
  social_links JSONB DEFAULT '{}',  -- {twitter, instagram, linkedin, website, facebook, tiktok}
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups by event_id
CREATE INDEX IF NOT EXISTS idx_event_speakers_event_id ON event_speakers(event_id);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_event_speakers_display_order ON event_speakers(event_id, display_order);

-- Enable RLS
ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Public can view speakers for published events" ON event_speakers;
DROP POLICY IF EXISTS "Organizers can view their event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Organizers can add speakers to their events" ON event_speakers;
DROP POLICY IF EXISTS "Organizers can update their event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Organizers can delete their event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Service role full access to event_speakers" ON event_speakers;

-- RLS Policies

-- Public can view speakers for published events
CREATE POLICY "Public can view speakers for published events"
  ON event_speakers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_speakers.event_id
      AND events.status = 'published'
    )
  );

-- Organizers can view all speakers for their events
CREATE POLICY "Organizers can view their event speakers"
  ON event_speakers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN organizers ON events.organizer_id = organizers.id
      WHERE events.id = event_speakers.event_id
      AND organizers.user_id = auth.uid()
    )
  );

-- Organizers can insert speakers for their events
CREATE POLICY "Organizers can add speakers to their events"
  ON event_speakers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      JOIN organizers ON events.organizer_id = organizers.id
      WHERE events.id = event_speakers.event_id
      AND organizers.user_id = auth.uid()
    )
  );

-- Organizers can update speakers for their events
CREATE POLICY "Organizers can update their event speakers"
  ON event_speakers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN organizers ON events.organizer_id = organizers.id
      WHERE events.id = event_speakers.event_id
      AND organizers.user_id = auth.uid()
    )
  );

-- Organizers can delete speakers from their events
CREATE POLICY "Organizers can delete their event speakers"
  ON event_speakers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN organizers ON events.organizer_id = organizers.id
      WHERE events.id = event_speakers.event_id
      AND organizers.user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access to event_speakers"
  ON event_speakers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_speakers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_event_speakers_updated_at ON event_speakers;
CREATE TRIGGER trigger_event_speakers_updated_at
  BEFORE UPDATE ON event_speakers
  FOR EACH ROW
  EXECUTE FUNCTION update_event_speakers_updated_at();
