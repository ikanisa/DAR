#!/usr/bin/env node
/**
 * Malta Property Ingestion Script
 * 
 * Uses AI-powered web search to discover Malta property listings
 * and inserts them directly into the Supabase `listings` table.
 * 
 * Usage:
 *   node scripts/ingest-malta-properties.mjs
 *   node scripts/ingest-malta-properties.mjs --dry-run
 *   node scripts/ingest-malta-properties.mjs --query "Sliema 2 bed apartment"
 * 
 * Environment:
 *   SUPABASE_URL or DAR_SUPABASE_URL
 *   SUPABASE_SERVICE_KEY or DAR_SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const loadDotEnv = async () => {
    const candidates = [
        path.join(process.cwd(), '.env'),
        path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env'),
        path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'apps', 'web', '.env')
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
        } catch {
            continue;
        }
    }
};

await loadDotEnv();

// Parse arguments
const parseArgs = (args) => {
    const parsed = { _: [] };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
            parsed[key] = value;
            if (value !== true) i++;
        } else {
            parsed._.push(arg);
        }
    }
    return parsed;
};

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = args['dry-run'] || false;
const CUSTOM_QUERY = args.query || null;

// Config
const SUPABASE_URL = process.env.DAR_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.DAR_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.log('Set environment variables or create .env file');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Search queries to run
const SEARCH_QUERIES = CUSTOM_QUERY ? [CUSTOM_QUERY] : [
    "Malta apartment for rent Sliema 2 bedroom",
    "Malta apartment for rent Valletta 1 bedroom",
    "Malta apartment for rent St Julians 3 bedroom",
    "Malta penthouse for rent sea view",
    "Malta house for rent Mellieha",
    "Malta apartment for rent Gzira modern",
    "Gozo apartment for rent Victoria",
    "Malta studio flat for rent",
    "Malta apartment for rent Msida",
    "Malta property for rent Mosta"
];

// AI Search prompt
const SYSTEM_PROMPT = `You are a Malta property listing researcher.
Search the web for REAL property listings. Return ONLY valid JSON (no markdown).

Output format:
{
  "listings": [
    {
      "title": "3 Bed Apartment Sea View Sliema",
      "link": "https://agency.com/listing/12345",
      "summary": "Description...",
      "image_url": "https://...",
      "price": 1800,
      "currency": "EUR",
      "location": "Sliema",
      "type": "apartment",
      "bedrooms": 3,
      "bathrooms": 2,
      "size_sqm": 120,
      "source": "RE/MAX Malta",
      "source_url": "https://remax-malta.com"
    }
  ]
}

Rules:
- Only include REAL listings with actual URLs (not homepages)
- "type" must be: apartment, house, penthouse, villa, maisonette, studio, or commercial
- Use null for unknown fields
- Include image_url if available
- Include the agency/source name`;

async function searchListings(query) {
    console.log(`\n🔍 Searching: "${query}"`);

    const userPrompt = `Find 10+ Malta property listings for: "${query}". Focus on major agencies like RE/MAX Malta, Frank Salt, Dhalia, Perry, QuickLets. Return actual listing URLs.`;

    try {
        // Call the ai-router edge function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-router`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                provider: 'gemini',  // Gemini has grounding/web search
                use_web_search: true,
                temperature: 0.2,
                max_tokens: 4096,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error(`   ❌ AI search failed: ${error.error || response.statusText}`);
            return [];
        }

        const data = await response.json();
        const text = data?.text || '';

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*"listings"[\s\S]*\}/);
        if (!jsonMatch) {
            console.log('   ⚠️ No listings JSON found in response');
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const listings = parsed.listings || [];
        console.log(`   ✓ Found ${listings.length} listings`);
        return listings;

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return [];
    }
}

function transformListing(raw) {
    return {
        title: raw.title || 'Property Listing',
        description: raw.summary || raw.description || null,
        type: normalizeType(raw.type),
        price_amount: parseNumber(raw.price),
        price_currency: raw.currency || 'EUR',
        bedrooms: parseNumber(raw.bedrooms),
        bathrooms: parseNumber(raw.bathrooms),
        size_sqm: parseNumber(raw.size_sqm || raw.interior_area),
        address_text: raw.location || raw.address || null,
        status: 'published',
        source: raw.source || 'Moltbot AI Search',
        source_url: raw.source_url || null,
        external_link: raw.link,
        image_url: raw.image_url || null,
        images: raw.images || null
    };
}

function normalizeType(type) {
    if (!type) return 'other';
    const t = type.toLowerCase();
    if (t.includes('apartment') || t.includes('flat')) return 'apartment';
    if (t.includes('penthouse')) return 'penthouse';
    if (t.includes('maisonette')) return 'maisonette';
    if (t.includes('villa')) return 'villa';
    if (t.includes('house') || t.includes('terraced')) return 'house';
    if (t.includes('studio')) return 'studio';
    if (t.includes('commercial') || t.includes('office')) return 'commercial';
    return 'other';
}

function parseNumber(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

async function upsertListing(listing) {
    if (!listing.external_link) {
        return { success: false, reason: 'missing_link' };
    }

    // Check if exists
    const { data: existing } = await supabase
        .from('listings')
        .select('id')
        .eq('external_link', listing.external_link)
        .single();

    if (existing) {
        // Update
        const { error } = await supabase
            .from('listings')
            .update({
                ...listing,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

        if (error) return { success: false, reason: error.message };
        return { success: true, action: 'updated', id: existing.id };
    }

    // Insert
    const { data, error } = await supabase
        .from('listings')
        .insert(listing)
        .select('id')
        .single();

    if (error) return { success: false, reason: error.message };
    return { success: true, action: 'inserted', id: data.id };
}

async function main() {
    console.log('🏠 Malta Property Ingestion');
    console.log('═'.repeat(50));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
    console.log(`Queries to run: ${SEARCH_QUERIES.length}`);
    console.log('');

    let totalFound = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const query of SEARCH_QUERIES) {
        const rawListings = await searchListings(query);
        totalFound += rawListings.length;

        for (const raw of rawListings) {
            const transformed = transformListing(raw);

            if (DRY_RUN) {
                console.log(`   📋 Would save: ${transformed.title.slice(0, 50)}...`);
                continue;
            }

            const result = await upsertListing(transformed);

            if (result.success) {
                if (result.action === 'inserted') {
                    totalInserted++;
                    process.stdout.write('✓');
                } else {
                    totalUpdated++;
                    process.stdout.write('•');
                }
            } else {
                totalFailed++;
                process.stdout.write('✗');
            }
        }

        console.log(''); // Newline after progress

        // Rate limiting
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Found: ${totalFound}`);
    console.log(`   Inserted: ${totalInserted}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log('═'.repeat(50));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
