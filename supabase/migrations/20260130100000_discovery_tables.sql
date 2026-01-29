-- W9: External Discovery - Domain Policy & URL Queue
-- Creates tables for discovery service: domain permissions, URL queue, API usage tracking

-- Domain policy registry (controls which domains we can fetch from)
CREATE TABLE IF NOT EXISTS domain_policy (
  domain TEXT PRIMARY KEY,
  allowed_to_fetch BOOLEAN NOT NULL DEFAULT false,
  allowed_to_republish BOOLEAN NOT NULL DEFAULT false,
  fields_allowed JSONB DEFAULT '["title","price","bedrooms","url"]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial Malta property portal domains
INSERT INTO domain_policy (domain, allowed_to_fetch, allowed_to_republish, notes)
VALUES
  ('remax-malta.com', true, false, 'Large agency, link-out only'),
  ('frank.com.mt', true, false, 'Major portal, link-out only'),
  ('propertymarket.com.mt', true, false, 'Portal, link-out only'),
  ('maltapark.com', true, false, 'Classifieds, link-out only'),
  ('dhalia.com', true, false, 'Agency, link-out only'),
  ('perry.com.mt', true, false, 'Agency, link-out only'),
  ('quicklets.com.mt', true, false, 'Rental portal, link-out only'),
  ('simonmamo.com', true, false, 'Agency, link-out only')
ON CONFLICT (domain) DO NOTHING;

-- URL status lifecycle enum
DO $$ BEGIN
  CREATE TYPE url_status AS ENUM ('new', 'processing', 'done', 'blocked', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- URL queue for discovered listings
CREATE TABLE IF NOT EXISTS url_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  status url_status NOT NULL DEFAULT 'new',
  discovered_via TEXT NOT NULL DEFAULT 'ai_search',
  query_used TEXT,
  result_rank INTEGER,
  snippet TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}'
);

-- Indexes for url_queue
CREATE INDEX IF NOT EXISTS idx_url_queue_status ON url_queue(status);
CREATE INDEX IF NOT EXISTS idx_url_queue_domain ON url_queue(domain);
CREATE INDEX IF NOT EXISTS idx_url_queue_discovered ON url_queue(discovered_at DESC);

-- API usage tracking (for quota enforcement)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  date DATE NOT NULL,
  calls_count INTEGER NOT NULL DEFAULT 0,
  quota_limit INTEGER,
  UNIQUE(api_name, date)
);

-- Trigger to update updated_at on domain_policy
CREATE OR REPLACE FUNCTION update_domain_policy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS domain_policy_updated_at ON domain_policy;
CREATE TRIGGER domain_policy_updated_at
  BEFORE UPDATE ON domain_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_domain_policy_timestamp();

-- Comments for documentation
COMMENT ON TABLE domain_policy IS 'Registry of domain permissions for external discovery';
COMMENT ON TABLE url_queue IS 'Queue of discovered property listing URLs pending processing';
COMMENT ON TABLE api_usage IS 'Daily API call tracking for quota enforcement';
COMMENT ON COLUMN domain_policy.allowed_to_fetch IS 'Whether we can fetch/scrape this domain';
COMMENT ON COLUMN domain_policy.allowed_to_republish IS 'Whether we can republish content (vs link-out only)';
COMMENT ON COLUMN domain_policy.fields_allowed IS 'Which fields we can extract/display';
