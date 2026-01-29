/**
 * Notifications API Routes
 * Mock senders for WhatsApp and Telegram
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../rbac.js';
import { audit } from '../audit.js';
import { logger } from '../observability/logger.js';

// Notification schema
const notificationSchema = z.object({
    recipient: z.string().min(1),
    message: z.string().min(1).max(4096),
    template: z.string().optional(),
    data: z.record(z.unknown()).optional(),
});

export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * POST /api/notifications/whatsapp
     * Send a WhatsApp message (mock implementation)
     */
    fastify.post('/notifications/whatsapp', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = notificationSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { recipient, message, template, data } = body.data;
        const actorId = request.user!.sub;

        // Mock implementation - in production, call Meta WhatsApp API
        logger.info({
            provider: 'whatsapp',
            recipient,
            messageLength: message.length,
            template,
        }, 'WhatsApp notification sent (mock)');

        await audit({
            actorType: request.isServiceToken ? 'agent' : 'user',
            actorId,
            action: 'notification.whatsapp',
            entity: 'notifications',
            payload: {
                recipient,
                message_preview: message.slice(0, 100),
                template,
            },
        });

        // Simulated response
        return reply.send({
            success: true,
            provider: 'whatsapp',
            recipient,
            message_id: `wa_mock_${Date.now()}`,
            status: 'sent',
            _mock: true,
        });
    });

    /**
     * POST /api/notifications/telegram
     * Send a Telegram message (mock implementation)
     */
    fastify.post('/notifications/telegram', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = notificationSchema.safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: body.error.issues,
            });
        }

        const { recipient, message, template, data } = body.data;
        const actorId = request.user!.sub;

        // Mock implementation - in production, call Telegram Bot API
        logger.info({
            provider: 'telegram',
            recipient,
            messageLength: message.length,
        }, 'Telegram notification sent (mock)');

        await audit({
            actorType: request.isServiceToken ? 'agent' : 'user',
            actorId,
            action: 'notification.telegram',
            entity: 'notifications',
            payload: {
                recipient,
                message_preview: message.slice(0, 100),
            },
        });

        // Simulated response
        return reply.send({
            success: true,
            provider: 'telegram',
            recipient,
            message_id: `tg_mock_${Date.now()}`,
            status: 'sent',
            _mock: true,
        });
    });
};
