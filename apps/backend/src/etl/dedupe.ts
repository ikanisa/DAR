/**
 * Deduplication Logic
 * Checks for duplicate listings by URL, content hash, and fuzzy matching
 */

import { query } from '../db.js';
import { logger } from '../observability/logger.js';

export interface DedupeResult {
    isDuplicate: boolean;
    existingId?: string;
    reason?: 'source_url' | 'content_hash' | 'fuzzy_match';
}

/**
 * Check if a listing is a duplicate
 */
export async function checkDuplicate(
    sourceUrl: string,
    contentHash: string,
    area: string | null,
    priceAmount: number | null,
    bedrooms: number | null
): Promise<DedupeResult> {
    // 1. Check exact source URL match
    const urlResult = await query<{ id: string }>(
        'SELECT id FROM listings WHERE source_url = $1 OR external_link = $1 LIMIT 1',
        [sourceUrl]
    );

    if (urlResult.rows.length > 0) {
        logger.debug({ sourceUrl, existingId: urlResult.rows[0].id }, 'Duplicate found by URL');
        return {
            isDuplicate: true,
            existingId: urlResult.rows[0].id,
            reason: 'source_url',
        };
    }

    // 2. Check content hash match
    const hashResult = await query<{ id: string }>(
        'SELECT id FROM listings WHERE content_hash = $1 LIMIT 1',
        [contentHash]
    );

    if (hashResult.rows.length > 0) {
        logger.debug({ contentHash, existingId: hashResult.rows[0].id }, 'Duplicate found by content hash');
        return {
            isDuplicate: true,
            existingId: hashResult.rows[0].id,
            reason: 'content_hash',
        };
    }

    // 3. Check fuzzy match (same area + price band + bedrooms)
    if (area && priceAmount && bedrooms !== null) {
        const fuzzyResult = await checkFuzzyDuplicate(area, priceAmount, bedrooms);
        if (fuzzyResult.isDuplicate) {
            return fuzzyResult;
        }
    }

    return { isDuplicate: false };
}

/**
 * Check for fuzzy duplicates based on property characteristics
 */
async function checkFuzzyDuplicate(
    area: string,
    priceAmount: number,
    bedrooms: number
): Promise<DedupeResult> {
    // Price band: within €5,000 below and €15,000 above
    const priceBand = Math.floor(priceAmount / 10000) * 10000;
    const priceMin = priceBand - 5000;
    const priceMax = priceBand + 15000;

    const fuzzyResult = await query<{ id: string }>(`
        SELECT id FROM listings
        WHERE LOWER(area) = LOWER($1)
          AND bedrooms = $2
          AND price_amount BETWEEN $3 AND $4
          AND source_type != 'native'
        LIMIT 1
    `, [area, bedrooms, priceMin, priceMax]);

    if (fuzzyResult.rows.length > 0) {
        logger.debug(
            { area, bedrooms, priceAmount, existingId: fuzzyResult.rows[0].id },
            'Duplicate found by fuzzy match'
        );
        return {
            isDuplicate: true,
            existingId: fuzzyResult.rows[0].id,
            reason: 'fuzzy_match',
        };
    }

    return { isDuplicate: false };
}

/**
 * Update last_checked_at for existing listing
 */
export async function updateLastChecked(listingId: string): Promise<void> {
    await query(
        'UPDATE listings SET last_checked_at = now() WHERE id = $1',
        [listingId]
    );
}

/**
 * Compute similarity score between two listings (0-1)
 * Used for more sophisticated deduplication if needed
 */
export function computeSimilarity(
    listing1: { title: string; price: number | null; bedrooms: number | null; area: string | null },
    listing2: { title: string; price: number | null; bedrooms: number | null; area: string | null }
): number {
    let score = 0;
    let maxScore = 0;

    // Title similarity (basic word overlap)
    maxScore += 3;
    const words1 = new Set(listing1.title.toLowerCase().split(/\s+/));
    const words2 = new Set(listing2.title.toLowerCase().split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    if (union > 0) {
        score += 3 * (intersection / union);
    }

    // Price similarity
    maxScore += 2;
    if (listing1.price !== null && listing2.price !== null) {
        const priceDiff = Math.abs(listing1.price - listing2.price);
        const priceAvg = (listing1.price + listing2.price) / 2;
        if (priceAvg > 0) {
            const priceRatio = 1 - Math.min(1, priceDiff / priceAvg);
            score += 2 * priceRatio;
        }
    }

    // Bedrooms match
    maxScore += 2;
    if (listing1.bedrooms !== null && listing2.bedrooms !== null) {
        if (listing1.bedrooms === listing2.bedrooms) {
            score += 2;
        }
    }

    // Area match
    maxScore += 3;
    if (listing1.area && listing2.area) {
        if (listing1.area.toLowerCase() === listing2.area.toLowerCase()) {
            score += 3;
        }
    }

    return maxScore > 0 ? score / maxScore : 0;
}
