-- Allow anonymous users to RSVP via share link (register as new guest)
-- Only allows insert when the invite is active
DROP POLICY IF EXISTS "Anyone can register via share link" ON party_invite_guests;
CREATE POLICY "Anyone can register via share link"
  ON party_invite_guests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_guests.invite_id
        AND pi.is_active = true
    )
  );
