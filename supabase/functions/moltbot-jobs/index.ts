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
  const expected = Deno.env.get('MOLTBOT_JOB_TOKEN');
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

  const payload = await req.json().catch(() => ({}));
  const action = (payload.action || 'create').toLowerCase();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: 'Missing Supabase credentials' }, 500, origin);
  }

  const clientKey = action === 'create' ? anonKey : serviceKey;
  const supabase = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(
    supabaseUrl,
    clientKey,
    { auth: { persistSession: false } }
  );

  if (action === 'create') {
    const query = (payload.query || '').trim();
    if (!query) {
      return jsonResponse({ error: 'Missing query' }, 400, origin);
    }

    let sources = Array.isArray(payload.sources) ? payload.sources : [];
    if (!sources.length) {
      const { data: feedSources } = await supabase
        .from('property_feed_sources')
        .select('url')
        .eq('active', true);
      sources = (feedSources || []).map((row: { url?: string }) => row.url).filter(Boolean);
    }
    sources = Array.from(new Set(sources.map((source: string) => source.trim()).filter(Boolean)));
    const notes = payload.notes || null;

    const { data, error } = await supabase
      .from('moltbot_jobs')
      .insert({
        query,
        sources,
        notes,
        status: 'queued'
      })
      .select('id')
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 500, origin);
    }

    return jsonResponse({ ok: true, job_id: data.id }, 200, origin);
  }

  if (!requireMoltbotToken(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, origin);
  }

  if (action === 'list') {
    const limit = payload.limit ? Math.min(Number(payload.limit), 50) : 20;
    const { data, error } = await supabase
      .from('moltbot_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      return jsonResponse({ error: error.message }, 500, origin);
    }

    return jsonResponse({ ok: true, jobs: data }, 200, origin);
  }

  if (action === 'complete') {
    const jobId = payload.job_id;
    if (!jobId) {
      return jsonResponse({ error: 'Missing job_id' }, 400, origin);
    }

    const updates: Record<string, unknown> = {
      status: payload.status || 'completed',
      results_count: payload.results_count ?? null,
      last_error: payload.error ?? null,
      completed_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('moltbot_jobs')
      .update(updates)
      .eq('id', jobId);

    if (error) {
      return jsonResponse({ error: error.message }, 500, origin);
    }

    return jsonResponse({ ok: true }, 200, origin);
  }

  return jsonResponse({ error: `Unsupported action: ${action}` }, 400, origin);
});
