-- =============================================
-- TICKETRACK DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension (for generating unique IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'attendee' CHECK (role IN ('attendee', 'organizer', 'admin')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. ORGANIZERS TABLE (for event creators)
-- =============================================
CREATE TABLE organizers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  business_phone TEXT,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. CATEGORIES TABLE
-- =============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, slug, icon) VALUES
  ('Tech & Innovation', 'tech', '💻'),
  ('Music & Concerts', 'music', '🎵'),
  ('Business & Networking', 'business', '💼'),
  ('Sports & Fitness', 'sports', '⚽'),
  ('Education & Workshops', 'education', '📚'),
  ('Arts & Culture', 'arts', '🎨'),
  ('Food & Drinks', 'food', '🍽️'),
  ('Comedy & Entertainment', 'comedy', '🎭');

-- =============================================
-- 4. EVENTS TABLE
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID REFERENCES organizers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'Nigeria',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  online_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  is_featured BOOLEAN DEFAULT FALSE,
  total_capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. TICKET TYPES TABLE (pricing tiers)
-- =============================================
CREATE TABLE ticket_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  quantity_available INTEGER NOT NULL,
  quantity_sold INTEGER DEFAULT 0,
  max_per_order INTEGER DEFAULT 10,
  sale_start_date TIMESTAMPTZ,
  sale_end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. ORDERS TABLE
-- =============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  event_id UUID REFERENCES events(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  subtotal DECIMAL(10, 2) NOT NULL,
  fees DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  payment_method TEXT,
  payment_reference TEXT,
  payment_provider TEXT DEFAULT 'paystack',
  paid_at TIMESTAMPTZ,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. TICKETS TABLE (individual tickets)
-- =============================================
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES ticket_types(id),
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES profiles(id),
  ticket_number TEXT UNIQUE NOT NULL,
  qr_code TEXT,
  status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled', 'transferred')),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES profiles(id),
  attendee_name TEXT,
  attendee_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. PAYOUTS TABLE (organizer payments)
-- =============================================
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID REFERENCES organizers(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  reference TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- This is crucial for security!
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read all profiles, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- CATEGORIES: Everyone can read
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

-- EVENTS: Published events are public, drafts only visible to organizer
CREATE POLICY "Published events are viewable by everyone" ON events
  FOR SELECT USING (status = 'published' OR organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Organizers can insert events" ON events
  FOR INSERT WITH CHECK (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Organizers can update own events" ON events
  FOR UPDATE USING (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

-- TICKET_TYPES: Viewable if event is published
CREATE POLICY "Ticket types viewable for published events" ON ticket_types
  FOR SELECT USING (event_id IN (
    SELECT id FROM events WHERE status = 'published'
  ) OR event_id IN (
    SELECT e.id FROM events e
    JOIN organizers o ON e.organizer_id = o.id
    WHERE o.user_id = auth.uid()
  ));

CREATE POLICY "Organizers can manage ticket types" ON ticket_types
  FOR ALL USING (event_id IN (
    SELECT e.id FROM events e
    JOIN organizers o ON e.organizer_id = o.id
    WHERE o.user_id = auth.uid()
  ));

-- ORDERS: Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (user_id = auth.uid() OR customer_email IN (
    SELECT email FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (true);

-- TICKETS: Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON tickets
  FOR SELECT USING (user_id = auth.uid() OR attendee_email IN (
    SELECT email FROM profiles WHERE id = auth.uid()
  ));

-- ORGANIZERS: Public read, owners can update
CREATE POLICY "Organizers are viewable by everyone" ON organizers
  FOR SELECT USING (true);

CREATE POLICY "Users can create organizer profile" ON organizers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Organizers can update own profile" ON organizers
  FOR UPDATE USING (user_id = auth.uid());

-- PAYOUTS: Only organizer can view their payouts
CREATE POLICY "Organizers can view own payouts" ON payouts
  FOR SELECT USING (organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  ));

-- =============================================
-- 10. FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizers_updated_at BEFORE UPDATE ON organizers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_types_updated_at BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, phone, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Generate unique ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number = 'T-' || 
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_ticket_number BEFORE INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- =============================================
-- SUCCESS! Your database is ready.
-- =============================================
