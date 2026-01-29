---
description: Extraction/ETL + Schema.org parser + Link-out listing creation
---

# W10: External ETL Workflow

Process URL queue, extract listing data, normalize, dedupe, and create link-out listings.

---

## Goal

Build an ETL pipeline that:
- Fetches URLs from queue (respecting domain policy)
- Extracts structured data (Schema.org preferred)
- Normalizes into listings schema
- Dedupes by source URL and by content similarity
- Creates link-out listings (minimal metadata + URL)

---

## Hard Rules

- **Respect domain_policy** — never republish without permission
- If `allowed_to_republish = false`:
  - Store ONLY: title (short), price, bedrooms, bathrooms, area, canonical URL, source domain, discovered_at
  - Do NOT store: full descriptions, images, contact info
- Never download or store remote photos — URL manifest only
- Dedupe by: (source_url) AND (geo_approx + price_band + bedrooms)
- Mark listings with `source_type`: 'native' | 'partner' | 'linkout'
- Audit every URL processed

---

## Stack

- Node.js 22+
- Fastify
- Cheerio (HTML parsing)
- PostgreSQL

---

## Database Changes

### Add to listings table

```sql
-- Add external listing fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'native';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_domain TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Constraint: source_url unique for external listings
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_source_url 
  ON listings(source_url) WHERE source_url IS NOT NULL;

-- Index for dedupe queries
CREATE INDEX IF NOT EXISTS idx_listings_dedupe 
  ON listings(type, bedrooms, price_amount) 
  WHERE source_type != 'native';
```

---

## Files to Create

```
/apps/backend/src/
├── etl/
│   ├── index.ts              # Main ETL orchestrator
│   ├── fetchPage.ts          # HTTP fetcher with retry
│   ├── extractSchemaOrg.ts   # Schema.org RealEstateListing parser
│   ├── extractFallback.ts    # Heuristic extraction
│   ├── normalizeListing.ts   # Normalize to internal schema
│   └── dedupe.ts             # Deduplication logic
├── jobs/
│   └── etlJob.ts             # Scheduled ETL runner
├── routes/
│   └── etl.ts                # Admin endpoints
└── test/
    └── etl.test.ts
```

---

## Implementation

### Page Fetcher (`etl/fetchPage.ts`)

```typescript
interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MaltaPropertyBot/1.0 (+https://yoursite.com/bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    return {
      html,
      finalUrl: response.url,
      statusCode: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

### Schema.org Extractor (`etl/extractSchemaOrg.ts`)

```typescript
import * as cheerio from 'cheerio';

interface SchemaOrgListing {
  '@type': string;
  name?: string;
  description?: string;
  url?: string;
  price?: string | { '@type': string; price?: string; priceCurrency?: string };
  address?: { streetAddress?: string; addressLocality?: string; addressCountry?: string };
  numberOfRooms?: number | string;
  numberOfBedrooms?: number | string;
  numberOfBathroomsTotal?: number | string;
  floorSize?: { value?: number; unitCode?: string };
  image?: string | string[];
}

export interface ExtractedListing {
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: string | null;
  address: string | null;
  images: string[];
  canonicalUrl: string;
}

