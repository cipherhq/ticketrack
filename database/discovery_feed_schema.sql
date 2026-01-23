-- =====================================================
-- DISCOVERY FEED FEATURE - Database Schema
-- Personalized event recommendations based on user behavior
-- =====================================================

-- User Event Interactions
-- Track all user interactions with events for recommendation engine
CREATE TABLE IF NOT EXISTS user_event_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Interaction types
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN (
    'view',           -- Viewed event page
    'like',           -- Saved/liked event
    'share',          -- Shared event
    'purchase',       -- Purchased tickets
    'cart_add',       -- Added to cart
    'cart_abandon'    -- Added to cart but didn't purchase
  )),
  
  -- Context
  source VARCHAR(50), -- home, search, category, email, social
  session_id VARCHAR(100),
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate views within short time
  UNIQUE(user_id, event_id, interaction_type, created_at)
);

-- User Preferences
-- Explicit user preferences for categories and event types
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Category preferences (array of preferred categories)
  preferred_categories TEXT[] DEFAULT '{}',
  
  -- Event type preferences
  preferred_event_types TEXT[] DEFAULT '{}',
  
  -- Location preferences
  preferred_cities TEXT[] DEFAULT '{}',
  preferred_radius_km INTEGER DEFAULT 50,
  
  -- Price preferences
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'NGN',
  
  -- Virtual event preference
  prefer_virtual BOOLEAN DEFAULT false,
  prefer_in_person BOOLEAN DEFAULT true,
  
  -- Notification preferences for recommendations
  email_recommendations BOOLEAN DEFAULT true,
  push_recommendations BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Saved Events (Likes/Favorites)
CREATE TABLE IF NOT EXISTS saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, event_id)
);

-- Event Similarity Scores (precomputed for performance)
-- Computed periodically via cron job
CREATE TABLE IF NOT EXISTS event_similarity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id_a UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_id_b UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(event_id_a, event_id_b)
);

