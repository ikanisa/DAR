/**
 * Tool API Routes (for Moltbot agents)
 * Validate, dedupe, review queue, and admin decision endpoints
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../rbac.js';
import { audit } from '../audit.js';
import { logger } from '../observability/logger.js';

// Validation rules
const VALIDATION_RULES = {
    minTitleLength: 10,
    minDescriptionLength: 100,
    minPhotos: 5,
    maxPriceEur: 50000, // Monthly rent sanity check
} as const;

export const toolsRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/tools/listing/validate
     * Validate a listing for completeness and quality
     */
    fastify.post('/tools/listing/validate', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = z.object({
            listing_id: z.string().uuid().optional(),
            listing: z.object({
                title: z.string().optional(),
                description: z.string().optional(),
                type: z.string().optional(),
                price_amount: z.number().optional(),
                address_text: z.string().optional(),
                bedrooms: z.number().optional(),
                bathrooms: z.number().optional(),
            }).optional(),
        }).safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { listing_id, listing: inputListing } = body.data;
        let listing: Record<string, any>;
        let photoCount = 0;

        if (listing_id) {
            // Fetch listing from database
            const result = await query(
                `SELECT l.*, 
                (SELECT COUNT(*) FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo') as photo_count
         FROM listings l WHERE l.id = $1`,
                [listing_id]
            );

            if (result.rows.length === 0) {
                return reply.status(404).send({ error: 'Listing not found' });
            }

            listing = result.rows[0];
            photoCount = parseInt(listing.photo_count, 10);
        } else if (inputListing) {
            listing = inputListing;
            photoCount = 0; // External payload, no photos yet
        } else {
            return reply.status(400).send({ error: 'Either listing_id or listing object required' });
        }

        // Run validation checks
        const errors: string[] = [];
        const warnings: string[] = [];
        let score = 100;

        // Title check
        if (!listing.title || listing.title.length < VALIDATION_RULES.minTitleLength) {
            errors.push(`Title must be at least ${VALIDATION_RULES.minTitleLength} characters`);
            score -= 20;
        }

        // Description check
        if (!listing.description || listing.description.length < VALIDATION_RULES.minDescriptionLength) {
            errors.push(`Description must be at least ${VALIDATION_RULES.minDescriptionLength} characters`);
            score -= 25;
        }

        // Type check
        if (!listing.type) {
            errors.push('Property type is required');
            score -= 10;
        }

        // Price check
        if (!listing.price_amount || listing.price_amount <= 0) {
            errors.push('Price must be positive');
            score -= 20;
        } else if (listing.price_amount > VALIDATION_RULES.maxPriceEur) {
            warnings.push(`Price seems high for monthly rent (€${listing.price_amount})`);
            score -= 5;
        }

        // Photo check (only for DB listings)
        if (listing_id && photoCount < VALIDATION_RULES.minPhotos) {
            errors.push(`At least ${VALIDATION_RULES.minPhotos} photos required (found ${photoCount})`);
            score -= 15;
        }

        // Address check
        if (!listing.address_text) {
            warnings.push('Address is missing');
            score -= 5;
        }

        // Room count sanity
        if (listing.bedrooms !== undefined && listing.bedrooms < 0) {
            errors.push('Bedrooms cannot be negative');
            score -= 5;
        }
        if (listing.bathrooms !== undefined && listing.bathrooms < 0) {
            errors.push('Bathrooms cannot be negative');
            score -= 5;
        }

        score = Math.max(0, score);
        const passed = errors.length === 0;

        // Audit
        if (listing_id) {
            await audit({
                actorType: request.isServiceToken ? 'agent' : 'user',
                actorId: request.user!.sub,
                action: 'listing.validate',
                entity: 'listings',
                entityId: listing_id,
                payload: { passed, score, errorCount: errors.length },
            });
        }

        logger.info({ listing_id, passed, score, errors: errors.length }, 'Listing validated');

        return reply.send({
            ok: passed,
            errors,
            warnings,
            score,
            checks: {
                title: !!listing.title && listing.title.length >= VALIDATION_RULES.minTitleLength,
                description: !!listing.description && listing.description.length >= VALIDATION_RULES.minDescriptionLength,
                type: !!listing.type,
                price: listing.price_amount > 0,
                photos: listing_id ? photoCount >= VALIDATION_RULES.minPhotos : null,
                address: !!listing.address_text,
            },
        });
    });

    /**
     * POST /api/tools/listing/dedupe
     * Check for duplicate listings
     */
    fastify.post('/tools/listing/dedupe', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = z.object({
            listing_id: z.string().uuid(),
        }).safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { listing_id } = body.data;

        // Get the listing
        const listingResult = await query(
            'SELECT * FROM listings WHERE id = $1',
            [listing_id]
        );

        if (listingResult.rows.length === 0) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        const listing = listingResult.rows[0];

        // Find potential duplicates
        // Criteria: same poster + similar address OR close geo + similar price
        const duplicates: Array<{ id: string; reason: string; confidence: number }> = [];

        // Check same poster + similar address
        if (listing.address_text) {
            const addressResult = await query(
                `SELECT id, title, address_text, price_amount
         FROM listings
         WHERE id != $1
           AND poster_id = $2
           AND address_text ILIKE $3
           AND status NOT IN ('draft', 'archived')`,
                [listing_id, listing.poster_id, `%${listing.address_text.slice(0, 20)}%`]
            );

            for (const dup of addressResult.rows) {
                duplicates.push({
                    id: dup.id,
                    reason: `Same poster with similar address: "${dup.address_text}"`,
                    confidence: 0.9,
                });
            }
        }

        // Check geo proximity + similar price
        if (listing.lat && listing.lng) {
            const geoResult = await query(
                `SELECT id, title, address_text, price_amount, lat, lng
         FROM listings
         WHERE id != $1
           AND lat IS NOT NULL
           AND lng IS NOT NULL
           AND status NOT IN ('draft', 'archived')
           AND ABS(lat - $2) < 0.002  -- ~200m
           AND ABS(lng - $3) < 0.002
           AND ABS(price_amount - $4) / NULLIF($4, 0) < 0.1  -- Within 10%`,
                [listing_id, listing.lat, listing.lng, listing.price_amount]
            );

            for (const dup of geoResult.rows) {
                // Skip if already found by address
                if (duplicates.some(d => d.id === dup.id)) continue;

                duplicates.push({
                    id: dup.id,
                    reason: `Similar location and price: "${dup.title}" at €${dup.price_amount}`,
                    confidence: 0.7,
                });
            }
        }

        await audit({
            actorType: request.isServiceToken ? 'agent' : 'user',
            actorId: request.user!.sub,
            action: 'listing.dedupe',
            entity: 'listings',
            entityId: listing_id,
            payload: { duplicateCount: duplicates.length },
        });

        logger.info({ listing_id, duplicateCount: duplicates.length }, 'Dedupe check completed');

        return reply.send({
            listing_id,
            duplicates,
            has_duplicates: duplicates.length > 0,
        });
    });

    /**
     * GET /api/tools/admin/review-queue
     * Get listings pending review
     */
    fastify.get('/tools/admin/review-queue', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const queryParams = z.object({
            limit: z.coerce.number().int().min(1).max(50).default(20),
        }).safeParse(request.query);

        const limit = queryParams.success ? queryParams.data.limit : 20;

        const result = await query(
            `SELECT l.*, 
              u.name as poster_name,
              (SELECT COUNT(*) FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo') as photo_count,
              (SELECT COUNT(*) FROM reviews r WHERE r.listing_id = l.id) as review_count
       FROM listings l
       JOIN users u ON u.id = l.poster_id
       WHERE l.status IN ('submitted', 'under_review')
       ORDER BY l.created_at ASC
       LIMIT $1`,
            [limit]
        );

        return reply.send({
            queue: result.rows,
            count: result.rows.length,
        });
    });

    /**
     * POST /api/tools/admin/decision
     * Submit an admin decision on a listing
     */
    fastify.post('/tools/admin/decision', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        // This is essentially a proxy to the review endpoint
        // but with a simpler interface for agents
        const body = z.object({
            listing_id: z.string().uuid(),
            result: z.enum(['approved', 'rejected', 'needs_changes']),
            notes: z.string().optional(),
        }).safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { listing_id, result, notes } = body.data;

        // Determine next status
        const nextStatus = result === 'approved' ? 'approved'
            : result === 'rejected' ? 'rejected'
                : 'under_review';

        // Get current status
        const listingResult = await query(
            'SELECT status FROM listings WHERE id = $1',
            [listing_id]
        );

        if (listingResult.rows.length === 0) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        const currentStatus = listingResult.rows[0].status;

        // Insert review
        await query(
            `INSERT INTO reviews (listing_id, agent_id, result, notes)
       VALUES ($1, $2, $3, $4)`,
            [listing_id, request.user!.sub, result, notes ?? null]
        );

        // Update listing status
        await query(
            'UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2',
            [nextStatus, listing_id]
        );

        await audit({
            actorType: request.isServiceToken ? 'agent' : 'user',
            actorId: request.user!.sub,
            action: result === 'approved' ? 'listing.approve' : result === 'rejected' ? 'listing.reject' : 'listing.review',
            entity: 'listings',
            entityId: listing_id,
            payload: { result, previousStatus: currentStatus, newStatus: nextStatus },
        });

        logger.info({ listing_id, result, newStatus: nextStatus }, 'Admin decision made');

        return reply.send({
            success: true,
            listing_id,
            result,
            previous_status: currentStatus,
            new_status: nextStatus,
        });
    });
};
