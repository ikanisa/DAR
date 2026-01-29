/**
 * Discovery Job
 * Scheduled job that discovers Malta property listing URLs via AI search
 */

import cron from 'node-cron';
import { createSearchProvider, SearchResult } from '../integrations/aiSearch.js';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';
import searchQueries from '../config/searchQueries.json' with { type: 'json' };

export interface DiscoveryStats {
    queriesRun: number;
    urlsDiscovered: number;
    urlsEnqueued: number;
    urlsBlocked: number;
    urlsDuplicate: number;
    errors: number;
}

export interface DomainPolicy {
    domain: string;
    allowed_to_fetch: boolean;
    allowed_to_republish: boolean;
    fields_allowed: string[];
    notes: string | null;
}

/**
 * Run the discovery job
 * @param mode - 'daily' for scheduled runs, 'manual' for admin-triggered
 */
export async function runDiscovery(mode: 'daily' | 'manual' = 'daily'): Promise<DiscoveryStats> {
    const provider = createSearchProvider();
    const stats: DiscoveryStats = {
        queriesRun: 0,
        urlsDiscovered: 0,
        urlsEnqueued: 0,
        urlsBlocked: 0,
        urlsDuplicate: 0,
        errors: 0,
    };

    logger.info({ mode, provider: provider.getName() }, 'Starting discovery run');

    // Select queries for today using rotation
    const dailyQueries = getDailyQueries();
    logger.info({ queryCount: dailyQueries.length }, 'Selected daily queries');

    for (const searchQuery of dailyQueries) {
        try {
            const results = await provider.search(searchQuery);
            stats.queriesRun++;
            stats.urlsDiscovered += results.length;

            logger.info({ query: searchQuery, results: results.length }, 'Query completed');

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const domain = extractDomain(result.link);

                if (!domain) {
                    logger.warn({ url: result.link }, 'Could not extract domain from URL');
                    continue;
                }

                // Check domain policy
                const policy = await getDomainPolicy(domain);

                if (!policy || !policy.allowed_to_fetch) {
                    stats.urlsBlocked++;
                    logger.debug({ domain, url: result.link }, 'URL blocked by domain policy');
                    continue;
                }

                // Try to enqueue
                const enqueued = await enqueueUrl({
                    url: result.link,
                    domain,
                    query: searchQuery,
                    rank: i + 1,
                    snippet: result.snippet,
                });

                if (enqueued) {
                    stats.urlsEnqueued++;
                    logger.debug({ url: result.link }, 'URL enqueued');
                } else {
                    stats.urlsDuplicate++;
                }
            }

            // Rate limiting between queries (1 second)
            await sleep(1000);

        } catch (error) {
            stats.errors++;
            logger.error({ error, query: searchQuery }, 'Discovery error for query');
        }
    }

    // Write audit log
    await audit({
        actorType: 'system',
        actorId: 'discovery-job',
        action: AuditActions.DISCOVERY_RUN,
        entity: 'url_queue',
        payload: { mode, stats, provider: provider.getName() },
    });

    logger.info({ mode, stats }, 'Discovery run completed');

    return stats;
}

/**
 * Get queries for today based on rotation schedule
 */
function getDailyQueries(): string[] {
    const today = new Date();
    const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );

    const { queries, queriesPerDay, rotationDays } = searchQueries;
    const rotationIndex = Math.floor(dayOfYear / rotationDays) % Math.ceil(queries.length / queriesPerDay);
    const startIndex = (rotationIndex * queriesPerDay) % queries.length;

    // Get queriesPerDay queries starting from startIndex, wrapping around
    const selectedQueries: string[] = [];
    for (let i = 0; i < queriesPerDay && i < queries.length; i++) {
        selectedQueries.push(queries[(startIndex + i) % queries.length]);
    }

    return selectedQueries;
}

/**
 * Get domain policy from database
 */
async function getDomainPolicy(domain: string): Promise<DomainPolicy | null> {
    // Try exact match first
    let result = await query<DomainPolicy>(
        'SELECT * FROM domain_policy WHERE domain = $1',
        [domain]
    );

    if (result.rows[0]) {
        return result.rows[0];
    }

    // Try without www prefix
    const normalizedDomain = domain.replace(/^www\./, '');
    result = await query<DomainPolicy>(
        'SELECT * FROM domain_policy WHERE domain = $1',
        [normalizedDomain]
    );

    return result.rows[0] || null;
}

/**
 * Enqueue a discovered URL
 * Returns true if enqueued, false if duplicate
 */
async function enqueueUrl(data: {
    url: string;
    domain: string;
    query: string;
    rank: number;
    snippet: string;
}): Promise<boolean> {
    try {
        await query(`
            INSERT INTO url_queue (url, domain, query_used, result_rank, snippet)
            VALUES ($1, $2, $3, $4, $5)
        `, [data.url, data.domain, data.query, data.rank, data.snippet]);
        return true;
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
            // Unique constraint violation - duplicate URL
            return false;
        }
        throw error;
    }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Schedule daily discovery job
 * Runs at 6 AM Malta time (CET/CEST)
 */
export function scheduleDiscovery(): void {
    // Schedule for 6 AM Malta time
    cron.schedule('0 6 * * *', async () => {
        logger.info('Scheduled discovery job starting');
        try {
            await runDiscovery('daily');
        } catch (error) {
            logger.error({ error }, 'Scheduled discovery job failed');
        }
    }, {
        timezone: 'Europe/Malta',
    });

    logger.info('Discovery job scheduled for 6 AM Malta time');
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
    byStatus: Array<{ status: string; count: number }>;
    byDomain: Array<{ domain: string; count: number }>;
    recent: Array<{ url: string; domain: string; status: string; discovered_at: string }>;
}> {
    const statusResult = await query<{ status: string; count: string }>(`
        SELECT status, COUNT(*)::text as count
        FROM url_queue
        GROUP BY status
    `);

    const domainResult = await query<{ domain: string; count: string }>(`
        SELECT domain, COUNT(*)::text as count
        FROM url_queue
        GROUP BY domain
        ORDER BY COUNT(*) DESC
        LIMIT 10
    `);

    const recentResult = await query<{ url: string; domain: string; status: string; discovered_at: string }>(`
        SELECT url, domain, status, discovered_at::text
        FROM url_queue
        ORDER BY discovered_at DESC
        LIMIT 20
    `);

    return {
        byStatus: statusResult.rows.map(r => ({ status: r.status, count: parseInt(r.count, 10) })),
        byDomain: domainResult.rows.map(r => ({ domain: r.domain, count: parseInt(r.count, 10) })),
        recent: recentResult.rows,
    };
}
