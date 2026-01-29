/**
 * Enrichment Job
 * Scheduled job that geocodes listings and adds POI context
 */

import cron from 'node-cron';
import { query } from '../db.js';
import { geocodeClient, GeocodingResult, POIResult } from '../integrations/aiGeocode.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

export interface EnrichStats {
    processed: number;
    geocoded: number;
    poiEnriched: number;
    skipped: number;
    errors: number;
}

interface ListingToEnrich {
    id: string;
    location: string | null;
    title: string;
    lat: number | null;
    lng: number | null;
}

/**
 * Run the enrichment job
 * @param limit - Maximum listings to process in one run
 */
export async function runEnrichment(limit = 50): Promise<EnrichStats> {
    const stats: EnrichStats = {
        processed: 0,
        geocoded: 0,
        poiEnriched: 0,
        skipped: 0,
        errors: 0,
    };

    logger.info({ limit }, 'Starting enrichment run');

    // Get listings needing enrichment
    // Priority: missing lat/lng > missing enriched_at
    const listings = await query<ListingToEnrich>(`
        SELECT id, location, title, lat, lng
        FROM property_listings
        WHERE (lat IS NULL OR enriched_at IS NULL)
          AND (location IS NOT NULL OR title IS NOT NULL)
        ORDER BY 
            CASE WHEN lat IS NULL THEN 0 ELSE 1 END,
            created_at DESC
        LIMIT $1
    `, [limit]);

    logger.info({ count: listings.rows.length }, 'Found listings to enrich');

    for (const listing of listings.rows) {
        try {
            await enrichListing(listing, stats);
            stats.processed++;

            // Rate limit: 200ms between enrichments
            await sleep(200);

        } catch (err) {
            logger.error({ err, listingId: listing.id }, 'Enrichment error');
            stats.errors++;
        }
    }

    // Write audit log
    await audit({
        actorType: 'system',
        actorId: 'enrich-job',
        action: AuditActions.ENRICH_RUN,
        entity: 'property_listings',
        payload: { ...stats },
    });

    logger.info({ stats }, 'Enrichment run completed');

    return stats;
}

/**
 * Enrich a single listing
 */
async function enrichListing(listing: ListingToEnrich, stats: EnrichStats): Promise<void> {
    let lat = listing.lat;
    let lng = listing.lng;
    let geo: GeocodingResult | null = null;

    // If no coordinates, geocode first
    if (lat === null || lng === null) {
        const address = listing.location || extractAddressFromTitle(listing.title);

        if (!address) {
            logger.debug({ listingId: listing.id }, 'No address to geocode');
            stats.skipped++;
            return;
        }

        geo = await geocodeClient.geocode(address);

        if (!geo) {
            logger.debug({ listingId: listing.id, address }, 'Geocoding failed');
            stats.skipped++;
            return;
        }

        lat = geo.lat;
        lng = geo.lng;
        stats.geocoded++;
    }

    // Get POI context
    const pois = await geocodeClient.getNearbyPOIs(lat, lng);
    if (pois.length > 0) {
        stats.poiEnriched++;
    }

    // Update listing
    // IMPORTANT: Never overwrite user-provided coordinates (lat/lng)
    // Only fill if NULL, use COALESCE to preserve existing values
    await query(`
        UPDATE property_listings SET
            lat = COALESCE(lat, $1),
            lng = COALESCE(lng, $2),
            neighborhood = COALESCE(neighborhood, $3),
            locality = COALESCE(locality, $4),
            location_confidence = CASE 
                WHEN lat IS NULL THEN $5 
                ELSE location_confidence 
            END,
            poi_context = $6,
            enriched_at = now()
        WHERE id = $7
    `, [
        lat,
        lng,
        geo?.neighborhood || null,
        geo?.locality || null,
        geo?.confidence || null,
        pois.length > 0 ? JSON.stringify(groupPOIsByType(pois)) : null,
        listing.id,
    ]);

    logger.debug({
        listingId: listing.id,
        lat,
        lng,
        poiCount: pois.length,
    }, 'Listing enriched');
}

/**
 * Extract address-like text from title
 * Fallback when location field is empty
 */
