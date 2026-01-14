-- Sample Data for Venue Layout Designer
-- This creates sample venues, layouts, and demonstrates the system
-- All inserts check for existing data to allow re-running

-- =====================================================
-- SAMPLE VENUE SETUP
-- =====================================================

-- Create a sample venue with IoT capabilities (only if it doesn't exist)
INSERT INTO venues (organizer_id, name, address, capacity, latitude, longitude, venue_type, iot_enabled)
SELECT
  (SELECT id FROM organizers LIMIT 1),
  'Tech Conference Center',
  '123 Innovation Drive, Silicon Valley, CA',
  500,
  37.4419,
  -122.1430,
  'indoor',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM venues WHERE name = 'Tech Conference Center'
);

-- =====================================================
-- SAMPLE FURNITURE TYPES (additional types)
-- =====================================================

-- Insert additional furniture types if they don't exist
INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Executive Chair', 'chair', 'High-end leather chair for VIP sections', 0.7, 0.7, 1, '{"color": "#8B4513", "material": "leather", "adjustable": true, "price_category": "premium"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Executive Chair');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Plastic Chair', 'chair', 'Stackable plastic chair for general admission', 0.5, 0.5, 1, '{"color": "#FFFFFF", "material": "plastic", "stackable": true, "price_category": "budget"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Plastic Chair');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'VIP Lounge Sofa', 'area', 'Comfortable seating area for VIP guests', 2.5, 1.5, 4, '{"color": "#800080", "material": "leather", "price_category": "luxury"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'VIP Lounge Sofa');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Food Service Cart', 'bar', 'Mobile food and beverage service station', 1.0, 0.8, 0, '{"color": "#8B4513", "material": "metal", "wheels": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Food Service Cart');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Registration Desk', 'checkin', 'Check-in and registration counter', 2.0, 1.0, 0, '{"color": "#654321", "material": "wood", "computers": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Registration Desk');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Security Station', 'area', 'Staff security monitoring area', 1.5, 1.5, 2, '{"color": "#FF0000", "material": "metal", "monitors": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Security Station');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Emergency Exit Door', 'exit', 'Clearly marked emergency exit', 1.2, 0.3, 0, '{"color": "#FF0000", "material": "metal", "emergency": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Emergency Exit Door');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'First Aid Station', 'area', 'Medical emergency response area', 2.0, 1.5, 0, '{"color": "#FF0000", "material": "metal", "medical": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'First Aid Station');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Catering Table', 'table', 'Long table for buffet-style catering', 3.0, 0.8, 0, '{"color": "#FFFFFF", "material": "plastic", "folding": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Catering Table');

INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties)
SELECT 'Speaker Podium', 'stage', 'Presentation and speaking platform', 1.2, 1.8, 1, '{"color": "#8B4513", "material": "wood", "microphone": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM furniture_types WHERE name = 'Speaker Podium');

-- =====================================================
-- SAMPLE LAYOUT CREATION
-- =====================================================

-- Create a sample layout for the conference center
INSERT INTO venue_layouts (
  venue_id,
  name,
  description,
  total_width,
  total_height,
  grid_size,
  is_active,
  metadata
)
SELECT
  (SELECT id FROM venues WHERE name = 'Tech Conference Center' LIMIT 1),
  'Main Conference Hall Layout',
  'Standard layout for tech conference with seating, stage, and networking areas',
  25.0,
  20.0,
  0.5,
  true,
  '{"event_type": "conference", "capacity": 500, "floors": 1, "facilities": ["wifi", "restrooms", "parking", "catering"], "created_by": "sample_data"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM venue_layouts WHERE name = 'Main Conference Hall Layout'
)
AND EXISTS (
  SELECT 1 FROM venues WHERE name = 'Tech Conference Center'
);

-- =====================================================
-- SAMPLE SECTIONS
-- =====================================================

-- Main Stage
INSERT INTO layout_sections (layout_id, name, section_type, display_color, coordinates, capacity, accessibility_features, pricing_multiplier, sort_order)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'Main Stage',
  'stage',
  '#9C27B0',
  '[{"x": 8.0, "y": 1.0}, {"x": 17.0, "y": 1.0}, {"x": 17.0, "y": 5.0}, {"x": 8.0, "y": 5.0}]'::jsonb,
  0,
  '[]'::jsonb,
  1.0,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM layout_sections WHERE name = 'Main Stage' 
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- VIP Seating
INSERT INTO layout_sections (layout_id, name, section_type, display_color, coordinates, capacity, accessibility_features, pricing_multiplier, sort_order)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'VIP Seating',
  'vip',
  '#FFD700',
  '[{"x": 6.0, "y": 6.0}, {"x": 19.0, "y": 6.0}, {"x": 19.0, "y": 10.0}, {"x": 6.0, "y": 10.0}]'::jsonb,
  80,
  '["wheelchair_access", "hearing_assistance"]'::jsonb,
  2.5,
  2
