-- ============================================================================
-- Fix Contacts Sync RLS Issue
-- ============================================================================
-- Problem: Nested RLS policies block the sync function's queries
-- Solution: Create SECURITY DEFINER helper function to bypass nested RLS
-- ============================================================================

-- ============================================================================
-- Step 1: Create SECURITY DEFINER Helper Function
-- ============================================================================
-- This function bypasses nested RLS when checking organizer ownership
CREATE OR REPLACE FUNCTION is_event_organizer(event_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
    JOIN organizers o ON e.organizer_id = o.id
    WHERE e.id = event_id_param AND o.user_id = auth.uid()
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_event_organizer(UUID) TO authenticated;

-- ============================================================================
-- Step 2: Fix Tickets RLS Policies
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop ALL old ticket organizer policies to avoid conflicts
DROP POLICY IF EXISTS "tickets_select_organizer" ON tickets;
DROP POLICY IF EXISTS "Organizers can view tickets for their events" ON tickets;
DROP POLICY IF EXISTS "Organizers can view their event tickets" ON tickets;
DROP POLICY IF EXISTS "organizers_view_tickets" ON tickets;
DROP POLICY IF EXISTS "tickets_organizer_select" ON tickets;
DROP POLICY IF EXISTS "Organizers can update tickets" ON tickets;
DROP POLICY IF EXISTS "Team members can view attendees" ON tickets;

-- Keep user and admin policies, just drop organizer-related ones
-- DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;  -- Keep this
-- DROP POLICY IF EXISTS "tickets_user_select" ON tickets;  -- Keep this
-- DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;  -- Keep this
-- DROP POLICY IF EXISTS "tickets_admin_all" ON tickets;  -- Keep this

-- Create clean organizer SELECT policy using the helper function
CREATE POLICY "tickets_organizer_select_v2" ON tickets
FOR SELECT USING (
  is_event_organizer(event_id)
);

-- Create clean organizer UPDATE policy
CREATE POLICY "tickets_organizer_update_v2" ON tickets
FOR UPDATE USING (
  is_event_organizer(event_id)
);

-- ============================================================================
-- Step 3: Fix support_tickets RLS (fixes 400 console errors)
-- ============================================================================

-- Check if table exists before adding policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
    -- Enable RLS
    ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

    -- Drop ALL duplicate policies first
    DROP POLICY IF EXISTS "Admins can manage all support_tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Admins full access tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can create support tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can create support_tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can view own support tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can view own support_tickets" ON support_tickets;
    DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
    DROP POLICY IF EXISTS "support_admin_all" ON support_tickets;
    DROP POLICY IF EXISTS "support_user_insert" ON support_tickets;
    DROP POLICY IF EXISTS "support_user_select" ON support_tickets;
    DROP POLICY IF EXISTS "support_user_update" ON support_tickets;
    DROP POLICY IF EXISTS "support_tickets_organizer_select" ON support_tickets;
    DROP POLICY IF EXISTS "support_tickets_user_select" ON support_tickets;
    DROP POLICY IF EXISTS "support_tickets_user_insert" ON support_tickets;
    DROP POLICY IF EXISTS "support_tickets_user_update" ON support_tickets;

    -- Create clean policy set
    CREATE POLICY "support_tickets_select_v2" ON support_tickets
    FOR SELECT USING (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

    CREATE POLICY "support_tickets_insert_v2" ON support_tickets
    FOR INSERT WITH CHECK (
      user_id = auth.uid()
    );

    CREATE POLICY "support_tickets_update_v2" ON support_tickets
    FOR UPDATE USING (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

    CREATE POLICY "support_tickets_admin_delete" ON support_tickets
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );
  END IF;
END $$;

-- ============================================================================
-- Step 4: Fix ticket_transfers RLS (fixes 400 console errors)
-- ============================================================================

-- Check if table exists before adding policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_transfers') THEN
    -- Enable RLS
    ALTER TABLE ticket_transfers ENABLE ROW LEVEL SECURITY;

    -- Drop ALL old policies first
    DROP POLICY IF EXISTS "System can insert transfers" ON ticket_transfers;
    DROP POLICY IF EXISTS "Users can view own transfers" ON ticket_transfers;
    DROP POLICY IF EXISTS "ticket_transfers_organizer_select" ON ticket_transfers;
    DROP POLICY IF EXISTS "ticket_transfers_user_select" ON ticket_transfers;
    DROP POLICY IF EXISTS "ticket_transfers_user_insert" ON ticket_transfers;
    DROP POLICY IF EXISTS "ticket_transfers_user_update" ON ticket_transfers;

    -- Create clean policy set using helper function
    CREATE POLICY "ticket_transfers_select_v2" ON ticket_transfers
    FOR SELECT USING (
      from_user_id = auth.uid() OR
      to_user_id = auth.uid() OR
      is_event_organizer(event_id)
    );

    CREATE POLICY "ticket_transfers_insert_v2" ON ticket_transfers
    FOR INSERT WITH CHECK (
      from_user_id = auth.uid() OR
      -- Allow system/service role inserts
      auth.uid() IS NULL
    );

    CREATE POLICY "ticket_transfers_update_v2" ON ticket_transfers
    FOR UPDATE USING (
      from_user_id = auth.uid() OR
      to_user_id = auth.uid() OR
      is_event_organizer(event_id)
    );
  END IF;
END $$;

-- ============================================================================
-- Step 5: Clean up and fix contacts table RLS policies
-- ============================================================================

-- Ensure contacts RLS is enabled
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Drop ALL duplicate contacts policies first
DROP POLICY IF EXISTS "Organizers can manage own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "organizers_delete_contacts" ON contacts;
DROP POLICY IF EXISTS "organizers_insert_contacts" ON contacts;
DROP POLICY IF EXISTS "organizers_select_contacts" ON contacts;
DROP POLICY IF EXISTS "organizers_update_contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_select_organizer" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_organizer" ON contacts;
DROP POLICY IF EXISTS "contacts_update_organizer" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_organizer" ON contacts;

-- Create single clean policy set for contacts
CREATE POLICY "contacts_organizer_select" ON contacts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organizers o
    WHERE o.id = organizer_id AND o.user_id = auth.uid()
  )
);

CREATE POLICY "contacts_organizer_insert" ON contacts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizers o
    WHERE o.id = organizer_id AND o.user_id = auth.uid()
  )
);

CREATE POLICY "contacts_organizer_update" ON contacts
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM organizers o
    WHERE o.id = organizer_id AND o.user_id = auth.uid()
  )
);

CREATE POLICY "contacts_organizer_delete" ON contacts
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM organizers o
    WHERE o.id = organizer_id AND o.user_id = auth.uid()
  )
);

-- ============================================================================
-- Verification Query (run separately to check policies)
-- ============================================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('tickets', 'events', 'contacts', 'support_tickets', 'ticket_transfers')
-- ORDER BY tablename, policyname;
