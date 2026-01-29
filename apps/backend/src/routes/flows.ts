/**
 * Flow API Routes
 * Endpoints for flow orchestration
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../rbac.js';
import { logger } from '../observability/logger.js';
import {
    startListingFlow,
    continueListingFlow,
    submitListing,
    startSearchFlow,
    continueSearchFlow,
    executeSearch,
    saveSeekerProfile,
    startOnboardingFlow,
    completeOnboarding,
    type SearchPreferences,
    type ListingSubmission,
} from '../moltbot/index.js';

// Flow message schema
const flowMessageSchema = z.object({
    sessionId: z.string().uuid(),
    message: z.string().min(1),
    context: z.record(z.unknown()).optional(),
});

// Search preferences schema
const searchPreferencesSchema = z.object({
    propertyType: z.enum(['apartment', 'house']).optional(),
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
    bedrooms: z.number().int().min(0).optional(),
    locations: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
});

// Listing submission schema
const listingSubmissionSchema = z.object({
    sessionId: z.string().uuid(),
    title: z.string().min(10),
    description: z.string().min(100),
    propertyType: z.enum(['apartment', 'house', 'land', 'commercial']),
    priceAmount: z.number().positive(),
    addressText: z.string().min(5),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    sizeSqm: z.number().positive().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
});

export const flowsRoutes: FastifyPluginAsync = async (fastify) => {

    // ============== LISTING FLOW ==============

    /**
     * POST /api/flows/listing/start
     * Start a new listing submission flow
     */
    fastify.post('/flows/listing/start', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = flowMessageSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const userId = request.user!.sub;
        const { sessionId, message } = body.data;

        const result = await startListingFlow(userId, sessionId, message);

        return reply.send(result);
    });

    /**
     * POST /api/flows/listing/message
     * Continue listing flow with a message
     */
    fastify.post('/flows/listing/message', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = flowMessageSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const { sessionId, message, context } = body.data;

        const result = await continueListingFlow(sessionId, message, context);

        return reply.send(result);
    });

    /**
     * POST /api/flows/listing/submit
     * Submit a completed listing
     */
    fastify.post('/flows/listing/submit', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = listingSubmissionSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const userId = request.user!.sub;

        const submission: ListingSubmission = {
            userId,
            ...body.data,
        };

        const result = await submitListing(submission);

        return reply.status(result.success ? 201 : 400).send(result);
    });

    // ============== SEARCH FLOW ==============

    /**
     * POST /api/flows/search/start
     * Start a new property search flow
     */
    fastify.post('/flows/search/start', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = flowMessageSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const userId = request.user!.sub;
        const { sessionId, message } = body.data;

        const result = await startSearchFlow(userId, sessionId, message);

        return reply.send(result);
    });

    /**
     * POST /api/flows/search/message
     * Continue search flow with a message
     */
    fastify.post('/flows/search/message', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = flowMessageSchema.safeParse(request.body);
        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const { sessionId, message, context } = body.data;

        const result = await continueSearchFlow(sessionId, message, context);

        return reply.send(result);
    });

    /**
     * POST /api/flows/search/execute
     * Execute a search with preferences
     */
    fastify.post('/flows/search/execute', {
        preHandler: requireAuth,
    }, async (request, reply) => {
        const body = z.object({
            preferences: searchPreferencesSchema,
            saveProfile: z.boolean().optional(),
        }).safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const userId = request.user!.sub;
        const { preferences, saveProfile } = body.data;

        const results = await executeSearch(userId, preferences);

        if (saveProfile) {
            await saveSeekerProfile(userId, preferences);
        }

        return reply.send({
            results,
            count: results.length,
            profileSaved: saveProfile || false,
        });
    });

    // ============== ONBOARDING FLOW ==============

    /**
     * POST /api/flows/onboarding/start
     * Start onboarding for a new user
     */
    fastify.post('/flows/onboarding/start', async (request, reply) => {
        const body = z.object({
            sessionId: z.string().uuid(),
            channel: z.enum(['webchat', 'telegram', 'whatsapp']),
            peerId: z.string().min(1),
            message: z.string().min(1),
        }).safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const { sessionId, channel, peerId, message } = body.data;

        const result = await startOnboardingFlow(sessionId, channel, peerId, message);

        return reply.send(result);
    });

    /**
     * POST /api/flows/onboarding/complete
     * Complete onboarding and create user account
     */
    fastify.post('/flows/onboarding/complete', async (request, reply) => {
        const body = z.object({
            sessionId: z.string().uuid(),
            name: z.string().optional(),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            role: z.enum(['seeker', 'poster']),
            channel: z.enum(['webchat', 'telegram', 'whatsapp']),
            channelPeerId: z.string().min(1),
        }).safeParse(request.body);

        if (!body.success) {
            return reply.status(400).send({ error: 'Validation failed', details: body.error.issues });
        }

        const { sessionId, ...data } = body.data;

        const result = await completeOnboarding(sessionId, data);

        return reply.status(result.isNew ? 201 : 200).send(result);
    });
};