function extractAddressFromTitle(title: string): string | null {
    if (!title) return null;

    // Common Malta localities to look for
    const localities = [
        'Valletta', 'Sliema', 'St Julian', "St. Julian's", 'Gzira', 'Msida',
        'Birkirkara', 'Qormi', 'Mosta', 'Naxxar', 'Attard', 'Balzan',
        'Lija', 'Iklin', 'San Gwann', 'Swieqi', 'Pembroke', 'Paceville',
        'Ta Xbiex', "Ta' Xbiex", 'Floriana', 'Hamrun', 'Marsa', 'Paola',
        'Tarxien', 'Santa Lucia', 'Fgura', 'Zabbar', 'Zejtun', 'Marsaskala',
        'Birzebbuga', 'Marsaxlokk', 'Gudja', 'Ghaxaq', 'Zurrieq', 'Qrendi',
        'Mqabba', 'Siggiewi', 'Zebbug', 'Rabat', 'Mdina', 'Dingli', 'Mgarr',
        'Mellieha', 'St Paul\'s Bay', "St. Paul's Bay", 'Bugibba', 'Qawra',
        'Xemxija', 'Gozo', 'Victoria', 'Xlendi', 'Marsalforn', 'Sannat',
    ];

    for (const loc of localities) {
        if (title.toLowerCase().includes(loc.toLowerCase())) {
            return loc + ', Malta';
        }
    }

    return null;
}

/**
 * Group POIs by type for structured storage
 */
function groupPOIsByType(pois: POIResult[]): Record<string, POIResult[]> {
    const grouped: Record<string, POIResult[]> = {};

    for (const poi of pois) {
        if (!grouped[poi.type]) {
            grouped[poi.type] = [];
        }
        grouped[poi.type].push(poi);
    }

    return grouped;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Schedule enrichment job
 * Runs every 4 hours
 */
export function scheduleEnrichment(): void {
    cron.schedule('0 */4 * * *', async () => {
        logger.info('Scheduled enrichment job starting');
        try {
            await runEnrichment(50);
        } catch (err) {
            logger.error({ err }, 'Scheduled enrichment job failed');
        }
    });

    logger.info('Enrichment job scheduled (every 4 hours)');
}

/**
 * Get enrichment statistics
 */
export async function getEnrichmentStats(): Promise<{
    listings: {
        total: number;
        geocoded: number;
        withPois: number;
        highConfidence: number;
    };
    cache: {
        geoSize: number;
        poiSize: number;
    };
}> {
    const listingStats = await query<{
        total: string;
        geocoded: string;
        with_pois: string;
        high_confidence: string;
    }>(`
        SELECT 
            COUNT(*)::text as total,
            COUNT(*) FILTER (WHERE lat IS NOT NULL)::text as geocoded,
            COUNT(*) FILTER (WHERE poi_context IS NOT NULL)::text as with_pois,
            COUNT(*) FILTER (WHERE location_confidence >= 80)::text as high_confidence
        FROM property_listings
    `);

    const cacheStats = await query<{ geo_size: string; poi_size: string }>(`
        SELECT 
            (SELECT COUNT(*) FROM geo_cache)::text as geo_size,
            (SELECT COUNT(*) FROM poi_cache)::text as poi_size
    `);

    const ls = listingStats.rows[0];
    const cs = cacheStats.rows[0];

    return {
        listings: {
            total: parseInt(ls.total, 10),
            geocoded: parseInt(ls.geocoded, 10),
            withPois: parseInt(ls.with_pois, 10),
            highConfidence: parseInt(ls.high_confidence, 10),
        },
        cache: {
            geoSize: parseInt(cs.geo_size, 10),
            poiSize: parseInt(cs.poi_size, 10),
        },
    };
}

/**
 * Clear old cache entries (30+ days)
 */
export async function clearOldCache(): Promise<{ geo: number; poi: number }> {
    const geoResult = await query<{ query_hash: string }>(`
        DELETE FROM geo_cache 
        WHERE created_at < now() - interval '30 days'
        RETURNING query_hash
    `);

    const poiResult = await query<{ location_hash: string }>(`
        DELETE FROM poi_cache 
        WHERE created_at < now() - interval '30 days'
        RETURNING location_hash
    `);

    return {
        geo: geoResult.rowCount || 0,
        poi: poiResult.rowCount || 0,
    };
}
