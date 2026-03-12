-- ============================================================================
-- RACKPARTY FEATURE EXPANSION — DATABASE MIGRATION
-- Run in Supabase SQL Editor (production)
-- ============================================================================

-- ============================================================================
-- Phase 1.2: Image Sharing on Wall
-- ============================================================================
ALTER TABLE party_invite_wall_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================================================
-- Phase 1.3: Reactions / "Boops" on RSVPs
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  target_guest_id UUID NOT NULL REFERENCES party_invite_guests(id) ON DELETE CASCADE,
  reactor_name TEXT NOT NULL,
  reactor_guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  emoji TEXT NOT NULL DEFAULT '🎉',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_reactions_invite ON party_invite_reactions(invite_id);
CREATE INDEX IF NOT EXISTS idx_party_invite_reactions_target ON party_invite_reactions(target_guest_id);

-- RLS for reactions
ALTER TABLE party_invite_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage reactions" ON party_invite_reactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_reactions.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read reactions for active invites" ON party_invite_reactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_reactions.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Public can insert reactions for active invites" ON party_invite_reactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_reactions.invite_id AND pi.is_active = true)
  );

-- ============================================================================
-- Phase 2.1: Potluck / "What to Bring" List
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  quantity INTEGER DEFAULT 1,
  claimed_by_guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  claimed_by_name TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_items_invite ON party_invite_items(invite_id);

ALTER TABLE party_invite_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage items" ON party_invite_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_items.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read items for active invites" ON party_invite_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_items.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Public can claim items for active invites" ON party_invite_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_items.invite_id AND pi.is_active = true)
  );

-- ============================================================================
-- Phase 2.2: Photo Album
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  uploaded_by_name TEXT NOT NULL,
  uploaded_by_guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  is_host BOOLEAN DEFAULT false,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_photos_invite ON party_invite_photos(invite_id);

CREATE TABLE IF NOT EXISTS party_invite_photo_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES party_invite_photos(id) ON DELETE CASCADE,
  liker_name TEXT NOT NULL,
  liker_guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(photo_id, liker_name)
);
CREATE INDEX IF NOT EXISTS idx_party_invite_photo_likes_photo ON party_invite_photo_likes(photo_id);

ALTER TABLE party_invite_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invite_photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage photos" ON party_invite_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_photos.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read photos for active invites" ON party_invite_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_photos.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Public can insert photos for active invites" ON party_invite_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_photos.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Organizers can manage photo likes" ON party_invite_photo_likes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invite_photos p JOIN party_invites pi ON pi.id = p.invite_id JOIN organizers o ON o.id = pi.organizer_id WHERE p.id = party_invite_photo_likes.photo_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read photo likes" ON party_invite_photo_likes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invite_photos p JOIN party_invites pi ON pi.id = p.invite_id WHERE p.id = party_invite_photo_likes.photo_id AND pi.is_active = true)
  );

CREATE POLICY "Public can insert photo likes" ON party_invite_photo_likes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM party_invite_photos p JOIN party_invites pi ON pi.id = p.invite_id WHERE p.id = party_invite_photo_likes.photo_id AND pi.is_active = true)
  );

CREATE POLICY "Public can delete own photo likes" ON party_invite_photo_likes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM party_invite_photos p JOIN party_invites pi ON pi.id = p.invite_id WHERE p.id = party_invite_photo_likes.photo_id AND pi.is_active = true)
  );

-- ============================================================================
-- Phase 2.3: Custom RSVP Questions
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text' CHECK (question_type IN ('text', 'single_choice', 'multi_choice')),
  options TEXT[] DEFAULT '{}',
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_questions_invite ON party_invite_questions(invite_id);

CREATE TABLE IF NOT EXISTS party_invite_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES party_invite_questions(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES party_invite_guests(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_choices TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, guest_id)
);
CREATE INDEX IF NOT EXISTS idx_party_invite_answers_question ON party_invite_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_party_invite_answers_guest ON party_invite_answers(guest_id);

ALTER TABLE party_invite_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invite_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage questions" ON party_invite_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_questions.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read questions for active invites" ON party_invite_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_questions.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Organizers can manage answers" ON party_invite_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invite_questions q JOIN party_invites pi ON pi.id = q.invite_id JOIN organizers o ON o.id = pi.organizer_id WHERE q.id = party_invite_answers.question_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read answers for active invites" ON party_invite_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invite_questions q JOIN party_invites pi ON pi.id = q.invite_id WHERE q.id = party_invite_answers.question_id AND pi.is_active = true)
  );

CREATE POLICY "Public can insert answers for active invites" ON party_invite_answers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM party_invite_questions q JOIN party_invites pi ON pi.id = q.invite_id WHERE q.id = party_invite_answers.question_id AND pi.is_active = true)
  );

-- ============================================================================
-- Phase 2.4: Auto-Reminders
-- ============================================================================
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS auto_remind_enabled BOOLEAN DEFAULT false;
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS auto_remind_hours_before INTEGER DEFAULT 24;
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS auto_remind_sent_at TIMESTAMPTZ;

