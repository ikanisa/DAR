/**
 * Discovery Routes
 * Admin-only endpoints for managing URL discovery and domain policies
 */

import type { FastifyPluginAsync } from 'fastify';
import { runDiscovery, getQueueStats } from '../jobs/discoveryJob.js';
import { getApiUsage } from '../integrations/aiSearch.js';
import { query } from '../db.js';
import { requireRole } from '../rbac.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';

export const discoveryRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * POST /api/discovery/run
     * Trigger a discovery run (admin only)
     */
    fastify.post('/discovery/run', {
        preHandler: requireRole('admin'),
    }, async (request, reply) => {
        const body = request.body as { mode?: 'daily' | 'manual' } | undefined;
        const mode = body?.mode || 'manual';

        logger.info({ userId: request.user?.sub, mode }, 'Manual discovery run triggered');

        try {
            const stats = await runDiscovery(mode);
            return reply.send({ success: true, stats });
        } catch (error) {
            logger.error({ error }, 'Discovery run failed');
            return reply.status(500).send({
                error: 'Discovery run failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    /**
     * GET /api/discovery/stats
     * Get discovery statistics (admin only)
     */
    fastify.get('/discovery/stats', {
        preHandler: requireRole('admin'),
    }, async (_request, reply) => {
        const queueStats = await getQueueStats();
        const apiUsage = await getApiUsage('ai_search');

        // Get recent usage history (last 7 days)
        const usageHistory = await query<{ date: string; calls_count: number }>(`
            SELECT date::text, calls_count
            FROM api_usage 
            WHERE api_name = 'ai_search'
            ORDER BY date DESC
            LIMIT 7
        `);

        return reply.send({
            queue: queueStats,
            apiUsage: {
                ...apiUsage,
                history: usageHistory.rows,
            },
        });
    });

    /**
     * GET /api/discovery/domains
     * List all domain policies (admin only)
     */
    fastify.get('/discovery/domains', {
        preHandler: requireRole('admin'),
    }, async (_request, reply) => {
        const result = await query(`
            SELECT 
                domain,
                allowed_to_fetch,
                allowed_to_republish,
                fields_allowed,
                notes,
                created_at,
                updated_at
            FROM domain_policy 
            ORDER BY domain
        `);

        return reply.send({ domains: result.rows });
    });

    /**
     * POST /api/discovery/domains
     * Add or update a domain policy (admin only)
     */
    fastify.post('/discovery/domains', {
        preHandler: requireRole('admin'),
    }, async (request, reply) => {
        const body = request.body as {
            domain: string;
            allowed_to_fetch: boolean;
            allowed_to_republish: boolean;
            fields_allowed?: string[];
            notes?: string;
        };

        const {
            domain,
            allowed_to_fetch,
            allowed_to_republish,
            fields_allowed = ['title', 'price', 'bedrooms', 'url'],
            notes
        } = body;

        if (!domain) {
            return reply.status(400).send({ error: 'Domain is required' });
        }

        // Normalize domain (remove protocol, www, trailing slashes)
        const normalizedDomain = domain
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/+$/, '');

        await query(`
            INSERT INTO domain_policy (domain, allowed_to_fetch, allowed_to_republish, fields_allowed, notes)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (domain) DO UPDATE SET
                allowed_to_fetch = $2,
                allowed_to_republish = $3,
                fields_allowed = $4,
                notes = $5,
                updated_at = now()
        `, [normalizedDomain, allowed_to_fetch, allowed_to_republish, JSON.stringify(fields_allowed), notes || null]);

        await audit({
            actorType: 'user',
            actorId: request.user?.sub || 'unknown',
            action: AuditActions.DOMAIN_POLICY_UPDATE,
            entity: 'domain_policy',
            entityId: normalizedDomain,
            payload: { allowed_to_fetch, allowed_to_republish, fields_allowed, notes },
        });

        logger.info({ domain: normalizedDomain, allowed_to_fetch, userId: request.user?.sub }, 'Domain policy updated');

        return reply.send({ success: true, domain: normalizedDomain });
    });

    /**
     * DELETE /api/discovery/domains/:domain
     * Delete a domain policy (admin only)
     */
    fastify.delete<{ Params: { domain: string } }>('/discovery/domains/:domain', {
        preHandler: requireRole('admin'),
    }, async (request, reply) => {
        const { domain } = request.params;

        const result = await query(
            'DELETE FROM domain_policy WHERE domain = $1 RETURNING domain',
            [domain]
        );

        if (result.rowCount === 0) {
            return reply.status(404).send({ error: 'Domain not found' });
        }

        await audit({
            actorType: 'user',
            actorId: request.user?.sub || 'unknown',
            action: AuditActions.DOMAIN_POLICY_DELETE,
            entity: 'domain_policy',
            entityId: domain,
        });

        logger.info({ domain, userId: request.user?.sub }, 'Domain policy deleted');

        return reply.send({ success: true, domain });
    });

    /**
     * GET /api/discovery/queue
     * Get URL queue items with filtering (admin only)
     */
    fastify.get('/discovery/queue', {
        preHandler: requireRole('admin'),
    }, async (request, reply) => {
        const qs = request.query as { status?: string; domain?: string; limit?: string };
        const { status, domain, limit = '50' } = qs;

        let sql = 'SELECT * FROM url_queue WHERE 1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (status) {
            sql += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        if (domain) {
            sql += ` AND domain = $${paramIndex++}`;
            params.push(domain);
        }

        sql += ` ORDER BY discovered_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit, 10));

        const result = await query(sql, params);

        return reply.send({ urls: result.rows });
    });

    /**
     * PATCH /api/discovery/queue/:id
     * Update URL queue item status (admin only)
     */
    fastify.patch<{ Params: { id: string } }>('/discovery/queue/:id', {
        preHandler: requireRole('admin'),
    }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body as { status: string; last_error?: string };
        const { status, last_error } = body;

        const validStatuses = ['new', 'processing', 'done', 'blocked', 'error'];
        if (!validStatuses.includes(status)) {
            return reply.status(400).send({
                error: 'Invalid status',
                validStatuses
            });
        }

        const updates: string[] = ['status = $2'];
        const params: (string | null)[] = [id, status];
        let paramIndex = 3;

        if (status === 'done' || status === 'error') {
            updates.push(`processed_at = now()`);
        }

        if (last_error !== undefined) {
            updates.push(`last_error = $${paramIndex++}`);
            params.push(last_error);
        }

        if (status === 'error') {
            updates.push('retry_count = retry_count + 1');
        }

        const result = await query(`
            UPDATE url_queue 
            SET ${updates.join(', ')}
            WHERE id = $1
            RETURNING *
        `, params);

        if (result.rowCount === 0) {
            return reply.status(404).send({ error: 'URL not found' });
        }

        return reply.send({ success: true, url: result.rows[0] });
    });
};