WHERE NOT EXISTS (
  SELECT 1 FROM layout_sections WHERE name = 'VIP Seating' 
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- General Seating
INSERT INTO layout_sections (layout_id, name, section_type, display_color, coordinates, capacity, accessibility_features, pricing_multiplier, sort_order)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'General Seating',
  'seating',
  '#4CAF50',
  '[{"x": 2.0, "y": 11.0}, {"x": 23.0, "y": 11.0}, {"x": 23.0, "y": 17.0}, {"x": 2.0, "y": 17.0}]'::jsonb,
  320,
  '["wheelchair_access", "ramp"]'::jsonb,
  1.0,
  3
WHERE NOT EXISTS (
  SELECT 1 FROM layout_sections WHERE name = 'General Seating' 
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Networking Lounge
INSERT INTO layout_sections (layout_id, name, section_type, display_color, coordinates, capacity, accessibility_features, pricing_multiplier, sort_order)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'Networking Lounge',
  'standing',
  '#FF9800',
  '[{"x": 1.0, "y": 1.0}, {"x": 7.0, "y": 1.0}, {"x": 7.0, "y": 5.0}, {"x": 1.0, "y": 5.0}]'::jsonb,
  100,
  '["elevator"]'::jsonb,
  0.8,
  4
WHERE NOT EXISTS (
  SELECT 1 FROM layout_sections WHERE name = 'Networking Lounge' 
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Catering Area
INSERT INTO layout_sections (layout_id, name, section_type, display_color, coordinates, capacity, accessibility_features, pricing_multiplier, sort_order)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'Catering Area',
  'bar',
  '#795548',
  '[{"x": 20.0, "y": 15.0}, {"x": 25.0, "y": 15.0}, {"x": 25.0, "y": 20.0}, {"x": 20.0, "y": 20.0}]'::jsonb,
  0,
  '["ramp"]'::jsonb,
  1.0,
  5
WHERE NOT EXISTS (
  SELECT 1 FROM layout_sections WHERE name = 'Catering Area' 
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- =====================================================
-- SAMPLE FURNITURE PLACEMENT
-- =====================================================

-- VIP Chair 1
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Executive Chair' LIMIT 1),
  'VIP Chair 1', 7.0, 7.0, 0.7, 0.7, 1, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'VIP Chair 1'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- VIP Chair 2
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Executive Chair' LIMIT 1),
  'VIP Chair 2', 8.0, 7.0, 0.7, 0.7, 1, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'VIP Chair 2'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Main Podium
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Speaker Podium' LIMIT 1),
  'Main Podium', 12.0, 2.5, 1.2, 1.8, 1, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'Main Podium'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Networking Sofa
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'VIP Lounge Sofa' LIMIT 1),
  'Networking Sofa', 2.0, 2.0, 2.5, 1.5, 4, 0, false
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'Networking Sofa'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Buffet Table
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Catering Table' LIMIT 1),
  'Buffet Table', 21.0, 16.0, 3.0, 0.8, 0, 0, false
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'Buffet Table'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Medical Station
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'First Aid Station' LIMIT 1),
  'Medical Station', 23.0, 1.0, 2.0, 1.5, 0, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'Medical Station'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- Registration Counter
INSERT INTO layout_furniture (layout_id, furniture_type_id, name, x_position, y_position, width, height, capacity, rotation, is_locked)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Registration Desk' LIMIT 1),
  'Registration Counter', 1.0, 18.0, 2.0, 1.0, 0, 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM layout_furniture WHERE name = 'Registration Counter'
  AND layout_id = (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1)
);

-- =====================================================
-- SAMPLE ACCESSIBILITY FEATURES
-- =====================================================

-- Wheelchair access to VIP section
INSERT INTO accessibility_features (layout_id, section_id, feature_type, description, coordinates, capacity)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM layout_sections WHERE name = 'VIP Seating' LIMIT 1),
  'wheelchair_access',
  'Wheelchair accessible entrance to VIP section',
  '[{"x": 6.0, "y": 8.0}]'::jsonb,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM accessibility_features 
  WHERE feature_type = 'wheelchair_access' 
  AND section_id = (SELECT id FROM layout_sections WHERE name = 'VIP Seating' LIMIT 1)
);

-- Wheelchair access to general seating
INSERT INTO accessibility_features (layout_id, section_id, feature_type, description, coordinates, capacity)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM layout_sections WHERE name = 'General Seating' LIMIT 1),
  'wheelchair_access',
  'Wheelchair accessible entrance to general seating',
  '[{"x": 12.5, "y": 11.0}]'::jsonb,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM accessibility_features 
  WHERE feature_type = 'wheelchair_access' 
  AND section_id = (SELECT id FROM layout_sections WHERE name = 'General Seating' LIMIT 1)
);

-- Hearing loop for VIP
INSERT INTO accessibility_features (layout_id, section_id, feature_type, description, coordinates, capacity)
SELECT
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM layout_sections WHERE name = 'VIP Seating' LIMIT 1),
  'hearing_assistance',
  'Hearing loop system for VIP guests',
  '[{"x": 15.0, "y": 8.0}]'::jsonb,
  10
WHERE NOT EXISTS (
  SELECT 1 FROM accessibility_features 
  WHERE feature_type = 'hearing_assistance' 
  AND section_id = (SELECT id FROM layout_sections WHERE name = 'VIP Seating' LIMIT 1)
);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

-- Run this to verify the data was created
SELECT 'Sample data created successfully!' as status,
       (SELECT COUNT(*) FROM venues WHERE name = 'Tech Conference Center') as venues,
       (SELECT COUNT(*) FROM venue_layouts WHERE name = 'Main Conference Hall Layout') as layouts,
       (SELECT COUNT(*) FROM layout_sections ls 
        JOIN venue_layouts vl ON ls.layout_id = vl.id 
        WHERE vl.name = 'Main Conference Hall Layout') as sections,
       (SELECT COUNT(*) FROM layout_furniture lf 
        JOIN venue_layouts vl ON lf.layout_id = vl.id 
        WHERE vl.name = 'Main Conference Hall Layout') as furniture_items;
