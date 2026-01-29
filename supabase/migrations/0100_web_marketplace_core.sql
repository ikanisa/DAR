-- 0100_web_marketplace_core.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Web Sessions
CREATE TABLE IF NOT EXISTS public.web_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anon_user_id TEXT NOT NULL UNIQUE,
    language TEXT DEFAULT 'en',
    user_agent TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Market Posts
CREATE TABLE IF NOT EXISTS public.market_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('buy', 'sell')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'matched', 'closed')),
    title TEXT,
    description TEXT,
    budget_min NUMERIC,
    budget_max NUMERIC,
    currency TEXT DEFAULT 'EUR',
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match Suggestions
CREATE TABLE IF NOT EXISTS public.match_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.market_posts(id) ON DELETE CASCADE,
    candidate_data JSONB NOT NULL,
    rank INTEGER,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web Notifications
CREATE TABLE IF NOT EXISTS public.web_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE CASCADE,
    type TEXT,
    title TEXT,
    message TEXT,
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External Feed Items
CREATE TABLE IF NOT EXISTS public.external_feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    source TEXT,
    image_url TEXT,
    published_at TIMESTAMPTZ,
    crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation Events
CREATE TABLE IF NOT EXISTS public.moderation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE SET NULL,
    event_type TEXT,
    details JSONB,
    risk_score NUMERIC,
    action_taken TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_web_sessions_anon_id ON public.web_sessions(anon_user_id);
CREATE INDEX IF NOT EXISTS idx_market_posts_session_id ON public.market_posts(session_id);
CREATE INDEX IF NOT EXISTS idx_match_suggestions_post_id ON public.match_suggestions(post_id);
CREATE INDEX IF NOT EXISTS idx_web_notifications_session_id ON public.web_notifications(session_id);
