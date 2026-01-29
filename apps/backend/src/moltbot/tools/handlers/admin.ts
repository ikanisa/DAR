/**
 * Admin Tool Handlers
 *
 * Backend handlers for admin/moderator agent actions.
 */

import { query } from '../../../db.js';
import { logger } from '../../../observability/logger.js';
import type { AdminOutput } from '../../contracts.js';
import type { ToolResult } from './common.js';
import { adminOverride } from '../../../services/riskService.js';

/**
 * Approve a listing
 */
export async function handleApproveListing(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, notes } = params;

    if (!listing_id) {
        return { success: false, error: 'Listing ID required' };
    }

    try {
        // Update listing status
        await query(
            `UPDATE property_listings 
            SET status = 'approved', approved_at = now()
            WHERE id = $1`,
            [listing_id]
        );

        // Update review queue
        await query(
            `UPDATE admin_review_queue 
            SET status = 'approved', decision = 'approve', 
                decided_at = now(), decided_by = $2, notes = $3
            WHERE property_id = $1`,
            [listing_id, adminUserId, notes ?? null]
        );

        logger.info({ listingId: listing_id, adminUserId }, 'Listing approved');

        return {
            success: true,
            data: { listingId: listing_id, status: 'approved' },
            message: 'Listing approved successfully',
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to approve listing');
        return { success: false, error: 'Failed to approve listing' };
    }
}

/**
 * Reject a listing
 */
export async function handleRejectListing(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, reason, notes } = params;

    if (!listing_id || !reason) {
        return { success: false, error: 'Listing ID and reason required' };
    }

    try {
        // Update listing status
        await query(
            `UPDATE property_listings 
            SET status = 'rejected', rejected_at = now(), rejection_reason = $2
            WHERE id = $1`,
            [listing_id, reason]
        );

        // Update review queue
        await query(
            `UPDATE admin_review_queue 
            SET status = 'rejected', decision = 'reject', decision_reason = $3,
                decided_at = now(), decided_by = $2, notes = $4
            WHERE property_id = $1`,
            [listing_id, adminUserId, reason, notes ?? null]
        );

        logger.info({ listingId: listing_id, adminUserId, reason }, 'Listing rejected');

        return {
            success: true,
            data: { listingId: listing_id, status: 'rejected', reason },
            message: 'Listing rejected',
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to reject listing');
        return { success: false, error: 'Failed to reject listing' };
    }
}

/**
 * Request changes to a listing
 */
export async function handleRequestChanges(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, changes_requested, notes } = params;

    if (!listing_id || !changes_requested) {
        return { success: false, error: 'Listing ID and changes required' };
    }

    try {
        // Update listing status
        await query(
            `UPDATE property_listings 
            SET status = 'hold_for_review'
            WHERE id = $1`,
            [listing_id]
        );

        // Update review queue
        await query(
            `UPDATE admin_review_queue 
            SET status = 'changes_requested', decision = 'request_changes',
                changes_requested = $3, decided_at = now(), decided_by = $2, notes = $4
            WHERE property_id = $1`,
            [listing_id, adminUserId, JSON.stringify(changes_requested), notes ?? null]
        );

        logger.info({ listingId: listing_id, adminUserId, changes: changes_requested.length }, 'Changes requested');

        return {
            success: true,
            data: { listingId: listing_id, status: 'changes_requested', changesCount: changes_requested.length },
            message: 'Changes requested',
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to request changes');
        return { success: false, error: 'Failed to request changes' };
    }
}

/**
 * Flag a listing for moderation
 */
export async function handleFlagModeration(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, moderation_category, reason, severity } = params;

    if (!listing_id || !moderation_category || !reason) {
        return { success: false, error: 'Listing ID, category, and reason required' };
    }

    try {
        // Insert moderation event
        await query(
            `INSERT INTO moderation_events (
                listing_id, category, reason, severity, flagged_by
            ) VALUES ($1, $2, $3, $4, $5)`,
            [listing_id, moderation_category, reason, severity ?? 'medium', adminUserId]
        );

        // Update listing status to hold
        await query(
            `UPDATE property_listings SET status = 'hold_for_review' WHERE id = $1`,
            [listing_id]
        );

        logger.info({ listingId: listing_id, adminUserId, category: moderation_category }, 'Listing flagged for moderation');

        return {
            success: true,
            data: { listingId: listing_id, category: moderation_category },
            message: 'Listing flagged for moderation',
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to flag moderation');
        return { success: false, error: 'Failed to flag moderation' };
    }
}

/**
 * View the admin review queue
 */
export async function handleViewQueue(
    params: AdminOutput['params']
): Promise<ToolResult> {
    const filter = params.queue_filter || {};

    try {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (filter.status && filter.status !== 'all') {
            conditions.push(`arq.status = $${paramIndex}`);
            values.push(filter.status);
            paramIndex++;
        }

        const orderBy = filter.priority === 'oldest'
            ? 'arq.submitted_at ASC'
            : filter.priority === 'high_value'
                ? 'pl.price DESC NULLS LAST'
                : 'arq.submitted_at DESC';

        const limit = filter.limit || 10;
        values.push(limit);

        const sql = `
            SELECT arq.id, arq.property_id as listing_id, pl.title, arq.status, 
                   arq.priority, arq.submitted_at, pl.poster_id
            FROM admin_review_queue arq
            JOIN property_listings pl ON pl.id = arq.property_id
            ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
            ORDER BY ${orderBy}
            LIMIT $${paramIndex}
        `;

        const result = await query(sql, values);

        return {
            success: true,
            data: {
                items: result.rows,
                count: result.rows.length,
            },
            message: `Found ${result.rows.length} items in queue`,
        };
    } catch (err) {
        logger.error({ err, filter }, 'Failed to view queue');
        return { success: false, error: 'Failed to load queue' };
    }
}

