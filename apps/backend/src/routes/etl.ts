/**
 * ETL Routes
 * API endpoints for ETL management and monitoring
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { runETL, getETLStats, retryErrors } from '../jobs/etlJob.js';
import { requireRole } from '../rbac.js';
import { logger } from '../observability/logger.js';

// Schemas
const TriggerETLSchema = z.object({
    limit: z.number().int().min(1).max(200).optional().default(50),
});

const RetryErrorsSchema = z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
});

export const etlRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * GET /etl/stats
     * Get ETL pipeline statistics
     */
    fastify.get('/stats', {
        preHandler: [requireRole('admin')],
        handler: async () => {
            logger.info('Admin requested ETL stats');
            const stats = await getETLStats();
            return { success: true, ...stats };
        },
    });

    /**
     * POST /etl/trigger
     * Manually trigger ETL run
     */
    fastify.post('/trigger', {
        preHandler: [requireRole('admin')],
        handler: async (request) => {
            const { limit } = TriggerETLSchema.parse(request.body ?? {});

            logger.info({ limit }, 'Admin triggered ETL run');

            // Run ETL asynchronously - don't wait for it
            runETL(limit).catch((error) => {
                logger.error({ error }, 'ETL run failed after manual trigger');
            });

            return {
                success: true,
                message: `ETL job triggered with limit ${limit}`,
            };
        },
    });

    /**
     * POST /etl/trigger-sync
     * Manually trigger ETL run and wait for results
     */
    fastify.post('/trigger-sync', {
        preHandler: [requireRole('admin')],
        handler: async (request) => {
            const { limit } = TriggerETLSchema.parse(request.body ?? {});

            logger.info({ limit }, 'Admin triggered sync ETL run');

            const stats = await runETL(limit);

            return {
                success: true,
                message: 'ETL run completed',
                stats,
            };
        },
    });

    /**
     * POST /etl/retry-errors
     * Retry failed URL queue items
     */
    fastify.post('/retry-errors', {
        preHandler: [requireRole('admin')],
        handler: async (request) => {
            const { limit } = RetryErrorsSchema.parse(request.body ?? {});

            logger.info({ limit }, 'Admin requested retry of failed URLs');

            const retried = await retryErrors(limit);

            return {
                success: true,
                message: `Queued ${retried} URLs for retry`,
                retried,
            };
        },
    });
};
