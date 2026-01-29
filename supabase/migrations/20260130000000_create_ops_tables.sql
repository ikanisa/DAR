-- Market research reports
CREATE TABLE IF NOT EXISTS market_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL, -- 'weekly_brief', 'trend_analysis', 'news_digest'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  model_used TEXT,
  tokens_used INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published BOOLEAN DEFAULT false
);

CREATE INDEX idx_market_reports_type ON market_reports(report_type);

-- Listing anomalies detected by ops agent
CREATE TABLE IF NOT EXISTS listing_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  anomaly_type TEXT NOT NULL, -- 'price_outlier', 'duplicate_suspect', 'stale', 'suspicious_text'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high'
  details JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX idx_anomalies_listing ON listing_anomalies(listing_id);
CREATE INDEX idx_anomalies_unresolved ON listing_anomalies(resolved) WHERE resolved = false;

-- Enable RLS
ALTER TABLE market_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_anomalies ENABLE ROW LEVEL SECURITY;

-- Policies (Assuming admin role management exists, adjusting simply for now)
-- Allow read/write for service_role or admin users (placeholder policies)

CREATE POLICY "Allow read access to anyone" ON market_reports FOR SELECT USING (true);
CREATE POLICY "Allow read access to anyone" ON listing_anomalies FOR SELECT USING (true);
