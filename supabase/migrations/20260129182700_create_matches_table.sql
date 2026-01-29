-- W5: Create matches table for seeker-listing matches
-- Tracks seeker interest in listings with match scores

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    viewed_at TIMESTAMPTZ,
    saved_at TIMESTAMPTZ,
    contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint on seeker-listing pair
    CONSTRAINT matches_seeker_listing_unique UNIQUE (seeker_id, listing_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_matches_seeker_id ON matches(seeker_id);
CREATE INDEX IF NOT EXISTS idx_matches_listing_id ON matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

-- RLS policies
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Seekers can view their own matches
CREATE POLICY matches_seeker_select ON matches
    FOR SELECT
    TO authenticated
    USING (seeker_id = auth.uid());

-- Seekers can update their own matches (e.g., mark as viewed)
CREATE POLICY matches_seeker_update ON matches
    FOR UPDATE
    TO authenticated
    USING (seeker_id = auth.uid());

-- System can insert matches (via service role)
CREATE POLICY matches_system_insert ON matches
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Posters can see matches on their listings
CREATE POLICY matches_poster_select ON matches
    FOR SELECT
    TO authenticated
    USING (
        listing_id IN (
            SELECT id FROM listings WHERE poster_id = auth.uid()
        )
    );

-- Admin/Moderator can view all matches
CREATE POLICY matches_admin_select ON matches
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'moderator')
        )
    );

-- Comments
COMMENT ON TABLE matches IS 'Tracks seeker interest in listings with computed match scores';
COMMENT ON COLUMN matches.match_score IS 'Score 0-100 indicating how well listing matches seeker preferences';
COMMENT ON COLUMN matches.match_reasons IS 'Array of reasons why the listing matched (e.g., "Under budget", "Preferred location")';
COMMENT ON COLUMN matches.viewed_at IS 'When seeker viewed the listing details';
COMMENT ON COLUMN matches.saved_at IS 'When seeker saved/bookmarked the listing';
COMMENT ON COLUMN matches.contacted_at IS 'When seeker contacted the poster about this listing';
