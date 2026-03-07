-- ============================================================================
-- RackParty v2 Migration
-- Adds: design_metadata column, wall posts, announcements, activity log
-- ============================================================================

-- 1. Design metadata column on party_invites
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS design_metadata JSONB DEFAULT '{}';
-- Stores: { templateId, accentColor, textOverride, fontId, fontScale, tagline, backgroundPattern }

-- 2. Guest Wall Posts
CREATE TABLE IF NOT EXISTS party_invite_wall_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  author_guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  is_host BOOLEAN DEFAULT false,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wall_posts_invite_id ON party_invite_wall_posts(invite_id);
CREATE INDEX IF NOT EXISTS idx_wall_posts_created_at ON party_invite_wall_posts(created_at DESC);

ALTER TABLE party_invite_wall_posts ENABLE ROW LEVEL SECURITY;

-- Organizer (host) can do everything
DROP POLICY IF EXISTS "wall_posts_organizer_all" ON party_invite_wall_posts;
CREATE POLICY "wall_posts_organizer_all" ON party_invite_wall_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      JOIN organizers o ON o.id = pi.organizer_id
      WHERE pi.id = party_invite_wall_posts.invite_id
        AND o.user_id = auth.uid()
    )
  );

-- Anyone can read wall posts on active invites
DROP POLICY IF EXISTS "wall_posts_public_select" ON party_invite_wall_posts;
CREATE POLICY "wall_posts_public_select" ON party_invite_wall_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_wall_posts.invite_id
        AND pi.is_active = true
    )
  );

-- Anyone can insert wall posts on active invites
DROP POLICY IF EXISTS "wall_posts_public_insert" ON party_invite_wall_posts;
CREATE POLICY "wall_posts_public_insert" ON party_invite_wall_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_wall_posts.invite_id
        AND pi.is_active = true
    )
  );

-- 3. Host Announcements
CREATE TABLE IF NOT EXISTS party_invite_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  send_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_invite_id ON party_invite_announcements(invite_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON party_invite_announcements(created_at DESC);

ALTER TABLE party_invite_announcements ENABLE ROW LEVEL SECURITY;

-- Organizer full CRUD
DROP POLICY IF EXISTS "announcements_organizer_all" ON party_invite_announcements;
CREATE POLICY "announcements_organizer_all" ON party_invite_announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizers o
      WHERE o.id = party_invite_announcements.organizer_id
        AND o.user_id = auth.uid()
    )
  );

-- Anyone can read announcements on active invites
DROP POLICY IF EXISTS "announcements_public_select" ON party_invite_announcements;
CREATE POLICY "announcements_public_select" ON party_invite_announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_announcements.invite_id
        AND pi.is_active = true
    )
  );

-- 4. Activity Log
CREATE TABLE IF NOT EXISTS party_invite_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_invite_id ON party_invite_activity(invite_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON party_invite_activity(created_at DESC);

ALTER TABLE party_invite_activity ENABLE ROW LEVEL SECURITY;

-- Organizer can read activity
DROP POLICY IF EXISTS "activity_organizer_select" ON party_invite_activity;
CREATE POLICY "activity_organizer_select" ON party_invite_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      JOIN organizers o ON o.id = pi.organizer_id
      WHERE pi.id = party_invite_activity.invite_id
        AND o.user_id = auth.uid()
    )
  );

-- Organizer can insert activity
DROP POLICY IF EXISTS "activity_organizer_insert" ON party_invite_activity;
CREATE POLICY "activity_organizer_insert" ON party_invite_activity
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_invites pi
      JOIN organizers o ON o.id = pi.organizer_id
      WHERE pi.id = party_invite_activity.invite_id
        AND o.user_id = auth.uid()
    )
  );
