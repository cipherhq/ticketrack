-- Layout Design Feature Schema
-- Creates tables for venue layouts, objects, seats, and templates

-- Layouts table (one per event or reusable venue layout)
CREATE TABLE IF NOT EXISTS layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Canvas settings
  canvas_width NUMERIC NOT NULL DEFAULT 50,
  canvas_height NUMERIC NOT NULL DEFAULT 30,
  grid_size NUMERIC DEFAULT 0.5,
  background_image_url TEXT,
  background_opacity NUMERIC DEFAULT 0.3,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,

  -- Metadata
  total_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layout versions for history
CREATE TABLE IF NOT EXISTS layout_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(layout_id, version_number)
);

-- Layout objects (all objects on canvas)
CREATE TABLE IF NOT EXISTS layout_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,

  -- Object identification
  object_type TEXT NOT NULL,
  name TEXT,
  label TEXT,

  -- Geometry (2D)
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC DEFAULT 100,
  height NUMERIC DEFAULT 100,
  rotation NUMERIC DEFAULT 0,
  shape TEXT DEFAULT 'rectangle',
  polygon_points JSONB,

  -- Visual
  color TEXT DEFAULT '#3B82F6',
  z_index INTEGER DEFAULT 0,
  layer TEXT DEFAULT 'default',
  is_locked BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,

  -- 3D properties
  height_3d NUMERIC DEFAULT 1,
  elevation NUMERIC DEFAULT 0,

  -- Capacity & ticketing
  capacity INTEGER,
  ticket_type_id UUID REFERENCES ticket_types(id),
  pricing_override JSONB,

  -- Seat generation config
  seat_config JSONB,

  -- Grouping
  parent_id UUID REFERENCES layout_objects(id),
  group_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual seats
CREATE TABLE IF NOT EXISTS layout_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  parent_object_id UUID NOT NULL REFERENCES layout_objects(id) ON DELETE CASCADE,

  -- Seat identification
  row_label TEXT,
  seat_number TEXT NOT NULL,

  -- Position
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  rotation NUMERIC DEFAULT 0,

  -- Status
  seat_type TEXT DEFAULT 'standard',
  is_available BOOLEAN DEFAULT TRUE,

  -- Ticketing
  ticket_type_id UUID REFERENCES ticket_types(id),
  price_override NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System templates
CREATE TABLE IF NOT EXISTS layout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  thumbnail_url TEXT,
  template_data JSONB NOT NULL,
  capacity_estimate INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_layouts_organizer ON layouts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_layouts_event ON layouts(event_id);
