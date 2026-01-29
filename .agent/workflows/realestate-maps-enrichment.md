---
description: Google Maps/Places enrichment (geo, neighborhood, POI context)
---

# W11: Maps Enrichment Workflow

Enrich listings with geocoding, neighborhood context, and POI data using Google Maps/Places APIs.

---

## Goal

Build an enrichment service that:
- Geocodes listing addresses to lat/lng
- Identifies neighborhoods and localities
- Adds nearby POI context (schools, transit, etc.)
- Caches results to minimize API costs
- Computes location confidence scores

---

## Hard Rules

- **Never override user-provided coordinates** — only fill missing data
- Cache all geocoding responses (address hash → result)
- Add `location_confidence` score (0-100)
- Respect API quotas and rate limits
- Store enrichment provenance and timestamps
- Only enrich if listing has address_text or area

---

## Stack

- Node.js 22+
- **Gemini API** (grounded search for geocoding via Supabase Edge Function)
- **OpenAI API** (fallback)
- PostgreSQL

---

## Database Schema

### Migration: `007_listing_geo_enrichment.sql`

```sql
-- Add geo fields to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS locality TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS location_confidence INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS poi_context JSONB;

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_listings_geo ON listings(lat, lng) WHERE lat IS NOT NULL;

-- Geocoding cache to avoid repeated billing
CREATE TABLE IF NOT EXISTS geo_cache (
  query_hash TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  response JSONB NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_maps',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POI cache
CREATE TABLE IF NOT EXISTS poi_cache (
  location_hash TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retention: clear caches older than 30 days
-- (run via cron job)
```

---

## Files to Create

```
/apps/backend/src/
├── integrations/
│   └── googleMaps.ts           # Geocoding + Places client
├── jobs/
│   └── enrichJob.ts            # Scheduled enrichment
├── routes/
│   └── enrich.ts               # Admin endpoints
├── migrations/
│   └── 007_listing_geo_enrichment.sql
└── test/
    └── enrich.test.ts
```

---

## Implementation

### AI Geocoding Client (`integrations/aiGeocode.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { db } from '../db';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  locality: string | null;
  neighborhood: string | null;
  confidence: number;
}

interface POIResult {
  name: string;
  type: string;
  distance: number;
}

export class AIGeocodeClient {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  async geocode(address: string, country = 'Malta'): Promise<GeocodingResult | null> {
    const query = `${address}, ${country}`;
    const queryHash = this.hashQuery(query);
    
    // Check cache
    const cached = await this.getCache(queryHash);
    if (cached) return cached;
    
    // Call Supabase Edge Function with Gemini grounded search
    const { data, error } = await this.supabase.functions.invoke('ai-geocode', {
      body: {
        address: query,
        provider: 'gemini',
      },
    });
    
    if (error) {
      console.error('Gemini geocode failed, trying OpenAI:', error);
      return this.fallbackGeocode(query, queryHash);
    }
    
    const result: GeocodingResult = {
      lat: data.lat,
      lng: data.lng,
      formattedAddress: data.formattedAddress,
      locality: data.locality,
      neighborhood: data.neighborhood,
      confidence: data.confidence || 70,
    };
    
    // Cache result
    await this.setCache(queryHash, query, result);
    
    return result;
  }
  
  private async fallbackGeocode(query: string, queryHash: string): Promise<GeocodingResult | null> {
    const { data, error } = await this.supabase.functions.invoke('ai-geocode', {
      body: {
        address: query,
        provider: 'openai',
      },
    });
    
    if (error) return null;
    
    const result: GeocodingResult = {
      lat: data.lat,
      lng: data.lng,
      formattedAddress: data.formattedAddress,
      locality: data.locality,
      neighborhood: data.neighborhood,
      confidence: data.confidence || 60,
    };
    
    await this.setCache(queryHash, query, result);
    return result;
  }
  
  async getNearbyPOIs(lat: number, lng: number): Promise<POIResult[]> {
    const locationHash = this.hashLocation(lat, lng);
    
    // Check cache
    const cached = await this.getPOICache(locationHash);
    if (cached) return cached;
    
    // Use Gemini to find nearby POIs
    const { data, error } = await this.supabase.functions.invoke('ai-geocode', {
      body: {
        lat,
        lng,
        action: 'nearby_pois',
        provider: 'gemini',
      },
    });
    
    if (error) return [];
    
    const pois: POIResult[] = (data.pois || []).map((p: any) => ({
      name: p.name,
      type: p.type,
      distance: p.distance || 500,
    }));
    
    // Cache
    await this.setPOICache(locationHash, lat, lng, pois);
    
    return pois;
  }
  
