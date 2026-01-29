/**
 * Listing Submission Flow
 * Orchestrates the poster agent workflow for listing creation
 */

import { getMoltbotClient, type MoltbotResponse } from './MoltbotClient.js';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

const AGENT_ID = 'poster-agent';

export interface ListingSubmission {
    userId: string;
    sessionId: string;
    title: string;
    description: string;
    propertyType: 'apartment' | 'house' | 'land' | 'commercial';
    priceAmount: number;
    addressText: string;
    bedrooms?: number;
    bathrooms?: number;
    sizeSqm?: number;
    lat?: number;
    lng?: number;
}

export interface FlowResult {
    success: boolean;
    listingId?: string;
    message: string;
    agentResponse?: string;
}

/**
 * Start a new listing submission flow
 */
export async function startListingFlow(
    userId: string,
    sessionId: string,
    initialMessage: string
): Promise<MoltbotResponse> {
    const client = getMoltbotClient();

    // Initialize context with user info
    const context = {
        flow: 'listing_submission',
        step: 'welcome',
        userId,
        collectedData: {},
    };

    return client.sendMessage({
        agentId: AGENT_ID,
        sessionId,
        message: initialMessage,
        context,
    });
}

/**
 * Continue the listing flow with a user message
 */
export async function continueListingFlow(
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
 * Submit a completed listing to the database
 */
export async function submitListing(
    submission: ListingSubmission
): Promise<FlowResult> {
    const { userId, sessionId, title, description, propertyType, priceAmount, addressText, bedrooms, bathrooms, sizeSqm, lat, lng } = submission;

    try {
        // Insert listing
        const result = await query<{ id: string }>(
            `INSERT INTO listings (
        poster_id, title, description, type, price_amount, 
        address_text, bedrooms, bathrooms, size_sqm, lat, lng, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted')
      RETURNING id`,
            [
                userId, title, description, propertyType, priceAmount,
                addressText, bedrooms ?? null, bathrooms ?? null, sizeSqm ?? null,
                lat ?? null, lng ?? null,
            ]
        );

        const listingId = result.rows[0].id;

        // Audit
        await audit({
            actorType: 'user',
            actorId: userId,
            action: AuditActions.LISTING_CREATE,
            entity: 'listings',
            entityId: listingId,
            payload: { sessionId, title, propertyType },
        });

        logger.info({ listingId, userId, sessionId }, 'Listing submitted via flow');

        return {
            success: true,
            listingId,
            message: `Listing "${title}" submitted for review`,
        };
    } catch (err) {
        logger.error({ err, userId, sessionId }, 'Failed to submit listing');
        return {
            success: false,
            message: 'Failed to submit listing. Please try again.',
        };
    }
}

/**
 * Notify poster of listing status change
 */
export async function notifyListingStatus(
    userId: string,
    listingId: string,
    status: 'approved' | 'rejected' | 'needs_changes',
    notes?: string
): Promise<void> {
    // Get user contact info
    const userResult = await query(
        'SELECT whatsapp_id, phone FROM users WHERE id = $1',
        [userId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const recipient = user.whatsapp_id || user.phone;

    if (!recipient) return;

    // Get listing title
    const listingResult = await query(
        'SELECT title FROM listings WHERE id = $1',
        [listingId]
    );

    const title = listingResult.rows[0]?.title || 'Your listing';

    // Format message based on status
    let message: string;
    switch (status) {
        case 'approved':
            message = `Great news! Your listing "${title}" has been approved and is now live on Dar. 🎉`;
            break;
        case 'rejected':
            message = `Unfortunately, your listing "${title}" was not approved.${notes ? ` Reason: ${notes}` : ''} You can create a new listing following our guidelines.`;
            break;
        case 'needs_changes':
            message = `Your listing "${title}" needs some updates before approval.${notes ? ` Details: ${notes}` : ''} Please update and resubmit.`;
            break;
    }

    // Send via notifications API (would be internal call in production)
    logger.info({ userId, listingId, status, recipient }, 'Would send listing status notification');
}
