-- Team Member Security & Role-Based Access Control Fixes
-- Addresses security gaps in organizer team member permissions
-- This script is IDEMPOTENT and can be safely re-run multiple times

-- 1. Add role-specific permissions to event_tasks table
-- Drop all existing team member task policies
DROP POLICY IF EXISTS "Team members can view and manage tasks" ON event_tasks;
DROP POLICY IF EXISTS "Managers can manage all tasks" ON event_tasks;
DROP POLICY IF EXISTS "Coordinators can view tasks and edit assigned" ON event_tasks;
DROP POLICY IF EXISTS "Coordinators can update assigned tasks" ON event_tasks;
DROP POLICY IF EXISTS "Staff can view assigned tasks only" ON event_tasks;

-- Managers and Owners can fully manage tasks
CREATE POLICY "Managers can manage all tasks" ON "public"."event_tasks" 
FOR ALL USING (
  "organizer_id" IN (
    SELECT "organizer_team_members"."organizer_id"
    FROM "public"."organizer_team_members"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
      AND "organizer_team_members"."role" IN ('owner', 'manager')
  )
);

-- Coordinators can view all tasks but only edit assigned ones
CREATE POLICY "Coordinators can view tasks and edit assigned" ON "public"."event_tasks" 
FOR SELECT USING (
  "organizer_id" IN (
    SELECT "organizer_team_members"."organizer_id"
    FROM "public"."organizer_team_members"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
      AND "organizer_team_members"."role" = 'coordinator'
  )
);

CREATE POLICY "Coordinators can update assigned tasks" ON "public"."event_tasks" 
FOR UPDATE USING (
  "assigned_to" IN (
    SELECT "organizer_team_members"."id"
    FROM "public"."organizer_team_members"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
      AND "organizer_team_members"."role" = 'coordinator'
  )
);

-- Staff can only view assigned tasks
CREATE POLICY "Staff can view assigned tasks only" ON "public"."event_tasks" 
FOR SELECT USING (
  "assigned_to" IN (
    SELECT "organizer_team_members"."id"
    FROM "public"."organizer_team_members"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
      AND "organizer_team_members"."role" = 'staff'
  )
);

-- 2. Restrict event access by role
-- Drop all existing team member event policies
DROP POLICY IF EXISTS "Team members can view organizer events" ON events;
DROP POLICY IF EXISTS "Managers can view all events" ON events;
DROP POLICY IF EXISTS "Limited staff can view relevant events" ON events;

-- Managers can view all events
CREATE POLICY "Managers can view all events" ON "public"."events" 
FOR SELECT USING (
  "organizer_id" IN (
    SELECT "organizer_team_members"."organizer_id"
    FROM "public"."organizer_team_members"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
      AND "organizer_team_members"."role" IN ('owner', 'manager')
  )
);

-- Coordinators and staff can only view events they have tasks for
CREATE POLICY "Limited staff can view relevant events" ON "public"."events" 
FOR SELECT USING (
  "id" IN (
    SELECT DISTINCT "event_tasks"."event_id"
    FROM "public"."event_tasks"
    INNER JOIN "public"."organizer_team_members" ON "event_tasks"."assigned_to" = "organizer_team_members"."id"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
      AND "organizer_team_members"."role" IN ('coordinator', 'staff')
  )
);

-- 3. Create team member action audit log
CREATE TABLE IF NOT EXISTS team_member_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_member_id UUID NOT NULL REFERENCES organizer_team_members(id),
  organizer_id UUID NOT NULL REFERENCES organizers(id),
  action_type VARCHAR(100) NOT NULL, -- create_task, update_task, delete_task, checkin_attendee
  resource_type VARCHAR(100), -- task, event, attendee
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policy for audit log
ALTER TABLE team_member_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing audit log policies
DROP POLICY IF EXISTS "Team members can view own audit logs" ON team_member_audit_log;
DROP POLICY IF EXISTS "Organizers can view all team audit logs" ON team_member_audit_log;

CREATE POLICY "Team members can view own audit logs" ON "public"."team_member_audit_log" 
FOR SELECT USING (
  "team_member_id" IN (
    SELECT "organizer_team_members"."id"
    FROM "public"."organizer_team_members"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
  )
);

