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

const usage = () => {
  console.log(`Usage:
  node scripts/dar-ai-search.mjs --query "Sliema 2 bed sea view"   # auto: gemini -> openai fallback
  node scripts/dar-ai-search.mjs --provider gemini --query "Gozo farmhouse rent"
  node scripts/dar-ai-search.mjs --provider openai --model gpt-4o-search-preview --query "..."
  node scripts/dar-ai-search.mjs --provider openai --query "..." --sources "https://site1.com,https://site2.com"
`);
};

const parseArgs = (args) => {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = value;
      if (value !== true) i += 1;
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
};

const args = parseArgs(process.argv.slice(2));
const provider = (args.provider || 'auto').toLowerCase();
const model = args.model || null;
const query = args.query || args._.join(' ');
const sources = args.sources
  ? String(args.sources).split(',').map((value) => value.trim()).filter(Boolean)
  : [];

if (!baseUrl) {
  console.error('Missing DAR_SUPABASE_URL or SUPABASE_URL.');
  process.exit(1);
}

if (!query) {
  usage();
  process.exit(1);
}

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

const userPrompt = `Find Malta property listings for: "${query}".
Preferred sources (if provided): ${sources.length ? sources.join(', ') : 'any reputable Malta property sources'}.
Return at least 5 listings if available.`;

const callAiRouter = async (providerName) => {
  const payload = {
    provider: providerName,
    model,
    use_web_search: true,
    temperature: 0.2,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };

  const authHeaders = anonKey
    ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey }
    : {};
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/ai-router`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data?.error || 'AI router request failed';
    throw new Error(errorMsg);
  }
  return data?.text || '';
};

let rawText = '';
if (provider === 'auto') {
  try {
    rawText = await callAiRouter('gemini');
  } catch (error) {
    rawText = '';
  }

  if (!rawText) {
    try {
      rawText = await callAiRouter('openai');
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
} else {
  try {
    rawText = await callAiRouter(provider);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
const extractJson = (text) => {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```json\\s*([\\s\\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1) return trimmed.slice(first, last + 1);
  return null;
};

const jsonText = extractJson(rawText);
if (!jsonText) {
  console.error('No JSON found in response.');
  process.exit(1);
}

try {
  const parsed = JSON.parse(jsonText);
  console.log(JSON.stringify(parsed, null, 2));
} catch (error) {
  console.error('Failed to parse JSON:', error.message);
  process.exit(1);
}
