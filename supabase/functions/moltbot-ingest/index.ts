const ALLOWED_ORIGINS = new Set([
  'https://dar.ikanisa.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://dar.ikanisa.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-moltbot-token'
});

const jsonResponse = (data: unknown, status = 200, origin?: string | null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin ?? null)
    }
  });

const requireMoltbotToken = (req: Request) => {
  const expected = Deno.env.get('MOLTBOT_INGEST_TOKEN');
  if (!expected) return false;
  const token = req.headers.get('x-moltbot-token');
  return token === expected;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  if (!requireMoltbotToken(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }

  const payload = await req.json().catch(() => ({}));
  const listings = Array.isArray(payload.listings) ? payload.listings : [];

  if (!listings.length) {
    return jsonResponse({ error: 'No listings provided' }, 400, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Missing Supabase credentials' }, 500, origin);
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const sanitized = listings
    .map((item) => ({
      title: item.title || 'Untitled Listing',
      link: item.link,
      summary: item.summary || null,
      image_url: item.image_url || null,
      price: item.price ?? null,
      currency: item.currency || 'EUR',
      location: item.location || null,
      type: item.type || null,
      bedrooms: item.bedrooms ?? null,
      bathrooms: item.bathrooms ?? null,
      interior_area: item.interior_area ?? null,
      outdoor_area: item.outdoor_area ?? null,
      epc: item.epc || null,
      parking: item.parking || null,
      view: item.view || null,
      sea_distance: item.sea_distance ?? null,
      finish: item.finish || null,
      orientation: item.orientation || null,
      source: item.source || 'Moltbot',
      source_url: item.source_url || null,
      published_at: item.published_at || null,
      raw: item.raw || null
    }))
    .filter((item) => item.link);

  if (!sanitized.length) {
    return jsonResponse({ error: 'Listings missing links' }, 400, origin);
  }

  const { error } = await supabase
    .from('property_listings')
    .upsert(sanitized, { onConflict: 'link' });

  if (error) {
    return jsonResponse({ error: error.message }, 500, origin);
  }

  return jsonResponse({ ok: true, inserted: sanitized.length }, 200, origin);
});