export function extractSchemaOrg(html: string, sourceUrl: string): ExtractedListing | null {
  const $ = cheerio.load(html);
  
  // Find JSON-LD scripts
  const scripts = $('script[type="application/ld+json"]');
  
  for (const script of scripts.toArray()) {
    try {
      const json = JSON.parse($(script).html() || '');
      const listings = findListings(json);
      
      if (listings.length > 0) {
        return parseSchemaListing(listings[0], sourceUrl);
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

function findListings(json: any): SchemaOrgListing[] {
  const types = ['RealEstateListing', 'Apartment', 'House', 'Residence', 'Product'];
  
  if (Array.isArray(json)) {
    return json.filter(item => types.includes(item['@type']));
  }
  
  if (json['@graph']) {
    return json['@graph'].filter((item: any) => types.includes(item['@type']));
  }
  
  if (types.includes(json['@type'])) {
    return [json];
  }
  
  return [];
}

function parseSchemaListing(schema: SchemaOrgListing, sourceUrl: string): ExtractedListing {
  // Parse price
  let price: number | null = null;
  let currency = 'EUR';
  
  if (typeof schema.price === 'string') {
    price = parseFloat(schema.price.replace(/[^0-9.]/g, '')) || null;
  } else if (schema.price?.price) {
    price = parseFloat(schema.price.price) || null;
    currency = schema.price.priceCurrency || 'EUR';
  }
  
  // Parse images
  let images: string[] = [];
  if (Array.isArray(schema.image)) {
    images = schema.image;
  } else if (typeof schema.image === 'string') {
    images = [schema.image];
  }
  
  return {
    title: schema.name || 'Untitled Listing',
    description: schema.description || null,
    price,
    currency,
    bedrooms: parseNumber(schema.numberOfBedrooms || schema.numberOfRooms),
    bathrooms: parseNumber(schema.numberOfBathroomsTotal),
    area: schema.address?.addressLocality || null,
    address: formatAddress(schema.address),
    images,
    canonicalUrl: schema.url || sourceUrl,
  };
}

function parseNumber(val: any): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseInt(val, 10) || null;
  return null;
}

function formatAddress(addr: any): string | null {
  if (!addr) return null;
  const parts = [addr.streetAddress, addr.addressLocality, addr.addressCountry];
  return parts.filter(Boolean).join(', ') || null;
}
```

### Normalizer (`etl/normalizeListing.ts`)

```typescript
import crypto from 'crypto';
import { ExtractedListing } from './extractSchemaOrg';

interface NormalizedListing {
  title: string;
  description: string | null;
  type: 'apartment' | 'house' | 'villa' | 'penthouse' | 'other';
  price_amount: number | null;
  price_currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  address_text: string | null;
  area: string | null;
  source_type: 'linkout';
  source_url: string;
  source_domain: string;
  content_hash: string;
  media_manifest: { kind: string; url: string }[];
}

export function normalizeListing(
  extracted: ExtractedListing,
  domain: string,
  allowedFields: string[]
): NormalizedListing {
  // Infer type from title
  const type = inferType(extracted.title);
  
  // Apply field restrictions for link-out
  const title = allowedFields.includes('title') 
    ? truncate(extracted.title, 100) 
    : 'Property Listing';
  
  const description = allowedFields.includes('description')
    ? extracted.description
    : null;
  
  const media = allowedFields.includes('images')
    ? extracted.images.map(url => ({ kind: 'photo', url }))
    : [];
  
  // Compute content hash for dedupe
  const hashInput = [
    extracted.canonicalUrl,
    extracted.price,
    extracted.bedrooms,
    extracted.area,
  ].join('|');
  const contentHash = crypto.createHash('md5').update(hashInput).digest('hex');
  
  return {
    title,
    description,
    type,
    price_amount: allowedFields.includes('price') ? extracted.price : null,
    price_currency: extracted.currency,
    bedrooms: allowedFields.includes('bedrooms') ? extracted.bedrooms : null,
    bathrooms: allowedFields.includes('bathrooms') ? extracted.bathrooms : null,
    address_text: allowedFields.includes('address') ? extracted.address : null,
    area: allowedFields.includes('area') ? extracted.area : null,
    source_type: 'linkout',
    source_url: extracted.canonicalUrl,
    source_domain: domain,
    content_hash: contentHash,
    media_manifest: media,
  };
}

function inferType(title: string): NormalizedListing['type'] {
  const lower = title.toLowerCase();
  if (lower.includes('apartment') || lower.includes('flat')) return 'apartment';
  if (lower.includes('penthouse')) return 'penthouse';
  if (lower.includes('villa')) return 'villa';
  if (lower.includes('house') || lower.includes('maisonette')) return 'house';
  return 'other';
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}
```

### Dedupe (`etl/dedupe.ts`)

```typescript
import { db } from '../db';

interface DedupeResult {
  isDuplicate: boolean;
  existingId?: string;
  reason?: 'source_url' | 'content_similarity';
}

export async function checkDuplicate(
  sourceUrl: string,
  contentHash: string,
  area: string | null,
  priceAmount: number | null,
  bedrooms: number | null
): Promise<DedupeResult> {
  // Check exact source URL match
  const urlMatch = await db.query(
    'SELECT id FROM listings WHERE source_url = $1',
    [sourceUrl]
  );
  
  if (urlMatch.rows.length > 0) {
    return {
      isDuplicate: true,
      existingId: urlMatch.rows[0].id,
      reason: 'source_url',
    };
  }
  
  // Check content hash (same page, different URL)
  const hashMatch = await db.query(
    'SELECT id FROM listings WHERE content_hash = $1',
    [contentHash]
  );
  
  if (hashMatch.rows.length > 0) {
    return {
      isDuplicate: true,
      existingId: hashMatch.rows[0].id,
      reason: 'content_similarity',
    };
  }
  
  // Check fuzzy similarity (same property, different source)
  if (area && priceAmount && bedrooms) {
    const priceBand = Math.floor(priceAmount / 10000) * 10000;
    
    const fuzzyMatch = await db.query(`
      SELECT id FROM listings
      WHERE area ILIKE $1
        AND bedrooms = $2
        AND price_amount BETWEEN $3 AND $4
        AND source_type != 'native'
      LIMIT 1
    `, [area, bedrooms, priceBand - 5000, priceBand + 15000]);
    
    if (fuzzyMatch.rows.length > 0) {
      return {
        isDuplicate: true,
        existingId: fuzzyMatch.rows[0].id,
        reason: 'content_similarity',
      };
    }
  }
  
  return { isDuplicate: false };
}
```

### ETL Job (`jobs/etlJob.ts`)

```typescript
import cron from 'node-cron';
import { db } from '../db';
import { fetchPage } from '../etl/fetchPage';
import { extractSchemaOrg } from '../etl/extractSchemaOrg';
import { normalizeListing } from '../etl/normalizeListing';
import { checkDuplicate } from '../etl/dedupe';
import { writeAudit } from '../audit';

interface ETLStats {
  processed: number;
  created: number;
  updated: number;
  duplicates: number;
  errors: number;
  blocked: number;
}

export async function runETL(limit = 50): Promise<ETLStats> {
  const stats: ETLStats = {
    processed: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    errors: 0,
    blocked: 0,
  };
  
  // Get queued URLs
  const urls = await db.query(`
    SELECT q.*, p.allowed_to_republish, p.fields_allowed
    FROM url_queue q
    JOIN domain_policy p ON q.domain = p.domain
    WHERE q.status = 'new'
    ORDER BY q.discovered_at
    LIMIT $1
  `, [limit]);
  
  for (const row of urls.rows) {
    await db.query(
      "UPDATE url_queue SET status = 'processing' WHERE id = $1",
      [row.id]
    );
    
    try {
      // Fetch page
      const { html } = await fetchPage(row.url);
      
      // Extract
      const extracted = extractSchemaOrg(html, row.url);
      
      if (!extracted) {
        await markError(row.id, 'No structured data found');
        stats.errors++;
        continue;
      }
      
      // Normalize (apply field restrictions)
      const fieldsAllowed = row.fields_allowed || ['title', 'price', 'bedrooms', 'url'];
      const normalized = normalizeListing(extracted, row.domain, fieldsAllowed);
      
      // Dedupe
      const dedupe = await checkDuplicate(
        normalized.source_url,
        normalized.content_hash,
        normalized.area,
        normalized.price_amount,
        normalized.bedrooms
      );
      
      if (dedupe.isDuplicate) {
        await markDone(row.id);
        stats.duplicates++;
        
        // Update last_checked_at on existing
        await db.query(
          'UPDATE listings SET last_checked_at = now() WHERE id = $1',
          [dedupe.existingId]
        );
        continue;
      }
      
      // Insert listing
      await db.query(`
        INSERT INTO listings (
          title, description, type, price_amount, price_currency,
          bedrooms, bathrooms, address_text, area,
          source_type, source_url, source_domain, content_hash,
          discovered_at, last_checked_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now(), 'published')
      `, [
        normalized.title,
        normalized.description,
        normalized.type,
        normalized.price_amount,
        normalized.price_currency,
        normalized.bedrooms,
        normalized.bathrooms,
        normalized.address_text,
        normalized.area,
        normalized.source_type,
        normalized.source_url,
        normalized.source_domain,
        normalized.content_hash,
      ]);
      
      await markDone(row.id);
      stats.created++;
      
      await writeAudit({
        actorType: 'system',
        actorId: 'etl-job',
        action: 'etl.listing.created',
        entity: 'listing',
        payload: { source_url: normalized.source_url, domain: row.domain },
      });
      
    } catch (error: any) {
      await markError(row.id, error.message);
      stats.errors++;
    }
    
    stats.processed++;
    
    // Rate limit
    await sleep(500);
  }
  
  await writeAudit({
    actorType: 'system',
    actorId: 'etl-job',
    action: 'etl.run',
    entity: 'url_queue',
    payload: stats,
  });
  
  return stats;
}

async function markDone(id: string): Promise<void> {
  await db.query(
    "UPDATE url_queue SET status = 'done', processed_at = now() WHERE id = $1",
    [id]
  );
}

async function markError(id: string, error: string): Promise<void> {
  await db.query(`
    UPDATE url_queue 
    SET status = 'error', last_error = $2, retry_count = retry_count + 1 
    WHERE id = $1
  `, [id, error]);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Schedule: run every 2 hours
export function scheduleETL(): void {
  cron.schedule('0 */2 * * *', () => {
    runETL(50).catch(console.error);
  });
}
```

---

## Tests

```typescript
describe('ETL', () => {
  describe('Schema.org extraction', () => {
    it('extracts RealEstateListing from JSON-LD', async () => {});
    it('handles missing optional fields', async () => {});
    it('parses price from various formats', async () => {});
  });
  
  describe('Normalization', () => {
    it('redacts fields not in allowlist', async () => {});
    it('infers type from title', async () => {});
    it('truncates long titles', async () => {});
  });
  
  describe('Dedupe', () => {
    it('detects duplicate by source_url', async () => {});
    it('detects duplicate by content_hash', async () => {});
    it('detects fuzzy duplicates', async () => {});
  });
});
```

---

## Acceptance Criteria

- [ ] Schema.org extraction works on real Malta property pages
- [ ] Link-out mode redacts description/images when not allowed
- [ ] Dedupe prevents duplicate listings
- [ ] URL queue status updated correctly
- [ ] Audit trail for all operations
- [ ] External listings marked with `source_type = 'linkout'`

---

## Rollback

```bash
# Remove ETL-added listings
DELETE FROM listings WHERE source_type = 'linkout';

# Reset queue
UPDATE url_queue SET status = 'new' WHERE status IN ('done', 'error');
```
