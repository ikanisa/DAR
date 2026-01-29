-- P1: Real Estate DB + RLS
-- Complete schema for property listings, media, features, inquiries, viewings, and audit

-- =============================================================================
-- 1. ENHANCE property_listings WITH OWNERSHIP + WORKFLOW
-- =============================================================================

-- Add poster_id for ownership
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'property_listings'
        AND column_name = 'poster_id'
    ) THEN
        ALTER TABLE public.property_listings
        ADD COLUMN poster_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add workflow timestamps
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'property_listings'
        AND column_name = 'submitted_at'
    ) THEN
        ALTER TABLE public.property_listings
        ADD COLUMN submitted_at TIMESTAMPTZ,
        ADD COLUMN approved_at TIMESTAMPTZ,
        ADD COLUMN rejected_at TIMESTAMPTZ,
        ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- Index for poster queries
CREATE INDEX IF NOT EXISTS idx_property_listings_poster_id ON public.property_listings(poster_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON public.property_listings(status);

-- =============================================================================
-- 2. property_media TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'floor_plan', 'document')),
    position INTEGER DEFAULT 0,
    alt_text TEXT,
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_media_property_id ON public.property_media(property_id);
CREATE INDEX IF NOT EXISTS idx_property_media_position ON public.property_media(property_id, position);

-- =============================================================================
-- 3. property_features TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('amenity', 'facility', 'nearby', 'utility', 'other')),
    feature_name TEXT NOT NULL,
    feature_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(property_id, category, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_property_features_property_id ON public.property_features(property_id);
CREATE INDEX IF NOT EXISTS idx_property_features_category ON public.property_features(category);

-- =============================================================================
-- 4. property_inquiries TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
    seeker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    contact_preference TEXT CHECK (contact_preference IN ('email', 'phone', 'whatsapp', 'in_app')),
    seeker_name TEXT,
    seeker_email TEXT,
    seeker_phone TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'responded', 'closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    response_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_property_inquiries_property_id ON public.property_inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_seeker_id ON public.property_inquiries(seeker_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON public.property_inquiries(status);

-- =============================================================================
-- 5. property_viewings TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_viewings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
    seeker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE SET NULL,
    poster_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    proposed_dates JSONB DEFAULT '[]'::jsonb,
    confirmed_date TIMESTAMPTZ,
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
    seeker_notes TEXT,
    poster_notes TEXT,
    location_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT CHECK (cancelled_by IN ('seeker', 'poster', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_property_viewings_property_id ON public.property_viewings(property_id);
CREATE INDEX IF NOT EXISTS idx_property_viewings_seeker_id ON public.property_viewings(seeker_id);
CREATE INDEX IF NOT EXISTS idx_property_viewings_poster_id ON public.property_viewings(poster_id);
CREATE INDEX IF NOT EXISTS idx_property_viewings_status ON public.property_viewings(status);
CREATE INDEX IF NOT EXISTS idx_property_viewings_confirmed_date ON public.property_viewings(confirmed_date);

-- =============================================================================
-- 6. admin_review_queue TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL UNIQUE REFERENCES public.property_listings(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'changes_requested')),
    decision TEXT CHECK (decision IN ('approve', 'reject', 'request_changes')),
    decision_reason TEXT,
    changes_requested JSONB,
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_review_queue_status ON public.admin_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_admin_review_queue_priority ON public.admin_review_queue(priority);
CREATE INDEX IF NOT EXISTS idx_admin_review_queue_assigned_to ON public.admin_review_queue(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admin_review_queue_submitted_at ON public.admin_review_queue(submitted_at);

-- =============================================================================
-- 7. audit_events TABLE (for P0 compliance)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN ('tool_call', 'agent_response', 'user_action', 'system', 'error')),
    agent_type TEXT CHECK (agent_type IN ('seeker', 'poster', 'admin', 'system')),
    tool_name TEXT,
    input_hash TEXT,
    output_status TEXT CHECK (output_status IN ('success', 'error', 'rejected', 'timeout')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE SET NULL,
    property_id UUID REFERENCES public.property_listings(id) ON DELETE SET NULL,
    context JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON public.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_agent_type ON public.audit_events(agent_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_property_id ON public.audit_events(property_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_tool_name ON public.audit_events(tool_name);

-- =============================================================================
-- 8. ENABLE RLS ON ALL NEW TABLES
-- =============================================================================

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 9. RLS POLICIES FOR property_listings (replace simple policy)
-- =============================================================================

-- Drop old permissive policy
DROP POLICY IF EXISTS "Public read listings" ON public.property_listings;

-- Public: read only approved/published listings
CREATE POLICY "Public read approved listings"
ON public.property_listings FOR SELECT
USING (status IN ('approved', 'published'));

-- Posters: manage their own listings (all statuses)
CREATE POLICY "Poster manage own listings"
ON public.property_listings FOR ALL
TO authenticated
USING (poster_id = auth.uid())
WITH CHECK (poster_id = auth.uid());

-- Admins: full read access to all listings
CREATE POLICY "Admin read all listings"
ON public.property_listings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- Admins: update any listing (for approval workflow)
CREATE POLICY "Admin update all listings"
ON public.property_listings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 10. RLS POLICIES FOR property_media
-- =============================================================================

-- Public: read media for approved listings
CREATE POLICY "Public read media for approved listings"
ON public.property_media FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.status IN ('approved', 'published')
    )
);

-- Posters: manage media for their own listings
CREATE POLICY "Poster manage own media"
ON public.property_media FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
);

-- Admins: read all media
CREATE POLICY "Admin read all media"
ON public.property_media FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 11. RLS POLICIES FOR property_features
-- =============================================================================

-- Public: read features for approved listings
CREATE POLICY "Public read features for approved listings"
ON public.property_features FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.status IN ('approved', 'published')
    )
);

