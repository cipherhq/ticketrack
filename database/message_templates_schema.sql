-- ============================================================================
-- MESSAGE TEMPLATES SCHEMA
-- Custom message templates for organizers
-- ============================================================================

-- Create message_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  
  -- Template details
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom', -- 'reminder', 'thank_you', 'announcement', 'custom'
  
  -- Content for each channel
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "email": { "subject": "...", "body": "..." },
  --   "sms": { "message": "..." },
  --   "whatsapp": { "message": "..." }
  -- }
  
  -- Channels this template supports
  channels TEXT[] DEFAULT '{}',
  
  -- Metadata
  is_system BOOLEAN DEFAULT FALSE, -- System templates can't be deleted
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_message_templates_organizer 
  ON message_templates(organizer_id);

CREATE INDEX IF NOT EXISTS idx_message_templates_category 
  ON message_templates(category);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Organizers can view their own templates" ON message_templates;
CREATE POLICY "Organizers can view their own templates"
  ON message_templates FOR SELECT
  USING (
    organizer_id = auth.uid() 
    OR organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Organizers can create templates" ON message_templates;
CREATE POLICY "Organizers can create templates"
  ON message_templates FOR INSERT
  WITH CHECK (
    organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Organizers can update their own templates" ON message_templates;
CREATE POLICY "Organizers can update their own templates"
  ON message_templates FOR UPDATE
  USING (
    organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
    AND is_system = FALSE
  );

DROP POLICY IF EXISTS "Organizers can delete their own templates" ON message_templates;
CREATE POLICY "Organizers can delete their own templates"
  ON message_templates FOR DELETE
  USING (
    organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
    AND is_system = FALSE
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_templates_updated_at ON message_templates;
CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_message_templates_updated_at();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'message_templates table created successfully' AS status;
