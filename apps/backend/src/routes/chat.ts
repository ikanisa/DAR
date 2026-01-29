/**
 * Chat API Routes
 * Message ingestion and session management
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../db.js';
import { requireAuth } from '../rbac.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

// Ingest message schema
const ingestMessageSchema = z.object({
    event_id: z.string().min(1),
    source: z.string().min(1),
    channel: z.enum(['webchat', 'telegram', 'whatsapp']),
    peer_id: z.string().min(1),
    user_id: z.string().uuid().optional(),
    message: z.string().min(1),
    metadata: z.record(z.unknown()).optional(),
});

// Session state schema
const sessionStateSchema = z.object({
    state: z.record(z.unknown()),
});

export const chatRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/chat/ingest
     * Ingest an incoming message from a channel (idempotent by event_id)
     */
    fastify.post('/chat/ingest', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = ingestMessageSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { event_id, source, channel, peer_id, user_id, message, metadata } = body.data;

        // Idempotency check: try to insert event
        try {
            await query(
                `INSERT INTO inbound_events (id, source, payload) VALUES ($1, $2, $3)`,
                [event_id, source, JSON.stringify({ channel, peer_id, message, metadata })]
            );
        } catch (err: any) {
            if (err.code === '23505') { // Unique violation
                logger.debug({ event_id }, 'Duplicate event, skipping');
                return reply.send({
                    success: true,
                    duplicate: true,
                    event_id,
                    message: 'Event already processed',
                });
            }
            throw err;
        }

        // Find or create user if not provided
        let resolvedUserId = user_id;

        if (!resolvedUserId) {
            // Try to find user by channel ID
            const channelIdField = channel === 'telegram' ? 'telegram_id' :
                channel === 'whatsapp' ? 'whatsapp_id' : null;

            if (channelIdField) {
                const userResult = await query(
                    `SELECT id FROM users WHERE ${channelIdField} = $1`,
                    [peer_id]
                );

                if (userResult.rows.length > 0) {
                    resolvedUserId = userResult.rows[0].id;
                } else {
                    // Create new user
                    const newUser = await query<{ id: string }>(
                        `INSERT INTO users (role, ${channelIdField}) VALUES ('seeker', $1) RETURNING id`,
                        [peer_id]
                    );
                    resolvedUserId = newUser.rows[0].id;
                    logger.info({ userId: resolvedUserId, channel, peer_id }, 'New user created from chat');
                }
            }
        }

        if (!resolvedUserId) {
            return reply.status(400).send({ error: 'Unable to resolve user identity' });
        }

        // Find or create chat session
        const agentId = channel === 'whatsapp' ? 'poster-agent' :
            channel === 'telegram' ? 'seeker-agent' : 'admin-agent';

        const sessionResult = await query<{ id: string; state: object }>(
            `INSERT INTO chat_sessions (user_id, channel, peer_id, agent_id, state)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, channel, peer_id)
       DO UPDATE SET updated_at = NOW()
       RETURNING id, state`,
            [resolvedUserId, channel, peer_id, agentId, JSON.stringify({ messages: [] })]
        );

        const sessionId = sessionResult.rows[0].id;

        await audit({
            actorType: 'user',
            actorId: resolvedUserId,
            action: AuditActions.CHAT_INGEST,
            entity: 'chat_sessions',
            entityId: sessionId,
            payload: { channel, message_preview: message.slice(0, 100) },
        });

        logger.info({ sessionId, userId: resolvedUserId, channel }, 'Message ingested');

        return reply.send({
            success: true,
            duplicate: false,
            event_id,
            session_id: sessionId,
            user_id: resolvedUserId,
            agent_id: agentId,
        });
    });

    /**
     * GET /api/chat/session/:id
     * Get chat session state
     */
    fastify.get<{ Params: { id: string } }>('/chat/session/:id', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const sessionId = request.params.id;

        if (!z.string().uuid().safeParse(sessionId).success) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        const result = await query(
            `SELECT cs.*, u.name as user_name, u.role as user_role
       FROM chat_sessions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.id = $1`,
            [sessionId]
        );

        if (result.rows.length === 0) {
            return reply.status(404).send({ error: 'Session not found' });
        }

        return reply.send(result.rows[0]);
    });

    /**
     * PATCH /api/chat/session/:id/state
     * Update chat session state
     */
    fastify.patch<{ Params: { id: string } }>('/chat/session/:id/state', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const sessionId = request.params.id;

        if (!z.string().uuid().safeParse(sessionId).success) {
            return reply.status(400).send({ error: 'Invalid session ID' });
        }

        const body = sessionStateSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        await query(
            `UPDATE chat_sessions SET state = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(body.data.state), sessionId]
        );

        return reply.send({ success: true, session_id: sessionId });
    });
};
