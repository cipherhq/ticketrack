-- Ad Submission Schema Migration
-- Adds self-service advertising support to Ticketrack

-- ============================================
-- 1. Fix RPC functions (target wrong table)
-- ============================================

CREATE OR REPLACE FUNCTION increment_ad_clicks(ad_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE platform_adverts
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_ad_impressions(ad_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE platform_adverts
  SET impressions = COALESCE(impressions, 0) + 1
  WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Create ad_packages table
-- ============================================

CREATE TABLE IF NOT EXISTS ad_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position VARCHAR(20) NOT NULL,
  duration_days INTEGER NOT NULL,
  price DECIMAL NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Add columns to platform_adverts
-- ============================================

ALTER TABLE platform_adverts
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS advertiser_email TEXT,
  ADD COLUMN IF NOT EXISTS advertiser_phone TEXT,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES ad_packages(id);

-- ============================================
-- 4. Seed ad packages
-- ============================================

INSERT INTO ad_packages (name, position, duration_days, price, currency, description, sort_order) VALUES
  -- Homepage Banner (top) - NGN
  ('Homepage Banner - 1 Week', 'top', 7, 25000, 'NGN', 'Premium banner at the top of the homepage, seen by every visitor', 1),
  ('Homepage Banner - 1 Month', 'top', 30, 80000, 'NGN', 'Premium banner at the top of the homepage for 30 days', 2),
  -- Homepage Banner (top) - USD
  ('Homepage Banner - 1 Week', 'top', 7, 30, 'USD', 'Premium banner at the top of the homepage, seen by every visitor', 1),
  ('Homepage Banner - 1 Month', 'top', 30, 100, 'USD', 'Premium banner at the top of the homepage for 30 days', 2),
  -- Homepage Banner (top) - GBP
  ('Homepage Banner - 1 Week', 'top', 7, 25, 'GBP', 'Premium banner at the top of the homepage, seen by every visitor', 1),
  ('Homepage Banner - 1 Month', 'top', 30, 80, 'GBP', 'Premium banner at the top of the homepage for 30 days', 2),

  -- Homepage Banner (bottom) - NGN
  ('Homepage Bottom Banner - 1 Week', 'bottom', 7, 20000, 'NGN', 'Banner above the download section on homepage', 3),
  ('Homepage Bottom Banner - 1 Month', 'bottom', 30, 65000, 'NGN', 'Banner above the download section for 30 days', 4),
  -- Homepage Banner (bottom) - USD
  ('Homepage Bottom Banner - 1 Week', 'bottom', 7, 25, 'USD', 'Banner above the download section on homepage', 3),
  ('Homepage Bottom Banner - 1 Month', 'bottom', 30, 80, 'USD', 'Banner above the download section for 30 days', 4),
  -- Homepage Banner (bottom) - GBP
  ('Homepage Bottom Banner - 1 Week', 'bottom', 7, 20, 'GBP', 'Banner above the download section on homepage', 3),
  ('Homepage Bottom Banner - 1 Month', 'bottom', 30, 65, 'GBP', 'Banner above the download section for 30 days', 4),

  -- Event Page Sidebar (right) - NGN
  ('Event Page Sidebar - 1 Week', 'right', 7, 15000, 'NGN', 'Sidebar ad on event detail pages', 5),
  ('Event Page Sidebar - 1 Month', 'right', 30, 50000, 'NGN', 'Sidebar ad on event detail pages for 30 days', 6),
  -- Event Page Sidebar (right) - USD
  ('Event Page Sidebar - 1 Week', 'right', 7, 20, 'USD', 'Sidebar ad on event detail pages', 5),
  ('Event Page Sidebar - 1 Month', 'right', 30, 65, 'USD', 'Sidebar ad on event detail pages for 30 days', 6),
  -- Event Page Sidebar (right) - GBP
  ('Event Page Sidebar - 1 Week', 'right', 7, 15, 'GBP', 'Sidebar ad on event detail pages', 5),
  ('Event Page Sidebar - 1 Month', 'right', 30, 50, 'GBP', 'Sidebar ad on event detail pages for 30 days', 6),

  -- Homepage Banner (top) - GHS
  ('Homepage Banner - 1 Week', 'top', 7, 350, 'GHS', 'Premium banner at the top of the homepage, seen by every visitor', 1),
  ('Homepage Banner - 1 Month', 'top', 30, 1200, 'GHS', 'Premium banner at the top of the homepage for 30 days', 2),
  -- Homepage Banner (top) - CAD
  ('Homepage Banner - 1 Week', 'top', 7, 40, 'CAD', 'Premium banner at the top of the homepage, seen by every visitor', 1),
  ('Homepage Banner - 1 Month', 'top', 30, 130, 'CAD', 'Premium banner at the top of the homepage for 30 days', 2),

  -- Homepage Banner (bottom) - GHS
  ('Homepage Bottom Banner - 1 Week', 'bottom', 7, 280, 'GHS', 'Banner above the download section on homepage', 3),
  ('Homepage Bottom Banner - 1 Month', 'bottom', 30, 950, 'GHS', 'Banner above the download section for 30 days', 4),
  -- Homepage Banner (bottom) - CAD
  ('Homepage Bottom Banner - 1 Week', 'bottom', 7, 35, 'CAD', 'Banner above the download section on homepage', 3),
  ('Homepage Bottom Banner - 1 Month', 'bottom', 30, 105, 'CAD', 'Banner above the download section for 30 days', 4),

  -- Event Page Sidebar (right) - GHS
  ('Event Page Sidebar - 1 Week', 'right', 7, 220, 'GHS', 'Sidebar ad on event detail pages', 5),
  ('Event Page Sidebar - 1 Month', 'right', 30, 750, 'GHS', 'Sidebar ad on event detail pages for 30 days', 6),
  -- Event Page Sidebar (right) - CAD
  ('Event Page Sidebar - 1 Week', 'right', 7, 25, 'CAD', 'Sidebar ad on event detail pages', 5),
  ('Event Page Sidebar - 1 Month', 'right', 30, 85, 'CAD', 'Sidebar ad on event detail pages for 30 days', 6);

-- ============================================
-- 5. RLS Policies
-- ============================================

-- Enable RLS on ad_packages
ALTER TABLE ad_packages ENABLE ROW LEVEL SECURITY;

-- Anyone can view active packages
CREATE POLICY "Anyone can view active ad packages"
  ON ad_packages FOR SELECT
  USING (is_active = true);

-- Admins can manage packages (via service role)

-- Platform adverts: authenticated users can insert their own ads
CREATE POLICY "Users can insert their own ads"
  ON platform_adverts FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Platform adverts: users can view their own submitted ads
CREATE POLICY "Users can view their own ads"
  ON platform_adverts FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

-- Public can view active, approved ads (for display)
CREATE POLICY "Public can view active approved ads"
  ON platform_adverts FOR SELECT
  TO anon
  USING (is_active = true AND approval_status = 'approved');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_adverts_active_approved
  ON platform_adverts (is_active, approval_status, start_date, end_date)
  WHERE is_active = true AND approval_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_platform_adverts_submitted_by
  ON platform_adverts (submitted_by);

CREATE INDEX IF NOT EXISTS idx_ad_packages_active
  ON ad_packages (is_active, position, currency)
  WHERE is_active = true;
