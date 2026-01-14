-- IoT Smart Venue Management Schema
-- This schema extends the existing Ticketrack database for IoT venue management

-- =====================================================
-- VENUE MANAGEMENT TABLES
-- =====================================================

-- Venues table (extends existing if needed)
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES organizers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  capacity INTEGER,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  venue_type VARCHAR(50), -- indoor, outdoor, hybrid
  iot_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Venue zones (sections/rooms within venues)
CREATE TABLE IF NOT EXISTS venue_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  zone_type VARCHAR(50), -- entrance, main_hall, stage, restroom, etc.
  capacity INTEGER,
  floor_level INTEGER DEFAULT 1,
  coordinates JSONB, -- polygon coordinates for zone mapping
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- IoT SENSOR MANAGEMENT
-- =====================================================

-- Sensor devices
CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES venue_zones(id) ON DELETE SET NULL,
  sensor_type VARCHAR(50) NOT NULL, -- occupancy, temperature, air_quality, noise, motion, beacon
  device_id VARCHAR(100) UNIQUE NOT NULL,
  device_model VARCHAR(100),
  manufacturer VARCHAR(100),
  firmware_version VARCHAR(20),
  battery_level DECIMAL(5,2), -- percentage
  last_seen TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, maintenance, offline
  configuration JSONB, -- sensor-specific settings
  installed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sensor readings (time-series data)
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE CASCADE,
  reading_type VARCHAR(50) NOT NULL, -- occupancy_count, temperature, humidity, co2, noise_level, etc.
  value DECIMAL(10,4),
  unit VARCHAR(20), -- people, celsius, percent, ppm, db, etc.
  quality_score DECIMAL(3,2), -- data quality indicator
  metadata JSONB, -- additional sensor data
  reading_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- REAL-TIME CAPACITY & CHECK-IN
-- =====================================================

-- Real-time venue capacity
CREATE TABLE IF NOT EXISTS venue_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES venue_zones(id) ON DELETE CASCADE,
  current_occupancy INTEGER DEFAULT 0,
  max_capacity INTEGER,
  utilization_rate DECIMAL(5,2), -- percentage
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_by_sensor UUID REFERENCES iot_sensors(id)
);

-- Smart check-ins (IoT based)
CREATE TABLE IF NOT EXISTS smart_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES venue_zones(id) ON DELETE CASCADE,
  checkin_method VARCHAR(50), -- nfc, qr_code, bluetooth, facial, manual
  sensor_id UUID REFERENCES iot_sensors(id),
  checkin_timestamp TIMESTAMP DEFAULT NOW(),
  checkout_timestamp TIMESTAMP,
  duration_minutes INTEGER,
  device_info JSONB, -- mobile device details
  location_accuracy DECIMAL(5,2), -- GPS accuracy in meters
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ENVIRONMENTAL MONITORING
-- =====================================================

-- Environmental conditions
CREATE TABLE IF NOT EXISTS environmental_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES venue_zones(id) ON DELETE CASCADE,
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE CASCADE,
  temperature DECIMAL(5,2), -- celsius
  humidity DECIMAL(5,2), -- percentage
  co2_level DECIMAL(6,2), -- ppm
  voc_level DECIMAL(6,2), -- ppm
  noise_level DECIMAL(5,2), -- db
  air_pressure DECIMAL(7,2), -- hPa
  light_level DECIMAL(8,2), -- lux
  recorded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PREDICTIVE MAINTENANCE
-- =====================================================

-- Equipment maintenance tracking
CREATE TABLE IF NOT EXISTS venue_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES venue_zones(id) ON DELETE CASCADE,
  equipment_type VARCHAR(100), -- hvac, lighting, sound_system, security_camera, etc.
  equipment_model VARCHAR(100),
  serial_number VARCHAR(100),
  installation_date DATE,
  last_maintenance DATE,
  next_maintenance_due DATE,
  status VARCHAR(20) DEFAULT 'operational', -- operational, maintenance_due, faulty, offline
  sensor_id UUID REFERENCES iot_sensors(id), -- monitoring sensor
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance alerts
CREATE TABLE IF NOT EXISTS maintenance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES venue_equipment(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  alert_type VARCHAR(50), -- preventive, corrective, emergency
  severity VARCHAR(20), -- low, medium, high, critical
  title VARCHAR(255),
  description TEXT,
  sensor_data JSONB, -- readings that triggered the alert
  recommended_action TEXT,
  estimated_cost DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved, dismissed
  assigned_to UUID REFERENCES profiles(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS & REPORTING
-- =====================================================

-- Venue analytics
CREATE TABLE IF NOT EXISTS venue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  peak_occupancy INTEGER,
  average_occupancy DECIMAL(5,2),
  total_checkins INTEGER,
  average_dwell_time INTEGER, -- minutes
  environmental_score DECIMAL(3,1), -- 0-10 scale
  maintenance_incidents INTEGER,
  data_quality_score DECIMAL(3,2), -- percentage
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Sensor readings (time-series queries)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_timestamp ON sensor_readings(sensor_id, reading_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_type_timestamp ON sensor_readings(reading_type, reading_timestamp DESC);

-- Capacity queries
CREATE INDEX IF NOT EXISTS idx_venue_capacity_venue_zone ON venue_capacity(venue_id, zone_id);
CREATE INDEX IF NOT EXISTS idx_venue_capacity_updated ON venue_capacity(last_updated DESC);

-- Check-ins
CREATE INDEX IF NOT EXISTS idx_smart_checkins_event_timestamp ON smart_checkins(event_id, checkin_timestamp);
CREATE INDEX IF NOT EXISTS idx_smart_checkins_attendee ON smart_checkins(attendee_id, checkin_timestamp DESC);

-- Environmental data
CREATE INDEX IF NOT EXISTS idx_environmental_data_venue_timestamp ON environmental_data(venue_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_environmental_data_zone ON environmental_data(zone_id, recorded_at DESC);

-- Maintenance
CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_venue_status ON maintenance_alerts(venue_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due ON venue_equipment(next_maintenance_due) WHERE status = 'operational';

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Venues: Only organizers can manage their venues
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers can manage their venues" ON venues
  FOR ALL USING (organizer_id = (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Sensors: Venue owners can manage sensors
ALTER TABLE iot_sensors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue owners can manage sensors" ON iot_sensors
  FOR ALL USING (venue_id IN (
    SELECT id FROM venues WHERE organizer_id = (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  ));

-- Readings: Public read for analytics, restricted write
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sensor data" ON sensor_readings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Sensors can insert readings" ON sensor_readings FOR INSERT WITH CHECK (true);

-- Check-ins: Users can see their own check-ins, organizers can see event check-ins
ALTER TABLE smart_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their check-ins" ON smart_checkins FOR SELECT USING (attendee_id = auth.uid());
CREATE POLICY "Organizers can view event check-ins" ON smart_checkins FOR SELECT USING (
  event_id IN (
    SELECT id FROM events WHERE organizer_id = (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  )
);