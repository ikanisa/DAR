/**
 * ETL Job
 * Scheduled job that processes URL queue, extracts listings, and creates link-out entries
 */

import cron from 'node-cron';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';
import {
    fetchPage,
    extractSchemaOrg,
    extractFallback,
    normalizeListing,
    checkDuplicate,
    updateLastChecked,
    parseAllowedFields,
    type ExtractedData,
} from '../etl/index.js';

export interface ETLStats {
    processed: number;
    created: number;
    updated: number;
    duplicates: number;
    errors: number;
    blocked: number;
    startedAt: string;
    completedAt?: string;
}

interface QueueRow {
    id: string;
    url: string;
    domain: string;
    allowed_to_republish: boolean;
    fields_allowed: unknown;
}

/**
 * Run the ETL job
 * @param limit - Maximum number of URLs to process (default 50)
 */
export async function runETL(limit = 50): Promise<ETLStats> {
    const stats: ETLStats = {
        processed: 0,
        created: 0,
        updated: 0,
        duplicates: 0,
        errors: 0,
        blocked: 0,
        startedAt: new Date().toISOString(),
    };

    logger.info({ limit }, 'Starting ETL run');

    // Get queued URLs with their domain policies
    const urlsResult = await query<QueueRow>(`
        SELECT q.id, q.url, q.domain, p.allowed_to_republish, p.fields_allowed
        FROM url_queue q
        JOIN domain_policy p ON q.domain = p.domain
        WHERE q.status = 'new'
          AND p.allowed_to_fetch = true
        ORDER BY q.discovered_at
        LIMIT $1
    `, [limit]);

    const urls = urlsResult.rows;
    logger.info({ count: urls.length }, 'URLs fetched from queue');

    for (const row of urls) {
        // Mark as processing
        await query(
            "UPDATE url_queue SET status = 'processing' WHERE id = $1",
            [row.id]
        );

        try {
            await processUrl(row, stats);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.error({ url: row.url, error: errMsg }, 'ETL processing failed');
            await markError(row.id, errMsg);
            stats.errors++;
        }

        stats.processed++;

        // Rate limit: 500ms between requests
        await sleep(500);
    }

    stats.completedAt = new Date().toISOString();

    // Write audit log
    await audit({
        actorType: 'system',
        actorId: 'etl-job',
        action: AuditActions.ETL_RUN,
        entity: 'url_queue',
        payload: stats as unknown as Record<string, unknown>,
    });

    logger.info({ stats }, 'ETL run completed');

    return stats;
}

/**
 * Process a single URL from the queue
 */
async function processUrl(row: QueueRow, stats: ETLStats): Promise<void> {
    const { url, domain, allowed_to_republish, fields_allowed } = row;

    // Fetch the page
    logger.debug({ url }, 'Fetching page');
    const fetchResult = await fetchPage(url);

    // Try Schema.org extraction first
    let extracted: ExtractedData | null = extractSchemaOrg(fetchResult.html, fetchResult.finalUrl);

    // Fall back to heuristic extraction
    if (!extracted) {
        extracted = extractFallback(fetchResult.html, fetchResult.finalUrl);
    }

    if (!extracted) {
        logger.warn({ url }, 'No listing data could be extracted');
        await markError(row.id, 'No structured data found');
        stats.errors++;
        return;
    }

    logger.debug(
        { url, method: extracted.extractionMethod, title: extracted.title },
        'Listing extracted'
    );

    // Parse allowed fields from domain policy
    const allowedFields = parseAllowedFields(fields_allowed);

    // Normalize the listing
    const sourceType = allowed_to_republish ? 'partner' : 'linkout';
    const normalized = normalizeListing(extracted, domain, allowedFields, sourceType);

    // Check for duplicates
    const dedupe = await checkDuplicate(
        normalized.external_link,
        normalized.content_hash,
        normalized.area,
        normalized.price_amount,
        normalized.bedrooms
    );

    if (dedupe.isDuplicate && dedupe.existingId) {
        logger.debug(
            { url, reason: dedupe.reason, existingId: dedupe.existingId },
            'Duplicate detected'
        );

        // Update last_checked_at on existing listing
        await updateLastChecked(dedupe.existingId);
        await markDone(row.id);
        stats.duplicates++;
        return;
    }

    // Insert the listing
    const insertResult = await query<{ id: string }>(`
        INSERT INTO listings (
            title, description, type, price_amount, price_currency,
            bedrooms, bathrooms, size_sqm, address_text, area,
            source_type, source_url, source_domain, content_hash,
            external_link, image_url,
            discovered_at, last_checked_at, status
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16,
            now(), now(), 'published'
        )
        RETURNING id
    `, [
        normalized.title,
        normalized.description,
        normalized.type,
        normalized.price_amount,
        normalized.price_currency,
        normalized.bedrooms,
        normalized.bathrooms,
        normalized.size_sqm,
        normalized.address_text,
        normalized.area,
        normalized.source_type,
        normalized.source_url,
        normalized.source_domain,
        normalized.content_hash,
        normalized.external_link,
        normalized.image_url,
    ]);

    const listingId = insertResult.rows[0]?.id;

    await markDone(row.id);
    stats.created++;

    await audit({
        actorType: 'system',
        actorId: 'etl-job',
        action: AuditActions.ETL_LISTING_CREATED,
        entity: 'listings',
        entityId: listingId,
        payload: {
            source_url: normalized.external_link,
            domain: normalized.source_domain,
            source_type: normalized.source_type,
            extraction_method: extracted.extractionMethod,
        },
    });

    logger.info(
        { listingId, url, domain, extractionMethod: extracted.extractionMethod },
        'Listing created from ETL'
    );
}

