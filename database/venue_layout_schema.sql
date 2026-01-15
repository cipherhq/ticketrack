-- Venue Layout Designer Schema
-- Extends IoT Smart Venue Management for visual layout creation

-- =====================================================
-- FURNITURE & EQUIPMENT LIBRARY
-- =====================================================

-- Furniture types (templates/library items)
CREATE TABLE IF NOT EXISTS furniture_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL, -- chair, table, stage, bar, screen, entrance, exit, etc.
  description TEXT,
  default_width DECIMAL(6,2), -- width in meters
  default_height DECIMAL(6,2), -- height in meters
  default_capacity INTEGER DEFAULT 1, -- people capacity (1 for chair, 4 for table, etc.)
  icon_svg TEXT, -- SVG icon for UI
  properties JSONB, -- additional properties (color, material, adjustable, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pre-populate furniture library
INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties) VALUES
('Standard Chair', 'chair', 'Basic seating chair', 0.5, 0.5, 1, '{"color": "#8B4513", "material": "wood", "adjustable": false}'),
('VIP Chair', 'chair', 'Premium seating chair', 0.6, 0.6, 1, '{"color": "#FFD700", "material": "leather", "adjustable": true}'),
('Round Table (4 seats)', 'table', 'Round table for 4 people', 1.2, 1.2, 4, '{"color": "#654321", "material": "wood", "shape": "round"}'),
('Rectangular Table (6 seats)', 'table', 'Rectangular table for 6 people', 1.8, 0.8, 6, '{"color": "#654321", "material": "wood", "shape": "rectangle"}'),
('Stage Platform', 'stage', 'Raised performance platform', 4.0, 2.0, 0, '{"color": "#2C2C2C", "material": "wood", "height": 0.3}'),
('Bar Counter', 'bar', 'Service bar counter', 3.0, 0.8, 0, '{"color": "#8B4513", "material": "wood", "has_shelves": true}'),
('LED Screen', 'screen', 'Digital display screen', 2.0, 1.2, 0, '{"color": "#000000", "material": "metal", "resolution": "4K"}'),
('Entrance Gate', 'entrance', 'Entry/exit gate', 1.5, 0.2, 0, '{"color": "#FF0000", "material": "metal", "turnstile": true}'),
('Standing Area', 'area', 'General standing space', 2.0, 2.0, 10, '{"color": "#90EE90", "surface": "carpet"}'),
('VIP Lounge', 'area', 'Premium seating area', 3.0, 3.0, 8, '{"color": "#FFD700", "surface": "plush_carpet", "has_bar": true}');

-- =====================================================
-- VENUE LAYOUT MANAGEMENT
-- =====================================================

-- Venue layouts (main layout templates)
CREATE TABLE IF NOT EXISTS venue_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false, -- reusable template
  total_width DECIMAL(8,2), -- layout width in meters
  total_height DECIMAL(8,2), -- layout height in meters
  grid_size DECIMAL(4,2) DEFAULT 0.5, -- snap-to-grid size in meters
  background_image_url TEXT, -- optional background image
  metadata JSONB, -- additional layout properties
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Layout versions (for change tracking)
CREATE TABLE IF NOT EXISTS layout_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes_description TEXT,
  layout_data JSONB, -- complete layout snapshot
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- LAYOUT SECTIONS & ZONES
-- =====================================================

-- Layout sections (zones within layout)
CREATE TABLE IF NOT EXISTS layout_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  section_type VARCHAR(50) NOT NULL, -- seating, standing, vip, stage, bar, entrance, exit, etc.
  display_color VARCHAR(7) DEFAULT '#CCCCCC', -- hex color for UI
  coordinates JSONB NOT NULL, -- polygon coordinates defining the section area
  capacity INTEGER, -- maximum capacity for this section
  accessibility_features JSONB, -- ADA compliance, wheelchair access, etc.
  pricing_multiplier DECIMAL(3,2) DEFAULT 1.0, -- price multiplier vs base ticket
  iot_zone_id UUID REFERENCES venue_zones(id), -- link to IoT zone
  properties JSONB, -- section-specific properties
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- FURNITURE PLACEMENT
-- =====================================================

-- Furniture instances (placed items in layout)
CREATE TABLE IF NOT EXISTS layout_furniture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  section_id UUID REFERENCES layout_sections(id) ON DELETE SET NULL,
  furniture_type_id UUID REFERENCES furniture_types(id) ON DELETE RESTRICT,
  name VARCHAR(100), -- custom name (optional)
  x_position DECIMAL(8,2) NOT NULL, -- x coordinate in meters
  y_position DECIMAL(8,2) NOT NULL, -- y coordinate in meters
  width DECIMAL(6,2), -- actual width (overrides default)
  height DECIMAL(6,2), -- actual height (overrides default)
  rotation DECIMAL(5,2) DEFAULT 0, -- rotation in degrees
  capacity INTEGER, -- actual capacity (overrides default)
  properties JSONB, -- instance-specific properties
  is_locked BOOLEAN DEFAULT false, -- prevent accidental movement
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- SECTION-BASED PRICING
-- =====================================================