CREATE INDEX IF NOT EXISTS idx_layout_objects_layout ON layout_objects(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_objects_type ON layout_objects(layout_id, object_type);
CREATE INDEX IF NOT EXISTS idx_layout_seats_layout ON layout_seats(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_seats_parent ON layout_seats(parent_object_id);

-- Enable RLS
ALTER TABLE layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE layout_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for layouts
CREATE POLICY "Organizers can manage own layouts" ON layouts
  FOR ALL USING (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public can view published layouts" ON layouts
  FOR SELECT USING (status = 'published');

-- RLS Policies for layout_versions
CREATE POLICY "Organizers can manage own layout versions" ON layout_versions
  FOR ALL USING (layout_id IN (
    SELECT id FROM layouts WHERE organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for layout_objects
CREATE POLICY "Organizers can manage own layout objects" ON layout_objects
  FOR ALL USING (layout_id IN (
    SELECT id FROM layouts WHERE organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Public can view published layout objects" ON layout_objects
  FOR SELECT USING (layout_id IN (
    SELECT id FROM layouts WHERE status = 'published'
  ));

-- RLS Policies for layout_seats
CREATE POLICY "Organizers can manage own layout seats" ON layout_seats
  FOR ALL USING (layout_id IN (
    SELECT id FROM layouts WHERE organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Public can view published layout seats" ON layout_seats
  FOR SELECT USING (layout_id IN (
    SELECT id FROM layouts WHERE status = 'published'
  ));

-- RLS Policies for templates (public read)
CREATE POLICY "Anyone can view active templates" ON layout_templates
  FOR SELECT USING (is_active = true);

-- Insert default templates
INSERT INTO layout_templates (name, description, category, capacity_estimate, template_data, sort_order) VALUES
(
  'Concert Hall',
  'Stage with tiered seating rows facing forward. Ideal for concerts and shows.',
  'concert',
  500,
  '{
    "canvas_width": 800,
    "canvas_height": 600,
    "objects": [
      {
        "object_type": "stage",
        "name": "Main Stage",
        "x": 100,
        "y": 50,
        "width": 600,
        "height": 120,
        "color": "#1F2937",
        "height_3d": 1.2
      },
      {
        "object_type": "section",
        "name": "VIP Section",
        "x": 100,
        "y": 200,
        "width": 600,
        "height": 150,
        "color": "#EF4444",
        "capacity": 150
      },
      {
        "object_type": "section",
        "name": "General Admission",
        "x": 100,
        "y": 380,
        "width": 600,
        "height": 150,
        "color": "#3B82F6",
        "capacity": 300
      },
      {
        "object_type": "entrance",
        "name": "Main Entrance",
        "x": 350,
        "y": 560,
        "width": 100,
        "height": 30
      },
      {
        "object_type": "exit",
        "name": "Exit Left",
        "x": 10,
        "y": 300,
        "width": 30,
        "height": 60
      },
      {
        "object_type": "exit",
        "name": "Exit Right",
        "x": 760,
        "y": 300,
        "width": 30,
        "height": 60
      }
    ]
  }'::jsonb,
  1
),
(
  'Theater Style',
  'Classic auditorium layout with center aisle. Perfect for theaters.',
  'theater',
  300,
  '{
    "canvas_width": 700,
    "canvas_height": 550,
    "objects": [
      {
        "object_type": "stage",
        "name": "Stage",
        "x": 75,
        "y": 30,
        "width": 550,
        "height": 100,
        "color": "#1F2937",
        "height_3d": 0.8
      },
      {
        "object_type": "section",
        "name": "Orchestra Left",
        "x": 75,
        "y": 160,
        "width": 250,
        "height": 300,
        "color": "#F59E0B",
        "capacity": 120
      },
      {
        "object_type": "section",
        "name": "Orchestra Right",
        "x": 375,
        "y": 160,
        "width": 250,
        "height": 300,
        "color": "#F59E0B",
        "capacity": 120
      },
      {
        "object_type": "entrance",
        "name": "Main Entrance",
        "x": 300,
        "y": 500,
        "width": 100,
        "height": 30
      }
    ]
  }'::jsonb,
  2
),
(
  'Conference Room',
  'Rows facing a presentation area. Great for conferences and seminars.',
  'conference',
  200,
  '{
    "canvas_width": 600,
    "canvas_height": 500,
    "objects": [
      {
        "object_type": "stage",
        "name": "Presentation Area",
        "x": 100,
        "y": 30,
        "width": 400,
        "height": 80,
        "color": "#1F2937",
        "height_3d": 0.3
      },
      {
        "object_type": "section",
        "name": "Seating",
        "x": 75,
        "y": 140,
        "width": 450,
        "height": 300,
        "color": "#10B981",
        "capacity": 200
      },
      {
        "object_type": "entrance",
        "name": "Entrance",
        "x": 250,
        "y": 460,
        "width": 100,
        "height": 30
      }
    ]
  }'::jsonb,
  3
),
(
  'Banquet Style',
  'Round tables for seated dining events. Ideal for galas and weddings.',
  'banquet',
  80,
  '{
    "canvas_width": 600,
    "canvas_height": 600,
    "objects": [
      {
        "object_type": "stage",
        "name": "Head Table",
        "x": 175,
        "y": 30,
        "width": 250,
        "height": 60,
        "color": "#1F2937",
        "height_3d": 0.3
      },
      {
        "object_type": "table",
        "name": "Table 1",
        "x": 100,
        "y": 150,
        "width": 80,
        "height": 80,
        "color": "#8B5CF6",
        "capacity": 8
      },
      {
        "object_type": "table",
        "name": "Table 2",
        "x": 260,
        "y": 150,
        "width": 80,
        "height": 80,
        "color": "#8B5CF6",
        "capacity": 8
      },
      {
        "object_type": "table",
        "name": "Table 3",
        "x": 420,
        "y": 150,
        "width": 80,
        "height": 80,
        "color": "#8B5CF6",
        "capacity": 8
      },
      {
        "object_type": "table",
        "name": "Table 4",
        "x": 100,
        "y": 280,
        "width": 80,
        "height": 80,
        "color": "#8B5CF6",
        "capacity": 8
      },
      {
        "object_type": "table",
        "name": "Table 5",
        "x": 260,
        "y": 280,
        "width": 80,
        "height": 80,
        "color": "#8B5CF6",
        "capacity": 8
      },
      {
        "object_type": "table",
        "name": "Table 6",
        "x": 420,
        "y": 280,
        "width": 80,
        "height": 80,
        "color": "#8B5CF6",
        "capacity": 8
      },
      {
        "object_type": "zone",
        "name": "Dance Floor",
        "x": 200,
        "y": 420,
        "width": 200,
        "height": 120,
        "color": "#EC4899",
        "capacity": 30
      },
      {
        "object_type": "entrance",
        "name": "Entrance",
        "x": 250,
        "y": 560,
        "width": 100,
        "height": 30
      }
    ]
  }'::jsonb,
  4
)
ON CONFLICT DO NOTHING;

-- Function to update layout capacity
CREATE OR REPLACE FUNCTION update_layout_capacity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE layouts
  SET total_capacity = (
    SELECT COALESCE(SUM(capacity), 0)
    FROM layout_objects
    WHERE layout_id = COALESCE(NEW.layout_id, OLD.layout_id)
    AND capacity IS NOT NULL
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.layout_id, OLD.layout_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for capacity updates
DROP TRIGGER IF EXISTS trigger_update_layout_capacity ON layout_objects;
CREATE TRIGGER trigger_update_layout_capacity
AFTER INSERT OR UPDATE OR DELETE ON layout_objects
FOR EACH ROW
EXECUTE FUNCTION update_layout_capacity();
