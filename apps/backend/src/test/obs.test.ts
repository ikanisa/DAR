/**
 * Observability Tests
 * Tests for health checks, metrics, and retention jobs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Mock dependencies
vi.mock('../db.js', () => ({
    query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT 1')) {
            return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        if (sql.includes('DELETE FROM')) {
            return { rows: [], rowCount: 10 }; // Simulate 10 deleted rows
        }
        return { rows: [], rowCount: 0 };
    }),
}));

vi.mock('../audit.js', () => ({
    audit: vi.fn(),
    AuditActions: {
        RETENTION_PRUNE: 'system.retention_prune',
    },
}));

vi.mock('../observability/metrics.js', () => ({
    registry: {
        metrics: vi.fn().mockResolvedValue('# HELP http_requests_total Total HTTP requests\n'),
        contentType: 'text/plain',
    },
    metricsMiddleware: vi.fn((req, reply, done) => done()),
}));

vi.mock('../observability/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
    requestLogger: vi.fn(),
}));

vi.mock('node-cron', () => ({
    default: {
        schedule: vi.fn(),
    },
}));

describe('Observability', () => {
    describe('Health Routes', () => {
        let app: FastifyInstance;

        beforeAll(async () => {
            const { healthRoutes } = await import('../routes/health.js');
            app = Fastify({ logger: false });
            await app.register(healthRoutes);
            await app.ready();
        });

        afterAll(async () => {
            await app.close();
        });

        it('GET /health returns ok', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health',
            });
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.body)).toEqual({ status: 'ok', db: 'connected' });
        });

        it('GET /health/detailed returns checks', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health/detailed',
            });
            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('ok');
            expect(body.checks.db).toBe(true);
        });

        it('GET /metrics returns text', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/metrics',
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('text/plain');
            expect(response.body).toContain('# HELP http_requests_total');
        });
    });

    describe('Retention Jobs', () => {
        it('prunes inbound events and logs audit', async () => {
            const { pruneInboundEvents } = await import('../jobs/retention.js');
            const { audit, AuditActions } = await import('../audit.js'); // mock
            const { query } = await import('../db.js'); // mock

            const count = await pruneInboundEvents();

            expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM inbound_events'));
            expect(audit).toHaveBeenCalledWith(expect.objectContaining({
                action: AuditActions.RETENTION_PRUNE,
                entity: 'inbound_events',
                payload: { deleted: 10 },
            }));
            expect(count).toBe(10);
        });

        it('prunes chat sessions and logs audit', async () => {
            const { pruneChatSessions } = await import('../jobs/retention.js');
            const { audit, AuditActions } = await import('../audit.js'); // mock
            const { query } = await import('../db.js'); // mock

            const count = await pruneChatSessions();

            expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM chat_sessions'));
            expect(audit).toHaveBeenCalledWith(expect.objectContaining({
                action: AuditActions.RETENTION_PRUNE,
                entity: 'chat_sessions',
                payload: { deleted: 10 },
            }));
            expect(count).toBe(10);
        });

        it('schedules jobs on start', async () => {
            const { scheduleRetentionJobs } = await import('../jobs/retention.js');
            const cron = await import('node-cron');

            scheduleRetentionJobs();

            expect(cron.default.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
        });
    });
});
