-- W1: Inbound Events for Webhook Idempotency
-- Tracks inbound events to prevent duplicate processing

-- =============================================================================
-- 1. INBOUND EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inbound_events (
    id TEXT PRIMARY KEY,  -- Unique event ID from source
    source TEXT NOT NULL, -- Event source (telegram, whatsapp, webhook, scraper, etc.)
    event_type TEXT,      -- Optional event type classification
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'skipped'))
);

COMMENT ON TABLE public.inbound_events IS 'Idempotency table for webhook/event deduplication';
COMMENT ON COLUMN public.inbound_events.id IS 'Unique event ID - duplicates will be rejected';
COMMENT ON COLUMN public.inbound_events.source IS 'Event source system (telegram, whatsapp, remax_scraper, etc.)';

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_inbound_events_received_at 
ON public.inbound_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_events_source 
ON public.inbound_events(source);

CREATE INDEX IF NOT EXISTS idx_inbound_events_status 
ON public.inbound_events(status);

CREATE INDEX IF NOT EXISTS idx_inbound_events_source_type 
ON public.inbound_events(source, event_type);

-- =============================================================================
-- 3. RLS (Backend service role access only)
-- =============================================================================

ALTER TABLE public.inbound_events ENABLE ROW LEVEL SECURITY;

-- Admins can read events for debugging
CREATE POLICY "Admins can read inbound events"
ON public.inbound_events FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
);

-- No INSERT/UPDATE policies for authenticated users
-- Backend uses service role to insert events

-- =============================================================================
-- 4. HELPER FUNCTION: Check if event is duplicate
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_duplicate_event(p_event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.inbound_events WHERE id = p_event_id
    );
END;
$$;

COMMENT ON FUNCTION public.is_duplicate_event IS 'Check if an event ID has already been processed';

-- =============================================================================
-- 5. HELPER FUNCTION: Record event (returns false if duplicate)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_inbound_event(
    p_event_id TEXT,
    p_source TEXT,
    p_event_type TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.inbound_events (id, source, event_type, payload)
    VALUES (p_event_id, p_source, p_event_type, p_payload)
    ON CONFLICT (id) DO NOTHING;
    
    -- Return true if we inserted, false if duplicate
    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.record_inbound_event IS 'Record an inbound event, returns false if duplicate';
