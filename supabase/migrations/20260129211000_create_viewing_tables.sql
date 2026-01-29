-- P6B: Viewing Scheduling Tables
-- Enables scheduling property viewings between seekers and posters

-- 1. Viewing requests
CREATE TABLE IF NOT EXISTS public.viewing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.property_listings(id) ON DELETE CASCADE,
  seeker_id UUID,
  seeker_session_id UUID,
  poster_id UUID,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (
    status IN ('proposed', 'confirmed', 'rescheduled', 'cancelled', 'completed')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viewing_requests_property ON public.viewing_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_status ON public.viewing_requests(status);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_seeker ON public.viewing_requests(seeker_id);
CREATE INDEX IF NOT EXISTS idx_viewing_requests_poster ON public.viewing_requests(poster_id);

-- 2. Time options for viewings
CREATE TABLE IF NOT EXISTS public.viewing_time_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_request_id UUID NOT NULL REFERENCES public.viewing_requests(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Malta',
  source TEXT NOT NULL CHECK (source IN ('seeker', 'poster', 'admin')),
  status TEXT NOT NULL DEFAULT 'offered' CHECK (
    status IN ('offered', 'selected', 'rejected')
  ),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viewing_time_options_request ON public.viewing_time_options(viewing_request_id);
CREATE INDEX IF NOT EXISTS idx_viewing_time_options_start ON public.viewing_time_options(start_at);

-- 3. Viewing events (audit trail)
CREATE TABLE IF NOT EXISTS public.viewing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_request_id UUID NOT NULL REFERENCES public.viewing_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('created', 'offered', 'selected', 'confirmed', 'rescheduled', 'cancelled', 'reminded', 'completed')
  ),
  actor TEXT NOT NULL CHECK (actor IN ('seeker', 'poster', 'admin', 'system')),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viewing_events_request ON public.viewing_events(viewing_request_id);
CREATE INDEX IF NOT EXISTS idx_viewing_events_type ON public.viewing_events(event_type);

-- Enable RLS
ALTER TABLE public.viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_time_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for viewing_requests
-- Seekers can read their own viewing requests
CREATE POLICY "Seekers can read own requests"
  ON public.viewing_requests
  FOR SELECT
  TO authenticated
  USING (seeker_id = auth.uid() OR seeker_session_id::text = current_setting('request.headers', true)::json->>'x-session-id');

-- Posters can read requests for their properties
CREATE POLICY "Posters can read property requests"
  ON public.viewing_requests
  FOR SELECT
  TO authenticated
  USING (poster_id = auth.uid());

-- Admins can read all
CREATE POLICY "Admins can read all requests"
  ON public.viewing_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- Insert policies
CREATE POLICY "Anyone can create requests"
  ON public.viewing_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update policies  
CREATE POLICY "Participants can update requests"
  ON public.viewing_requests
  FOR UPDATE
  TO authenticated
  USING (seeker_id = auth.uid() OR poster_id = auth.uid());

-- RLS Policies for viewing_time_options
CREATE POLICY "Request participants can read time options"
  ON public.viewing_time_options
  FOR SELECT
  TO authenticated
  USING (
    viewing_request_id IN (
      SELECT id FROM public.viewing_requests
      WHERE seeker_id = auth.uid() OR poster_id = auth.uid()
    )
  );

CREATE POLICY "Request participants can insert time options"
  ON public.viewing_time_options
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewing_request_id IN (
      SELECT id FROM public.viewing_requests
      WHERE seeker_id = auth.uid() OR poster_id = auth.uid()
    )
  );

CREATE POLICY "Request participants can update time options"
  ON public.viewing_time_options
  FOR UPDATE
  TO authenticated
  USING (
    viewing_request_id IN (
      SELECT id FROM public.viewing_requests
      WHERE seeker_id = auth.uid() OR poster_id = auth.uid()
    )
  );

-- RLS Policies for viewing_events
CREATE POLICY "Request participants can read events"
  ON public.viewing_events
  FOR SELECT
  TO authenticated
  USING (
    viewing_request_id IN (
      SELECT id FROM public.viewing_requests
      WHERE seeker_id = auth.uid() OR poster_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all events"
  ON public.viewing_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' IN ('admin', 'moderator')
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_viewing_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_viewing_requests_updated_at ON public.viewing_requests;
CREATE TRIGGER trigger_viewing_requests_updated_at
  BEFORE UPDATE ON public.viewing_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_viewing_requests_updated_at();
