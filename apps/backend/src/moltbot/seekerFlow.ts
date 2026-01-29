/**
 * Seeker Search Flow
 * Orchestrates the seeker agent workflow for property search
 */

import { getMoltbotClient, type MoltbotResponse } from './MoltbotClient.js';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

const AGENT_ID = 'seeker-agent';

export interface SearchPreferences {
    propertyType?: 'apartment' | 'house';
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    locations?: string[];
    amenities?: string[];
}

export interface SearchResult {
    id: string;
    title: string;
    priceAmount: number;
    bedrooms: number | null;
    bathrooms: number | null;
    addressText: string | null;
    matchScore: number;
    matchReasons: string[];
}

/**
 * Start a new search flow
 */
export async function startSearchFlow(
    userId: string,
    sessionId: string,
    initialMessage: string
): Promise<MoltbotResponse> {
    const client = getMoltbotClient();

    const context = {
        flow: 'property_search',
        step: 'preferences',
        userId,
        preferences: {},
    };

    return client.sendMessage({
        agentId: AGENT_ID,
        sessionId,
        message: initialMessage,
        context,
    });
}

/**
 * Continue the search flow
 */
export async function continueSearchFlow(
    sessionId: string,
    message: string,
    context?: Record<string, unknown>
): Promise<MoltbotResponse> {
    const client = getMoltbotClient();

    return client.sendMessage({
        agentId: AGENT_ID,
        sessionId,
        message,
        context,
    });
}

/**
 * Execute a search based on preferences
 */
export async function executeSearch(
    userId: string,
    preferences: SearchPreferences
): Promise<SearchResult[]> {
    const conditions: string[] = [`status IN ('approved', 'published')`];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (preferences.propertyType) {
        conditions.push(`type = $${paramIndex++}`);
        params.push(preferences.propertyType);
    }

    if (preferences.minPrice !== undefined) {
        conditions.push(`price_amount >= $${paramIndex++}`);
        params.push(preferences.minPrice);
    }

    if (preferences.maxPrice !== undefined) {
        conditions.push(`price_amount <= $${paramIndex++}`);
        params.push(preferences.maxPrice);
    }

    if (preferences.bedrooms !== undefined) {
        conditions.push(`bedrooms >= $${paramIndex++}`);
        params.push(preferences.bedrooms);
    }

    if (preferences.locations && preferences.locations.length > 0) {
        const locationConditions = preferences.locations.map((loc, i) => {
            params.push(`%${loc}%`);
            return `address_text ILIKE $${paramIndex++}`;
        });
        conditions.push(`(${locationConditions.join(' OR ')})`);
    }

    const sql = `
    SELECT id, title, price_amount, bedrooms, bathrooms, address_text, quality_score
    FROM listings
    WHERE ${conditions.join(' AND ')}
    ORDER BY quality_score DESC, created_at DESC
    LIMIT 10
  `;

    const result = await query(sql, params);

    // Calculate match scores
    const results: SearchResult[] = result.rows.map(row => {
        const matchReasons: string[] = [];
        let score = 50; // Base score

        if (preferences.propertyType && row.type === preferences.propertyType) {
            score += 20;
            matchReasons.push('Property type matches');
        }

        if (preferences.bedrooms && row.bedrooms >= preferences.bedrooms) {
            score += 15;
            matchReasons.push(`${row.bedrooms} bedrooms`);
        }

        if (preferences.maxPrice && row.price_amount <= preferences.maxPrice * 0.9) {
            score += 10;
            matchReasons.push('Under budget');
        }

        if (preferences.locations?.some(loc =>
            row.address_text?.toLowerCase().includes(loc.toLowerCase())
        )) {
            score += 15;
            matchReasons.push('Preferred location');
        }

        return {
            id: row.id,
            title: row.title,
            priceAmount: parseFloat(row.price_amount),
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms,
            addressText: row.address_text,
            matchScore: Math.min(100, score),
            matchReasons,
        };
    });

    // Sort by match score
    results.sort((a, b) => b.matchScore - a.matchScore);

    // Create match rows for top 3 results
    const top3 = results.slice(0, 3);
    for (const listing of top3) {
        await createMatch(userId, listing.id, listing.matchScore, listing.matchReasons);
    }

    // Audit search
    await audit({
        actorType: 'user',
        actorId: userId,
        action: 'search.execute',
        entity: 'listings',
        payload: { preferences, resultCount: results.length, matchesCreated: top3.length },
    });

    logger.info({ userId, resultCount: results.length, matchesCreated: top3.length, preferences }, 'Search executed');

    return results;
}

/**
 * Create a match row to track seeker interest in a listing
 */
async function createMatch(
    seekerId: string,
    listingId: string,
    score: number,
    reasons: string[]
): Promise<void> {
    try {
        await query(
            `INSERT INTO matches (seeker_id, listing_id, match_score, match_reasons)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (seeker_id, listing_id) DO UPDATE SET 
               match_score = $3, match_reasons = $4, updated_at = NOW()`,
            [seekerId, listingId, score, JSON.stringify(reasons)]
        );

        logger.debug({ seekerId, listingId, score }, 'Match created/updated');
    } catch (err) {
        // Log but don't fail the search if match creation fails
        logger.warn({ err, seekerId, listingId }, 'Failed to create match row');
    }
}

/**
 * Save seeker profile from search preferences
 */
export async function saveSeekerProfile(
    userId: string,
    preferences: SearchPreferences
): Promise<void> {
    await query(
        `INSERT INTO seeker_profiles (user_id, criteria)
     VALUES ($1, $2)
     ON CONFLICT (user_id) 
     DO UPDATE SET criteria = $2, updated_at = NOW()`,
        [userId, JSON.stringify(preferences)]
    );

    logger.info({ userId }, 'Seeker profile saved');
}