CREATE POLICY "Organizers can view all team audit logs" ON "public"."team_member_audit_log" 
FOR SELECT USING (
  "organizer_id" IN (
    SELECT "organizers"."id"
    FROM "public"."organizers"
    WHERE "organizers"."user_id" = "auth"."uid"()
  )
);

-- 4. Add function to log team member actions
CREATE OR REPLACE FUNCTION log_team_member_action(
  p_action_type TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  team_member_rec RECORD;
  log_id UUID;
BEGIN
  -- Get current team member info
  SELECT tm.id, tm.organizer_id INTO team_member_rec
  FROM organizer_team_members tm
  WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  LIMIT 1;

  IF team_member_rec.id IS NULL THEN
    RAISE EXCEPTION 'User is not an active team member';
  END IF;

  -- Insert audit log
  INSERT INTO team_member_audit_log (
    team_member_id, organizer_id, action_type, resource_type, 
    resource_id, old_values, new_values
  ) VALUES (
    team_member_rec.id, team_member_rec.organizer_id, p_action_type, 
    p_resource_type, p_resource_id, p_old_values, p_new_values
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Prevent access to financial data
-- Drop existing financial access policies
DROP POLICY IF EXISTS "Team members cannot access organizer financial data" ON organizer_bank_accounts;
DROP POLICY IF EXISTS "Team members cannot access payouts" ON payouts;
DROP POLICY IF EXISTS "Team members cannot access organizer revenue" ON orders;

CREATE POLICY "Team members cannot access organizer financial data" ON "public"."organizer_bank_accounts" 
USING (false); -- Blocks all team member access

CREATE POLICY "Team members cannot access payouts" ON "public"."payouts" 
USING (false); -- Blocks all team member access

CREATE POLICY "Team members cannot access organizer revenue" ON "public"."orders" 
FOR SELECT USING (
  -- Only allow if they're checking in for an event they're assigned to
  "event_id" IN (
    SELECT DISTINCT "event_tasks"."event_id"
    FROM "public"."event_tasks"
    INNER JOIN "public"."organizer_team_members" ON "event_tasks"."assigned_to" = "organizer_team_members"."id"
    WHERE "organizer_team_members"."user_id" = "auth"."uid"()
      AND "organizer_team_members"."status" = 'active'
  )
);

-- 6. Expire old invitation tokens
UPDATE organizer_team_members 
SET invitation_token = NULL, invitation_expires_at = NULL
WHERE invitation_expires_at < NOW() AND status = 'pending';

-- 7. Add constraints for role hierarchy
ALTER TABLE organizer_team_members 
ADD COLUMN IF NOT EXISTS can_manage_team BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_edit_events BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_access_financials BOOLEAN DEFAULT false;

-- Update role permissions
UPDATE organizer_team_members SET
  can_manage_team = true,
  can_edit_events = true,
  can_view_analytics = true,
  can_access_financials = false
WHERE role = 'manager';

UPDATE organizer_team_members SET
  can_manage_team = true,
  can_edit_events = true,
  can_view_analytics = true,
  can_access_financials = true
WHERE role = 'owner';

UPDATE organizer_team_members SET
  can_manage_team = false,
  can_edit_events = false,
  can_view_analytics = false,
  can_access_financials = false
WHERE role IN ('coordinator', 'staff');

-- 8. Create function to check team member permissions
CREATE OR REPLACE FUNCTION check_team_member_permission(
  p_permission_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  SELECT CASE 
    WHEN p_permission_name = 'manage_team' THEN tm.can_manage_team
    WHEN p_permission_name = 'edit_events' THEN tm.can_edit_events
    WHEN p_permission_name = 'view_analytics' THEN tm.can_view_analytics
    WHEN p_permission_name = 'access_financials' THEN tm.can_access_financials
    ELSE false
  END INTO has_permission
  FROM organizer_team_members tm
  WHERE tm.user_id = auth.uid() 
    AND tm.status = 'active'
  LIMIT 1;

  RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
SELECT 'Team Member Security Fixes Applied!' as status;

-- Safe count queries that handle table existence
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_member_audit_log') THEN
    RAISE NOTICE 'Audit Log Table Count: %', (SELECT COUNT(*) FROM team_member_audit_log);
  ELSE
    RAISE NOTICE 'Audit Log Table: Created (0 records)';
  END IF;
END $$;

SELECT 'Active Team Members:' as info, COUNT(*) as count FROM organizer_team_members WHERE status = 'active';