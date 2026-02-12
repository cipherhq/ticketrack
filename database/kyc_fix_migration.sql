-- KYC Fix Migration
-- Adds missing columns referenced by AdminKYCReview.jsx and AdminKYC.jsx
-- Run this in your Supabase SQL Editor

-- =============================================
-- 1. Add missing columns to kyc_documents table
-- =============================================
ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN kyc_documents.review_notes IS 'Internal admin notes from review';
COMMENT ON COLUMN kyc_documents.updated_at IS 'Last updated timestamp';

-- =============================================
-- 2. Add missing columns to organizers table
-- =============================================
ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS kyc_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN organizers.kyc_level IS 'KYC verification level: 0=none, 1=basic, 2=standard, 3=business';
COMMENT ON COLUMN organizers.kyc_verified_at IS 'Timestamp when KYC was verified';

-- =============================================
-- 3. Expand kyc_documents.status CHECK constraint
--    to include awaiting_info
-- =============================================
-- Drop existing constraint if it exists
DO $$
BEGIN
  ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_status_check;
EXCEPTION WHEN undefined_object THEN
  -- constraint doesn't exist, that's fine
  NULL;
END $$;

-- Add updated constraint with awaiting_info
ALTER TABLE kyc_documents
  ADD CONSTRAINT kyc_documents_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'awaiting_info'));

-- =============================================
-- 4. Add updated_at trigger for kyc_documents
-- =============================================
CREATE OR REPLACE FUNCTION update_kyc_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_kyc_documents_updated_at ON kyc_documents;
CREATE TRIGGER set_kyc_documents_updated_at
  BEFORE UPDATE ON kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_kyc_documents_updated_at();

-- =============================================
-- 5. Update RLS to allow admin updates on kyc_documents
-- =============================================
-- Admins need to be able to update kyc_documents (approve/reject)
DROP POLICY IF EXISTS "Admins can update KYC documents" ON kyc_documents;
CREATE POLICY "Admins can update KYC documents"
  ON kyc_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admins need to read all kyc_documents
DROP POLICY IF EXISTS "Admins can view all KYC documents" ON kyc_documents;
CREATE POLICY "Admins can view all KYC documents"
  ON kyc_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );
