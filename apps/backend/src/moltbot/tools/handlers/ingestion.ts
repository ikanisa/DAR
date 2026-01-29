/**
 * Ingestion Tool Handlers
 *
 * Backend handlers for Moltbot property ingestion actions.
 * These tools enable autonomous property discovery and ingestion.
 */

import { query as dbQuery } from '../../../db.js';
import { logger } from '../../../observability/logger.js';
import type { ToolResult } from './common.js';

// ============================================================================
// Types for Ingestion
// ============================================================================

export interface IngestionParams {
    query?: string;
    source?: string;
    location?: string;
    property_type?: string;
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
    limit?: number;
    listings?: PropertyListing[];
    url?: string;
    job_id?: string;
    message?: string;
}

export interface PropertyListing {
    title: string;
    link: string;
    summary?: string;
    image_url?: string;
    price?: number;
    currency?: string;
    location?: string;
    type?: string;
    bedrooms?: number;
    bathrooms?: number;
    size_sqm?: number;
    source?: string;
    source_url?: string;
}

// System poster ID for external listings
const SYSTEM_POSTER_ID = '33333333-3333-3333-3333-333333333333';

// ============================================================================
// Tool: Discover Properties
// ============================================================================

/**
 * Discover properties from external sources using AI web search.
 * Moltbot calls this to find new listings.
 */
export async function handleDiscoverProperties(
    params: IngestionParams
): Promise<ToolResult> {
    const { query, source, location, property_type, min_price, max_price, bedrooms, limit = 10 } = params;

    // Build search query from parameters
    const searchParts: string[] = ['Malta property'];
    if (location) searchParts.push(location);
    if (property_type) searchParts.push(property_type);
    if (bedrooms) searchParts.push(`${bedrooms} bedroom`);
    if (min_price && max_price) searchParts.push(`€${min_price}-€${max_price}`);
    else if (min_price) searchParts.push(`from €${min_price}`);
    else if (max_price) searchParts.push(`up to €${max_price}`);
    if (source) searchParts.push(`site:${source}`);

    const searchQuery = query || searchParts.join(' ');

    try {
        // Call the AI router for web search
        const aiRouterUrl = process.env.SUPABASE_URL
            ? `${process.env.SUPABASE_URL}/functions/v1/ai-router`
            : 'https://yxtpdgxaqoqsozhkysty.supabase.co/functions/v1/ai-router';

        const response = await fetch(aiRouterUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY}`,
                'apikey': process.env.SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
                provider: 'gemini',
                input: `Search for: ${searchQuery}

You are a real estate data extractor. Find property listings and return them in JSON format.
For each property found, extract:
- title: property title
- link: URL to the listing
- price: numeric price (no currency symbol)
- currency: EUR or USD
- location: area/town in Malta
- bedrooms: number
- bathrooms: number
- size_sqm: size in square meters
- source: agency name
- source_url: agency website
- image_url: main property image URL

Return ONLY valid JSON array of listings. Example:
[{"title": "2 Bed Apartment Sliema", "link": "https://...", "price": 1500, ...}]`,
                use_web_search: true,
                max_tokens: 4096,
                temperature: 0.2,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI router failed: ${errorText}`);
        }

        const aiResult = await response.json() as { text?: string; sources?: Array<{ title?: string; url?: string }> };

        // Parse listings from AI response
        const listings = parseListingsFromAI(aiResult.text || '');
        const sources = aiResult.sources || [];

        logger.info({ query: searchQuery, foundCount: listings.length }, 'Property discovery completed');

        return {
            success: true,
            data: {
                query: searchQuery,
                listings,
                sources,
                count: listings.length,
            },
            message: `Discovered ${listings.length} properties`,
        };
    } catch (err) {
        logger.error({ err, query: searchQuery }, 'Property discovery failed');
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Discovery failed',
        };
    }
}

/**
 * Parse listings from AI response text
 */
function parseListingsFromAI(text: string): PropertyListing[] {
    try {
        // Find JSON array in text
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
            return [];
        }

        // Validate and clean listings
        return parsed.filter((item: Record<string, unknown>) => {
            return item.title && item.link && typeof item.link === 'string';
        }).map((item: Record<string, unknown>) => ({
            title: String(item.title),
            link: String(item.link),
            summary: item.summary ? String(item.summary) : undefined,
            image_url: item.image_url ? String(item.image_url) : undefined,
            price: typeof item.price === 'number' ? item.price : undefined,
            currency: item.currency ? String(item.currency) : 'EUR',
            location: item.location ? String(item.location) : undefined,
            type: item.type ? String(item.type) : undefined,
            bedrooms: typeof item.bedrooms === 'number' ? item.bedrooms : undefined,
            bathrooms: typeof item.bathrooms === 'number' ? item.bathrooms : undefined,
            size_sqm: typeof item.size_sqm === 'number' ? item.size_sqm : undefined,
            source: item.source ? String(item.source) : undefined,
            source_url: item.source_url ? String(item.source_url) : undefined,
        }));
    } catch {
        logger.warn({ text: text.substring(0, 500) }, 'Failed to parse listings from AI response');
        return [];
    }
}

// ============================================================================
// Tool: Ingest Listings
// ============================================================================

/**
 * Ingest discovered listings into the database.
 * Moltbot calls this after discovery to save listings.
 */
export async function handleIngestListings(
    params: IngestionParams
): Promise<ToolResult> {
    const { listings } = params;

    if (!listings || !Array.isArray(listings) || listings.length === 0) {
        return {
            success: false,
            error: 'No listings provided',
        };
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const listing of listings) {
        try {
            // Map property type to enum
            const propertyType = mapPropertyType(listing.type);

            // Check if listing exists
            const existing = await dbQuery(
                `SELECT id FROM public.listings WHERE external_link = $1`,
                [listing.link]
            );

            if (existing.rows.length > 0) {
                // Update existing
                await dbQuery(
                    `UPDATE public.listings SET
                        title = $2,
                        description = $3,
                        price_amount = $4,
                        price_currency = $5,
                        address_text = $6,
                        bedrooms = $7,
                        bathrooms = $8,
                        size_sqm = $9,
                        source = $10,
                        source_url = $11,
                        image_url = $12,
                        updated_at = now()
                    WHERE id = $1`,
                    [
                        existing.rows[0].id,
                        listing.title,
                        listing.summary || null,
                        listing.price || null,
                        listing.currency || 'EUR',
                        listing.location || null,
                        listing.bedrooms || null,
                        listing.bathrooms || null,
                        listing.size_sqm || null,
                        listing.source || null,
                        listing.source_url || null,
                        listing.image_url || null,
                    ]
                );
                updated++;
            } else {
                // Insert new
                await dbQuery(
                    `INSERT INTO public.listings (
                        poster_id, title, description, type, price_amount, price_currency,
                        address_text, bedrooms, bathrooms, size_sqm,
                        source, source_url, external_link, image_url, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'published')`,
                    [
                        SYSTEM_POSTER_ID,
                        listing.title,
                        listing.summary || null,
                        propertyType,
                        listing.price || null,
                        listing.currency || 'EUR',
                        listing.location || null,
                        listing.bedrooms || null,
                        listing.bathrooms || null,
                        listing.size_sqm || null,
                        listing.source || null,
                        listing.source_url || null,
                        listing.link,
                        listing.image_url || null,
                    ]
                );
                inserted++;
            }
        } catch (err) {
            logger.error({ err, listing: listing.link }, 'Failed to ingest listing');
            failed++;
        }
    }

    logger.info({ inserted, updated, failed, total: listings.length }, 'Listings ingestion completed');

    return {
        success: failed === 0,
        data: { inserted, updated, failed, total: listings.length },
        message: `Ingested ${inserted} new, updated ${updated} existing, ${failed} failed`,
    };
}

