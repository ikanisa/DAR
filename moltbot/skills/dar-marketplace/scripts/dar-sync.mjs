import fs from 'node:fs/promises';
import path from 'node:path';

const loadDotEnv = async () => {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env')
  ];

  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
        const [key, ...rest] = trimmed.split('=');
        if (!process.env[key]) {
          process.env[key] = rest.join('=').trim();
        }
      });
      return;
    } catch (_) {
      continue;
    }
  }
};

await loadDotEnv();

const baseUrl = process.env.DAR_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.DAR_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const jobToken = process.env.DAR_MOLTBOT_JOB_TOKEN;
const ingestToken = process.env.DAR_MOLTBOT_INGEST_TOKEN;
const geminiModel = process.env.DAR_GEMINI_MODEL || process.env.GEMINI_MODEL || null;
const openaiModel = process.env.DAR_OPENAI_MODEL || process.env.OPENAI_MODEL || null;

if (!baseUrl || !jobToken || !ingestToken) {
  console.error('Missing DAR_SUPABASE_URL / DAR_MOLTBOT_JOB_TOKEN / DAR_MOLTBOT_INGEST_TOKEN.');
  process.exit(1);
}

const requestJson = async (url, payload, headers = {}) => {
  const authHeaders = anonKey
    ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey }
    : {};
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.error || `${response.status} ${response.statusText}`;
    throw new Error(msg);
  }
  return data;
};

const aiRouterUrl = `${baseUrl.replace(/\/$/, '')}/functions/v1/ai-router`;
const jobsUrl = `${baseUrl.replace(/\/$/, '')}/functions/v1/moltbot-jobs`;
const ingestUrl = `${baseUrl.replace(/\/$/, '')}/functions/v1/moltbot-ingest`;

const systemPrompt = `You are a Malta property listing researcher.
Use web search to find real listings. Return ONLY valid JSON. Do not include markdown.
Output shape:
{
  "listings": [
    {
      "title": "...",
      "link": "...",
      "summary": "...",
      "image_url": "...",
      "price": 0,
      "currency": "EUR",
      "location": "...",
      "type": "...",
      "bedrooms": 0,
      "bathrooms": 0,
      "interior_area": 0,
      "outdoor_area": 0,
      "epc": "...",
      "parking": "...",
      "view": "...",
      "sea_distance": 0,
      "finish": "...",
      "orientation": "...",
      "source": "...",
      "source_url": "...",
      "published_at": "2025-01-01T00:00:00Z",
      "raw": {}
    }
  ]
}
Rules:
- Use null for unknown numeric or string fields.
- "link" must be the actual listing URL (not a homepage).
- "source_url" should be the base domain or listing page source.
- Keep summary under 700 chars.`;

const buildUserPrompt = (query, sources) => {
  const sourceText = sources?.length
    ? sources.join(', ')
    : 'any reputable Malta property sources';
  return `Find Malta property listings for: "${query}".
Preferred sources: ${sourceText}.
Return at least 5 listings if available.`;
};

const callAiRouter = async (provider, query, sources) => {
  const model = provider === 'gemini' ? geminiModel : provider === 'openai' ? openaiModel : null;
  const payload = {
    provider,
    model: model || undefined,
    use_web_search: true,
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(query, sources) }
    ]
  };
  const data = await requestJson(aiRouterUrl, payload);
  return data?.text || '';
};

const extractJson = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```json\\s*([\\s\\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1) return trimmed.slice(first, last + 1);
  return null;
};

const parseListings = (text) => {
  const jsonText = extractJson(text);
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed?.listings) ? parsed.listings : null;
  } catch (_) {
    return null;
  }
};

const normalizeListings = (listings, job) => {
  const nowIso = new Date().toISOString();
  return listings
    .filter((item) => item?.link && item?.title)
    .map((item) => ({
      ...item,
      title: item.title || 'Untitled Listing',
      source: item.source || 'Moltbot AI Search',
      source_url: item.source_url || (job.sources?.[0] || null),
      published_at: item.published_at || nowIso,
      raw: item.raw || { query: job.query, sources: job.sources || [] }
    }));
};

const completeJob = async (jobId, payload) => {
  await requestJson(
    jobsUrl,
    { action: 'complete', job_id: jobId, ...payload },
    { 'x-moltbot-token': jobToken }
  );
};

const run = async () => {
  const { jobs } = await requestJson(
    jobsUrl,
    { action: 'list', limit: 10 },
    { 'x-moltbot-token': jobToken }
  );

  if (!jobs || !jobs.length) {
    console.log('No queued jobs.');
    return;
  }

  for (const job of jobs) {
    const jobId = job.id;
    try {
      let text = '';
      try {
        text = await callAiRouter('gemini', job.query, job.sources || []);
      } catch (_) {
        text = '';
      }
      if (!text) {
        text = await callAiRouter('openai', job.query, job.sources || []);
      }

      const listings = parseListings(text);
      if (!listings || listings.length === 0) {
        await completeJob(jobId, { status: 'completed', results_count: 0, error: 'No listings found' });
        continue;
      }

      const normalized = normalizeListings(listings, job);
      if (!normalized.length) {
        await completeJob(jobId, { status: 'completed', results_count: 0, error: 'Listings missing required fields' });
        continue;
      }

      const ingestResult = await requestJson(
        ingestUrl,
        { listings: normalized },
        { 'x-moltbot-token': ingestToken }
      );

      const inserted = ingestResult?.inserted ?? normalized.length;
      await completeJob(jobId, { status: 'completed', results_count: inserted, error: null });
      console.log(`Job ${jobId}: inserted ${inserted}`);
    } catch (error) {
      await completeJob(jobId, { status: 'failed', results_count: 0, error: error.message || 'Sync failed' });
      console.error(`Job ${jobId} failed:`, error.message || error);
    }
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
