/**
 * Search API Routes
 * Property search with filters and ranking
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { logger } from '../observability/logger.js';

// Search query schema
const searchSchema = z.object({
    type: z.enum(['apartment', 'house', 'land', 'commercial']).optional(),
    min_price: z.coerce.number().positive().optional(),
    max_price: z.coerce.number().positive().optional(),
    bedrooms: z.coerce.number().int().min(0).optional(),
    min_bedrooms: z.coerce.number().int().min(0).optional(),
    max_bedrooms: z.coerce.number().int().optional(),
    location: z.string().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius_km: z.coerce.number().positive().default(10),
    status: z.enum(['published', 'approved', 'all']).default('published'),
    sort: z.enum(['price_asc', 'price_desc', 'newest', 'quality']).default('newest'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

export const searchRoutes: FastifyPluginAsync = async (fastify) => {

    /**
     * GET /api/listings/search
     * Search listings with filters
     */
    fastify.get('/listings/search', async (request, reply) => {
        const params = searchSchema.safeParse(request.query);

        if (!params.success) {
            return reply.status(400).send({
                error: 'Invalid search parameters',
                details: params.error.issues,
            });
        }

        const filters = params.data;
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        // Status filter
        if (filters.status === 'all') {
            // For admin/service, allow all non-draft
            conditions.push(`l.status != 'draft'`);
        } else if (filters.status === 'approved') {
            conditions.push(`l.status IN ('approved', 'published')`);
        } else {
            conditions.push(`l.status = 'published'`);
        }

        // Type filter
        if (filters.type) {
            conditions.push(`l.type = $${paramIndex++}`);
            values.push(filters.type);
        }

        // Price range
        if (filters.min_price) {
            conditions.push(`l.price_amount >= $${paramIndex++}`);
            values.push(filters.min_price);
        }
        if (filters.max_price) {
            conditions.push(`l.price_amount <= $${paramIndex++}`);
            values.push(filters.max_price);
        }

        // Bedroom filters
        if (filters.bedrooms !== undefined) {
            conditions.push(`l.bedrooms = $${paramIndex++}`);
            values.push(filters.bedrooms);
        } else {
            if (filters.min_bedrooms !== undefined) {
                conditions.push(`l.bedrooms >= $${paramIndex++}`);
                values.push(filters.min_bedrooms);
            }
            if (filters.max_bedrooms !== undefined) {
                conditions.push(`l.bedrooms <= $${paramIndex++}`);
                values.push(filters.max_bedrooms);
            }
        }

        // Location text search
        if (filters.location) {
            conditions.push(`l.address_text ILIKE $${paramIndex++}`);
            values.push(`%${filters.location}%`);
        }

        // Geo search (simple bounding box for now)
        if (filters.lat !== undefined && filters.lng !== undefined) {
            // Approximate degrees per km at Malta's latitude
            const latDelta = filters.radius_km / 111;
            const lngDelta = filters.radius_km / (111 * Math.cos(filters.lat * Math.PI / 180));

            conditions.push(`l.lat BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            values.push(filters.lat - latDelta, filters.lat + latDelta);

            conditions.push(`l.lng BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            values.push(filters.lng - lngDelta, filters.lng + lngDelta);
        }

        // Build ORDER BY
        let orderBy = 'l.created_at DESC';
        switch (filters.sort) {
            case 'price_asc':
                orderBy = 'l.price_amount ASC';
                break;
            case 'price_desc':
                orderBy = 'l.price_amount DESC';
                break;
            case 'quality':
                orderBy = 'l.quality_score DESC, l.created_at DESC';
                break;
            case 'newest':
            default:
                orderBy = 'l.created_at DESC';
        }

        // Add limit and offset
        values.push(filters.limit, filters.offset);

        const sql = `
      SELECT 
        l.*,
        u.name as poster_name,
        (SELECT url FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo' LIMIT 1) as thumbnail
      FROM listings l
      JOIN users u ON u.id = l.poster_id
      WHERE ${conditions.length > 0 ? conditions.join(' AND ') : 'TRUE'}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

        const countSql = `
      SELECT COUNT(*) as total
      FROM listings l
      WHERE ${conditions.length > 0 ? conditions.join(' AND ') : 'TRUE'}
    `;

        const [results, countResult] = await Promise.all([
            query(sql, values),
            query(countSql, values.slice(0, -2)), // Exclude limit/offset
        ]);

        const total = parseInt(countResult.rows[0].total, 10);

        logger.debug({ filters, resultCount: results.rows.length, total }, 'Search executed');

        return reply.send({
            listings: results.rows,
            pagination: {
                total,
                limit: filters.limit,
                offset: filters.offset,
                hasMore: filters.offset + results.rows.length < total,
            },
        });
    });
};
