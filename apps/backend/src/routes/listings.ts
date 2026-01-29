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
import crypto from 'crypto';

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

        const link = `https://dar.mt/p/${crypto.randomUUID()}`; // Generate unique link
        const rawData = { lat: data.lat, lng: data.lng, description: data.description };

        const result = await query<{ id: string }>(
            `INSERT INTO property_listings (
        poster_id, title, summary, link, type, price, currency,
        bedrooms, bathrooms, interior_area, location, raw, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'submitted')
      RETURNING id`,
            [
                userId,
                data.title,
                data.description?.substring(0, 500), // Summary limited length
                link,
                data.type,
                data.price_amount,
                data.price_currency,
                data.bedrooms ?? null,
                data.bathrooms ?? null,
                data.size_sqm ?? null,
                data.address_text ?? null,
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
            // Risk scoring failures should not block listing creation
            logger.error({ riskError, listingId }, 'Risk scoring failed, proceeding with submission');
        }

        await audit({
            actorType: 'user',
            actorId: userId,
            action: AuditActions.LISTING_SUBMIT,
            entity: 'listings',
            entityId: listingId,
            payload: { title: data.title, type: data.type, price: data.price_amount, riskStatus },
        });

        logger.info({ listingId, userId, riskStatus }, 'Listing created');

        return reply.status(201).send({
            id: listingId,
            status: riskStatus === 'ok' ? 'submitted' : 'hold_for_review',
            message: riskStatus === 'ok'
                ? 'Listing submitted for review'
                : 'Listing held for additional review',
            riskStatus,
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
            `SELECT pl.*, 
              u.email as poster_email,
              (SELECT json_agg(pm.*) FROM property_media pm WHERE pm.property_id = pl.id) as media
       FROM property_listings pl
       LEFT JOIN auth.users u ON u.id = pl.poster_id
       WHERE pl.id = $1`,
            [params.data.id]
        );

        if (result.rows.length === 0) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        const listing = result.rows[0];

        // Check visibility: published is public, others require auth
        if (listing.status !== 'published') {
            try {
                await request.jwtVerify();
            } catch {
                // Not authenticated
            }

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
            `SELECT pl.*,
              (SELECT COUNT(*) FROM property_media pm WHERE pm.property_id = pl.id) as media_count
       FROM property_listings pl
       WHERE pl.poster_id = $1
       ORDER BY pl.created_at DESC`,
            [userId]
        );

        return reply.send(result.rows);
    });
};