  private async getCache(hash: string): Promise<GeocodingResult | null> {
    const result = await db.query(
      'SELECT response FROM geo_cache WHERE query_hash = $1',
      [hash]
    );
    return result.rows[0]?.response || null;
  }
  
  private async setCache(hash: string, query: string, response: GeocodingResult): Promise<void> {
    await db.query(`
      INSERT INTO geo_cache (query_hash, query_text, response)
      VALUES ($1, $2, $3)
      ON CONFLICT (query_hash) DO UPDATE SET response = $3, created_at = now()
    `, [hash, query, JSON.stringify(response)]);
  }
  
  private async getPOICache(hash: string): Promise<POIResult[] | null> {
    const result = await db.query(
      'SELECT response FROM poi_cache WHERE location_hash = $1',
      [hash]
    );
    return result.rows[0]?.response || null;
  }
  
  private async setPOICache(hash: string, lat: number, lng: number, pois: POIResult[]): Promise<void> {
    await db.query(`
      INSERT INTO poi_cache (location_hash, lat, lng, radius_meters, response)
      VALUES ($1, $2, $3, 1000, $4)
      ON CONFLICT (location_hash) DO UPDATE SET response = $4, created_at = now()
    `, [hash, lat, lng, JSON.stringify(pois)]);
  }
  
  private hashQuery(query: string): string {
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }
  
  private hashLocation(lat: number, lng: number): string {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }
}

export const geocodeClient = new AIGeocodeClient();
```

### Supabase Edge Function (`supabase/functions/ai-geocode/index.ts`)

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
  
  const { address, lat, lng, action, provider } = await req.json();
  
  try {
    if (action === 'nearby_pois') {
      return await handleNearbyPOIs(lat, lng, provider);
    }
    
    return await handleGeocode(address, provider);
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleGeocode(address: string, provider: string) {
  const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
  });
  
  const prompt = `
    Geocode this Malta address and return JSON only:
    Address: ${address}
    
    Return format:
    {
      "lat": number,
      "lng": number,
      "formattedAddress": "string",
      "locality": "string or null",
      "neighborhood": "string or null",
      "confidence": number (0-100)
    }
  `;
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  
  const data = JSON.parse(jsonMatch[0]);
  
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleNearbyPOIs(lat: number, lng: number, provider: string) {
  const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
  });
  
  const prompt = `
    Find nearby points of interest within 1km of coordinates (${lat}, ${lng}) in Malta.
    Focus on: schools, transit stations, supermarkets, hospitals.
    
    Return JSON array:
    [
      { "name": "string", "type": "school|transit|supermarket|hospital", "distance": number_in_meters }
    ]
  `;
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const pois = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  
  return new Response(JSON.stringify({ pois }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

export class GoogleMapsClient {
  private apiKey: string;
  
  constructor() {
    this.apiKey = config.GOOGLE_MAPS_API_KEY;
    if (!this.apiKey) {
      throw new Error('Missing GOOGLE_MAPS_API_KEY');
    }
  }
  
  async geocode(address: string, country = 'Malta'): Promise<GeocodingResult | null> {
    const query = `${address}, ${country}`;
    const queryHash = this.hashQuery(query);
    
    // Check cache
    const cached = await this.getCache('geo_cache', queryHash);
    if (cached) {
      return this.parseGeocodingResponse(cached);
    }
    
    // Call API
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('region', 'mt'); // Malta bias
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results?.[0]) {
      return null;
    }
    
    // Cache response
    await this.setCache('geo_cache', queryHash, query, data.results[0]);
    
    return this.parseGeocodingResponse(data.results[0]);
  }
  
  private parseGeocodingResponse(result: any): GeocodingResult {
    const location = result.geometry?.location || {};
    
    // Extract address components
    let locality: string | null = null;
    let neighborhood: string | null = null;
    
    for (const component of result.address_components || []) {
      if (component.types.includes('locality')) {
        locality = component.long_name;
      }
      if (component.types.includes('neighborhood') || component.types.includes('sublocality')) {
        neighborhood = component.long_name;
      }
    }
    
    // Compute confidence based on result type
    let confidence = 50;
    const locationType = result.geometry?.location_type;
    
    if (locationType === 'ROOFTOP') confidence = 100;
    else if (locationType === 'RANGE_INTERPOLATED') confidence = 80;
    else if (locationType === 'GEOMETRIC_CENTER') confidence = 60;
    else if (locationType === 'APPROXIMATE') confidence = 40;
    
    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      locality,
      neighborhood,
      confidence,
    };
  }
  
  async getNearbyPOIs(
    lat: number, 
    lng: number, 
    radius = 1000
  ): Promise<POIResult[]> {
    const locationHash = this.hashLocation(lat, lng, radius);
    
    // Check cache
    const cached = await this.getCache('poi_cache', locationHash);
    if (cached) {
      return this.parsePOIResponse(cached, lat, lng);
    }
    
    const types = ['school', 'transit_station', 'supermarket', 'hospital'];
    const allPOIs: POIResult[] = [];
    
    for (const type of types) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
      url.searchParams.set('location', `${lat},${lng}`);
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('type', type);
      url.searchParams.set('key', this.apiKey);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (data.status === 'OK') {
        for (const place of data.results.slice(0, 3)) {
          allPOIs.push({
            name: place.name,
            type,
            distance: this.calculateDistance(
              lat, lng,
              place.geometry.location.lat,
              place.geometry.location.lng
            ),
          });
        }
      }
      
      // Rate limit between types
      await this.sleep(100);
    }
    
    // Cache combined response
    await db.query(`
      INSERT INTO poi_cache (location_hash, lat, lng, radius_meters, response)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (location_hash) DO UPDATE SET response = $5, created_at = now()
    `, [locationHash, lat, lng, radius, JSON.stringify(allPOIs)]);
    
    return allPOIs;
  }
  
  private parsePOIResponse(cached: any, lat: number, lng: number): POIResult[] {
    if (Array.isArray(cached)) return cached;
    return [];
  }
  
  private async getCache(table: string, hash: string): Promise<any | null> {
    const column = table === 'poi_cache' ? 'response' : 'response';
    const result = await db.query(
      `SELECT ${column} FROM ${table} WHERE ${table === 'poi_cache' ? 'location_hash' : 'query_hash'} = $1`,
      [hash]
    );
    return result.rows[0]?.response || null;
  }
  
  private async setCache(table: string, hash: string, query: string, response: any): Promise<void> {
    await db.query(`
      INSERT INTO geo_cache (query_hash, query_text, response)
      VALUES ($1, $2, $3)
      ON CONFLICT (query_hash) DO UPDATE SET response = $3, created_at = now()
    `, [hash, query, JSON.stringify(response)]);
  }
  
  private hashQuery(query: string): string {
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }
  
  private hashLocation(lat: number, lng: number, radius: number): string {
    // Round to 4 decimal places (~11m precision)
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }
  
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  }
  
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mapsClient = new GoogleMapsClient();
```

