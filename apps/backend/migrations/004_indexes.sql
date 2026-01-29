-- 004_indexes.sql
-- Performance indexes for common queries

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_poster_id ON listings(poster_id);
CREATE INDEX IF NOT EXISTS idx_listings_price_amount ON listings(price_amount);
CREATE INDEX IF NOT EXISTS idx_listings_bedrooms ON listings(bedrooms);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(type);
CREATE INDEX IF NOT EXISTS idx_listings_lat_lng ON listings(lat, lng);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- Listing media indexes
CREATE INDEX IF NOT EXISTS idx_listing_media_listing_id ON listing_media(listing_id);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- Matches indexes
CREATE INDEX IF NOT EXISTS idx_matches_seeker_id ON matches(seeker_id);
CREATE INDEX IF NOT EXISTS idx_matches_listing_id ON matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC);

-- Viewings indexes
CREATE INDEX IF NOT EXISTS idx_viewings_listing_id ON viewings(listing_id);
CREATE INDEX IF NOT EXISTS idx_viewings_seeker_id ON viewings(seeker_id);
CREATE INDEX IF NOT EXISTS idx_viewings_scheduled_at ON viewings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_viewings_status ON viewings(status);

-- Chat sessions indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_channel ON chat_sessions(channel);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Inbound events indexes
CREATE INDEX IF NOT EXISTS idx_inbound_events_received_at ON inbound_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_events_source ON inbound_events(source);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_id ON users(whatsapp_id) WHERE whatsapp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
