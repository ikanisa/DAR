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
const token = process.env.DAR_MOLTBOT_INGEST_TOKEN;

const usage = () => {
  console.log(`Usage:
  node scripts/dar-ingest.mjs listings.json
  cat listings.json | node scripts/dar-ingest.mjs
`);
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

if (!baseUrl || !token) {
  console.error('Missing DAR_SUPABASE_URL or DAR_MOLTBOT_INGEST_TOKEN.');
  process.exit(1);
}

const inputPath = process.argv[2];
let raw = '';

if (inputPath) {
  raw = await fs.readFile(inputPath, 'utf8');
} else if (!process.stdin.isTTY) {
  raw = await readStdin();
} else {
  usage();
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch (error) {
  console.error('Invalid JSON payload.', error.message);
  process.exit(1);
}

const listings = Array.isArray(payload) ? payload : payload?.items || payload?.listings || [];
if (!Array.isArray(listings) || listings.length === 0) {
  console.error('No listings found in payload.');
  process.exit(1);
}

const endpoint = `${baseUrl.replace(/\/$/, '')}/functions/v1/moltbot-ingest`;
const authHeaders = anonKey
  ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey }
  : {};
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-moltbot-token': token,
    ...authHeaders
  },
  body: JSON.stringify({ listings })
});

const text = await response.text();
if (!response.ok) {
  console.error(text);
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch (_) {
  console.log(text);
}
