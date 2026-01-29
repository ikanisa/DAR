-- P6A: Anti-duplicate + Anti-scam Risk Tables
-- Creates fingerprinting and risk scoring infrastructure

-- 1. Listing fingerprints for duplicate detection
CREATE TABLE IF NOT EXISTS public.listing_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
  fingerprint_hash TEXT UNIQUE NOT NULL,
  phone_hash TEXT,
  address_norm TEXT,
  title_norm TEXT,
  price_bucket TEXT,
  geo_cell TEXT,
  photo_hashes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_property ON public.listing_fingerprints(property_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON public.listing_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_fingerprints_geo_cell ON public.listing_fingerprints(geo_cell);

-- 2. Risk scores for each listing
CREATE TABLE IF NOT EXISTS public.listing_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.property_listings(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  reasons JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('ok', 'hold', 'review_required')) DEFAULT 'ok',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_property ON public.listing_risk_scores(property_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_status ON public.listing_risk_scores(status);

-- 3. Photo hash index for image deduplication
CREATE TABLE IF NOT EXISTS public.photo_hash_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
  poster_id UUID,
  phash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_hash_phash ON public.photo_hash_index(phash);
CREATE INDEX IF NOT EXISTS idx_photo_hash_property ON public.photo_hash_index(property_id);

-- Enable RLS
ALTER TABLE public.listing_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_hash_index ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listing_fingerprints
-- Only admins can read fingerprints (used internally)
CREATE POLICY "Admins can read fingerprints"
  ON public.listing_fingerprints
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- RLS Policies for listing_risk_scores
-- Posters can read their own risk summary (limited view)
CREATE POLICY "Posters can read own risk status"
  ON public.listing_risk_scores
  FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.property_listings
      WHERE link LIKE '%' || auth.uid()::text || '%'
    )
  );

-- Admins can read all risk scores with full reasons
CREATE POLICY "Admins can read all risk scores"
  ON public.listing_risk_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- Admins can update risk scores (for override)
CREATE POLICY "Admins can update risk scores"
  ON public.listing_risk_scores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- RLS Policies for photo_hash_index
-- Only admins can read photo hashes
CREATE POLICY "Admins can read photo hashes"
  ON public.photo_hash_index
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- Add status column to property_listings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'property_listings' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.property_listings 
    ADD COLUMN status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'submitted', 'hold_for_review', 'approved', 'rejected', 'published'));
  END IF;
END $$;

-- Trigger to update updated_at on risk_scores
CREATE OR REPLACE FUNCTION update_risk_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_risk_scores_updated_at ON public.listing_risk_scores;
CREATE TRIGGER trigger_risk_scores_updated_at
  BEFORE UPDATE ON public.listing_risk_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_risk_scores_updated_at();
