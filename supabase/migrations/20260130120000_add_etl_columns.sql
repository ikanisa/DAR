-- W10: External ETL - Add ETL columns to listings table
-- Enables link-out listings with source tracking, deduplication, and status tracking

-- Add source_type to differentiate native vs external listings
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'native';

-- Add source_domain for external listings
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS source_domain TEXT;

-- Add discovered_at timestamp for external listings
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ;

-- Add last_checked_at for freshness tracking
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- Add content_hash for deduplication
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Unique index on source_url to prevent duplicate external listings
-- Only applies to non-null source_url values
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_source_url_unique 
  ON public.listings(source_url) 
  WHERE source_url IS NOT NULL;

-- Index for content hash deduplication
CREATE INDEX IF NOT EXISTS idx_listings_content_hash 
  ON public.listings(content_hash) 
  WHERE content_hash IS NOT NULL;

-- Dedupe index for fuzzy matching (area + price band + bedrooms)
CREATE INDEX IF NOT EXISTS idx_listings_dedupe 
  ON public.listings(type, bedrooms, price_amount) 
  WHERE source_type != 'native';

-- Index for source_type queries
CREATE INDEX IF NOT EXISTS idx_listings_source_type 
  ON public.listings(source_type);

-- Index for external discovery queries
CREATE INDEX IF NOT EXISTS idx_listings_source_domain 
  ON public.listings(source_domain) 
  WHERE source_domain IS NOT NULL;

-- Check constraint for valid source_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'listings_source_type_check'
  ) THEN
    ALTER TABLE public.listings 
    ADD CONSTRAINT listings_source_type_check 
    CHECK (source_type IN ('native', 'partner', 'linkout'));
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN public.listings.source_type IS 'Type of listing source: native (user-posted), partner (API), linkout (external discovery)';
COMMENT ON COLUMN public.listings.source_domain IS 'Domain of the external source website';
COMMENT ON COLUMN public.listings.discovered_at IS 'When the external listing was first discovered';
COMMENT ON COLUMN public.listings.last_checked_at IS 'When the external listing was last verified/updated';
COMMENT ON COLUMN public.listings.content_hash IS 'MD5 hash of key fields for deduplication';
