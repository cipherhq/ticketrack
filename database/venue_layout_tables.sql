-- Venue Layout Designer Schema - TABLES ONLY
-- Run this FIRST, then run venue_layout_functions.sql

-- =====================================================
-- FURNITURE & EQUIPMENT LIBRARY
-- =====================================================

-- Furniture types (templates/library items)
CREATE TABLE IF NOT EXISTS furniture_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  default_width DECIMAL(6,2),
  default_height DECIMAL(6,2),
  default_capacity INTEGER DEFAULT 1,
  icon_svg TEXT,
  properties JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);oject

-- Pre-populate furniture library
INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties) VALUES
('Standard Chair', 'chair', 'Basic seating chair', 0.5, 0.5, 1, '{"color": "#8B4513", "material": "wood", "adjustable": false}'),
('VIP Chair', 'chair', 'Premium seating chair', 0.6, 0.6, 1, '{"color": "#FFD700", "material": "leather", "adjustable": true}'),
('Folding Chair', 'chair', 'Compact folding chair', 0.45, 0.45, 1, '{"color": "#666666", "material": "metal", "foldable": true}'),
('Round Table (4 seats)', 'table', 'Round table for 4 people', 1.2, 1.2, 4, '{"color": "#654321", "material": "wood", "shape": "round"}'),
('Round Table (8 seats)', 'table', 'Large round table for 8 people', 1.5, 1.5, 8, '{"color": "#654321", "material": "wood", "shape": "round"}'),
('Rectangular Table (6 seats)', 'table', 'Rectangular table for 6 people', 1.8, 0.8, 6, '{"color": "#654321", "material": "wood", "shape": "rectangle"}'),
('Cocktail Table', 'table', 'High cocktail/bar table', 0.6, 0.6, 4, '{"color": "#8B4513", "material": "wood", "height": 1.1}'),
('Stage Platform', 'stage', 'Raised performance platform', 4.0, 2.0, 0, '{"color": "#2C2C2C", "material": "wood", "height": 0.3}'),
('Small Stage', 'stage', 'Small platform stage', 3.0, 2.0, 0, '{"color": "#2C2C2C", "material": "wood", "height": 0.2}'),
('DJ Booth', 'dj', 'DJ performance area', 3.0, 2.0, 2, '{"color": "#9C27B0", "equipment": true}'),
('Bar Counter', 'bar', 'Service bar counter', 3.0, 0.8, 0, '{"color": "#8B4513", "material": "wood", "has_shelves": true}'),
('Mobile Bar', 'bar', 'Portable bar station', 2.0, 0.8, 0, '{"color": "#8B4513", "material": "metal", "portable": true}'),
('Check-in Desk', 'checkin', 'Registration/check-in counter', 3.0, 1.0, 0, '{"color": "#2196F3", "has_computers": true}'),
('LED Screen', 'screen', 'Digital display screen', 2.0, 1.2, 0, '{"color": "#000000", "material": "metal", "resolution": "4K"}'),
('Entrance Gate', 'entrance', 'Entry point', 2.0, 0.5, 0, '{"color": "#4CAF50", "turnstile": true}'),
('Emergency Exit', 'exit', 'Emergency exit door', 1.5, 0.5, 0, '{"color": "#F44336", "emergency": true}'),
('Dance Floor', 'area', 'Open dance area', 6.0, 6.0, 50, '{"color": "#90EE90", "surface": "hardwood"}'),
('Lounge Area', 'area', 'Relaxation zone', 4.0, 3.0, 15, '{"color": "#FFD700", "surface": "carpet"}'),
('Standing Area', 'area', 'General standing space', 2.0, 2.0, 10, '{"color": "#90EE90", "surface": "carpet"}'),
('VIP Lounge', 'area', 'Premium seating area', 3.0, 3.0, 8, '{"color": "#FFD700", "surface": "plush_carpet", "has_bar": true}')
ON CONFLICT DO NOTHING;

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
  is_template BOOLEAN DEFAULT false,
  total_width DECIMAL(8,2),
  total_height DECIMAL(8,2),
  grid_size DECIMAL(4,2) DEFAULT 0.5,
  background_image_url TEXT,
  metadata JSONB,
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
  layout_data JSONB,
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
  section_type VARCHAR(50) NOT NULL,
  display_color VARCHAR(7) DEFAULT '#CCCCCC',
  coordinates JSONB NOT NULL,
  capacity INTEGER,
  accessibility_features JSONB,
  pricing_multiplier DECIMAL(3,2) DEFAULT 1.0,
  iot_zone_id UUID REFERENCES venue_zones(id),
  properties JSONB,
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
  name VARCHAR(100),
  x_position DECIMAL(8,2) NOT NULL,
  y_position DECIMAL(8,2) NOT NULL,
  width DECIMAL(6,2),
  height DECIMAL(6,2),
  rotation DECIMAL(5,2) DEFAULT 0,
  capacity INTEGER,
  properties JSONB,
  is_locked BOOLEAN DEFAULT false,
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
  current_price DECIMAL(10,2),
  capacity_allocated INTEGER,
  tickets_sold INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- REAL-TIME CAPACITY TRACKING
-- =====================================================

-- Section capacity tracking
CREATE TABLE IF NOT EXISTS section_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID REFERENCES venue_layouts(id) ON DELETE CASCADE,
  section_id UUID REFERENCES layout_sections(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  current_occupancy INTEGER DEFAULT 0,
  max_capacity INTEGER,
  available_capacity INTEGER,
  utilization_rate DECIMAL(5,2),
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
  feature_type VARCHAR(50) NOT NULL,
  description TEXT,
  coordinates JSONB,
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
  average_dwell_time INTEGER,
  revenue_generated DECIMAL(10,2),
  utilization_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_venue_layouts_venue_active ON venue_layouts(venue_id, is_active);
CREATE INDEX IF NOT EXISTS idx_layout_sections_layout ON layout_sections(layout_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_layout_furniture_layout ON layout_furniture(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_furniture_section ON layout_furniture(section_id);
CREATE INDEX IF NOT EXISTS idx_section_capacity_layout_section ON section_capacity(layout_id, section_id);
CREATE INDEX IF NOT EXISTS idx_section_capacity_event ON section_capacity(event_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_section_pricing_event_section ON section_pricing(event_id, section_id);
CREATE INDEX IF NOT EXISTS idx_section_pricing_ticket_type ON section_pricing(ticket_type_id);

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE venue_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_capacity ENABLE ROW LEVEL SECURITY;
