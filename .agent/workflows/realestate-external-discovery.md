---
description: External Discovery (Google Search API) + URL Queue + Domain Policy
---

# W9: External Discovery Workflow

Discover Malta property listing URLs using Google Programmable Search API with domain policy enforcement.

---

## Goal

Build a discovery service that:
- Queries Google Custom Search for Malta property listings
- Stores candidate URLs in a queue
- Enforces domain-level permissions
- Tracks provenance and API usage

---

## Hard Rules

- **Never scrape arbitrary domains** — domain_policy controls everything
- Only enqueue URLs where `allowed_to_fetch = true`
- Store discovery provenance: query, rank, snippet, discovered_at
- Rate-limit API calls (100 queries/day free tier)
- Use abstraction layer (Google CSE sunsets Jan 2027 for some uses)
- Audit log every discovery run

---

## Stack

- Node.js 22+
- Fastify
- **Gemini API** (grounded search via Supabase Edge Function)
- **OpenAI API** (fallback)
- PostgreSQL
- node-cron for scheduling

---

## Database Schema

### Migration: `006_domain_policy_and_url_queue.sql`

```sql
-- Domain policy registry
CREATE TABLE IF NOT EXISTS domain_policy (
  domain TEXT PRIMARY KEY,
  allowed_to_fetch BOOLEAN NOT NULL DEFAULT false,
  allowed_to_republish BOOLEAN NOT NULL DEFAULT false,
  fields_allowed JSONB DEFAULT '["title","price","bedrooms","url"]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial Malta domains
INSERT INTO domain_policy (domain, allowed_to_fetch, allowed_to_republish, notes)
VALUES
  ('remax-malta.com', true, false, 'Large agency, link-out only'),
  ('frank.com.mt', true, false, 'Major portal, link-out only'),
  ('propertymarket.com.mt', true, false, 'Portal, link-out only'),
  ('maltapark.com', true, false, 'Classifieds, link-out only'),
  ('dhalia.com', true, false, 'Agency, link-out only')
ON CONFLICT (domain) DO NOTHING;

-- URL queue for discovered listings
CREATE TYPE url_status AS ENUM ('new', 'processing', 'done', 'blocked', 'error');

CREATE TABLE IF NOT EXISTS url_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  status url_status NOT NULL DEFAULT 'new',
  discovered_via TEXT NOT NULL DEFAULT 'google_cse',
  query_used TEXT,
  result_rank INTEGER,
  snippet TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}'
);

CREATE INDEX idx_url_queue_status ON url_queue(status);
CREATE INDEX idx_url_queue_domain ON url_queue(domain);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  date DATE NOT NULL,
  calls_count INTEGER NOT NULL DEFAULT 0,
  quota_limit INTEGER,
  UNIQUE(api_name, date)
);
```

---

## Files to Create

```
/apps/backend/
├── src/
│   ├── integrations/
│   │   └── googleSearch.ts       # CSE client with abstraction
│   ├── jobs/
│   │   └── discoveryJob.ts       # Scheduled discovery
│   ├── routes/
│   │   └── discovery.ts          # Admin endpoints
│   └── config/
│       └── searchQueries.json    # Query templates
├── migrations/
│   └── 006_domain_policy_and_url_queue.sql
└── src/test/
    └── discovery.test.ts
```

---

## Implementation

### Unified AI Search Client (`integrations/aiSearch.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import { db } from '../db';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

// Abstraction layer - uses Gemini grounded search, falls back to OpenAI
export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
  getName(): string;
}

export class GeminiSearchProvider implements SearchProvider {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  getName(): string {
    return 'gemini_grounded';
  }
  
  async search(query: string): Promise<SearchResult[]> {
    // Check daily quota
    const usage = await this.checkQuota();
    if (usage >= 100) {
      throw new Error('Daily search quota exceeded');
    }
    
    // Call Supabase Edge Function that wraps Gemini grounded search
    const { data, error } = await this.supabase.functions.invoke('ai-search', {
      body: {
        query,
        provider: 'gemini',
        searchType: 'property',
        region: 'mt', // Malta
      },
    });
    
    if (error) {
      console.error('Gemini search failed, trying OpenAI fallback:', error);
      return this.fallbackSearch(query);
    }
    
    await this.incrementUsage();
    
    return (data.results || []).map((r: any) => ({
      title: r.title,
      link: r.url,
      snippet: r.snippet,
      displayLink: new URL(r.url).hostname,
    }));
  }
  
  private async fallbackSearch(query: string): Promise<SearchResult[]> {
    // Fallback to OpenAI web search
    const { data, error } = await this.supabase.functions.invoke('ai-search', {
      body: {
        query,
        provider: 'openai',
        searchType: 'property',
      },
    });
    
    if (error) throw new Error(`All search providers failed: ${error.message}`);
    
    await this.incrementUsage();
    
    return (data.results || []).map((r: any) => ({
      title: r.title,
      link: r.url,
      snippet: r.snippet,
      displayLink: new URL(r.url).hostname,
    }));
  }
  
