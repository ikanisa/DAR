/**
 * Reviews API Routes
 * Admin/moderator review operations for listings
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../db.js';
import { requireRole } from '../rbac.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

// Review decision schema
const reviewDecisionSchema = z.object({
    result: z.enum(['approved', 'rejected', 'needs_changes']),
    notes: z.string().optional(),
    flags: z.record(z.unknown()).optional(),
    next_status: z.enum(['approved', 'rejected', 'under_review', 'published']).optional(),
});

// Status transition rules
const validTransitions: Record<string, string[]> = {
    submitted: ['under_review', 'approved', 'rejected'],
    under_review: ['approved', 'rejected', 'needs_changes'],
    approved: ['published', 'rejected'],
    rejected: ['under_review'], // Allow re-review
    needs_changes: ['submitted', 'under_review'],
};

export const reviewsRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/listings/:id/review
     * Submit a review decision for a listing
     */
    fastify.post<{ Params: { id: string } }>('/listings/:id/review', {
        preHandler: requireRole('admin', 'moderator'),
    }, async (request, reply) => {
        const listingId = request.params.id;

        // Validate UUID
        if (!z.string().uuid().safeParse(listingId).success) {
            return reply.status(400).send({ error: 'Invalid listing ID' });
        }

        const body = reviewDecisionSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { result, notes, flags, next_status } = body.data;
        const reviewerId = request.user!.sub;
        const isServiceToken = request.isServiceToken;

        // Get current listing
        const listingResult = await query(
            'SELECT id, status, poster_id FROM listings WHERE id = $1',
            [listingId]
        );

        if (listingResult.rows.length === 0) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        const listing = listingResult.rows[0];
        const currentStatus = listing.status;

        // Determine target status
        let targetStatus = next_status;
        if (!targetStatus) {
            // Default status based on result
            switch (result) {
                case 'approved':
                    targetStatus = 'approved';
                    break;
                case 'rejected':
                    targetStatus = 'rejected';
                    break;
                case 'needs_changes':
                    targetStatus = 'under_review'; // Keep in review
                    break;
            }
        }

        // Validate transition
        const allowedTransitions = validTransitions[currentStatus] || [];
        if (!allowedTransitions.includes(targetStatus)) {
            return reply.status(400).send({
                error: 'Invalid status transition',
                current: currentStatus,
                target: targetStatus,
                allowed: allowedTransitions,
            });
        }

        // Execute review in transaction
        await transaction(async (client) => {
            // Insert review record
            await client.query(
                `INSERT INTO reviews (listing_id, reviewer_id, agent_id, result, notes, flags)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    listingId,
                    isServiceToken ? null : reviewerId,
                    isServiceToken ? reviewerId : null,
                    result,
                    notes ?? null,
                    flags ? JSON.stringify(flags) : '{}',
                ]
            );

            // Update listing status
            await client.query(
                'UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2',
                [targetStatus, listingId]
            );
        });

        // Audit the decision
        const auditAction = result === 'approved'
            ? AuditActions.LISTING_APPROVE
            : result === 'rejected'
                ? AuditActions.LISTING_REJECT
                : 'listing.review';

        await audit({
            actorType: isServiceToken ? 'agent' : 'user',
            actorId: reviewerId,
            action: auditAction,
            entity: 'listings',
            entityId: listingId,
            payload: {
                result,
                previousStatus: currentStatus,
                newStatus: targetStatus,
                notes: notes?.slice(0, 200),
            },
        });

        logger.info({
            listingId,
            reviewerId,
            result,
            previousStatus: currentStatus,
            newStatus: targetStatus,
        }, 'Listing reviewed');

        return reply.send({
            success: true,
            listing_id: listingId,
            previous_status: currentStatus,
            new_status: targetStatus,
            result,
        });
    });

    /**
     * GET /api/listings/:id/reviews
     * Get review history for a listing
     */
    fastify.get<{ Params: { id: string } }>('/listings/:id/reviews', {
        preHandler: requireRole('admin', 'moderator'),
    }, async (request, reply) => {
        const listingId = request.params.id;

        if (!z.string().uuid().safeParse(listingId).success) {
            return reply.status(400).send({ error: 'Invalid listing ID' });
        }

        const result = await query(
            `SELECT r.*, u.name as reviewer_name
       FROM reviews r
       LEFT JOIN users u ON u.id = r.reviewer_id
       WHERE r.listing_id = $1
       ORDER BY r.created_at DESC`,
            [listingId]
        );

        return reply.send(result.rows);
    });
};