/**
 * Mark a URL as successfully processed
 */
async function markDone(id: string): Promise<void> {
    await query(
        "UPDATE url_queue SET status = 'done', processed_at = now() WHERE id = $1",
        [id]
    );
}

/**
 * Mark a URL as failed with error
 */
async function markError(id: string, error: string): Promise<void> {
    await query(`
        UPDATE url_queue 
        SET status = 'error', 
            last_error = $2, 
            retry_count = retry_count + 1 
        WHERE id = $1
    `, [id, error.slice(0, 500)]);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get ETL statistics
 */
export async function getETLStats(): Promise<{
    queue: { status: string; count: number }[];
    listings: { source_type: string; count: number }[];
    recentErrors: { url: string; error: string; at: string }[];
}> {
    const queueResult = await query<{ status: string; count: string }>(`
        SELECT status, COUNT(*)::text as count
        FROM url_queue
        GROUP BY status
    `);

    const listingsResult = await query<{ source_type: string; count: string }>(`
        SELECT COALESCE(source_type, 'native') as source_type, COUNT(*)::text as count
        FROM listings
        GROUP BY source_type
    `);

    const errorsResult = await query<{ url: string; error: string; at: string }>(`
        SELECT url, last_error as error, processed_at::text as at
        FROM url_queue
        WHERE status = 'error'
        ORDER BY processed_at DESC
        LIMIT 10
    `);

    return {
        queue: queueResult.rows.map(r => ({ status: r.status, count: parseInt(r.count, 10) })),
        listings: listingsResult.rows.map(r => ({ source_type: r.source_type, count: parseInt(r.count, 10) })),
        recentErrors: errorsResult.rows,
    };
}

/**
 * Retry failed URLs
 */
export async function retryErrors(limit = 20): Promise<number> {
    const result = await query<{ count: string }>(`
        UPDATE url_queue
        SET status = 'new'
        WHERE id IN (
            SELECT id FROM url_queue
            WHERE status = 'error'
              AND retry_count < 3
            ORDER BY processed_at
            LIMIT $1
        )
        RETURNING id
    `, [limit]);

    const count = result.rowCount || 0;
    logger.info({ count }, 'Queued error URLs for retry');

    return count;
}

/**
 * Schedule ETL job
 * Runs every 2 hours
 */
export function scheduleETL(): void {
    cron.schedule('0 */2 * * *', async () => {
        logger.info('Scheduled ETL job starting');
        try {
            await runETL(50);
        } catch (error) {
            logger.error({ error }, 'Scheduled ETL job failed');
        }
    }, {
        timezone: 'Europe/Malta',
    });

    logger.info('ETL job scheduled to run every 2 hours');
}