-- Recommendation Cache
-- Pre-computed recommendations for faster loading
CREATE TABLE IF NOT EXISTS user_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Score and reasoning
  score DECIMAL(5,4) NOT NULL, -- 0.0 to 1.0
  reasons JSONB DEFAULT '[]', -- ["Based on your interest in Music", "Popular in Lagos"]
  
  -- Recommendation source
  source VARCHAR(50), -- collaborative, content_based, trending, location
  
  -- Timing
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Tracking
  was_shown BOOLEAN DEFAULT false,
  was_clicked BOOLEAN DEFAULT false,
  shown_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  UNIQUE(user_id, event_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_event_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_event ON user_event_interactions(event_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON user_event_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON user_event_interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_events_user ON saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event ON saved_events(event_id);

CREATE INDEX IF NOT EXISTS idx_recommendations_user ON user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_score ON user_recommendations(score DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON user_recommendations(expires_at);

CREATE INDEX IF NOT EXISTS idx_similarity_event_a ON event_similarity(event_id_a);
CREATE INDEX IF NOT EXISTS idx_similarity_event_b ON event_similarity(event_id_b);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE user_event_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_similarity ENABLE ROW LEVEL SECURITY;

-- Users can manage their own data
CREATE POLICY "Users can manage their interactions" ON user_event_interactions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage their preferences" ON user_preferences
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage saved events" ON saved_events
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their recommendations" ON user_recommendations
  FOR SELECT USING (user_id = auth.uid());

-- Service role can manage all
CREATE POLICY "Service role full access interactions" ON user_event_interactions
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access preferences" ON user_preferences
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access recommendations" ON user_recommendations
  USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read similarity scores" ON event_similarity
  FOR SELECT USING (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Record a user interaction
CREATE OR REPLACE FUNCTION record_event_interaction(
  p_user_id UUID,
  p_event_id UUID,
  p_interaction_type VARCHAR,
  p_source VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_event_interactions (user_id, event_id, interaction_type, source)
  VALUES (p_user_id, p_event_id, p_interaction_type, p_source)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle saved event (like/unlike)
CREATE OR REPLACE FUNCTION toggle_saved_event(p_user_id UUID, p_event_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM saved_events WHERE user_id = p_user_id AND event_id = p_event_id) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM saved_events WHERE user_id = p_user_id AND event_id = p_event_id;
    RETURN false; -- Now unsaved
  ELSE
    INSERT INTO saved_events (user_id, event_id) VALUES (p_user_id, p_event_id);
    -- Also record as interaction
    PERFORM record_event_interaction(p_user_id, p_event_id, 'like', 'direct');
    RETURN true; -- Now saved
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's category preferences based on purchase history
CREATE OR REPLACE FUNCTION get_inferred_preferences(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_categories TEXT[];
  v_event_types TEXT[];
  v_cities TEXT[];
BEGIN
  -- Get categories from purchased events
  SELECT ARRAY_AGG(DISTINCT e.category) FILTER (WHERE e.category IS NOT NULL)
  INTO v_categories
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.user_id = p_user_id AND o.status = 'completed';
  
  -- Get event types from purchased events
  SELECT ARRAY_AGG(DISTINCT e.event_type) FILTER (WHERE e.event_type IS NOT NULL)
  INTO v_event_types
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.user_id = p_user_id AND o.status = 'completed';
  
  -- Get cities from purchased events
  SELECT ARRAY_AGG(DISTINCT e.city) FILTER (WHERE e.city IS NOT NULL)
  INTO v_cities
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.user_id = p_user_id AND o.status = 'completed';
  
  RETURN json_build_object(
    'categories', COALESCE(v_categories, '{}'),
    'event_types', COALESCE(v_event_types, '{}'),
    'cities', COALESCE(v_cities, '{}')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get personalized recommendations for a user
CREATE OR REPLACE FUNCTION get_personalized_recommendations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  event_id UUID,
  title VARCHAR,
  slug VARCHAR,
  image_url TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  venue_name VARCHAR,
  city VARCHAR,
  currency VARCHAR,
  min_price DECIMAL,
  event_type VARCHAR,
  category VARCHAR,
  recommendation_score DECIMAL,
  recommendation_reasons TEXT[]
) AS $$
DECLARE
  v_preferences JSON;
  v_has_history BOOLEAN;
BEGIN
  -- Get inferred preferences
  v_preferences := get_inferred_preferences(p_user_id);
  
  -- Check if user has any purchase history
  SELECT EXISTS(
    SELECT 1 FROM orders WHERE user_id = p_user_id AND status = 'completed' LIMIT 1
  ) INTO v_has_history;
  
  IF v_has_history THEN
    -- Personalized recommendations based on history
    RETURN QUERY
    SELECT DISTINCT ON (e.id)
      e.id,
      e.title,
      e.slug,
      e.image_url,
      e.start_date,
      e.end_date,
      e.venue_name,
      e.city,
      e.currency,
      (SELECT MIN(tt.price) FROM ticket_types tt WHERE tt.event_id = e.id AND tt.is_active = true) as min_price,
      e.event_type,
      e.category,
      CASE
        -- Higher score for matching category
        WHEN e.category = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'categories'))) THEN 0.8
        -- Higher score for matching event type
        WHEN e.event_type = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'event_types'))) THEN 0.7
        -- Higher score for matching city
        WHEN e.city = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'cities'))) THEN 0.6
        ELSE 0.4
      END::DECIMAL as recommendation_score,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN e.category = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'categories'))) 
          THEN 'Based on events you''ve attended' END,
        CASE WHEN e.city = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'cities'))) 
          THEN 'Popular in ' || e.city END,
        CASE WHEN e.event_type = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'event_types'))) 
          THEN 'Similar to your interests' END
      ], NULL) as recommendation_reasons
    FROM events e
    WHERE e.status = 'published'
      AND e.start_date > NOW()
      AND e.id NOT IN (SELECT o.event_id FROM orders o WHERE o.user_id = p_user_id)
    ORDER BY e.id, recommendation_score DESC, e.start_date ASC
    LIMIT p_limit OFFSET p_offset;
  ELSE
    -- New user: return trending/popular events
    RETURN QUERY
    SELECT 
      e.id,
      e.title,
      e.slug,
      e.image_url,
      e.start_date,
      e.end_date,
      e.venue_name,
      e.city,
      e.currency,
      (SELECT MIN(tt.price) FROM ticket_types tt WHERE tt.event_id = e.id AND tt.is_active = true) as min_price,
      e.event_type,
      e.category,
      0.5::DECIMAL as recommendation_score,
      ARRAY['Trending near you', 'Popular this week']::TEXT[] as recommendation_reasons
    FROM events e
    WHERE e.status = 'published'
      AND e.start_date > NOW()
    ORDER BY e.start_date ASC
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION record_event_interaction TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_saved_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_inferred_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION get_personalized_recommendations TO authenticated;
