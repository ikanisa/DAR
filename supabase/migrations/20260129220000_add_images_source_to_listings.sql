-- 20260129220000_add_images_source_to_listings.sql
-- Add image and source fields to listings table for property photos and origin tracking

-- Add primary image URL
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add array of additional image URLs
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS images TEXT[];

-- Add source/origin (e.g., RE/MAX, Frank Salt, Belair)
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add source website URL
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Add external listing link (link to original listing on source website)
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS external_link TEXT;

-- Add index for source queries
CREATE INDEX IF NOT EXISTS idx_listings_source ON public.listings(source);

-- Comment for documentation
COMMENT ON COLUMN public.listings.image_url IS 'Primary property image URL';
COMMENT ON COLUMN public.listings.images IS 'Array of additional property image URLs';
COMMENT ON COLUMN public.listings.source IS 'Source agency name (e.g., RE/MAX, Frank Salt, Belair)';
COMMENT ON COLUMN public.listings.source_url IS 'Base URL of the source agency website';
COMMENT ON COLUMN public.listings.external_link IS 'Direct link to the original listing on source website';
