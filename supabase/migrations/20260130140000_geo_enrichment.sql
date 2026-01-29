-- W11: Geo Enrichment Schema
-- Add geocoding, neighborhood, and POI context to listings

-- =============================================================================
-- 1. ADD GEO COLUMNS TO property_listings
-- =============================================================================

-- Latitude/Longitude
ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;

ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Location context
ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS neighborhood TEXT;

ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS locality TEXT;

-- Confidence score (0-100)
ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS location_confidence INTEGER CHECK (location_confidence >= 0 AND location_confidence <= 100);

-- POI context (schools, transit, supermarkets, hospitals nearby)
ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS poi_context JSONB;

-- Enrichment timestamp
ALTER TABLE public.property_listings 
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_property_listings_geo 
  ON public.property_listings(lat, lng) 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Index for unenriched listings (for enrichment job)
CREATE INDEX IF NOT EXISTS idx_property_listings_needs_enrichment 
  ON public.property_listings(created_at DESC) 
  WHERE lat IS NULL AND enriched_at IS NULL;

-- =============================================================================
-- 2. GEO CACHE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.geo_cache (
    query_hash TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    response JSONB NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gemini',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.geo_cache IS 'Cache for geocoding API responses to reduce costs';
COMMENT ON COLUMN public.geo_cache.query_hash IS 'MD5 hash of lowercased, trimmed query';
COMMENT ON COLUMN public.geo_cache.provider IS 'AI provider used: gemini or openai';

-- Index for cache cleanup (30 day retention)
CREATE INDEX IF NOT EXISTS idx_geo_cache_created_at 
  ON public.geo_cache(created_at);

-- =============================================================================
-- 3. POI CACHE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.poi_cache (
    location_hash TEXT PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 1000,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.poi_cache IS 'Cache for POI (points of interest) API responses';
COMMENT ON COLUMN public.poi_cache.location_hash IS 'MD5 hash of lat,lng rounded to 4 decimals (~11m precision)';

-- Index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_poi_cache_created_at 
  ON public.poi_cache(created_at);

-- =============================================================================
-- 4. RLS POLICIES (no user access, backend uses service role)
-- =============================================================================

ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poi_cache ENABLE ROW LEVEL SECURITY;

-- Admin-only read access for debugging
CREATE POLICY "Admin read geo_cache"
  ON public.geo_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Admin read poi_cache"
  ON public.poi_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- =============================================================================
-- 5. COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.property_listings.lat IS 'Latitude from geocoding (not overwritten if user-provided)';
COMMENT ON COLUMN public.property_listings.lng IS 'Longitude from geocoding (not overwritten if user-provided)';
COMMENT ON COLUMN public.property_listings.neighborhood IS 'Neighborhood/sublocality from geocoding';
COMMENT ON COLUMN public.property_listings.locality IS 'Locality/town from geocoding';
COMMENT ON COLUMN public.property_listings.location_confidence IS 'Geocoding confidence score 0-100';
COMMENT ON COLUMN public.property_listings.poi_context IS 'Nearby POIs: schools, transit, supermarkets, hospitals';
COMMENT ON COLUMN public.property_listings.enriched_at IS 'When geo enrichment was last run';
