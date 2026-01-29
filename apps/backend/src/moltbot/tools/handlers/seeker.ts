/**
 * Seeker Tool Handlers
 *
 * Backend handlers for seeker/poster agent actions.
 */

import { query } from '../../../db.js';
import { logger } from '../../../observability/logger.js';
import type { SeekerOutput } from '../../contracts.js';
import type { ToolResult } from './common.js';

/**
 * Search properties based on criteria
 */
export async function handleSearchProperties(
    params: SeekerOutput['params'],
    userId?: string
): Promise<ToolResult> {
    const { criteria } = params;

    if (!criteria) {
        return { success: false, error: 'Criteria required for search' };
    }

    try {
        // Build dynamic query based on criteria
        const conditions: string[] = ["status IN ('approved', 'published')"];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (criteria.location) {
            conditions.push(`location ILIKE $${paramIndex}`);
            values.push(`%${criteria.location}%`);
            paramIndex++;
        }

        if (criteria.min_price !== undefined) {
            conditions.push(`price >= $${paramIndex}`);
            values.push(criteria.min_price);
            paramIndex++;
        }

        if (criteria.max_price !== undefined) {
            conditions.push(`price <= $${paramIndex}`);
            values.push(criteria.max_price);
            paramIndex++;
        }

        if (criteria.bedrooms !== undefined) {
            conditions.push(`bedrooms >= $${paramIndex}`);
            values.push(criteria.bedrooms);
            paramIndex++;
        }

        if (criteria.property_type) {
            conditions.push(`type = $${paramIndex}`);
            values.push(criteria.property_type);
            paramIndex++;
        }

        const sql = `
            SELECT id, title, price, location, type, bedrooms, bathrooms
            FROM property_listings
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC
            LIMIT 20
        `;

        const result = await query(sql, values);

        logger.info({ userId, criteria, count: result.rows.length }, 'Property search executed');

        return {
            success: true,
            data: {
                listings: result.rows,
                count: result.rows.length,
            },
            message: `Found ${result.rows.length} properties`,
        };
    } catch (err) {
        logger.error({ err, criteria }, 'Property search failed');
        return { success: false, error: 'Search failed' };
    }
}

/**
 * Schedule a property viewing
 */
export async function handleScheduleViewing(
    params: SeekerOutput['params'],
    userId?: string,
    sessionId?: string
): Promise<ToolResult> {
    const { viewing } = params;

    if (!viewing) {
        return { success: false, error: 'Viewing details required' };
    }

    try {
        const { createViewingRequest, offerTimeOptions } = await import('../../../services/viewingService.js');

        // 1. Create viewing request
        const { viewing_request_id } = await createViewingRequest(
            viewing.listing_id,
            userId || null,
            sessionId || null,
            viewing.notes
        );

        // 2. Add proposed dates if any
        if (viewing.proposed_dates && viewing.proposed_dates.length > 0) {
            // Default slot duration: 30 minutes
            const timeOptions = viewing.proposed_dates.map(dateStr => {
                const startAt = new Date(dateStr);
                const endAt = new Date(startAt.getTime() + 30 * 60000); // +30 mins
                return {
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString(),
                    timezone: 'Africa/Kigali', // Default or from user context? Service defaults to Malta but explicit provided here to match schema or keep consistent
                };
            });

            await offerTimeOptions(viewing_request_id, timeOptions, 'seeker');
        }

        logger.info({ viewingId: viewing_request_id, userId, listingId: viewing.listing_id }, 'Viewing scheduled');

        return {
            success: true,
            data: { viewingId: viewing_request_id, listingId: viewing.listing_id },
            message: 'Viewing request submitted',
        };
    } catch (err) {
        logger.error({ err, viewing }, 'Failed to schedule viewing');
        return { success: false, error: 'Failed to schedule viewing' };
    }
}

/**
 * Send an inquiry about a listing
 */
export async function handleInquireListing(
    params: SeekerOutput['params'],
    userId?: string,
    sessionId?: string
): Promise<ToolResult> {
    const { inquiry } = params;

    if (!inquiry) {
        return { success: false, error: 'Inquiry details required' };
    }

    try {
        const result = await query<{ id: string }>(
            `INSERT INTO property_inquiries (
                property_id, seeker_id, session_id, message, contact_preference, status
            ) VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id`,
            [
                inquiry.listing_id,
                userId ?? null,
                sessionId ?? null,
                inquiry.message ?? '',
                inquiry.contact_preference ?? 'in_app',
            ]
        );

        const inquiryId = result.rows[0].id;

        logger.info({ inquiryId, userId, listingId: inquiry.listing_id }, 'Inquiry sent');

        return {
            success: true,
            data: { inquiryId, listingId: inquiry.listing_id },
            message: 'Inquiry sent successfully',
        };
    } catch (err) {
        logger.error({ err, inquiry }, 'Failed to send inquiry');
        return { success: false, error: 'Failed to send inquiry' };
    }
}

/**
 * Save a listing to favorites
 */
export async function handleSaveToFavorites(
    params: SeekerOutput['params'],
    userId?: string
): Promise<ToolResult> {
    const { listing_id } = params;

    if (!listing_id) {
        return { success: false, error: 'Listing ID required' };
    }

    if (!userId) {
        return { success: false, error: 'User authentication required' };
    }

    try {
        await query(
            `INSERT INTO user_favorites (user_id, listing_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, listing_id) DO NOTHING`,
            [userId, listing_id]
        );

        logger.info({ userId, listingId: listing_id }, 'Listing saved to favorites');

        return {
            success: true,
            data: { listingId: listing_id },
            message: 'Saved to favorites',
        };
    } catch (err) {
        logger.error({ err, listing_id, userId }, 'Failed to save favorite');
        return { success: false, error: 'Failed to save favorite' };
    }
}

/**
 * Show shortlist of candidates
 */
export async function handleShowShortlist(
    params: SeekerOutput['params']
): Promise<ToolResult> {
    return {
        success: true,
        data: {
            candidates: params.candidates || [],
            message: params.message || '',
        },
        message: 'Shortlist ready to display',
    };
}

/**
 * Submit a draft for review
 */
export async function handleSubmitForReview(
    params: SeekerOutput['params'],
    userId?: string
): Promise<ToolResult> {
    const { draft_id } = params;

    if (!draft_id) {
        return { success: false, error: 'Draft ID required' };
    }

    try {
        // Update listing status and add to review queue
        await query(
            `UPDATE property_listings 
            SET status = 'submitted', submitted_at = now()
            WHERE id = $1 AND poster_id = $2`,
            [draft_id, userId]
        );

        await query(
            `INSERT INTO admin_review_queue (property_id, priority, status)
            VALUES ($1, 'normal', 'pending')
            ON CONFLICT (property_id) DO UPDATE SET status = 'pending', submitted_at = now()`,
            [draft_id]
        );

        logger.info({ userId, draftId: draft_id }, 'Listing submitted for review');

        return {
            success: true,
            data: { draftId: draft_id },
            message: 'Listing submitted for review',
        };
    } catch (err) {
        logger.error({ err, draft_id, userId }, 'Failed to submit for review');
        return { success: false, error: 'Failed to submit for review' };
    }
}
