---
description: Moltbot "Ops Brain" using OpenAI Web Search + Deep Research
---

# W12: Ops Research Workflow

Autonomous Moltbot operations with market intelligence, anomaly detection, and weekly briefings.

---

## Goal

Build an Ops agent that:
- Produces weekly Malta property market briefs with citations
- Monitors news and regulatory changes
- Detects suspicious listings (price anomalies, duplicates)
- Uses OpenAI Web Search + Deep Research for investigations

---

## Hard Rules

- All reports must include **citations** (URLs + access dates)
- Anomaly flags are advisory only — humans make final decisions
- Deep Research outputs stored for auditability
- Never auto-delete or auto-reject listings without human confirmation
- Rate limit AI calls (avoid runaway costs)

---

## Stack

- Node.js 22+
- **Gemini API** (grounded search + research via Supabase Edge Function)
- **OpenAI API** (fallback for research)
- node-cron for scheduling
- PostgreSQL for report storage

---

## Database Schema

```sql
-- Market research reports
CREATE TABLE IF NOT EXISTS market_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL, -- 'weekly_brief', 'trend_analysis', 'news_digest'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  model_used TEXT,
  tokens_used INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published BOOLEAN DEFAULT false
);

CREATE INDEX idx_market_reports_type ON market_reports(report_type);

-- Listing anomalies detected by ops agent
CREATE TABLE IF NOT EXISTS listing_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  anomaly_type TEXT NOT NULL, -- 'price_outlier', 'duplicate_suspect', 'stale', 'suspicious_text'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high'
  details JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX idx_anomalies_listing ON listing_anomalies(listing_id);
CREATE INDEX idx_anomalies_unresolved ON listing_anomalies(resolved) WHERE resolved = false;
```

---

## Files to Create

```
/apps/backend/src/
├── integrations/
│   └── openaiResearch.ts       # OpenAI Web Search + Deep Research
├── reports/
│   ├── weeklyMarketBrief.ts    # Weekly brief generator
│   ├── anomalyDetector.ts      # Listing anomaly detection
│   └── newsDigest.ts           # News monitoring
├── jobs/
│   └── opsJob.ts               # Scheduled operations
├── routes/
│   └── reports.ts              # Report endpoints
└── test/
    └── reports.test.ts

/infra/moltbot/agents/admin/
└── OPS.md                      # Agent instructions
```

---

## Implementation

### Unified AI Research Client (`integrations/aiResearch.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

interface Citation {
  title: string;
  url: string;
  snippet: string;
  accessedAt: string;
}

interface ResearchResult {
  content: string;
  citations: Citation[];
  tokensUsed: number;
  model: string;
}

export class AIResearchClient {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  // Web Search with citations (Gemini primary, OpenAI fallback)
  async webSearch(query: string): Promise<ResearchResult> {
    const { data, error } = await this.supabase.functions.invoke('ai-research', {
      body: {
        query,
        action: 'web_search',
        provider: 'gemini', // Will fallback to openai if needed
      },
    });
    
    if (error) throw new Error(`Research failed: ${error.message}`);
    
    return {
      content: data.content,
      citations: data.citations || [],
      tokensUsed: data.tokensUsed || 0,
      model: data.model,
    };
  }
  
  // Deep Research for comprehensive reports
  async deepResearch(topic: string): Promise<ResearchResult> {
    const { data, error } = await this.supabase.functions.invoke('ai-research', {
      body: {
        query: topic,
        action: 'deep_research',
        provider: 'gemini',
      },
    });
    
    if (error) throw new Error(`Deep research failed: ${error.message}`);
    
    return {
      content: data.content,
      citations: data.citations || [],
      tokensUsed: data.tokensUsed || 0,
      model: data.model,
    };
  }
}

