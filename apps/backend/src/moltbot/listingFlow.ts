/**
 * Listing Submission Flow
 * Orchestrates the poster agent workflow for listing creation
 */

import { getMoltbotClient, type MoltbotResponse } from './MoltbotClient.js';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';
import crypto from 'crypto';

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
        const link = `https://dar.mt/p/${crypto.randomUUID()}`;
        const rawData = { lat, lng, description };

        // Insert listing
        const result = await query<{ id: string }>(
            `INSERT INTO property_listings (
        poster_id, title, summary, link, type, price, currency,
        bedrooms, bathrooms, interior_area, location, raw, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'submitted')
      RETURNING id`,
            [
                userId,
                title,
                description.substring(0, 500),
                link,
                propertyType,
                priceAmount,
                'EUR',
                bedrooms ?? null,
                bathrooms ?? null,
                sizeSqm ?? null,
                addressText,
                JSON.stringify(rawData),
            ]
        );

        const listingId = result.rows[0].id;

        // P6A: Risk scoring integration
        let riskStatus = 'ok';
        try {
            const { computeFingerprint, scoreListing, isRiskScoringEnabled } = await import('../services/riskService.js');

            if (isRiskScoringEnabled()) {
                await computeFingerprint(listingId);
                const riskResult = await scoreListing(listingId);
                riskStatus = riskResult.status;

                // If high risk, update listing status to hold_for_review
                if (riskResult.status === 'hold' || riskResult.status === 'review_required') {
                    await query(
                        `UPDATE property_listings SET status = 'hold_for_review' WHERE id = $1`,
                        [listingId]
                    );
                    logger.warn({ listingId, riskScore: riskResult.risk_score, reasons: riskResult.reasons },
                        'Listing held for review due to risk score');
                }
            }
        } catch (riskError) {
            logger.error({ riskError, listingId }, 'Risk scoring failed in flow, proceeding');
        }

        // Audit
        await audit({
            actorType: 'user',
            actorId: userId,
            action: AuditActions.LISTING_CREATE,
            entity: 'listings', // Keep entity name generic or switch to property_listings? keeping generic 'listings' for audit consistence
            entityId: listingId,
            payload: { sessionId, title, propertyType, riskStatus },
        });

        logger.info({ listingId, userId, sessionId, riskStatus }, 'Listing submitted via flow');

        // Trigger the listing submitted hook to notify admin (only if not held?)
        // The requirement says "if ok => proceed to standard admin review".
        // If held, we might want to notify poster differently?
        // For now, onListingSubmitted handles generic "submitted" notification to admin. 
        // Admin queue usually picks up submitted. If held, it might go to a different queue view.
        await onListingSubmitted(listingId, userId);

        let userMessage = `Listing "${title}" submitted for review.`;
        if (riskStatus !== 'ok') {
            userMessage += ` It is currently being reviewed by our trust & safety team.`;
        }

        return {
            success: true,
            listingId,
            message: userMessage,
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
 * Hook called when a listing is submitted - triggers admin notification
 */
export async function onListingSubmitted(
    listingId: string,
    posterId: string
): Promise<void> {
    await audit({
        actorType: 'system',
        actorId: 'listing-flow',
        action: 'listing.submitted',
        entity: 'listings',
        entityId: listingId,
    });

    // Notify admin agent to review the listing
    const client = getMoltbotClient();
    if (client.notifyAdminNewListing) {
        await client.notifyAdminNewListing(listingId);
    } else {
        logger.warn('notifyAdminNewListing not available on client');
    }

    logger.info({ listingId, posterId }, 'Listing submitted hook triggered');
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
        'SELECT whatsapp_id, telegram_id, phone FROM users WHERE id = $1',
        [userId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];

    // Get listing title - Updated to property_listings
    const listingResult = await query(
        'SELECT title FROM property_listings WHERE id = $1',
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

    // Send notification via MoltbotClient
    const client = getMoltbotClient();

    if (user.whatsapp_id) {
        await client.notifyPoster(user.whatsapp_id, message, 'whatsapp');
    } else if (user.telegram_id) {
        await client.notifyPoster(user.telegram_id, message, 'telegram');
    }

    // Audit the notification
    await audit({
        actorType: 'system',
        actorId: 'listing-flow',
        action: 'listing.notification.sent',
        entity: 'listings',
        entityId: listingId,
        payload: {
            status,
            channel: user.whatsapp_id ? 'whatsapp' : user.telegram_id ? 'telegram' : 'none'
        },
    });

    logger.info({ userId, listingId, status }, 'Listing status notification sent');
}
