-- 0103_marketplace_listings_products.sql

CREATE TABLE IF NOT EXISTS public.product_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE CASCADE,
    vendor_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC,
    currency TEXT DEFAULT 'EUR',
    category TEXT,
    images TEXT[],
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.listing_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES public.product_listings(id) ON DELETE CASCADE,
    buyer_session_id UUID REFERENCES public.web_sessions(id) ON DELETE CASCADE,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.listing_verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID REFERENCES public.product_listings(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.web_sessions(id) ON DELETE CASCADE,
    requested_vendor_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Published Listings" ON public.product_listings FOR SELECT USING (status = 'published');