  private async checkQuota(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT calls_count FROM api_usage 
       WHERE api_name = 'ai_search' AND date = $1`,
      [today]
    );
    return result.rows[0]?.calls_count || 0;
  }
  
  private async incrementUsage(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await db.query(`
      INSERT INTO api_usage (api_name, date, calls_count, quota_limit)
      VALUES ('ai_search', $1, 1, 100)
      ON CONFLICT (api_name, date) 
      DO UPDATE SET calls_count = api_usage.calls_count + 1
    `, [today]);
  }
}

export function createSearchProvider(): SearchProvider {
  return new GeminiSearchProvider();
}
```

### Supabase Edge Function (`supabase/functions/ai-search/index.ts`)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const { query, provider, searchType, region } = await req.json();
  
  try {
    if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
      
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} }], // Grounded search
      });
      
      const prompt = `Search for Malta property listings: ${query}`;
      const result = await model.generateContent(prompt);
      
      // Extract grounding metadata (search results)
      const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
      const chunks = groundingMetadata?.groundingChunks || [];
      
      const results = chunks.map((chunk: any) => ({
        title: chunk.web?.title || 'Property Listing',
        url: chunk.web?.uri || '',
        snippet: chunk.text || '',
      }));
      
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Search for Malta property listings and return URLs.' },
          { role: 'user', content: query },
        ],
        tools: [{ type: 'web_search', web_search: { search_context_size: 'medium' } }],
      });
      
      // Parse citations from response
      const results = extractCitations(completion);
      
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    throw new Error(`Unknown provider: ${provider}`);
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractCitations(completion: any) {
  // Extract URLs from tool call results
  const results: any[] = [];
  // ... extraction logic
  return results;
}
```
    
    if (!response.ok) {
      throw new Error(`CSE API error: ${response.status}`);
    }
    
    const data: SearchResponse = await response.json();
    
    // Track usage
    await this.incrementUsage();
    
    return data.items || [];
  }
  
  private async checkQuota(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT calls_count FROM api_usage 
       WHERE api_name = 'google_cse' AND date = $1`,
      [today]
    );
    return result.rows[0]?.calls_count || 0;
  }
  
  private async incrementUsage(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await db.query(`
      INSERT INTO api_usage (api_name, date, calls_count, quota_limit)
      VALUES ('google_cse', $1, 1, 100)
      ON CONFLICT (api_name, date) 
      DO UPDATE SET calls_count = api_usage.calls_count + 1
    `, [today]);
  }
}

// Factory for swappability
export function createSearchProvider(): SearchProvider {
  // Future: could return BingProvider, SerpAPIProvider, etc.
  return new GoogleCSEProvider();
}
```

### Query Templates (`config/searchQueries.json`)

```json
{
  "queries": [
    "site:.mt apartment for rent Malta",
    "site:.mt property for sale Malta",
    "Sliema apartment rent Malta",
    "Valletta apartment for sale",
    "St Julian's property rent",
    "Gzira flat for rent Malta",
    "Malta penthouse for sale",
    "Mellieha house rent",
    "site:remax-malta.com apartment",
    "site:frank.com.mt property"
  ],
  "rotationDays": 7,
  "queriesPerDay": 10
}
```

### Discovery Job (`jobs/discoveryJob.ts`)

```typescript
import cron from 'node-cron';
import { createSearchProvider } from '../integrations/googleSearch';
import { db } from '../db';
import { writeAudit } from '../audit';
import queries from '../config/searchQueries.json';

interface DiscoveryStats {
  queriesRun: number;
  urlsDiscovered: number;
  urlsEnqueued: number;
  urlsBlocked: number;
  urlsDuplicate: number;
}

export async function runDiscovery(mode: 'daily' | 'manual' = 'daily'): Promise<DiscoveryStats> {
  const provider = createSearchProvider();
  const stats: DiscoveryStats = {
    queriesRun: 0,
    urlsDiscovered: 0,
    urlsEnqueued: 0,
    urlsBlocked: 0,
    urlsDuplicate: 0,
  };
  
  // Select queries for today
  const today = new Date();
  const dayIndex = today.getDay();
  const dailyQueries = queries.queries.slice(
    (dayIndex * queries.queriesPerDay) % queries.queries.length,
    ((dayIndex * queries.queriesPerDay) % queries.queries.length) + queries.queriesPerDay
  );
  
  for (const query of dailyQueries) {
    try {
      const results = await provider.search(query);
      stats.queriesRun++;
      stats.urlsDiscovered += results.length;
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const domain = extractDomain(result.link);
        
        // Check domain policy
        const policy = await getDomainPolicy(domain);
        
        if (!policy || !policy.allowed_to_fetch) {
          stats.urlsBlocked++;
          continue;
        }
        
        // Try to enqueue
        const enqueued = await enqueueUrl({
          url: result.link,
          domain,
          query,
          rank: i + 1,
          snippet: result.snippet,
        });
        
        if (enqueued) {
          stats.urlsEnqueued++;
        } else {
          stats.urlsDuplicate++;
        }
      }
      
      // Rate limiting between queries
      await sleep(1000);
      
    } catch (error) {
      console.error(`Discovery error for query "${query}":`, error);
    }
  }
  
  // Audit
  await writeAudit({
    actorType: 'system',
    actorId: 'discovery-job',
    action: 'discovery.run',
    entity: 'url_queue',
    payload: { mode, stats },
  });
  
  return stats;
}

