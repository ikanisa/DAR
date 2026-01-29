-- Fix risk schema
-- 1. Remove UNIQUE from fingerprint_hash so we can store duplicates
-- 2. Add UNIQUE to property_id so we can upsert by property_id

ALTER TABLE listing_fingerprints 
DROP CONSTRAINT IF EXISTS listing_fingerprints_fingerprint_hash_key;

-- In case it was created differently, try to drop index if it enforces uniqueness
DROP INDEX IF EXISTS listing_fingerprints_fingerprint_hash_key;

-- Re-create index on fingerprint_hash (non-unique)
CREATE INDEX IF NOT EXISTS idx_listing_fingerprints_hash ON listing_fingerprints(fingerprint_hash);

-- Add unique constraint on property_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_fingerprints_property_id_key'
  ) THEN
    ALTER TABLE listing_fingerprints
    ADD CONSTRAINT listing_fingerprints_property_id_key UNIQUE (property_id);
  END IF;
END $$;