-- Section pricing for events
CREATE TABLE IF NOT EXISTS section_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  section_id UUID REFERENCES layout_sections(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE CASCADE,
  base_price DECIMAL(10,2) NOT NULL,
  dynamic_pricing_enabled BOOLEAN DEFAULT false,
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  current_price DECIMAL(10,2), -- for dynamic pricing
  capacity_allocated INTEGER, -- tickets allocated to this section
  tickets_sold INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- REAL-TIME CAPACITY TRACKING
-- =====================================================

-- Section capacity tracking (extends existing venue_capacity)
CREATE TABLE IF NOT EXISTS section_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  section_id UUID REFERENCES layout_sections(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  current_occupancy INTEGER DEFAULT 0,
  max_capacity INTEGER,
  available_capacity INTEGER,
  utilization_rate DECIMAL(5,2), -- percentage
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_by_sensor UUID REFERENCES iot_sensors(id)
);

-- =====================================================
-- ACCESSIBILITY & COMPLIANCE
-- =====================================================

-- Accessibility features
CREATE TABLE IF NOT EXISTS accessibility_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  section_id UUID REFERENCES layout_sections(id) ON DELETE SET NULL,
  feature_type VARCHAR(50) NOT NULL, -- wheelchair_access, hearing_assistance, visual_aids, etc.
  description TEXT,
  coordinates JSONB, -- location of feature
  capacity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS & REPORTING
-- =====================================================

-- Layout usage analytics
CREATE TABLE IF NOT EXISTS layout_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  section_id UUID REFERENCES layout_sections(id),
  peak_occupancy INTEGER,
  average_occupancy DECIMAL(5,2),
  total_checkins INTEGER,
  average_dwell_time INTEGER, -- minutes
  revenue_generated DECIMAL(10,2),
  utilization_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Layout queries
CREATE INDEX IF NOT EXISTS idx_venue_layouts_venue_active ON venue_layouts(venue_id, is_active);
CREATE INDEX IF NOT EXISTS idx_layout_sections_layout ON layout_sections(layout_id, sort_order);

-- Furniture placement
CREATE INDEX IF NOT EXISTS idx_layout_furniture_layout ON layout_furniture(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_furniture_section ON layout_furniture(section_id);

-- Real-time capacity
CREATE INDEX IF NOT EXISTS idx_section_capacity_layout_section ON section_capacity(layout_id, section_id);
CREATE INDEX IF NOT EXISTS idx_section_capacity_event ON section_capacity(event_id, last_updated DESC);

-- Pricing
CREATE INDEX IF NOT EXISTS idx_section_pricing_event_section ON section_pricing(event_id, section_id);
CREATE INDEX IF NOT EXISTS idx_section_pricing_ticket_type ON section_pricing(ticket_type_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE venue_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_capacity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running the script)
DROP POLICY IF EXISTS "Venue owners can manage layouts" ON venue_layouts;
DROP POLICY IF EXISTS "Venue owners can manage sections" ON layout_sections;
DROP POLICY IF EXISTS "Venue owners can manage furniture" ON layout_furniture;
DROP POLICY IF EXISTS "Authenticated users can read capacity" ON section_capacity;
DROP POLICY IF EXISTS "Venue owners can update capacity" ON section_capacity;

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

-- Section capacity: Public read for real-time data, restricted write
CREATE POLICY "Authenticated users can read capacity" ON section_capacity FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Venue owners can update capacity" ON section_capacity FOR ALL USING (
  layout_id IN (
    SELECT id FROM venue_layouts WHERE venue_id IN (
      SELECT id FROM venues WHERE organizer_id = (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  )
);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update section capacity when IoT data arrives
CREATE OR REPLACE FUNCTION update_section_capacity_from_iot()
RETURNS TRIGGER AS $$
BEGIN
  -- Update section capacity based on IoT zone data
  UPDATE section_capacity
  SET
    current_occupancy = NEW.current_occupancy,
    utilization_rate = (NEW.current_occupancy::DECIMAL / section_capacity.max_capacity) * 100,
    available_capacity = section_capacity.max_capacity - NEW.current_occupancy,
    last_updated = NEW.last_updated,
    updated_by_sensor = NEW.updated_by_sensor
  FROM layout_sections ls
  WHERE section_capacity.section_id = ls.id
    AND ls.iot_zone_id = NEW.zone_id
    AND section_capacity.event_id IS NOT NULL; -- Only for active events

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (to allow re-running the script)
DROP TRIGGER IF EXISTS trigger_update_section_capacity ON venue_capacity;

-- Trigger to update section capacity when venue_capacity changes
CREATE TRIGGER trigger_update_section_capacity
  AFTER INSERT OR UPDATE ON venue_capacity
  FOR EACH ROW EXECUTE FUNCTION update_section_capacity_from_iot();

-- Function to calculate total layout capacity
CREATE OR REPLACE FUNCTION calculate_layout_capacity(layout_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  total_capacity INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(capacity), 0)
  INTO total_capacity
  FROM layout_sections
  WHERE layout_id = layout_uuid;

  RETURN total_capacity;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create section capacity records for new events
CREATE OR REPLACE FUNCTION create_section_capacity_for_event(event_uuid UUID, layout_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO section_capacity (layout_id, section_id, event_id, max_capacity, available_capacity)
  SELECT layout_uuid, id, event_uuid, capacity, capacity
  FROM layout_sections
  WHERE layout_id = layout_uuid;
END;
$$ LANGUAGE plpgsql;