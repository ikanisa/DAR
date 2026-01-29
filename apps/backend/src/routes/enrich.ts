/**
 * Enrichment Routes
 * Admin endpoints for managing geo enrichment
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { runEnrichment, getEnrichmentStats, clearOldCache } from '../jobs/enrichJob.js';
import { logger } from '../observability/logger.js';

interface RunEnrichmentBody {
    limit?: number;
}

export async function enrichRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/enrich/run
     * Manually trigger enrichment job (admin only)
     */
    fastify.post<{ Body: RunEnrichmentBody }>('/enrich/run', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
            if (!request.user || !['admin', 'moderator'].includes(request.user.role || '')) {
                return reply.status(403).send({ error: 'Admin access required' });
            }
        },
    }, async (request, reply) => {
        const body = (request.body || {}) as RunEnrichmentBody;
        const limit = body.limit ?? 50;

        logger.info({ limit, userId: request.user?.sub }, 'Manual enrichment triggered');

        const stats = await runEnrichment(Math.min(limit, 200)); // Cap at 200

        return reply.send({
            success: true,
            stats,
        });
    });

    /**
     * GET /api/enrich/stats
     * Get enrichment statistics (admin only)
     */
    fastify.get('/enrich/stats', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
            if (!request.user || !['admin', 'moderator'].includes(request.user.role || '')) {
                return reply.status(403).send({ error: 'Admin access required' });
            }
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const stats = await getEnrichmentStats();
        return reply.send(stats);
    });

    /**
     * POST /api/enrich/cache/clear
     * Clear old cache entries (admin only)
     */
    fastify.post('/enrich/cache/clear', {
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
            if (!request.user || !['admin', 'moderator'].includes(request.user.role || '')) {
                return reply.status(403).send({ error: 'Admin access required' });
            }
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        logger.info({ userId: request.user?.sub }, 'Cache clear triggered');

        const cleared = await clearOldCache();

        return reply.send({
            success: true,
            cleared,
        });
    });
}
