/**
 * RBAC Middleware
 * JWT validation + role-based access control
 */

import type { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { getConfig } from './config.js';
import { logger } from './observability/logger.js';

export type UserRole = 'seeker' | 'poster' | 'admin' | 'moderator';

export interface JWTPayload {
    sub: string;       // user id
    role: UserRole;
    email?: string;
    name?: string;
    iat: number;
    exp: number;
}

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: JWTPayload;
        user: JWTPayload;
    }
}

declare module 'fastify' {
    interface FastifyRequest {
        isServiceToken?: boolean;
    }
}

const rbacPlugin: FastifyPluginAsync = async (fastify) => {
    const config = getConfig();

    await fastify.register(fastifyJwt, {
        secret: config.JWT_SECRET,
        sign: {
            expiresIn: '7d',
        },
    });

    // Decorate request with auth helpers (user is already decorated by @fastify/jwt)
    fastify.decorateRequest('isServiceToken', false);
};

export const rbac = fp(rbacPlugin, {
    name: 'rbac',
    fastify: '4.x',
});

/**
 * Middleware: Require authentication (JWT or Service Token)
 */
export async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        return reply.status(401).send({ error: 'Authorization required' });
    }

    // Check for service token (for Moltbot tool calls)
    if (authHeader.startsWith('Bearer service:')) {
        const token = authHeader.slice('Bearer service:'.length);
        const config = getConfig();

        if (token === config.SERVICE_TOKEN) {
            request.isServiceToken = true;
            request.user = {
                sub: 'service',
                role: 'admin',
                iat: Date.now() / 1000,
                exp: Date.now() / 1000 + 3600,
            };
            return;
        } else {
            return reply.status(401).send({ error: 'Invalid service token' });
        }
    }

    // Standard JWT auth
    try {
        const decoded = await request.jwtVerify<JWTPayload>();
        request.user = decoded;
    } catch (err) {
        logger.warn({ err }, 'JWT verification failed');
        return reply.status(401).send({ error: 'Invalid token' });
    }
}

/**
 * Middleware factory: Require specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await requireAuth(request, reply);

        if (reply.sent) return; // Already replied with error

        if (!request.user) {
            return reply.status(401).send({ error: 'Not authenticated' });
        }

        // Service tokens have admin role, which has access to everything
        if (request.isServiceToken) {
            return;
        }

        if (!allowedRoles.includes(request.user.role)) {
            logger.warn({
                userId: request.user.sub,
                role: request.user.role,
                requiredRoles: allowedRoles,
            }, 'Role access denied');

            return reply.status(403).send({
                error: 'Insufficient permissions',
                required: allowedRoles,
                current: request.user.role,
            });
        }
    };
}

/**
 * Helper: Check if user has role (for conditional logic)
 */
export function hasRole(user: JWTPayload | undefined, ...roles: UserRole[]): boolean {
    if (!user) return false;
    return roles.includes(user.role);
}

/**
 * Helper: Check if user is admin or moderator
 */
export function isStaff(user: JWTPayload | undefined): boolean {
    return hasRole(user, 'admin', 'moderator');
}
