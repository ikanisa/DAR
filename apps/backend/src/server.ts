/**
 * Dar Backend - Fastify Server
 * Entry point for the Real Estate PWA backend API
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from './config.js';
import { rbac } from './rbac.js';
import { closePool } from './db.js';
import { logger, requestLogger } from './observability/logger.js';
import { metricsMiddleware } from './observability/metrics.js';

// Routes
import { listingsRoutes } from './routes/listings.js';
import { searchRoutes } from './routes/search.js';
import { reviewsRoutes } from './routes/reviews.js';
import { viewingsRoutes } from './routes/viewings.js';
import { chatRoutes } from './routes/chat.js';
import { notificationsRoutes } from './routes/notifications.js';
import { toolsRoutes } from './routes/tools.js';
import { healthRoutes } from './routes/health.js';
import { flowsRoutes } from './routes/flows.js';
import { webchatRoutes } from './routes/webchat.js';
import { riskRoutes } from './routes/risk.js';
import { discoveryRoutes } from './routes/discovery.js';
import { evidenceRoutes } from './routes/evidence.js';
import { etlRoutes } from './routes/etl.js';
import { enrichRoutes } from './routes/enrich.js';
import { scheduleDiscovery } from './jobs/discoveryJob.js';
import { scheduleETL } from './jobs/etlJob.js';
import { scheduleEnrichment } from './jobs/enrichJob.js';
import { scheduleRetentionJobs } from './jobs/retention.js';
import { reportRoutes } from './routes/reports.js';
import { scheduleOpsJobs } from './jobs/opsJob.js';

async function buildServer() {
    const config = getConfig();

    const fastify = Fastify({
        logger: false, // We use our own pino logger
        trustProxy: true,
    });

    // CORS
    await fastify.register(cors, {
        origin: config.NODE_ENV === 'production'
            ? ['https://dar.mt', 'https://www.dar.mt']
            : true,
        credentials: true,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        keyGenerator: (request) => {
            return request.user?.sub || request.ip;
        },
    });

    // RBAC (JWT + role middleware)
    await fastify.register(rbac);

    // Request logging and metrics
    fastify.addHook('onRequest', (request, reply, done) => {
        // Cast to any to avoid strict type checks on the middleware signature if needed, 
        // but it should match (req, rep, done)
        metricsMiddleware(request, reply, done);
    });

    fastify.addHook('onRequest', (request, reply, done) => {
        requestLogger(request, reply, done);
    });

    // Health routes (no /api prefix)
    await fastify.register(healthRoutes);

    // API routes
    await fastify.register(async (api) => {
        await api.register(listingsRoutes);
        await api.register(searchRoutes);
        await api.register(reviewsRoutes);
        await api.register(viewingsRoutes);
        await api.register(chatRoutes);
        await api.register(notificationsRoutes);
        await api.register(toolsRoutes);
        await api.register(flowsRoutes);
        await api.register(webchatRoutes);
        await api.register(riskRoutes);
        await api.register(discoveryRoutes);
        await api.register(evidenceRoutes);
        await api.register(etlRoutes, { prefix: '/etl' });
        await api.register(enrichRoutes);
        await api.register(reportRoutes);
    }, { prefix: '/api' });

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
        logger.error({
            err: error,
            url: request.url,
            method: request.method,
            userId: request.user?.sub,
        }, 'Request error');

        // Don't leak internal errors in production
        if (config.NODE_ENV === 'production' && error.statusCode === undefined) {
            return reply.status(500).send({ error: 'Internal server error' });
        }

        return reply.status(error.statusCode || 500).send({
            error: error.message,
            code: error.code,
        });
    });

    // Not found handler
    fastify.setNotFoundHandler((_request, reply) => {
        return reply.status(404).send({ error: 'Not found' });
    });

    return fastify;
}

async function start() {
    const config = getConfig();

    logger.info({
        env: config.NODE_ENV,
        port: config.PORT,
    }, 'Starting Dar backend server');

    const server = await buildServer();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Shutting down...');
        await server.close();
        await closePool();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    try {
        await server.listen({
            port: config.PORT,
            host: '0.0.0.0',
        });

        logger.info(`Server listening on http://0.0.0.0:${config.PORT}`);

        // Schedule discovery job (runs daily at 6 AM Malta time)
        scheduleDiscovery();

        // Schedule ETL job (runs every 2 hours)
        scheduleETL();

        // Schedule enrichment job (runs every 4 hours)
        scheduleEnrichment();

        // Schedule retention jobs (runs daily at 3 AM)
        scheduleRetentionJobs();

        // Schedule ops jobs (weekly brief + anomaly detection)
        scheduleOpsJobs();
    } catch (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
}

// Extend FastifyRequest
declare module 'fastify' {
    interface FastifyRequest {
        requestStartTime?: number;
    }
}

start();
