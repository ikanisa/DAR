/**
 * Health API Routes
 * Health checks and metrics
 */

import type { FastifyPluginAsync } from 'fastify';
import { healthCheck } from '../db.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * GET /health
     * Basic health check
     */
    fastify.get('/health', async (request, reply) => {
        const dbHealthy = await healthCheck();

        const status = dbHealthy ? 'ok' : 'degraded';
        const statusCode = dbHealthy ? 200 : 503;

        return reply.status(statusCode).send({
            status,
            timestamp: new Date().toISOString(),
            checks: {
                database: dbHealthy ? 'ok' : 'fail',
            },
        });
    });

    /**
     * GET /health/ready
     * Readiness probe
     */
    fastify.get('/health/ready', async (request, reply) => {
        const dbHealthy = await healthCheck();

        if (!dbHealthy) {
            return reply.status(503).send({ ready: false });
        }

        return reply.send({ ready: true });
    });

    /**
     * GET /health/live
     * Liveness probe
     */
    fastify.get('/health/live', async (_request, reply) => {
        return reply.send({ alive: true });
    });
};
