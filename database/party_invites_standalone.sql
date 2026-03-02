-- ============================================================================
-- Party Invites: Standalone Migration
-- Makes party_invites self-contained (no event dependency required)
-- ============================================================================

-- Add event-like fields directly to party_invites
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS venue_name VARCHAR(255) DEFAULT '';
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Make event_id nullable (keep column for backward compat)
ALTER TABLE party_invites ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE party_invite_guests ALTER COLUMN event_id DROP NOT NULL;
