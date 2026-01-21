-- Fix RLS policies for Group Buy feature
-- Run this in Supabase SQL Editor

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Anyone can view active group sessions" ON group_buy_sessions;
DROP POLICY IF EXISTS "Authenticated users can create group sessions" ON group_buy_sessions;
DROP POLICY IF EXISTS "Hosts can update their sessions" ON group_buy_sessions;
DROP POLICY IF EXISTS "Session members can view members" ON group_buy_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_buy_members;
DROP POLICY IF EXISTS "Members can update their own record" ON group_buy_members;
DROP POLICY IF EXISTS "Session members can view messages" ON group_buy_messages;
DROP POLICY IF EXISTS "Session members can send messages" ON group_buy_messages;

-- Sessions: More permissive policies
CREATE POLICY "Public can view active sessions" ON group_buy_sessions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can create sessions" ON group_buy_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Hosts can update sessions" ON group_buy_sessions
  FOR UPDATE USING (auth.uid() = host_user_id);

-- Members: More permissive policies  
CREATE POLICY "Public can view members" ON group_buy_members
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can join" ON group_buy_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can update self" ON group_buy_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages: More permissive policies
CREATE POLICY "Public can view messages" ON group_buy_messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can send messages" ON group_buy_messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Verify tables exist
SELECT 'group_buy_sessions' as table_name, count(*) as row_count FROM group_buy_sessions
UNION ALL
SELECT 'group_buy_members', count(*) FROM group_buy_members
UNION ALL
SELECT 'group_buy_messages', count(*) FROM group_buy_messages;
