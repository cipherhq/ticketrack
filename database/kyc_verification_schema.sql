-- KYC Verification Schema
-- Run this in your Supabase SQL Editor
-- Creates kyc_verifications table, kyc_documents table, storage bucket, and organizer columns

-- =============================================
-- 1. Add KYC columns to organizers table
-- =============================================
ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_identity_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS stripe_identity_session_id TEXT;

COMMENT ON COLUMN organizers.kyc_status IS 'KYC status: pending, in_review, verified, rejected';
COMMENT ON COLUMN organizers.kyc_verified IS 'Whether KYC has been fully verified';
COMMENT ON COLUMN organizers.stripe_identity_status IS 'Stripe Identity session status (US/UK/CA)';
COMMENT ON COLUMN organizers.stripe_identity_session_id IS 'Stripe Identity verification session ID';

-- =============================================
-- 2. Create kyc_verifications table
-- =============================================
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,

  -- Status & level
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, verified, in_review, rejected
  verification_level INTEGER NOT NULL DEFAULT 0,   -- 0=none, 1=basic(BVN), 2=standard(BVN+ID), 3=business(BVN+ID+CAC)
  monthly_payout_limit BIGINT DEFAULT 0,

  -- BVN verification (Nigeria)
  bvn VARCHAR(11),
  bvn_verified BOOLEAN DEFAULT false,
  bvn_first_name TEXT,
  bvn_last_name TEXT,
  bvn_dob DATE,
  bvn_phone TEXT,
  bvn_verified_at TIMESTAMPTZ,

  -- ID document verification
  id_type VARCHAR(30),        -- national_id, drivers_license, passport, voters_card, ghana_card
  id_number TEXT,
  id_document_url TEXT,
  id_verified BOOLEAN DEFAULT false,
  id_verified_at TIMESTAMPTZ,

  -- CAC business verification (Nigeria)
  cac_number TEXT,
  cac_document_url TEXT,
  cac_verified BOOLEAN DEFAULT false,
  cac_verified_at TIMESTAMPTZ,

  -- Rejection
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_organizer_kyc UNIQUE (organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_organizer ON kyc_verifications(organizer_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_verifications(status);

COMMENT ON TABLE kyc_verifications IS 'KYC verification records for organizers (Nigeria tiered BVN/ID/CAC)';

-- =============================================
-- 3. Create kyc_documents table (manual uploads)
-- =============================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL,  -- passport, drivers_license, national_id, ghana_card, voters_card
  document_url TEXT NOT NULL,
  file_name TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_organizer ON kyc_documents(organizer_id);

COMMENT ON TABLE kyc_documents IS 'Manual KYC document uploads for Ghana/Kenya/SA and fallback';

-- =============================================
-- 4. Create storage bucket for KYC documents
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  5242880,  -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 5. RLS Policies for kyc_verifications
-- =============================================
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Organizers can view their own KYC
CREATE POLICY IF NOT EXISTS "Organizers can view own KYC"
  ON kyc_verifications FOR SELECT
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can insert their own KYC
CREATE POLICY IF NOT EXISTS "Organizers can insert own KYC"
  ON kyc_verifications FOR INSERT
  WITH CHECK (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can update their own KYC
CREATE POLICY IF NOT EXISTS "Organizers can update own KYC"
  ON kyc_verifications FOR UPDATE
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- 6. RLS Policies for kyc_documents
-- =============================================
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Organizers can view their own documents
CREATE POLICY IF NOT EXISTS "Organizers can view own KYC documents"
  ON kyc_documents FOR SELECT
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can insert their own documents
CREATE POLICY IF NOT EXISTS "Organizers can insert own KYC documents"
  ON kyc_documents FOR INSERT
  WITH CHECK (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- 7. Storage policies for kyc-documents bucket
-- =============================================

-- Authenticated users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload KYC documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own KYC documents
CREATE POLICY IF NOT EXISTS "Users can view own KYC documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================
-- 8. Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_kyc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_kyc_updated_at ON kyc_verifications;
CREATE TRIGGER set_kyc_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_kyc_updated_at();
