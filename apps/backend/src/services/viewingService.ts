/**
 * Viewing Service - P6B Viewing Scheduling
 * 
 * Enables scheduling property viewings between seekers and posters.
 * Chat-first scheduling with confirmations, time windows, and reminders.
 */

import { query } from '../db.js';
import { logger } from '../observability/logger.js';

export interface ViewingRequest {
    id: string;
    property_id: string;
    seeker_id: string | null;
    seeker_session_id: string | null;
    poster_id: string | null;
    status: 'proposed' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface TimeOption {
    id: string;
    viewing_request_id: string;
    start_at: string;
    end_at: string;
    timezone: string;
    source: 'seeker' | 'poster' | 'admin';
    status: 'offered' | 'selected' | 'rejected';
}

export interface ViewingEvent {
    event_type: string;
    actor: string;
    payload?: Record<string, unknown>;
}

const MAX_TIME_OPTIONS = 5;

/**
 * Create a new viewing request
 */
export async function createViewingRequest(
    propertyId: string,
    seekerId: string | null,
    seekerSessionId: string | null,
    notes?: string
): Promise<{ viewing_request_id: string }> {
    // Get poster ID from property
    const propertyResult = await query<{ source: string }>(
        `SELECT source FROM property_listings WHERE id = $1`,
        [propertyId]
    );

    if (propertyResult.rows.length === 0) {
        throw new Error('Property not found');
    }

    // Create viewing request
    const result = await query<{ id: string }>(
        `INSERT INTO viewing_requests 
     (property_id, seeker_id, seeker_session_id, poster_id, notes, status)
     VALUES ($1, $2, $3, $4, $5, 'proposed')
     RETURNING id`,
        [propertyId, seekerId, seekerSessionId, null, notes || null]
    );

    const viewingRequestId = result.rows[0].id;

    // Log event
    await logViewingEvent(viewingRequestId, 'created', seekerId ? 'seeker' : 'system', {
        property_id: propertyId,
        notes,
    });

    logger.info({ viewingRequestId, propertyId, seekerId }, 'Viewing request created');

    return { viewing_request_id: viewingRequestId };
}

/**
 * Offer time options for a viewing
 */
export async function offerTimeOptions(
    viewingRequestId: string,
    timeOptions: Array<{ start_at: string; end_at: string; timezone?: string }>,
    source: 'seeker' | 'poster' | 'admin'
): Promise<{ offered_count: number }> {
    if (timeOptions.length > MAX_TIME_OPTIONS) {
        throw new Error(`Maximum ${MAX_TIME_OPTIONS} time options allowed`);
    }

    if (timeOptions.length === 0) {
        throw new Error('At least one time option is required');
    }

    // Validate viewing request exists
    const requestCheck = await query(
        `SELECT id FROM viewing_requests WHERE id = $1`,
        [viewingRequestId]
    );

    if (requestCheck.rows.length === 0) {
        throw new Error('Viewing request not found');
    }

    // Insert time options
    let offeredCount = 0;
    for (const option of timeOptions) {
        await query(
            `INSERT INTO viewing_time_options 
       (viewing_request_id, start_at, end_at, timezone, source, status)
       VALUES ($1, $2, $3, $4, $5, 'offered')`,
            [
                viewingRequestId,
                option.start_at,
                option.end_at,
                option.timezone || 'Europe/Malta',
                source,
            ]
        );
        offeredCount++;
    }

    // Log event
    await logViewingEvent(viewingRequestId, 'offered', source, {
        options_count: offeredCount,
        time_options: timeOptions,
    });

    logger.info({ viewingRequestId, offeredCount, source }, 'Time options offered');

    return { offered_count: offeredCount };
}

/**
 * Select a time option
 */
export async function selectTimeOption(
    viewingRequestId: string,
    timeOptionId: string,
    actor: 'seeker' | 'poster'
): Promise<{ status: string }> {
    // Verify option belongs to request
    const optionCheck = await query<{ id: string }>(
        `SELECT id FROM viewing_time_options 
     WHERE id = $1 AND viewing_request_id = $2 AND status = 'offered'`,
        [timeOptionId, viewingRequestId]
    );

    if (optionCheck.rows.length === 0) {
        throw new Error('Time option not found or not available');
    }

    // Mark this option as selected
    await query(
        `UPDATE viewing_time_options SET status = 'selected' WHERE id = $1`,
        [timeOptionId]
    );

    // Mark other options as rejected
    await query(
        `UPDATE viewing_time_options 
     SET status = 'rejected' 
     WHERE viewing_request_id = $1 AND id != $2 AND status = 'offered'`,
        [viewingRequestId, timeOptionId]
    );

    // Log event
    await logViewingEvent(viewingRequestId, 'selected', actor, {
        time_option_id: timeOptionId,
    });

    logger.info({ viewingRequestId, timeOptionId, actor }, 'Time option selected');

    return { status: 'selected' };
}

/**
 * Confirm a viewing
 */
export async function confirmViewing(
    viewingRequestId: string,
    actor: 'seeker' | 'poster' | 'admin'
): Promise<{ status: string }> {
    // Check there's a selected time option
    const selectedCheck = await query(
        `SELECT id FROM viewing_time_options 
     WHERE viewing_request_id = $1 AND status = 'selected'`,
        [viewingRequestId]
    );

    if (selectedCheck.rows.length === 0) {
        throw new Error('No time option selected yet');
    }

    // Update request status
    await query(
        `UPDATE viewing_requests SET status = 'confirmed' WHERE id = $1`,
        [viewingRequestId]
    );

    // Log event
    await logViewingEvent(viewingRequestId, 'confirmed', actor, {});

    logger.info({ viewingRequestId, actor }, 'Viewing confirmed');

    return { status: 'confirmed' };
}

/**
 * Reschedule a viewing
 */
export async function rescheduleViewing(
    viewingRequestId: string,
    newTimeOptions: Array<{ start_at: string; end_at: string; timezone?: string }>,
    by: 'seeker' | 'poster' | 'admin'
): Promise<{ status: string }> {
    // Mark all existing options as rejected
    await query(
        `UPDATE viewing_time_options SET status = 'rejected' WHERE viewing_request_id = $1`,
        [viewingRequestId]
    );

    // Update request status
    await query(
        `UPDATE viewing_requests SET status = 'rescheduled' WHERE id = $1`,
        [viewingRequestId]
    );

    // Offer new time options
    await offerTimeOptions(viewingRequestId, newTimeOptions, by);

    // Log event
    await logViewingEvent(viewingRequestId, 'rescheduled', by, {
        new_options_count: newTimeOptions.length,
    });

    logger.info({ viewingRequestId, by, optionsCount: newTimeOptions.length }, 'Viewing rescheduled');

    return { status: 'rescheduled' };
}

/**
 * Cancel a viewing
 */
export async function cancelViewing(
    viewingRequestId: string,
    by: 'seeker' | 'poster' | 'admin',
    reason?: string
): Promise<{ status: string }> {
    await query(
        `UPDATE viewing_requests SET status = 'cancelled' WHERE id = $1`,
        [viewingRequestId]
    );

    // Log event
    await logViewingEvent(viewingRequestId, 'cancelled', by, { reason });

    logger.info({ viewingRequestId, by, reason }, 'Viewing cancelled');

    return { status: 'cancelled' };
}

/**
 * Complete a viewing
 */
export async function completeViewing(
    viewingRequestId: string,
    by: 'poster' | 'admin'
): Promise<{ status: string }> {
    await query(
        `UPDATE viewing_requests SET status = 'completed' WHERE id = $1`,
        [viewingRequestId]
    );

    // Log event
    await logViewingEvent(viewingRequestId, 'completed', by, {});

    logger.info({ viewingRequestId, by }, 'Viewing completed');

    return { status: 'completed' };
}

/**
 * Get viewing request details
 */
export async function getViewingRequest(viewingRequestId: string): Promise<ViewingRequest | null> {
    const result = await query<ViewingRequest>(
        `SELECT * FROM viewing_requests WHERE id = $1`,
        [viewingRequestId]
    );

    return result.rows[0] || null;
}

/**
 * Get time options for a viewing request
 */
export async function getTimeOptions(viewingRequestId: string): Promise<TimeOption[]> {
    const result = await query<TimeOption>(
        `SELECT * FROM viewing_time_options 
     WHERE viewing_request_id = $1 
     ORDER BY start_at ASC`,
        [viewingRequestId]
    );

    return result.rows;
}

/**
 * Get viewing events (audit trail)
 */
export async function getViewingEvents(viewingRequestId: string): Promise<ViewingEvent[]> {
    const result = await query<ViewingEvent & { created_at: string }>(
        `SELECT event_type, actor, payload, created_at 
     FROM viewing_events 
     WHERE viewing_request_id = $1 
     ORDER BY created_at ASC`,
        [viewingRequestId]
    );

    return result.rows;
}

/**
 * Log a viewing event
 */
async function logViewingEvent(
    viewingRequestId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>
): Promise<void> {
    await query(
        `INSERT INTO viewing_events (viewing_request_id, event_type, actor, payload)
     VALUES ($1, $2, $3, $4)`,
        [viewingRequestId, eventType, actor, JSON.stringify(payload)]
    );
}

/**
 * Check if viewings are enabled
 */
export function isViewingsEnabled(): boolean {
    return process.env.VIEWINGS_ENABLED !== 'false';
}