-- Posters: manage features for their own listings
CREATE POLICY "Poster manage own features"
ON public.property_features FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
);

-- Admins: read all features
CREATE POLICY "Admin read all features"
ON public.property_features FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 12. RLS POLICIES FOR property_inquiries
-- =============================================================================

-- Seekers can insert inquiries (anyone)
CREATE POLICY "Anyone can create inquiries"
ON public.property_inquiries FOR INSERT
WITH CHECK (true);

-- Seekers can read their own inquiries
CREATE POLICY "Seeker read own inquiries"
ON public.property_inquiries FOR SELECT
TO authenticated
USING (seeker_id = auth.uid());

-- Posters can read inquiries for their listings
CREATE POLICY "Poster read inquiries for own listings"
ON public.property_inquiries FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
);

-- Posters can update inquiry status (mark read, respond)
CREATE POLICY "Poster update inquiries for own listings"
ON public.property_inquiries FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
);

-- Admins: full access
CREATE POLICY "Admin manage all inquiries"
ON public.property_inquiries FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 13. RLS POLICIES FOR property_viewings
-- =============================================================================

-- Anyone can request viewings
CREATE POLICY "Anyone can request viewings"
ON public.property_viewings FOR INSERT
WITH CHECK (true);

-- Seekers can read/update their own viewings
CREATE POLICY "Seeker manage own viewings"
ON public.property_viewings FOR SELECT
TO authenticated
USING (seeker_id = auth.uid());

CREATE POLICY "Seeker update own viewings"
ON public.property_viewings FOR UPDATE
TO authenticated
USING (seeker_id = auth.uid());

-- Posters can read/update viewings for their listings
CREATE POLICY "Poster read viewings for own listings"
ON public.property_viewings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
);

CREATE POLICY "Poster update viewings for own listings"
ON public.property_viewings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.property_listings pl
        WHERE pl.id = property_id
        AND pl.poster_id = auth.uid()
    )
);

-- Admins: full access
CREATE POLICY "Admin manage all viewings"
ON public.property_viewings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 14. RLS POLICIES FOR admin_review_queue (Admins only)
-- =============================================================================

CREATE POLICY "Admin full access to review queue"
ON public.admin_review_queue FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 15. RLS POLICIES FOR audit_events
-- =============================================================================

-- System/backend can insert (via service role)
-- No INSERT policy for authenticated users - backend uses service role

-- Admins can read all audit events
CREATE POLICY "Admin read all audit events"
ON public.audit_events FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- =============================================================================
-- 16. UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_property_media_updated_at ON public.property_media;
CREATE TRIGGER trigger_property_media_updated_at
    BEFORE UPDATE ON public.property_media
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_property_viewings_updated_at ON public.property_viewings;
CREATE TRIGGER trigger_property_viewings_updated_at
    BEFORE UPDATE ON public.property_viewings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_admin_review_queue_updated_at ON public.admin_review_queue;
CREATE TRIGGER trigger_admin_review_queue_updated_at
    BEFORE UPDATE ON public.admin_review_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 17. COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.property_media IS 'Photos, videos, and documents for property listings';
COMMENT ON TABLE public.property_features IS 'Amenities and features for property listings';
COMMENT ON TABLE public.property_inquiries IS 'Seeker inquiries about property listings';
COMMENT ON TABLE public.property_viewings IS 'Scheduled property viewings between seekers and posters';
COMMENT ON TABLE public.admin_review_queue IS 'Review queue for pending property listings';
COMMENT ON TABLE public.audit_events IS 'Audit log for all Moltbot tool calls and agent actions';

COMMENT ON COLUMN public.property_listings.poster_id IS 'Owner of the listing (can be NULL for ingested listings)';
COMMENT ON COLUMN public.property_listings.status IS 'Workflow status: pending → submitted → approved/rejected → published';
COMMENT ON COLUMN public.audit_events.input_hash IS 'SHA256 of input params for deduplication';