async function getDomainPolicy(domain: string) {
  const result = await db.query(
    'SELECT * FROM domain_policy WHERE domain = $1',
    [domain]
  );
  return result.rows[0];
}

async function enqueueUrl(data: {
  url: string;
  domain: string;
  query: string;
  rank: number;
  snippet: string;
}): Promise<boolean> {
  try {
    await db.query(`
      INSERT INTO url_queue (url, domain, query_used, result_rank, snippet)
      VALUES ($1, $2, $3, $4, $5)
    `, [data.url, data.domain, data.query, data.rank, data.snippet]);
    return true;
  } catch (error: any) {
    if (error.code === '23505') { // unique violation
      return false;
    }
    throw error;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Schedule: run daily at 6 AM Malta time
export function scheduleDiscovery(): void {
  cron.schedule('0 6 * * *', () => {
    runDiscovery('daily').catch(console.error);
  }, {
    timezone: 'Europe/Malta',
  });
}
```

### Routes (`routes/discovery.ts`)

```typescript
import { FastifyInstance } from 'fastify';
import { runDiscovery } from '../jobs/discoveryJob';
import { db } from '../db';
import { requireRole } from '../middleware/rbac';

export async function discoveryRoutes(fastify: FastifyInstance) {
  // Run discovery (admin only)
  fastify.post('/api/discovery/run', {
    preHandler: requireRole(['admin']),
  }, async (request, reply) => {
    const { mode = 'manual' } = request.body as { mode?: 'daily' | 'manual' };
    const stats = await runDiscovery(mode);
    return { success: true, stats };
  });
  
  // Get discovery stats
  fastify.get('/api/discovery/stats', {
    preHandler: requireRole(['admin']),
  }, async () => {
    const queueStats = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM url_queue
      GROUP BY status
    `);
    
    const usage = await db.query(`
      SELECT * FROM api_usage 
      WHERE api_name = 'google_cse'
      ORDER BY date DESC
      LIMIT 7
    `);
    
    const recentUrls = await db.query(`
      SELECT url, domain, status, discovered_at
      FROM url_queue
      ORDER BY discovered_at DESC
      LIMIT 20
    `);
    
    return {
      queue: queueStats.rows,
      apiUsage: usage.rows,
      recentUrls: recentUrls.rows,
    };
  });
  
  // Manage domain policy
  fastify.get('/api/discovery/domains', {
    preHandler: requireRole(['admin']),
  }, async () => {
    const result = await db.query('SELECT * FROM domain_policy ORDER BY domain');
    return result.rows;
  });
  
  fastify.post('/api/discovery/domains', {
    preHandler: requireRole(['admin']),
  }, async (request) => {
    const { domain, allowed_to_fetch, allowed_to_republish, fields_allowed, notes } = request.body as any;
    
    await db.query(`
      INSERT INTO domain_policy (domain, allowed_to_fetch, allowed_to_republish, fields_allowed, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (domain) DO UPDATE SET
        allowed_to_fetch = $2,
        allowed_to_republish = $3,
        fields_allowed = $4,
        notes = $5,
        updated_at = now()
    `, [domain, allowed_to_fetch, allowed_to_republish, JSON.stringify(fields_allowed), notes]);
    
    return { success: true };
  });
}
```

---

## Environment Variables

```env
# In Supabase Edge Function secrets (not in backend)
GEMINI_API_KEY=your-gemini-api-key     # Primary
OPENAI_API_KEY=your-openai-api-key     # Fallback

# Backend only needs Supabase connection
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

> **Note**: No individual Google CSE keys needed. Gemini grounded search handles web discovery.

---

## Tests

```typescript
describe('Discovery', () => {
  it('only enqueues allowed domains', async () => {});
  it('blocks domains without policy', async () => {});
  it('rejects duplicate URLs', async () => {});
  it('tracks API usage correctly', async () => {});
  it('writes audit log on run', async () => {});
  it('respects daily quota limit', async () => {});
});
```

---

## Acceptance Criteria

- [ ] Domain policy table seeded with Malta portals
- [ ] Discovery job runs on schedule
- [ ] Only `allowed_to_fetch=true` domains enqueued
- [ ] Duplicate URLs rejected (unique constraint)
- [ ] API usage tracked and quota enforced
- [ ] Admin can manage domain policies
- [ ] Audit log written for every run

---

## Rollback

```bash
psql -c "DROP TABLE IF EXISTS url_queue CASCADE;"
psql -c "DROP TABLE IF EXISTS domain_policy CASCADE;"
psql -c "DROP TABLE IF EXISTS api_usage CASCADE;"
psql -c "DROP TYPE IF EXISTS url_status;"
```
