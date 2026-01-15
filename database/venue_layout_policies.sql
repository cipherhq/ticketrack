-- Venue Layout Designer Schema - RLS POLICIES
-- Run this AFTER venue_layout_tables.sql

-- =====================================================
-- DROP EXISTING POLICIES (for re-running)
-- =====================================================

DROP POLICY IF EXISTS "Venue owners can manage layouts" ON venue_layouts;
DROP POLICY IF EXISTS "Venue owners can manage sections" ON layout_sections;
DROP POLICY IF EXISTS "Venue owners can manage furniture" ON layout_furniture;
DROP POLICY IF EXISTS "Authenticated users can read capacity" ON section_capacity;
DROP POLICY IF EXISTS "Venue owners can update capacity" ON section_capacity;

-- =====================================================
-- CREATE POLICIES
-- =====================================================

-- Venue layouts: Only venue owners can manage their layouts
CREATE POLICY "Venue owners can manage layouts" ON venue_layouts
  FOR ALL USING (venue_id IN (
    SELECT id FROM venues WHERE organizer_id = (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  ));

-- Layout sections: Venue owners can manage sections
CREATE POLICY "Venue owners can manage sections" ON layout_sections
  FOR ALL USING (layout_id IN (
    SELECT id FROM venue_layouts WHERE venue_id IN (
      SELECT id FROM venues WHERE organizer_id = (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  ));

-- Furniture: Venue owners can manage furniture placement
CREATE POLICY "Venue owners can manage furniture" ON layout_furniture
  FOR ALL USING (layout_id IN (
    SELECT id FROM venue_layouts WHERE venue_id IN (
      SELECT id FROM venues WHERE organizer_id = (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  ));

-- Section capacity: Public read for real-time data
CREATE POLICY "Authenticated users can read capacity" ON section_capacity 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Section capacity: Venue owners can update
CREATE POLICY "Venue owners can update capacity" ON section_capacity 
  FOR ALL USING (
    layout_id IN (
      SELECT id FROM venue_layouts WHERE venue_id IN (
        SELECT id FROM venues WHERE organizer_id = (
          SELECT id FROM organizers WHERE user_id = auth.uid()
        )
      )
    )
  );
