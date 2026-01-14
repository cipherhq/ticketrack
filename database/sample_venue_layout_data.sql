-- Sample Data for Venue Layout Designer
-- This creates sample venues, layouts, and demonstrates the system

-- =====================================================
-- SAMPLE VENUE SETUP
-- =====================================================

-- Create a sample venue with IoT capabilities
INSERT INTO venues (organizer_id, name, address, capacity, latitude, longitude, venue_type, iot_enabled)
VALUES (
  (SELECT id FROM organizers LIMIT 1), -- Get first organizer
  'Tech Conference Center',
  '123 Innovation Drive, Silicon Valley, CA',
  500,
  37.4419,
  -122.1430,
  'indoor',
  true
) ON CONFLICT DO NOTHING;

-- Get the venue ID for reference
-- Note: Replace 'venue-uuid-here' with actual UUID from above insert

-- =====================================================
-- SAMPLE FURNITURE TYPES (if not already seeded)
-- =====================================================

-- Insert sample furniture types if they don't exist
INSERT INTO furniture_types (name, category, description, default_width, default_height, default_capacity, properties) VALUES
('Executive Chair', 'chair', 'High-end leather chair for VIP sections', 0.7, 0.7, 1, '{"color": "#8B4513", "material": "leather", "adjustable": true, "price_category": "premium"}'),
('Plastic Chair', 'chair', 'Stackable plastic chair for general admission', 0.5, 0.5, 1, '{"color": "#FFFFFF", "material": "plastic", "stackable": true, "price_category": "budget"}'),
('VIP Lounge Sofa', 'area', 'Comfortable seating area for VIP guests', 2.5, 1.5, 4, '{"color": "#800080", "material": "leather", "price_category": "luxury"}'),
('Food Service Cart', 'bar', 'Mobile food and beverage service station', 1.0, 0.8, 0, '{"color": "#8B4513", "material": "metal", "wheels": true}'),
('Registration Desk', 'bar', 'Check-in and registration counter', 2.0, 1.0, 0, '{"color": "#654321", "material": "wood", "computers": true}'),
('Security Station', 'area', 'Staff security monitoring area', 1.5, 1.5, 2, '{"color": "#FF0000", "material": "metal", "monitors": true}'),
('Emergency Exit', 'entrance', 'Clearly marked emergency exit', 1.2, 0.3, 0, '{"color": "#FF0000", "material": "metal", "emergency": true}'),
('First Aid Station', 'area', 'Medical emergency response area', 2.0, 1.5, 0, '{"color": "#FF0000", "material": "metal", "medical": true}'),
('Catering Table', 'table', 'Long table for buffet-style catering', 3.0, 0.8, 0, '{"color": "#FFFFFF", "material": "plastic", "folding": true}'),
('Speaker Podium', 'stage', 'Presentation and speaking platform', 1.2, 1.8, 1, '{"color": "#8B4513", "material": "wood", "microphone": true}')
ON CONFLICT (name) DO NOTHING;

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
) VALUES (
  (SELECT id FROM venues WHERE name = 'Tech Conference Center' LIMIT 1),
  'Main Conference Hall Layout',
  'Standard layout for tech conference with seating, stage, and networking areas',
  25.0, -- 25 meters wide
  20.0, -- 20 meters high
  0.5,  -- 50cm grid
  true,
  '{
    "event_type": "conference",
    "capacity": 500,
    "floors": 1,
    "facilities": ["wifi", "restrooms", "parking", "catering"],
    "created_by": "sample_data"
  }'
) ON CONFLICT DO NOTHING;

-- Get the layout ID for reference
-- Note: Replace 'layout-uuid-here' with actual UUID from above insert

-- =====================================================
-- SAMPLE SECTIONS
-- =====================================================

-- Create sample sections for the layout
INSERT INTO layout_sections (
  layout_id,
  name,
  section_type,
  display_color,
  coordinates,
  capacity,
  accessibility_features,
  pricing_multiplier,
  sort_order
) VALUES
-- Main Stage Area
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'Main Stage',
  'stage',
  '#9C27B0',
  '[{"x": 8.0, "y": 1.0}, {"x": 17.0, "y": 1.0}, {"x": 17.0, "y": 5.0}, {"x": 8.0, "y": 5.0}]',
  0,
  '[]',
  1.0,
  1
),
-- VIP Seating Section
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'VIP Seating',
  'vip',
  '#FFD700',
  '[{"x": 6.0, "y": 6.0}, {"x": 19.0, "y": 6.0}, {"x": 19.0, "y": 10.0}, {"x": 6.0, "y": 10.0}]',
  80,
  '["wheelchair_access", "hearing_assistance"]',
  2.5,
  2
),
-- General Admission Seating
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'General Seating',
  'seating',
  '#4CAF50',
  '[{"x": 2.0, "y": 11.0}, {"x": 23.0, "y": 11.0}, {"x": 23.0, "y": 17.0}, {"x": 2.0, "y": 17.0}]',
  320,
  '["wheelchair_access", "ramp"]',
  1.0,
  3
),
-- Standing Networking Area
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'Networking Lounge',
  'standing',
  '#FF9800',
  '[{"x": 1.0, "y": 1.0}, {"x": 7.0, "y": 1.0}, {"x": 7.0, "y": 5.0}, {"x": 1.0, "y": 5.0}]',
  100,
  '["elevator"]',
  0.8,
  4
),
-- Catering Area
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  'Catering Area',
  'bar',
  '#795548',
  '[{"x": 20.0, "y": 15.0}, {"x": 25.0, "y": 15.0}, {"x": 25.0, "y": 20.0}, {"x": 20.0, "y": 20.0}]',
  0,
  '["ramp"]',
  1.0,
  5
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE FURNITURE PLACEMENT
-- =====================================================