/**
 * View listing details (admin)
 */
export async function handleViewListingDetails(
    params: AdminOutput['params']
): Promise<ToolResult> {
    const { listing_id } = params;

    if (!listing_id) {
        return { success: false, error: 'Listing ID required' };
    }

    try {
        const result = await query(
            `SELECT pl.*, arq.status as review_status, arq.priority, arq.notes
            FROM property_listings pl
            LEFT JOIN admin_review_queue arq ON arq.property_id = pl.id
            WHERE pl.id = $1`,
            [listing_id]
        );

        if (result.rows.length === 0) {
            return { success: false, error: 'Listing not found' };
        }

        return {
            success: true,
            data: { listing: result.rows[0] },
            message: 'Listing details loaded',
        };
    } catch (err) {
        logger.error({ err, listing_id }, 'Failed to view listing details');
        return { success: false, error: 'Failed to load listing' };
    }
}

/**
 * Suspend a user
 */
export async function handleSuspendUser(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { user_id, reason, suspension_duration } = params;

    if (!user_id || !reason || !suspension_duration) {
        return { success: false, error: 'User ID, reason, and duration required' };
    }

    // Calculate suspension end date
    const durationDays: Record<string, number> = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        'permanent': 36500, // ~100 years
    };

    const days = durationDays[suspension_duration] || 7;

    try {
        await query(
            `UPDATE users 
            SET suspended_until = now() + interval '${days} days',
                suspension_reason = $2
            WHERE id = $1`,
            [user_id, reason]
        );

        logger.info({ userId: user_id, adminUserId, duration: suspension_duration, reason }, 'User suspended');

        return {
            success: true,
            data: { userId: user_id, suspensionDuration: suspension_duration },
            message: 'User suspended',
        };
    } catch (err) {
        logger.error({ err, user_id, adminUserId }, 'Failed to suspend user');
        return { success: false, error: 'Failed to suspend user' };
    }
}

/**
 * Unblock a user
 */
export async function handleUnblockUser(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { user_id } = params;

    if (!user_id) {
        return { success: false, error: 'User ID required' };
    }

    try {
        await query(
            `UPDATE users 
            SET suspended_until = NULL, suspension_reason = NULL
            WHERE id = $1`,
            [user_id]
        );

        logger.info({ userId: user_id, adminUserId }, 'User unblocked');

        return {
            success: true,
            data: { userId: user_id },
            message: 'User unblocked',
        };
    } catch (err) {
        logger.error({ err, user_id, adminUserId }, 'Failed to unblock user');
        return { success: false, error: 'Failed to unblock user' };
    }
}

/**
 * Update listing status
 */
export async function handleUpdateListingStatus(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, new_status } = params;

    if (!listing_id || !new_status) {
        return { success: false, error: 'Listing ID and new status required' };
    }

    // Map admin statuses to listing statuses
    const statusMap: Record<string, string> = {
        'draft': 'pending',
        'pending': 'pending',
        'approved': 'approved',
        'rejected': 'rejected',
        'moderation_hold': 'hold_for_review',
        'archived': 'rejected',
    };

    const listingStatus = statusMap[new_status] || new_status;

    try {
        await query(
            `UPDATE property_listings SET status = $2 WHERE id = $1`,
            [listing_id, listingStatus]
        );

        logger.info({ listingId: listing_id, adminUserId, newStatus: new_status }, 'Listing status updated');

        return {
            success: true,
            data: { listingId: listing_id, status: new_status },
            message: 'Listing status updated',
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to update listing status');
        return { success: false, error: 'Failed to update status' };
    }
}

/**
 * Escalate a listing
 */
export async function handleEscalate(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, severity, reason } = params;

    if (!listing_id || !severity || !reason) {
        return { success: false, error: 'Listing ID, severity, and reason required' };
    }

    try {
        await query(
            `UPDATE admin_review_queue 
            SET priority = 'urgent', notes = $3
            WHERE property_id = $1`,
            [listing_id, adminUserId, `ESCALATED (${severity}): ${reason}`]
        );

        logger.info({ listingId: listing_id, adminUserId, severity, reason }, 'Listing escalated');

        return {
            success: true,
            data: { listingId: listing_id, severity },
            message: 'Listing escalated',
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to escalate');
        return { success: false, error: 'Failed to escalate' };
    }
}

/**
 * Override risk score decision
 */
export async function handleRiskOverride(
    params: AdminOutput['params'],
    adminUserId: string
): Promise<ToolResult> {
    const { listing_id, decision, notes } = params;

    if (!listing_id || !decision) {
        return { success: false, error: 'Listing ID and decision required' };
    }

    try {
        const { finalStatus } = await adminOverride(
            listing_id,
            decision,
            adminUserId,
            notes
        );

        return {
            success: true,
            data: { listingId: listing_id, decision, finalStatus },
            message: `Risk override applied: ${decision} (Status: ${finalStatus})`,
        };
    } catch (err) {
        logger.error({ err, listing_id, adminUserId }, 'Failed to override risk');
        return { success: false, error: 'Failed to override risk' };
    }
}