/**
 * Map string property type to enum value
 */
function mapPropertyType(type?: string): string {
    if (!type) return 'apartment';

    const normalized = type.toLowerCase();

    if (normalized.includes('house') || normalized.includes('villa') || normalized.includes('maisonette')) {
        return 'house';
    }
    if (normalized.includes('land') || normalized.includes('plot')) {
        return 'land';
    }
    if (normalized.includes('commercial') || normalized.includes('office') || normalized.includes('shop')) {
        return 'commercial';
    }
    return 'apartment';
}

// ============================================================================
// Tool: Get Feed Sources
// ============================================================================

/**
 * Get list of property feed sources (agencies, portals).
 * Moltbot can use this to know where to search.
 */
export async function handleGetFeedSources(): Promise<ToolResult> {
    try {
        const result = await dbQuery(
            `SELECT name, domain, category, is_active
             FROM public.property_feed_sources
             WHERE is_active = true
             ORDER BY priority DESC, name ASC`
        );

        return {
            success: true,
            data: {
                sources: result.rows,
                count: result.rows.length,
            },
            message: `Found ${result.rows.length} active feed sources`,
        };
    } catch (err) {
        logger.error({ err }, 'Failed to get feed sources');
        return {
            success: false,
            error: 'Failed to load feed sources',
        };
    }
}

// ============================================================================
// Tool: Get Pending Jobs
// ============================================================================

/**
 * Get pending ingestion jobs from the queue.
 * Moltbot uses this to find work to do.
 */
export async function handleGetPendingJobs(): Promise<ToolResult> {
    try {
        const result = await dbQuery(
            `SELECT id, query, sources, location, property_type, created_at
             FROM public.moltbot_jobs
             WHERE status = 'pending'
             ORDER BY created_at ASC
             LIMIT 10`
        );

        return {
            success: true,
            data: {
                jobs: result.rows,
                count: result.rows.length,
            },
            message: `Found ${result.rows.length} pending jobs`,
        };
    } catch (err) {
        logger.error({ err }, 'Failed to get pending jobs');
        return {
            success: false,
            error: 'Failed to load pending jobs',
        };
    }
}

// ============================================================================
// Tool: Complete Job
// ============================================================================

/**
 * Mark a job as completed.
 */
export async function handleCompleteJob(
    params: IngestionParams
): Promise<ToolResult> {
    const { job_id } = params;

    if (!job_id) {
        return { success: false, error: 'Job ID required' };
    }

    try {
        await dbQuery(
            `UPDATE public.moltbot_jobs
             SET status = 'completed', completed_at = now()
             WHERE id = $1`,
            [job_id]
        );

        return {
            success: true,
            data: { job_id },
            message: 'Job marked as completed',
        };
    } catch (err) {
        logger.error({ err, job_id }, 'Failed to complete job');
        return { success: false, error: 'Failed to complete job' };
    }
}

// ============================================================================
// Tool: Get Listing Stats
// ============================================================================

/**
 * Get current listing statistics.
 * Moltbot can use this to report status.
 */
export async function handleGetListingStats(): Promise<ToolResult> {
    try {
        const result = await dbQuery(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
                COUNT(CASE WHEN source IS NOT NULL THEN 1 END) as from_external,
                COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_images,
                COUNT(CASE WHEN created_at > now() - interval '24 hours' THEN 1 END) as added_24h,
                COUNT(CASE WHEN updated_at > now() - interval '24 hours' THEN 1 END) as updated_24h
             FROM public.listings`
        );

        const stats = result.rows[0] || {};

        return {
            success: true,
            data: stats,
            message: `Total: ${stats.total}, Published: ${stats.published}, External: ${stats.from_external}`,
        };
    } catch (err) {
        logger.error({ err }, 'Failed to get listing stats');
        return { success: false, error: 'Failed to get stats' };
    }
}
