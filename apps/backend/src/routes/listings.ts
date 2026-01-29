/**
 * Listings API Routes
 * CRUD operations for property listings
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../db.js';
import { requireAuth, requireRole } from '../rbac.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

// Validation schemas
const createListingSchema = z.object({
    title: z.string().min(10, 'Title must be at least 10 characters'),
    description: z.string().min(100, 'Description must be at least 100 characters'),
    type: z.enum(['apartment', 'house', 'land', 'commercial']),
    price_amount: z.number().positive('Price must be positive'),
    price_currency: z.string().default('EUR'),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    size_sqm: z.number().positive().optional(),
    address_text: z.string().min(5).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

const listingIdSchema = z.object({
    id: z.string().uuid(),
});

export const listingsRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/listings
     * Create a new listing (poster only)
     */
    fastify.post('/listings', {
        preHandler: requireRole('poster', 'admin'),
    }, async (request, reply) => {
        const body = createListingSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const userId = request.user!.sub;
        const data = body.data;

        const result = await query<{ id: string }>(
            `INSERT INTO listings (
        poster_id, title, description, type, price_amount, price_currency,
        bedrooms, bathrooms, size_sqm, address_text, lat, lng, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'submitted')
      RETURNING id`,
            [
                userId,
                data.title,
                data.description,
                data.type,
                data.price_amount,
                data.price_currency,
                data.bedrooms ?? null,
                data.bathrooms ?? null,
                data.size_sqm ?? null,
                data.address_text ?? null,
                data.lat ?? null,
                data.lng ?? null,
            ]
        );

        const listingId = result.rows[0].id;

        await audit({
            actorType: 'user',
            actorId: userId,
            action: AuditActions.LISTING_SUBMIT,
            entity: 'listings',
            entityId: listingId,
            payload: { title: data.title, type: data.type, price: data.price_amount },
        });

        logger.info({ listingId, userId }, 'Listing created');

        return reply.status(201).send({
            id: listingId,
            status: 'submitted',
            message: 'Listing submitted for review',
        });
    });

    /**
     * GET /api/listings/:id
     * Get a single listing by ID (public for published, auth for others)
     */
    fastify.get<{ Params: { id: string } }>('/listings/:id', async (request, reply) => {
        const params = listingIdSchema.safeParse(request.params);

        if (!params.success) {
            return reply.status(400).send({ error: 'Invalid listing ID' });
        }

        const result = await query(
            `SELECT l.*, 
              u.name as poster_name,
              (SELECT json_agg(m.*) FROM listing_media m WHERE m.listing_id = l.id) as media
       FROM listings l
       JOIN users u ON u.id = l.poster_id
       WHERE l.id = $1`,
            [params.data.id]
        );

        if (result.rows.length === 0) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        const listing = result.rows[0];

        // Check visibility: published is public, others require auth
        if (listing.status !== 'published') {
            // Try to authenticate
            try {
                await request.jwtVerify();
            } catch {
                // Not authenticated
            }

            // If not authenticated or not the owner/admin, hide non-published listings
            if (!request.user) {
                return reply.status(404).send({ error: 'Listing not found' });
            }

            const isOwner = request.user.sub === listing.poster_id;
            const isStaff = ['admin', 'moderator'].includes(request.user.role);

            if (!isOwner && !isStaff) {
                return reply.status(404).send({ error: 'Listing not found' });
            }
        }

        return reply.send(listing);
    });

    /**
     * GET /api/listings/my
     * Get current user's listings
     */
    fastify.get('/listings/my', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const userId = request.user!.sub;

        const result = await query(
            `SELECT l.*,
              (SELECT COUNT(*) FROM listing_media m WHERE m.listing_id = l.id) as media_count
       FROM listings l
       WHERE l.poster_id = $1
       ORDER BY l.created_at DESC`,
            [userId]
        );

        return reply.send(result.rows);
    });
};
