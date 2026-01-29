import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateListing } from '../tools/validateListing.js';
import { dedupeListing } from '../tools/dedupeListing.js';
import { getReviewQueue } from '../tools/reviewQueue.js';
import { submitAdminDecision } from '../tools/adminDecision.js';

const TOOLS_PREFIX = '/api/tools';

// Injection defense patterns
const BLOCKED_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /api.?key/i,
    /drop\s+table/i,
    /delete\s+from/i,
];

function checkInjection(payload: string): boolean {
    return BLOCKED_PATTERNS.some(p => p.test(payload));
}

export async function toolsRoutes(fastify: FastifyInstance) {

    // Authorization Hook
    fastify.addHook('preHandler', async (request, reply) => {
        const authHeader = request.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        // 1. Check SERVICE_TOKEN (for automated agents)
        if (token && token === process.env.SERVICE_TOKEN) {
            // @ts-ignore - extending request
            request.actor = { type: 'agent', id: 'moltbot' };
            return;
        }

        // 2. Check Admin JWT (for human admins using tools UI)
        try {
            // Expecting Fastify JWT plugin to be registered previously. 
            // If verify fails, it throws.
            await request.jwtVerify();
            const user = request.user as { sub: string, role: string };

            if (user.role === 'admin' || user.role === 'moderator') {
                // @ts-ignore
                request.actor = { type: 'user', id: user.sub };
                return;
            }
        } catch (err) {
            // JWT verification failed
        }

        reply.code(403).send({ error: 'Forbidden: Invalid Service Token or insufficient Admin permissions' });
    });

    // Content Safety Hook
    fastify.addHook('preHandler', async (request, reply) => {
        if (request.body && typeof request.body === 'object') {
            const payloadStr = JSON.stringify(request.body);
            if (checkInjection(payloadStr)) {
                reply.code(400).send({ error: 'Request/Input contained unsafe patterns.' });
            }
        }
    });

    // Routes

    fastify.post(`${TOOLS_PREFIX}/listing/validate`, async (request, reply) => {
        // @ts-ignore
        const actorId = request.actor.id;
        const result = await validateListing(request.body, actorId);
        return result;
    });

    fastify.post(`${TOOLS_PREFIX}/listing/dedupe`, async (request, reply) => {
        // @ts-ignore
        const actorId = request.actor.id;
        const result = await dedupeListing(request.body, actorId);
        return result;
    });

    fastify.get(`${TOOLS_PREFIX}/admin/review-queue`, async (request, reply) => {
        const result = await getReviewQueue();
        return result;
    });

    fastify.post(`${TOOLS_PREFIX}/admin/decision`, async (request, reply) => {
        // @ts-ignore
        const actorId = request.actor.id;
        const result = await submitAdminDecision(request.body, actorId);
        return result;
    });
}
