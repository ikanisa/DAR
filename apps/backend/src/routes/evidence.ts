/**
 * Evidence API Routes
 * Endpoints for generating evidence packs (JSON/PDF/ZIP)
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../rbac.js';
import { buildEvidencePack, canAccessEvidence, renderPdf, renderZip } from '../evidence/index.js';
import { logger } from '../observability/logger.js';

// Query schema
const evidenceQuerySchema = z.object({
    format: z.enum(['json', 'pdf', 'zip']).default('json'),
    include: z.enum(['basic', 'full']).default('full'),
});

// Params schema
const listingIdSchema = z.object({
    id: z.string().uuid(),
});

export const evidenceRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * GET /api/evidence/listing/:id
     * Generate evidence pack for a listing
     * 
     * Query params:
     * - format: json | pdf | zip (default: json)
     * - include: basic | full (default: full)
     * 
     * Auth:
     * - Admin/moderator: full access
     * - Poster: own listings only
     * - Seeker: blocked (403)
     */
    fastify.get<{
        Params: { id: string };
        Querystring: { format?: string; include?: string };
    }>('/evidence/listing/:id', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        // Validate params
        const paramsResult = listingIdSchema.safeParse(request.params);
        if (!paramsResult.success) {
            return reply.status(400).send({
                error: 'Invalid listing ID',
                details: paramsResult.error.issues,
            });
        }

        // Validate query
        const queryResult = evidenceQuerySchema.safeParse(request.query);
        if (!queryResult.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: queryResult.error.issues,
            });
        }

        const { id: listingId } = paramsResult.data;
        const { format, include } = queryResult.data;

        logger.info({ listingId, format, include, userId: request.user?.sub }, 'Evidence pack requested');

        // Check access
        const access = await canAccessEvidence(request.user, listingId);
        if (!access.allowed) {
            logger.warn({ listingId, userId: request.user?.sub, reason: access.reason }, 'Evidence access denied');
            return reply.status(403).send({
                error: 'Forbidden',
                reason: access.reason,
            });
        }

        try {
            // Build evidence pack
            const pack = await buildEvidencePack(
                listingId,
                {
                    type: request.user?.role === 'admin' ? 'user' : 'user',
                    id: request.user?.sub || 'unknown',
                    role: request.user?.role || 'unknown',
                },
                {
                    includeViewings: include === 'full',
                    format,
                }
            );

            // Return based on format
            if (format === 'json') {
                return reply.send(pack);
            }

            if (format === 'pdf') {
                const pdf = await renderPdf(pack);
                return reply
                    .header('Content-Type', 'application/pdf')
                    .header('Content-Disposition', `attachment; filename="evidence-${listingId}.pdf"`)
                    .send(pdf);
            }

            if (format === 'zip') {
                const zip = await renderZip(pack);
                return reply
                    .header('Content-Type', 'application/zip')
                    .header('Content-Disposition', `attachment; filename="evidence-${listingId}.zip"`)
                    .send(zip);
            }

            // Fallback (should not reach here)
            return reply.status(400).send({ error: 'Invalid format' });

        } catch (err) {
            logger.error({ err, listingId }, 'Failed to generate evidence pack');

            if (err instanceof Error && err.message.includes('not found')) {
                return reply.status(404).send({ error: 'Listing not found' });
            }

            return reply.status(500).send({ error: 'Failed to generate evidence pack' });
        }
    });

    /**
     * GET /api/evidence/viewing/:id
     * Generate evidence pack for a specific viewing
     * Includes listing + viewing timeline
     */
    fastify.get<{
        Params: { id: string };
        Querystring: { format?: string };
    }>('/evidence/viewing/:id', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        // Validate params
        const paramsResult = z.object({ id: z.string().uuid() }).safeParse(request.params);
        if (!paramsResult.success) {
            return reply.status(400).send({
                error: 'Invalid viewing ID',
                details: paramsResult.error.issues,
            });
        }

        const { id: viewingId } = paramsResult.data;

        // For now, viewing evidence is admin-only
        if (request.user?.role !== 'admin' && request.user?.role !== 'moderator') {
            return reply.status(403).send({
                error: 'Forbidden',
                reason: 'Viewing evidence requires admin access',
            });
        }

        // TODO: Implement viewing-specific evidence pack
        // This would fetch the viewing, its associated listing, and build a combined pack

        return reply.status(501).send({
            error: 'Not implemented',
            message: 'Viewing evidence packs are not yet implemented. Use /api/evidence/listing/:id instead.',
            viewingId,
        });
    });
};
