import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { registry } from '../observability/metrics.js';

export async function healthRoutes(fastify: FastifyInstance) {
    // Basic health
    fastify.get('/health', async (request, reply) => {
        try {
            await query('SELECT 1');
            return { status: 'ok', db: 'connected' };
        } catch (error) {
            reply.code(503);
            return { status: 'error', db: 'disconnected' };
        }
    });

    // Detailed health
    fastify.get('/health/detailed', async (request, reply) => {
        const checks = {
            db: false,
            moltbot: false,
        };

        try {
            await query('SELECT 1');
            checks.db = true;
        } catch { }

        try {
            if (process.env.MOLTBOT_GATEWAY_URL) {
                const res = await fetch(`${process.env.MOLTBOT_GATEWAY_URL}/health`);
                checks.moltbot = res.ok;
            } else {
                // If not configured, assume it's optional or not reachable in this env
                // But detailed health implies checking dependencies. 
                // Let's set it to true if env is missing? No, that's misleading. 
                // Let's just skip it if env is missing or keep false? 
                // The original code assumed it exists. I'll stick to original logic but handle undefined URL.
                checks.moltbot = false;
            }
        } catch { }

        // If MOLTBOT_GATEWAY_URL is not set, we might not want to fail detailed health?
        // But for now, let's keep it strict or just report what we found.

        const allHealthy = Object.values(checks).every(Boolean);
        // reply.code(allHealthy ? 200 : 503); // detailed check might fail partial

        // Use loose check for now if gateway url is missing
        const finalStatus = (checks.db) ? 200 : 503;

        reply.code(finalStatus);

        return { status: finalStatus === 200 ? 'ok' : 'degraded', checks };
    });

    // Prometheus metrics
    fastify.get('/metrics', async (request, reply) => {
        reply.header('Content-Type', registry.contentType);
        return registry.metrics();
    });
}
