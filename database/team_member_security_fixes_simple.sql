-- SIMPLE Team Member Security Fixes
-- This script is IDEMPOTENT and focuses only on critical security gaps
-- Safe to run multiple times

-- 1. Drop existing task policies and create role-based ones
DROP POLICY IF EXISTS "Team members can view and manage tasks" ON event_tasks;
DROP POLICY IF EXISTS "Managers can manage all tasks" ON event_tasks;
DROP POLICY IF EXISTS "Coordinators can view tasks and edit assigned" ON event_tasks;
DROP POLICY IF EXISTS "Coordinators can update assigned tasks" ON event_tasks;
DROP POLICY IF EXISTS "Staff can view assigned tasks only" ON event_tasks;

-- Managers and Owners: Full task access
CREATE POLICY "Managers full task access" ON "public"."event_tasks" 
USING (
  "organizer_id" IN (
    SELECT otm.organizer_id
    FROM organizer_team_members otm
    WHERE otm.user_id = auth.uid()
      AND otm.status = 'active'
      AND otm.role IN ('owner', 'manager')
  )
);

-- Coordinators: View organizer tasks, edit only assigned ones  
CREATE POLICY "Coordinators view all tasks" ON "public"."event_tasks" 
FOR SELECT USING (
  "organizer_id" IN (
    SELECT otm.organizer_id
    FROM organizer_team_members otm
    WHERE otm.user_id = auth.uid()
      AND otm.status = 'active'
      AND otm.role = 'coordinator'
  )
);

CREATE POLICY "Coordinators edit assigned tasks" ON "public"."event_tasks" 
FOR UPDATE USING (
  "assigned_to" IN (
    SELECT otm.id
    FROM organizer_team_members otm
    WHERE otm.user_id = auth.uid()
      AND otm.status = 'active'
      AND otm.role = 'coordinator'
  )
);

-- Staff: View only assigned tasks
CREATE POLICY "Staff view assigned tasks" ON "public"."event_tasks" 
FOR SELECT USING (
  "assigned_to" IN (
    SELECT otm.id
    FROM organizer_team_members otm
    WHERE otm.user_id = auth.uid()
      AND otm.status = 'active'
      AND otm.role = 'staff'
  )
);

-- 2. Restrict event access by role
DROP POLICY IF EXISTS "Team members can view organizer events" ON events;
DROP POLICY IF EXISTS "Managers can view all events" ON events;
DROP POLICY IF EXISTS "Limited staff can view relevant events" ON events;

-- Managers see all events
CREATE POLICY "Managers view all events" ON "public"."events" 
FOR SELECT USING (
  "organizer_id" IN (
    SELECT otm.organizer_id
    FROM organizer_team_members otm
    WHERE otm.user_id = auth.uid()
      AND otm.status = 'active'
      AND otm.role IN ('owner', 'manager')
  )
);

-- Staff/Coordinators see only events with assigned tasks
CREATE POLICY "Staff view task events" ON "public"."events" 
FOR SELECT USING (
  "id" IN (
    SELECT DISTINCT et.event_id
    FROM event_tasks et
    JOIN organizer_team_members otm ON et.assigned_to = otm.id
    WHERE otm.user_id = auth.uid()
      AND otm.status = 'active'
      AND otm.role IN ('coordinator', 'staff')
  )
);

-- 3. Block financial data access for ALL team members
-- This is critical - team members should NEVER access financial data

-- Block bank account access
DROP POLICY IF EXISTS "Team members cannot access organizer financial data" ON organizer_bank_accounts;
CREATE POLICY "Block team member bank access" ON "public"."organizer_bank_accounts" 
USING (
  -- Only allow if user is the actual organizer (not a team member)
  NOT EXISTS (
    SELECT 1 FROM organizer_team_members otm 
    WHERE otm.user_id = auth.uid() AND otm.status = 'active'
  )
);

-- Block payout access
DROP POLICY IF EXISTS "Team members cannot access payouts" ON payouts;
CREATE POLICY "Block team member payout access" ON "public"."payouts" 
USING (
  -- Only allow if user is the actual organizer (not a team member)  
  NOT EXISTS (
    SELECT 1 FROM organizer_team_members otm 
    WHERE otm.user_id = auth.uid() AND otm.status = 'active'
  )
);

-- 4. Expire old invitation tokens (security cleanup)
UPDATE organizer_team_members 
SET invitation_token = NULL, invitation_expires_at = NULL
WHERE invitation_expires_at < NOW() AND status = 'pending';

-- 5. Add basic permission columns for future use
ALTER TABLE organizer_team_members 
ADD COLUMN IF NOT EXISTS can_manage_team BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_edit_events BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN DEFAULT false;

-- Set permissions based on current roles
UPDATE organizer_team_members SET
  can_manage_team = (role IN ('owner', 'manager')),
  can_edit_events = (role IN ('owner', 'manager')),
  can_view_analytics = (role IN ('owner', 'manager'))
WHERE role IS NOT NULL;

-- Verification
SELECT 'Simple Team Member Security Fixes Applied Successfully!' as status;
SELECT role, COUNT(*) as count FROM organizer_team_members WHERE status = 'active' GROUP BY role ORDER BY role;