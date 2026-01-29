/**
 * Viewings API Routes
 * Schedule and manage property viewings
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../db.js';
import { requireAuth, requireRole } from '../rbac.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

// Create viewing schema
const createViewingSchema = z.object({
    listing_id: z.string().uuid(),
    scheduled_at: z.string().datetime(),
    notes: z.string().max(500).optional(),
});

// Update viewing schema
const updateViewingSchema = z.object({
    status: z.enum(['confirmed', 'cancelled', 'completed']),
    notes: z.string().max(500).optional(),
});

export const viewingsRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/viewings
     * Schedule a new viewing (seeker)
     */
    fastify.post('/viewings', {
        preHandler: requireRole('seeker', 'admin'),
    }, async (request, reply) => {
        const body = createViewingSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { listing_id, scheduled_at, notes } = body.data;
        const seekerId = request.user!.sub;

        // Check listing exists and is viewable
        const listingResult = await query(
            `SELECT id, poster_id, title, status FROM listings WHERE id = $1`,
            [listing_id]
        );

        if (listingResult.rows.length === 0) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        const listing = listingResult.rows[0];

        if (!['approved', 'published'].includes(listing.status)) {
            return reply.status(400).send({ error: 'Listing is not available for viewing' });
        }

        // Create viewing
        const result = await query<{ id: string }>(
            `INSERT INTO viewings (listing_id, seeker_id, scheduled_at, status, notes)
       VALUES ($1, $2, $3, 'proposed', $4)
       RETURNING id`,
            [listing_id, seekerId, scheduled_at, notes ?? null]
        );

        const viewingId = result.rows[0].id;

        await audit({
            actorType: 'user',
            actorId: seekerId,
            action: AuditActions.VIEWING_CREATE,
            entity: 'viewings',
            entityId: viewingId,
            payload: { listing_id, scheduled_at },
        });

        logger.info({ viewingId, listingId: listing_id, seekerId }, 'Viewing scheduled');

        return reply.status(201).send({
            id: viewingId,
            status: 'proposed',
            listing_id,
            scheduled_at,
            message: 'Viewing request submitted',
        });
    });

    /**
     * GET /api/viewings
     * List viewings for current user
     */
    fastify.get('/viewings', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const userId = request.user!.sub;
        const role = request.user!.role;

        let sql: string;
        let params: unknown[];

        if (['admin', 'moderator'].includes(role)) {
            // Staff sees all viewings
            sql = `
        SELECT v.*, 
               l.title as listing_title,
               u.name as seeker_name,
               p.name as poster_name
        FROM viewings v
        JOIN listings l ON l.id = v.listing_id
        JOIN users u ON u.id = v.seeker_id
        JOIN users p ON p.id = l.poster_id
        ORDER BY v.scheduled_at DESC
        LIMIT 100
      `;
            params = [];
        } else if (role === 'poster') {
            // Poster sees viewings on their listings
            sql = `
        SELECT v.*, 
               l.title as listing_title,
               u.name as seeker_name
        FROM viewings v
        JOIN listings l ON l.id = v.listing_id
        JOIN users u ON u.id = v.seeker_id
        WHERE l.poster_id = $1
        ORDER BY v.scheduled_at DESC
      `;
            params = [userId];
        } else {
            // Seeker sees their own viewings
            sql = `
        SELECT v.*, 
               l.title as listing_title,
               p.name as poster_name
        FROM viewings v
        JOIN listings l ON l.id = v.listing_id
        JOIN users p ON p.id = l.poster_id
        WHERE v.seeker_id = $1
        ORDER BY v.scheduled_at DESC
      `;
            params = [userId];
        }

        const result = await query(sql, params);

        return reply.send(result.rows);
    });

    /**
     * PATCH /api/viewings/:id
     * Update viewing status (confirm, cancel, complete)
     */
    fastify.patch<{ Params: { id: string } }>('/viewings/:id', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const viewingId = request.params.id;

        if (!z.string().uuid().safeParse(viewingId).success) {
            return reply.status(400).send({ error: 'Invalid viewing ID' });
        }

        const body = updateViewingSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { status: newStatus, notes } = body.data;
        const userId = request.user!.sub;
        const role = request.user!.role;

        // Get viewing with ownership info
        const viewingResult = await query(
            `SELECT v.*, l.poster_id
       FROM viewings v
       JOIN listings l ON l.id = v.listing_id
       WHERE v.id = $1`,
            [viewingId]
        );

        if (viewingResult.rows.length === 0) {
            return reply.status(404).send({ error: 'Viewing not found' });
        }

        const viewing = viewingResult.rows[0];

        // Check authorization
        const isSeeker = viewing.seeker_id === userId;
        const isPoster = viewing.poster_id === userId;
        const isStaff = ['admin', 'moderator'].includes(role);

        if (!isSeeker && !isPoster && !isStaff) {
            return reply.status(403).send({ error: 'Not authorized to update this viewing' });
        }

        // Update viewing
        await query(
            `UPDATE viewings SET status = $1, notes = COALESCE($2, notes) WHERE id = $3`,
            [newStatus, notes, viewingId]
        );

        // Audit
        const auditAction = newStatus === 'confirmed' ? AuditActions.VIEWING_CONFIRM
            : newStatus === 'cancelled' ? AuditActions.VIEWING_CANCEL
                : AuditActions.VIEWING_COMPLETE;

        await audit({
            actorType: 'user',
            actorId: userId,
            action: auditAction,
            entity: 'viewings',
            entityId: viewingId,
            payload: { previousStatus: viewing.status, newStatus },
        });

        logger.info({ viewingId, userId, newStatus }, 'Viewing status updated');

        return reply.send({
            success: true,
            viewing_id: viewingId,
            previous_status: viewing.status,
            new_status: newStatus,
        });
    });
};
