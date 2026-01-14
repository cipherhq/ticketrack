-- Venue Layout Designer Schema - FUNCTIONS & TRIGGERS
-- Run this AFTER venue_layout_policies.sql

-- =====================================================
-- FUNCTION: Update section capacity from IoT
-- =====================================================

CREATE OR REPLACE FUNCTION update_section_capacity_from_iot()
RETURNS TRIGGER AS $func$
BEGIN
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
    AND section_capacity.event_id IS NOT NULL;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-update section capacity
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_section_capacity ON venue_capacity;

CREATE TRIGGER trigger_update_section_capacity
  AFTER INSERT OR UPDATE ON venue_capacity
  FOR EACH ROW EXECUTE FUNCTION update_section_capacity_from_iot();

-- =====================================================
-- FUNCTION: Calculate total layout capacity
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_layout_capacity(layout_uuid UUID)
RETURNS INTEGER AS $func$
DECLARE
  total_capacity INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(capacity), 0)
  INTO total_capacity
  FROM layout_sections
  WHERE layout_id = layout_uuid;

  RETURN total_capacity;
END;
$func$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Create section capacity for events
-- =====================================================

CREATE OR REPLACE FUNCTION create_section_capacity_for_event(event_uuid UUID, layout_uuid UUID)
RETURNS VOID AS $func$
BEGIN
  INSERT INTO section_capacity (layout_id, section_id, event_id, max_capacity, available_capacity)
  SELECT layout_uuid, id, event_uuid, capacity, capacity
  FROM layout_sections
  WHERE layout_id = layout_uuid;
END;
$func$ LANGUAGE plpgsql;