export const researchClient = new AIResearchClient();
```

### Supabase Edge Function (`supabase/functions/ai-research/index.ts`)

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
  
  const { query, action, provider } = await req.json();
  
  try {
    // Try Gemini first
    if (provider === 'gemini') {
      try {
        return await handleGeminiResearch(query, action);
      } catch (geminiError) {
        console.error('Gemini failed, falling back to OpenAI:', geminiError);
        return await handleOpenAIResearch(query, action);
      }
    }
    
    return await handleOpenAIResearch(query, action);
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleGeminiResearch(query: string, action: string) {
  const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
  
  const model = genAI.getGenerativeModel({
    model: action === 'deep_research' ? 'gemini-2.0-flash-thinking' : 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
  });
  
  const systemPrompt = action === 'deep_research'
    ? `You are a Malta real estate market researcher. Produce a comprehensive report with citations.`
    : `You are researching Malta real estate. Always cite sources with URLs.`;
  
  const result = await model.generateContent(`${systemPrompt}\n\n${query}`);
  const text = result.response.text();
  
  // Extract citations from grounding metadata
  const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
  const citations = (groundingMetadata?.groundingChunks || []).map((chunk: any) => ({
    title: chunk.web?.title || 'Source',
    url: chunk.web?.uri || '',
    snippet: chunk.text || '',
    accessedAt: new Date().toISOString(),
  }));
  
  return new Response(JSON.stringify({
    content: text,
    citations,
    tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
    model: 'gemini-2.0-flash',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleOpenAIResearch(query: string, action: string) {
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
  
  const completion = await openai.chat.completions.create({
    model: action === 'deep_research' ? 'gpt-4o' : 'gpt-4o-mini',
    messages: [
      { 
        role: 'system', 
        content: 'You are a Malta real estate researcher. Always cite sources.' 
      },
      { role: 'user', content: query },
    ],
    tools: [{ type: 'web_search', web_search: { search_context_size: 'medium' } }],
  });
  
  const content = completion.choices[0].message.content || '';
  const citations = extractCitationsFromContent(content);
  
  return new Response(JSON.stringify({
    content,
    citations,
    tokensUsed: completion.usage?.total_tokens || 0,
    model: 'gpt-4o',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractCitationsFromContent(content: string) {
  const citations: any[] = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    citations.push({
      title: match[1],
      url: match[2],
      snippet: '',
      accessedAt: new Date().toISOString(),
    });
  }
  
  return citations;
}
```
    const completion = await this.client.chat.completions.create({
      model: 'o3-deep-research',
      messages: [
        {
          role: 'system',
          content: `You are conducting deep research on Malta's real estate market.
Produce a comprehensive, well-structured report with:
- Executive summary
- Key findings with data
- Market trends
- Recommendations
Always cite every claim with [Source](URL).`,
        },
        {
          role: 'user',
          content: topic,
        },
      ],
      max_completion_tokens: 4000,
    });
    
    const message = completion.choices[0].message;
    const citations = this.extractCitations(message);
    
    return {
      content: message.content || '',
      citations,
      tokensUsed: completion.usage?.total_tokens || 0,
      model: 'o3-deep-research',
    };
  }
  
  private extractCitations(message: any): Citation[] {
    const citations: Citation[] = [];
    const content = message.content || '';
    
    // Extract markdown links [title](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      citations.push({
        title: match[1],
        url: match[2],
        snippet: '',
        accessedAt: new Date().toISOString(),
      });
    }
    
    // Also check tool call results for citations
    if (message.tool_calls) {
      for (const call of message.tool_calls) {
        if (call.result?.citations) {
          for (const cite of call.result.citations) {
            citations.push({
              title: cite.title || 'Source',
              url: cite.url,
              snippet: cite.snippet || '',
              accessedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
    
    return citations;
  }
}

export const researchClient = new OpenAIResearchClient();
```

### Weekly Market Brief (`reports/weeklyMarketBrief.ts`)

```typescript
import { db } from '../db';
import { researchClient } from '../integrations/openaiResearch';
import { writeAudit } from '../audit';

interface BriefSection {
  title: string;
  content: string;
}

export async function generateWeeklyBrief(): Promise<string> {
  // 1. Get internal stats
  const stats = await getInternalStats();
  
  // 2. Research external market data
  const marketResearch = await researchClient.deepResearch(`
    Malta real estate market update for the week of ${new Date().toLocaleDateString()}.
    
    Research and report on:
    1. Current rental price trends in major areas (Sliema, St Julian's, Valletta, Gzira)
    2. Any new property regulations or government announcements
    3. Notable market developments or large transactions
    4. Seasonal trends affecting the market
    
    Cite all sources.
  `);
  
  // 3. Combine into report
  const report = `
# Malta Property Market Weekly Brief

**Week of ${new Date().toLocaleDateString()}**

## Platform Statistics

- New listings this week: ${stats.newListings}
- Total active listings: ${stats.activeListings}
- Link-out listings: ${stats.linkoutListings}
- Average price (rent): €${stats.avgRentPrice}/month
- Most active areas: ${stats.topAreas.join(', ')}

## Market Research

${marketResearch.content}

## Anomalies Detected

${stats.anomalies} new anomalies flagged this week (${stats.unresolvedAnomalies} unresolved)

---

Generated: ${new Date().toISOString()}
Model: ${marketResearch.model}
Tokens: ${marketResearch.tokensUsed}
`;

  // 4. Store report
  await db.query(`
    INSERT INTO market_reports (report_type, title, content, citations, model_used, tokens_used)
    VALUES ('weekly_brief', $1, $2, $3, $4, $5)
  `, [
    `Weekly Brief - ${new Date().toLocaleDateString()}`,
    report,
    JSON.stringify(marketResearch.citations),
    marketResearch.model,
    marketResearch.tokensUsed,
  ]);
  
  await writeAudit({
    actorType: 'system',
    actorId: 'ops-agent',
    action: 'report.generate',
    entity: 'market_report',
    payload: { type: 'weekly_brief', tokens: marketResearch.tokensUsed },
  });
  
  return report;
}

async function getInternalStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const listings = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at > $1) as new_listings,
      COUNT(*) FILTER (WHERE status = 'published') as active_listings,
      COUNT(*) FILTER (WHERE source_type = 'linkout') as linkout_listings,
      AVG(price_amount) FILTER (WHERE type = 'apartment' AND price_currency = 'EUR') as avg_rent
    FROM listings
  `, [weekAgo]);
  
  const topAreas = await db.query(`
    SELECT area, COUNT(*) as count
    FROM listings
    WHERE area IS NOT NULL AND status = 'published'
    GROUP BY area
    ORDER BY count DESC
    LIMIT 5
  `);
  
  const anomalies = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE detected_at > $1) as new_anomalies,
      COUNT(*) FILTER (WHERE resolved = false) as unresolved
    FROM listing_anomalies
  `, [weekAgo]);
  
  return {
    newListings: listings.rows[0]?.new_listings || 0,
    activeListings: listings.rows[0]?.active_listings || 0,
    linkoutListings: listings.rows[0]?.linkout_listings || 0,
    avgRentPrice: Math.round(listings.rows[0]?.avg_rent || 0),
    topAreas: topAreas.rows.map(r => r.area),
    anomalies: anomalies.rows[0]?.new_anomalies || 0,
    unresolvedAnomalies: anomalies.rows[0]?.unresolved || 0,
  };
}
```

### Anomaly Detector (`reports/anomalyDetector.ts`)

```typescript
import { db } from '../db';
import { writeAudit } from '../audit';

interface Anomaly {
  listingId: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  details: object;
}

export async function detectAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  
  // 1. Price outliers (>3 std dev from mean for type+area)
  const priceOutliers = await db.query(`
    WITH stats AS (
      SELECT type, area,
        AVG(price_amount) as mean,
        STDDEV(price_amount) as stddev
      FROM listings
      WHERE status = 'published' AND price_amount > 0
      GROUP BY type, area
    )
    SELECT l.id, l.title, l.price_amount, l.type, l.area,
      s.mean, s.stddev,
      ABS(l.price_amount - s.mean) / NULLIF(s.stddev, 0) as z_score
    FROM listings l
    JOIN stats s ON l.type = s.type AND l.area = s.area
    WHERE l.status = 'published'
      AND ABS(l.price_amount - s.mean) / NULLIF(s.stddev, 0) > 3
  `);
  
  for (const row of priceOutliers.rows) {
    anomalies.push({
      listingId: row.id,
      type: 'price_outlier',
      severity: row.z_score > 4 ? 'high' : 'medium',
      details: {
        price: row.price_amount,
        mean: Math.round(row.mean),
        zScore: row.z_score.toFixed(2),
      },
    });
  }
  
  // 2. Stale listings (not updated in 60+ days)
  const staleListings = await db.query(`
    SELECT id, title, updated_at
    FROM listings
    WHERE status = 'published'
      AND updated_at < now() - interval '60 days'
      AND source_type != 'linkout'
  `);
  
  for (const row of staleListings.rows) {
    anomalies.push({
      listingId: row.id,
      type: 'stale',
      severity: 'low',
      details: { lastUpdated: row.updated_at },
    });
  }
  
  // 3. Duplicate suspects (same price + bedrooms + area, different source)
  const duplicateSuspects = await db.query(`
    SELECT l1.id, l1.title, l1.source_url, l2.id as dup_id, l2.title as dup_title
    FROM listings l1
    JOIN listings l2 ON 
      l1.price_amount = l2.price_amount
      AND l1.bedrooms = l2.bedrooms
      AND l1.area = l2.area
      AND l1.id < l2.id
      AND l1.source_domain != l2.source_domain
    WHERE l1.source_type = 'linkout' AND l2.source_type = 'linkout'
  `);
  
  for (const row of duplicateSuspects.rows) {
    anomalies.push({
      listingId: row.id,
      type: 'duplicate_suspect',
      severity: 'medium',
      details: { 
        duplicateOf: row.dup_id,
        duplicateTitle: row.dup_title,
      },
    });
  }
  
  // Store anomalies
  for (const anomaly of anomalies) {
    await db.query(`
      INSERT INTO listing_anomalies (listing_id, anomaly_type, severity, details)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [anomaly.listingId, anomaly.type, anomaly.severity, JSON.stringify(anomaly.details)]);
  }
  
  await writeAudit({
    actorType: 'system',
    actorId: 'ops-agent',
    action: 'anomaly.detect',
    entity: 'listing_anomaly',
    payload: { count: anomalies.length },
  });
  
  return anomalies;
}
```

### Ops Job (`jobs/opsJob.ts`)

```typescript
import cron from 'node-cron';
import { generateWeeklyBrief } from '../reports/weeklyMarketBrief';
import { detectAnomalies } from '../reports/anomalyDetector';

// Weekly brief: every Monday at 8 AM Malta time
export function scheduleOpsJobs(): void {
  cron.schedule('0 8 * * 1', () => {
    generateWeeklyBrief().catch(console.error);
  }, { timezone: 'Europe/Malta' });
  
  // Anomaly detection: daily at midnight
  cron.schedule('0 0 * * *', () => {
    detectAnomalies().catch(console.error);
  }, { timezone: 'Europe/Malta' });
}
```

### Routes (`routes/reports.ts`)

```typescript
import { FastifyInstance } from 'fastify';
import { generateWeeklyBrief } from '../reports/weeklyMarketBrief';
import { detectAnomalies } from '../reports/anomalyDetector';
import { db } from '../db';
import { requireRole } from '../middleware/rbac';

export async function reportRoutes(fastify: FastifyInstance) {
  // Get latest weekly brief
  fastify.get('/api/reports/weekly-malta-brief', {
    preHandler: requireRole(['admin']),
  }, async (request) => {
    const format = (request.query as any).format || 'json';
    
    const result = await db.query(`
      SELECT * FROM market_reports
      WHERE report_type = 'weekly_brief'
      ORDER BY generated_at DESC
      LIMIT 1
    `);
    
    if (!result.rows[0]) {
      return { error: 'No report available' };
    }
    
    if (format === 'markdown') {
      return result.rows[0].content;
    }
    
    return result.rows[0];
  });
  
  // Generate new brief (manual trigger)
  fastify.post('/api/reports/weekly-malta-brief', {
    preHandler: requireRole(['admin']),
  }, async () => {
    const report = await generateWeeklyBrief();
    return { success: true, preview: report.slice(0, 500) + '...' };
  });
  
  // List anomalies
  fastify.get('/api/reports/anomalies', {
    preHandler: requireRole(['admin']),
  }, async (request) => {
    const { resolved = 'false' } = request.query as any;
    
    const result = await db.query(`
      SELECT a.*, l.title as listing_title
      FROM listing_anomalies a
      LEFT JOIN listings l ON a.listing_id = l.id
      WHERE a.resolved = $1
      ORDER BY a.detected_at DESC
      LIMIT 100
    `, [resolved === 'true']);
    
    return result.rows;
  });
  
  // Resolve anomaly
  fastify.post('/api/reports/anomalies/:id/resolve', {
    preHandler: requireRole(['admin']),
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };
    
    await db.query(`
      UPDATE listing_anomalies SET
        resolved = true,
        resolved_by = $1,
        resolved_at = now(),
        resolution_notes = $2
      WHERE id = $3
    `, [request.user?.id, notes, id]);
    
    return { success: true };
  });
  
  // Run anomaly detection manually
  fastify.post('/api/reports/anomalies/detect', {
    preHandler: requireRole(['admin']),
  }, async () => {
    const anomalies = await detectAnomalies();
    return { success: true, count: anomalies.length };
  });
}
```

### Agent Instructions (`infra/moltbot/agents/admin/OPS.md`)

```markdown
# Ops Agent Instructions

You are the Malta Property Intelligence Ops Agent.

## Core Responsibilities

1. **Market Monitoring**
   - Generate weekly market briefs every Monday
   - Track rental price trends by area
   - Monitor regulatory news

2. **Quality Assurance**
   - Detect price anomalies (>3 std dev)
   - Flag stale listings (60+ days unchanged)
   - Identify duplicate suspects across sources

3. **Ingestion Health**
   - Monitor discovery job success rates
   - Track ETL error rates
   - Alert on API quota exhaustion

## Available Tools

- `report.weekly.generate` - Generate weekly market brief
- `anomaly.detect` - Run anomaly detection
- `stats.ingestion` - Get ingestion pipeline stats
- `stats.listings` - Get listing inventory stats

## Routines

### Weekly (Monday 8 AM)
1. Generate weekly brief
2. Review unresolved anomalies
3. Check ingestion health

### Daily (Midnight)
1. Run anomaly detection
2. Check API quotas

## Escalation

Flag to human admin if:
- More than 10 high-severity anomalies in 24h
- Discovery job fails 3+ times
- API quota > 80%

## Safety Rules

- Never auto-delete listings
- Never auto-reject without human review
- Always cite sources in reports
- Rate limit AI calls (max 50/day)
```

---

## Environment Variables

```env
# In Supabase Edge Function secrets
GEMINI_API_KEY=your-gemini-api-key     # Primary
OPENAI_API_KEY=your-openai-api-key     # Fallback

# Backend only needs Supabase connection
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

> **Note**: Gemini is primary for research, OpenAI is automatic fallback. Both keys stored in Supabase secrets.

---

## Tests

```typescript
describe('Ops Research', () => {
  describe('Weekly Brief', () => {
    it('includes platform statistics', async () => {});
    it('includes citations', async () => {});
    it('stores report in database', async () => {});
  });
  
  describe('Anomaly Detection', () => {
    it('detects price outliers', async () => {});
    it('detects stale listings', async () => {});
    it('detects duplicate suspects', async () => {});
  });
});
```

---

## Acceptance Criteria

- [ ] Weekly briefs generated automatically
- [ ] Briefs include citations with URLs
- [ ] Anomalies detected and flagged
- [ ] Admin can resolve anomalies
- [ ] Reports stored for auditability
- [ ] Ops agent instructions documented

---

## Rollback

```bash
# Remove ops data
TRUNCATE market_reports;
TRUNCATE listing_anomalies;
```
