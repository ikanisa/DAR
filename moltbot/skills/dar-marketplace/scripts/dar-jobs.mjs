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
const token = process.env.DAR_MOLTBOT_JOB_TOKEN;

const usage = () => {
  console.log(`Usage:
  node scripts/dar-jobs.mjs list --limit 20
  node scripts/dar-jobs.mjs create --query "Sliema 2 bed" --sources "https://example.com,https://example.org" --notes "optional"
  node scripts/dar-jobs.mjs complete <jobId> --results 12 --error ""
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

if (!baseUrl || !token) {
  console.error('Missing DAR_SUPABASE_URL or DAR_MOLTBOT_JOB_TOKEN.');
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const action = args._[0];

if (!action || action === 'help' || action === '--help') {
  usage();
  process.exit(0);
}

const callJobs = async (endpoint, payload) => {
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
    body: JSON.stringify(payload || {})
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
};

const endpoint = `${baseUrl.replace(/\/$/, '')}/functions/v1/moltbot-jobs`;

if (action === 'list') {
  const limit = args.limit ? Number(args.limit) : undefined;
  await callJobs(endpoint, { action: 'list', limit: Number.isFinite(limit) ? limit : undefined });
  process.exit(0);
}

if (action === 'create') {
  const query = args.query || args._[1];
  if (!query) {
    console.error('Missing --query or positional query.');
    usage();
    process.exit(1);
  }
  const sources = args.sources
    ? String(args.sources).split(',').map((value) => value.trim()).filter(Boolean)
    : [];
  const notes = args.notes || '';
  await callJobs(endpoint, { action: 'create', query, sources, notes });
  process.exit(0);
}

if (action === 'complete') {
  const jobId = args._[1] || args.id;
  if (!jobId) {
    console.error('Missing job id.');
    usage();
    process.exit(1);
  }
  const resultsCount = args.results ? Number(args.results) : undefined;
  await callJobs(endpoint, {
    action: 'complete',
    job_id: jobId,
    results_count: Number.isFinite(resultsCount) ? resultsCount : undefined,
    error: args.error || null
  });
  process.exit(0);
}

console.error(`Unknown action: ${action}`);
usage();
process.exit(1);
