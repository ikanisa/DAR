/**
 * Risk API Routes - P6A Anti-duplicate + Anti-scam
 * 
 * Endpoints for risk scoring, fingerprinting, and admin override.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../rbac.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';
import {
    computeFingerprint,
    scoreListing,
    adminOverride,
    getRiskStatus,
    isRiskScoringEnabled,
} from '../services/riskService.js';

// Validation schemas
const propertyIdSchema = z.object({
    propertyId: z.string().uuid(),
});

const overrideSchema = z.object({
    propertyId: z.string().uuid(),
    decision: z.enum(['allow', 'hold', 'reject']),
    notes: z.string().optional(),
});

export const riskRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * GET /api/risk/status
     * Check if risk scoring is enabled
     */
    fastify.get('/risk/status', async (_request, reply) => {
        return reply.send({
            enabled: isRiskScoringEnabled(),
        });
    });

    /**
     * POST /api/risk/fingerprint/:propertyId
     * Compute fingerprint for a listing (internal use)
     */
    fastify.post<{ Params: { propertyId: string } }>('/risk/fingerprint/:propertyId', {
        preHandler: requireRole('admin', 'moderator'),
    }, async (request, reply) => {
        const params = propertyIdSchema.safeParse(request.params);

        if (!params.success) {
            return reply.status(400).send({ error: 'Invalid property ID' });
        }

        if (!isRiskScoringEnabled()) {
            return reply.send({ skipped: true, reason: 'Risk scoring disabled' });
        }

        try {
            const result = await computeFingerprint(params.data.propertyId);
            return reply.send(result);
        } catch (error) {
            logger.error({ error, propertyId: params.data.propertyId }, 'Failed to compute fingerprint');
            return reply.status(500).send({ error: 'Failed to compute fingerprint' });
        }
    });

    /**
     * POST /api/risk/score/:propertyId
     * Score a listing for risk
     */
    fastify.post<{ Params: { propertyId: string } }>('/risk/score/:propertyId', {
        preHandler: requireRole('admin', 'moderator'),
    }, async (request, reply) => {
        const params = propertyIdSchema.safeParse(request.params);

        if (!params.success) {
            return reply.status(400).send({ error: 'Invalid property ID' });
        }

        if (!isRiskScoringEnabled()) {
            return reply.send({
                skipped: true,
                reason: 'Risk scoring disabled',
                status: 'ok',
            });
        }

        try {
            const result = await scoreListing(params.data.propertyId);
            return reply.send(result);
        } catch (error) {
            logger.error({ error, propertyId: params.data.propertyId }, 'Failed to score listing');
            return reply.status(500).send({ error: 'Failed to score listing' });
        }
    });

    /**
     * GET /api/risk/:propertyId
     * Get risk status for a listing
     */
    fastify.get<{ Params: { propertyId: string } }>('/risk/:propertyId', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const params = propertyIdSchema.safeParse(request.params);

        if (!params.success) {
            return reply.status(400).send({ error: 'Invalid property ID' });
        }

        const result = await getRiskStatus(params.data.propertyId);

        if (!result) {
            return reply.status(404).send({ error: 'Risk score not found' });
        }

        // Non-admins get limited info (hide detailed reasons)
        const isAdmin = request.user && ['admin', 'moderator'].includes(request.user.role);

        if (!isAdmin) {
            return reply.send({
                risk_level: result.risk_level,
                status: result.status,
            });
        }

        return reply.send(result);
    });

    /**
     * POST /api/admin/risk/override
     * Admin override for risk decision
     */
    fastify.post('/admin/risk/override', {
        preHandler: requireRole('admin', 'moderator'),
    }, async (request, reply) => {
        const body = overrideSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const adminId = request.user!.sub;
        const { propertyId, decision, notes } = body.data;

        try {
            const result = await adminOverride(propertyId, decision, adminId, notes);

            // Audit the override
            await audit({
                actorType: 'user',
                actorId: adminId,
                action: AuditActions.ADMIN_OVERRIDE,
                entity: 'listing_risk_scores',
                entityId: propertyId,
                payload: { decision, notes, finalStatus: result.finalStatus },
            });

            logger.info({ propertyId, decision, adminId }, 'Risk override applied');

            return reply.send({
                success: true,
                propertyId,
                decision,
                finalStatus: result.finalStatus,
            });
        } catch (error) {
            logger.error({ error, propertyId, decision }, 'Failed to apply risk override');
            return reply.status(500).send({ error: 'Failed to apply override' });
        }
    });

    /**
     * GET /api/admin/risk/held
     * Get all listings held for review
     */
    fastify.get('/admin/risk/held', {
        preHandler: requireRole('admin', 'moderator'),
    }, async (_request, reply) => {
        const { query: dbQuery } = await import('../db.js');

        const result = await dbQuery<{
            property_id: string;
            title: string;
            price: number;
            location: string;
            risk_score: number;
            risk_level: string;
            status: string;
            reasons: string;
            created_at: string;
        }>(
            `SELECT 
        rs.property_id,
        pl.title,
        pl.price,
        pl.location,
        rs.risk_score,
        rs.risk_level,
        rs.status,
        rs.reasons,
        rs.created_at
       FROM listing_risk_scores rs
       JOIN property_listings pl ON pl.id = rs.property_id
       WHERE rs.status IN ('hold', 'review_required')
       ORDER BY rs.risk_score DESC, rs.created_at DESC
       LIMIT 50`
        );

        return reply.send({
            count: result.rows.length,
            listings: result.rows.map(row => ({
                ...row,
                reasons: JSON.parse(row.reasons),
            })),
        });
    });
};