-- ============================================================================
-- Phase 3.1: Date Polling
-- ============================================================================
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS date_poll_active BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS party_invite_date_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  date_option TIMESTAMPTZ NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_date_polls_invite ON party_invite_date_polls(invite_id);

CREATE TABLE IF NOT EXISTS party_invite_date_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id UUID NOT NULL REFERENCES party_invite_date_polls(id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  voter_guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  vote TEXT NOT NULL DEFAULT 'yes' CHECK (vote IN ('yes', 'maybe', 'no')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_option_id, voter_name)
);
CREATE INDEX IF NOT EXISTS idx_party_invite_date_votes_option ON party_invite_date_votes(poll_option_id);

ALTER TABLE party_invite_date_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invite_date_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage date polls" ON party_invite_date_polls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_date_polls.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read date polls for active invites" ON party_invite_date_polls
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_date_polls.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Organizers can manage date votes" ON party_invite_date_votes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invite_date_polls dp JOIN party_invites pi ON pi.id = dp.invite_id JOIN organizers o ON o.id = pi.organizer_id WHERE dp.id = party_invite_date_votes.poll_option_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read date votes for active invites" ON party_invite_date_votes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invite_date_polls dp JOIN party_invites pi ON pi.id = dp.invite_id WHERE dp.id = party_invite_date_votes.poll_option_id AND pi.is_active = true)
  );

CREATE POLICY "Public can insert date votes for active invites" ON party_invite_date_votes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM party_invite_date_polls dp JOIN party_invites pi ON pi.id = dp.invite_id WHERE dp.id = party_invite_date_votes.poll_option_id AND pi.is_active = true)
  );

CREATE POLICY "Public can update own date votes" ON party_invite_date_votes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM party_invite_date_polls dp JOIN party_invites pi ON pi.id = dp.invite_id WHERE dp.id = party_invite_date_votes.poll_option_id AND pi.is_active = true)
  );

-- ============================================================================
-- Phase 3.2: Co-Hosting
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_cohosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'cohost' CHECK (role IN ('cohost', 'viewer')),
  accepted_at TIMESTAMPTZ,
  invite_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invite_id, email)
);
CREATE INDEX IF NOT EXISTS idx_party_invite_cohosts_invite ON party_invite_cohosts(invite_id);
CREATE INDEX IF NOT EXISTS idx_party_invite_cohosts_user ON party_invite_cohosts(user_id);
CREATE INDEX IF NOT EXISTS idx_party_invite_cohosts_token ON party_invite_cohosts(invite_token);

ALTER TABLE party_invite_cohosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage cohosts" ON party_invite_cohosts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_cohosts.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Cohosts can read own cohost records" ON party_invite_cohosts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Public can read cohost by token" ON party_invite_cohosts
  FOR SELECT USING (true);

CREATE POLICY "Public can update cohost by token" ON party_invite_cohosts
  FOR UPDATE USING (true);

-- ============================================================================
-- Phase 3.3: Recurring Events
-- ============================================================================
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS series_id UUID;
ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;

-- ============================================================================
-- Phase 3.4: Money Collection / Cash Fund
-- ============================================================================
CREATE TABLE IF NOT EXISTS party_invite_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  goal_amount NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_funds_invite ON party_invite_funds(invite_id);

CREATE TABLE IF NOT EXISTS party_invite_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES party_invite_funds(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_id UUID REFERENCES party_invite_guests(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_reference TEXT,
  payment_provider TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_party_invite_contributions_fund ON party_invite_contributions(fund_id);

ALTER TABLE party_invite_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invite_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage funds" ON party_invite_funds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invites pi JOIN organizers o ON o.id = pi.organizer_id WHERE pi.id = party_invite_funds.invite_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read funds for active invites" ON party_invite_funds
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invites pi WHERE pi.id = party_invite_funds.invite_id AND pi.is_active = true)
  );

CREATE POLICY "Organizers can manage contributions" ON party_invite_contributions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM party_invite_funds f JOIN party_invites pi ON pi.id = f.invite_id JOIN organizers o ON o.id = pi.organizer_id WHERE f.id = party_invite_contributions.fund_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Public can read contributions for active invites" ON party_invite_contributions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_invite_funds f JOIN party_invites pi ON pi.id = f.invite_id WHERE f.id = party_invite_contributions.fund_id AND pi.is_active = true)
  );

CREATE POLICY "Public can insert contributions for active invites" ON party_invite_contributions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM party_invite_funds f JOIN party_invites pi ON pi.id = f.invite_id WHERE f.id = party_invite_contributions.fund_id AND pi.is_active = true)
  );

-- ============================================================================
-- HELPER FUNCTION: Is user a party host or cohost?
-- (Used for co-hosting RLS overhaul)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_party_host_or_cohost(p_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is the organizer (host)
  IF EXISTS (
    SELECT 1 FROM party_invites pi
    JOIN organizers o ON o.id = pi.organizer_id
    WHERE pi.id = p_invite_id AND o.user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is an accepted cohost
  IF EXISTS (
    SELECT 1 FROM party_invite_cohosts
    WHERE invite_id = p_invite_id
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