### Enrichment Job (`jobs/enrichJob.ts`)

```typescript
import cron from 'node-cron';
import { db } from '../db';
import { mapsClient } from '../integrations/googleMaps';
import { writeAudit } from '../audit';

interface EnrichStats {
  processed: number;
  geocoded: number;
  poiEnriched: number;
  skipped: number;
  errors: number;
}

export async function runEnrichment(limit = 50): Promise<EnrichStats> {
  const stats: EnrichStats = {
    processed: 0,
    geocoded: 0,
    poiEnriched: 0,
    skipped: 0,
    errors: 0,
  };
  
  // Get listings needing enrichment
  const listings = await db.query(`
    SELECT id, address_text, area, lat, lng
    FROM listings
    WHERE (lat IS NULL OR enriched_at IS NULL)
      AND (address_text IS NOT NULL OR area IS NOT NULL)
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  
  for (const listing of listings.rows) {
    try {
      // Skip if already has coordinates (user-provided)
      if (listing.lat && listing.lng) {
        // Just add POI context
        const pois = await mapsClient.getNearbyPOIs(listing.lat, listing.lng);
        
        await db.query(`
          UPDATE listings 
          SET poi_context = $1, enriched_at = now()
          WHERE id = $2
        `, [JSON.stringify(pois), listing.id]);
        
        stats.poiEnriched++;
      } else {
        // Geocode first
        const address = listing.address_text || listing.area;
        const geo = await mapsClient.geocode(address);
        
        if (!geo) {
          stats.skipped++;
          continue;
        }
        
        // Get POIs
        const pois = await mapsClient.getNearbyPOIs(geo.lat, geo.lng);
        
        // Update listing
        await db.query(`
          UPDATE listings SET
            lat = $1,
            lng = $2,
            neighborhood = COALESCE(neighborhood, $3),
            locality = COALESCE(locality, $4),
            location_confidence = $5,
            poi_context = $6,
            enriched_at = now()
          WHERE id = $7
        `, [
          geo.lat,
          geo.lng,
          geo.neighborhood,
          geo.locality,
          geo.confidence,
          JSON.stringify(pois),
          listing.id,
        ]);
        
        stats.geocoded++;
        stats.poiEnriched++;
      }
      
      stats.processed++;
      
      // Rate limit
      await sleep(200);
      
    } catch (error: any) {
      console.error(`Enrichment error for ${listing.id}:`, error);
      stats.errors++;
    }
  }
  
  await writeAudit({
    actorType: 'system',
    actorId: 'enrich-job',
    action: 'enrich.run',
    entity: 'listing',
    payload: stats,
  });
  
  return stats;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Schedule: run every 4 hours