-- Place furniture in the layout
INSERT INTO layout_furniture (
  layout_id,
  furniture_type_id,
  name,
  x_position,
  y_position,
  width,
  height,
  capacity,
  rotation,
  is_locked
) VALUES
-- VIP Section Chairs (arranged in rows)
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Executive Chair' LIMIT 1),
  'VIP Chair 1',
  7.0, 7.0, 0.7, 0.7, 1, 0, true
),
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Executive Chair' LIMIT 1),
  'VIP Chair 2',
  8.0, 7.0, 0.7, 0.7, 1, 0, true
),
-- Add more VIP chairs programmatically would be ideal, but for demo:

-- Stage Elements
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Speaker Podium' LIMIT 1),
  'Main Podium',
  12.0, 2.5, 1.2, 1.8, 1, 0, true
),

-- Networking Area Furniture
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'VIP Lounge Sofa' LIMIT 1),
  'Networking Sofa',
  2.0, 2.0, 2.5, 1.5, 4, 0, false
),

-- Catering Equipment
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Catering Table' LIMIT 1),
  'Buffet Table',
  21.0, 16.0, 3.0, 0.8, 0, 0, false
),

-- Safety and Service
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'First Aid Station' LIMIT 1),
  'Medical Station',
  23.0, 1.0, 2.0, 1.5, 0, 0, true
),

-- Registration
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM furniture_types WHERE name = 'Registration Desk' LIMIT 1),
  'Registration Counter',
  1.0, 18.0, 2.0, 1.0, 0, 0, true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE ACCESSIBILITY FEATURES
-- =====================================================

INSERT INTO accessibility_features (
  layout_id,
  section_id,
  feature_type,
  description,
  coordinates,
  capacity
) VALUES
-- Wheelchair access points
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM layout_sections WHERE name = 'VIP Seating' LIMIT 1),
  'wheelchair_access',
  'Wheelchair accessible entrance to VIP section',
  '[{"x": 6.0, "y": 8.0}]',
  1
),
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM layout_sections WHERE name = 'General Seating' LIMIT 1),
  'wheelchair_access',
  'Wheelchair accessible entrance to general seating',
  '[{"x": 12.5, "y": 11.0}]',
  1
),

-- Hearing assistance
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  (SELECT id FROM layout_sections WHERE name = 'VIP Seating' LIMIT 1),
  'hearing_assistance',
  'Hearing loop system for VIP guests',
  '[{"x": 15.0, "y": 8.0}]',
  10
),

-- Visual aids
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  NULL,
  'visual_aids',
  'Braille signage at main entrance',
  '[{"x": 12.5, "y": 19.0}]',
  0
),

-- Emergency exits
(
  (SELECT id FROM venue_layouts WHERE name = 'Main Conference Hall Layout' LIMIT 1),
  NULL,
  'ramp',
  'Accessible ramp at emergency exit',
  '[{"x": 24.0, "y": 10.0}]',
  0
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE EVENT WITH SECTION PRICING
-- =====================================================

-- Create a sample event
INSERT INTO events (
  organizer_id,
  title,
  description,
  venue_id,
  start_date,
  end_date,
  status,
  ticket_sales_start,
  ticket_sales_end,
  max_capacity
) VALUES (
  (SELECT organizer_id FROM venues WHERE name = 'Tech Conference Center' LIMIT 1),
  'Annual Tech Innovation Summit',
  'A premier conference featuring cutting-edge technology presentations and networking opportunities',
  (SELECT id FROM venues WHERE name = 'Tech Conference Center' LIMIT 1),
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days' + INTERVAL '8 hours',
  'published',
  NOW(),
  NOW() + INTERVAL '29 days',
  500
) ON CONFLICT DO NOTHING;

-- Create ticket types for the event
INSERT INTO ticket_types (event_id, name, price, quantity_available, description) VALUES
(
  (SELECT id FROM events WHERE title = 'Annual Tech Innovation Summit' LIMIT 1),
  'VIP Experience',
  299.00,
  80,
  'Premium seating, exclusive networking, VIP catering access'
),
(
  (SELECT id FROM events WHERE title = 'Annual Tech Innovation Summit' LIMIT 1),
  'General Admission',
  149.00,
  320,
  'Standard seating with full conference access'
),
(
  (SELECT id FROM events WHERE title = 'Annual Tech Innovation Summit' LIMIT 1),
  'Standing Room',
  79.00,
  100,
  'Networking area access with standing room only'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- UTILITY QUERIES FOR TESTING
-- =====================================================

-- Query to verify the layout was created correctly
-- SELECT
--   vl.name as layout_name,
--   COUNT(ls.id) as sections_count,
--   COUNT(lf.id) as furniture_count,
--   COUNT(af.id) as accessibility_count
-- FROM venue_layouts vl
-- LEFT JOIN layout_sections ls ON vl.id = ls.layout_id
-- LEFT JOIN layout_furniture lf ON vl.id = lf.layout_id
-- LEFT JOIN accessibility_features af ON vl.id = af.layout_id
-- WHERE vl.name = 'Main Conference Hall Layout'
-- GROUP BY vl.id, vl.name;

-- Query to check section capacities
-- SELECT
--   ls.name as section_name,
--   ls.section_type,
--   ls.capacity,
--   ls.pricing_multiplier,
--   json_array_length(ls.coordinates) as coordinate_points
-- FROM layout_sections ls
-- JOIN venue_layouts vl ON ls.layout_id = vl.id
-- WHERE vl.name = 'Main Conference Hall Layout'
-- ORDER BY ls.sort_order;