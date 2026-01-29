/**
 * WebChat Proxy Routes
 * Proxies PWA chat requests to Moltbot gateway (keeping token server-side)
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getMoltbotClient } from '../moltbot/MoltbotClient.js';
import { query } from '../db.js';
import { requireAuth } from '../rbac.js';
import { audit } from '../audit.js';
import { logger } from '../observability/logger.js';

// Chat send schema
const chatSendSchema = z.object({
    message: z.string().min(1).max(4096),
    sessionId: z.string().uuid().optional(),
});

export const webchatRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/webchat/send
     * Send a message through the WebChat (proxied to Moltbot)
     */
    fastify.post('/webchat/send', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = chatSendSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const userId = request.user!.sub;
        const { message, sessionId: providedSessionId } = body.data;

        // Get or create session
        let sessionId = providedSessionId;

        if (!sessionId) {
            // Create new session
            const result = await query<{ id: string }>(
                `INSERT INTO chat_sessions (user_id, channel, peer_id, agent_id, state)
         VALUES ($1, 'webchat', $2, 'admin-agent', $3)
         RETURNING id`,
                [userId, userId, JSON.stringify({ messages: [] })]
            );
            sessionId = result.rows[0].id;
        }

        // Send to Moltbot
        const client = getMoltbotClient();
        const result = await client.sendMessage({
            agentId: 'admin-agent',
            sessionId,
            message,
            context: { userId, channel: 'webchat' },
        });

        // Audit
        await audit({
            actorType: 'user',
            actorId: userId,
            action: 'webchat.send',
            entity: 'chat_sessions',
            entityId: sessionId,
            payload: { messageLength: message.length },
        });

        if (result.success) {
            // Update session state with new message
            await query(
                `UPDATE chat_sessions 
         SET state = state || $1::jsonb, updated_at = NOW() 
         WHERE id = $2`,
                [
                    JSON.stringify({ lastMessage: message, lastResponse: result.response }),
                    sessionId,
                ]
            );
        }

        return reply.send({
            success: result.success,
            sessionId,
            response: result.response,
            error: result.error,
        });
    });

    /**
     * GET /api/webchat/session
     * Get current user's active session
     */
    fastify.get('/webchat/session', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const userId = request.user!.sub;

        const result = await query(
            `SELECT id, state, created_at, updated_at
       FROM chat_sessions
       WHERE user_id = $1 AND channel = 'webchat'
       ORDER BY updated_at DESC
       LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return reply.send({ session: null });
        }

        return reply.send({ session: result.rows[0] });
    });

    /**
     * GET /api/webchat/history/:sessionId
     * Get chat history for a session
     */
    fastify.get<{ Params: { sessionId: string } }>('/webchat/history/:sessionId', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const { sessionId } = request.params;
        const userId = request.user!.sub;

        if (!z.string().uuid().safeParse(sessionId).success) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        // Verify ownership
        const session = await query(
            'SELECT id, user_id, state FROM chat_sessions WHERE id = $1',
            [sessionId]
        );

        if (session.rows.length === 0) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        if (session.rows[0].user_id !== userId && request.user!.role !== 'admin') {
            return reply.status(403).send({ error: 'Not authorized' });
        }

        // Get history from Moltbot
        const client = getMoltbotClient();
        const history = await client.getSession(sessionId);

        return reply.send({
            sessionId,
            messages: history || [],
            state: session.rows[0].state,
        });
    });

    /**
     * DELETE /api/webchat/session/:sessionId
     * End a chat session
     */
    fastify.delete<{ Params: { sessionId: string } }>('/webchat/session/:sessionId', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const { sessionId } = request.params;
        const userId = request.user!.sub;

        if (!z.string().uuid().safeParse(sessionId).success) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        // Verify ownership
        const session = await query(
            'SELECT user_id FROM chat_sessions WHERE id = $1',
            [sessionId]
        );

        if (session.rows.length === 0) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        if (session.rows[0].user_id !== userId && request.user!.role !== 'admin') {
            return reply.status(403).send({ error: 'Not authorized' });
        }

        // End in Moltbot
        const client = getMoltbotClient();
        await client.endSession(sessionId);

        // Mark as ended in DB
        await query(
            `UPDATE chat_sessions 
       SET state = state || '{"ended": true}'::jsonb, updated_at = NOW() 
       WHERE id = $1`,
            [sessionId]
        );

        return reply.send({ success: true });
    });
};