export function scheduleEnrichment(): void {
  cron.schedule('0 */4 * * *', () => {
    runEnrichment(50).catch(console.error);
  });
}
```

### Routes (`routes/enrich.ts`)

```typescript
import { FastifyInstance } from 'fastify';
import { runEnrichment } from '../jobs/enrichJob';
import { db } from '../db';
import { requireRole } from '../middleware/rbac';

export async function enrichRoutes(fastify: FastifyInstance) {
  // Manual enrichment run
  fastify.post('/api/enrich/run', {
    preHandler: requireRole(['admin']),
  }, async (request) => {
    const { limit = 50 } = request.body as { limit?: number };
    const stats = await runEnrichment(limit);
    return { success: true, stats };
  });
  
  // Enrichment stats
  fastify.get('/api/enrich/stats', {
    preHandler: requireRole(['admin']),
  }, async () => {
    const enriched = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE lat IS NOT NULL) as geocoded,
        COUNT(*) FILTER (WHERE poi_context IS NOT NULL) as with_pois,
        COUNT(*) FILTER (WHERE location_confidence >= 80) as high_confidence,
        COUNT(*) as total
      FROM listings
    `);
    
    const cacheStats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM geo_cache) as geo_cache_size,
        (SELECT COUNT(*) FROM poi_cache) as poi_cache_size
    `);
    
    return {
      listings: enriched.rows[0],
      cache: cacheStats.rows[0],
    };
  });
  
  // Clear old cache entries
  fastify.post('/api/enrich/cache/clear', {
    preHandler: requireRole(['admin']),
  }, async () => {
    const geo = await db.query(`
      DELETE FROM geo_cache WHERE created_at < now() - interval '30 days'
      RETURNING query_hash
    `);
    
    const poi = await db.query(`
      DELETE FROM poi_cache WHERE created_at < now() - interval '30 days'
      RETURNING location_hash
    `);
    
    return {
      cleared: {
        geo: geo.rowCount,
        poi: poi.rowCount,
      },
    };
  });
}
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

> **Note**: No Google Maps API key needed. Gemini grounded search handles geocoding and POI discovery.

---

## Tests

```typescript
describe('Maps Enrichment', () => {
  describe('Geocoding', () => {
    it('geocodes Malta addresses correctly', async () => {});
    it('uses cache for repeated queries', async () => {});
    it('computes confidence from location_type', async () => {});
  });
  
  describe('POI', () => {
    it('finds nearby schools and transit', async () => {});
    it('caches POI results', async () => {});
    it('calculates distances correctly', async () => {});
  });
  
  describe('Enrichment job', () => {
    it('does not override user-provided coordinates', async () => {});
    it('fills neighborhood and locality', async () => {});
    it('writes audit log', async () => {});
  });
});
```

---

## Acceptance Criteria

- [ ] Listings with address/area get geocoded
- [ ] User-provided coordinates are never overwritten
- [ ] Cache hits reduce API calls
- [ ] POI context includes schools, transit, supermarkets
- [ ] Location confidence score set correctly
- [ ] Cache cleared after 30 days
- [ ] Audit trail for enrichment runs

---

## Rollback

```bash
# Remove enrichment data
UPDATE listings SET 
  lat = NULL, 
  lng = NULL, 
  neighborhood = NULL,
  locality = NULL,
  location_confidence = NULL,
  poi_context = NULL,
  enriched_at = NULL
WHERE source_type = 'linkout';

# Clear caches
TRUNCATE geo_cache;
TRUNCATE poi_cache;
```
