import { z } from 'zod';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';

const InputSchema = z.object({
    listing_id: z.string().uuid().optional(),
    listing_payload: z.object({
        title: z.string(),
        description: z.string(),
        price_amount: z.number(),
        address_text: z.string(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
    }).optional(),
});

export async function validateListing(input: unknown, actorId: string) {
    const data = InputSchema.parse(input);
    const errors: string[] = [];
    const warnings: string[] = [];

    let listing = data.listing_payload;

    if (data.listing_id) {
        const result = await query('SELECT * FROM listings WHERE id = $1', [data.listing_id]);
        listing = result.rows[0] as any;

        // Check photo count
        const mediaResult = await query(
            'SELECT COUNT(*) FROM listing_media WHERE listing_id = $1 AND kind = $2',
            [data.listing_id, 'photo']
        );
        if (parseInt(mediaResult.rows[0].count) < 5) {
            errors.push('Minimum 5 photos required');
        }
    }

    if (!listing) {
        return { ok: false, errors: ['Listing not found'], warnings: [], score: 0 };
    }

    if (!listing.title || listing.title.length < 1) {
        errors.push('Title is required');
    }

    if (!listing.description || listing.description.length < 100) {
        errors.push('Description must be at least 100 characters');
    }

    if (!listing.price_amount || listing.price_amount <= 0) {
        errors.push('Price must be positive');
    }

    if (!listing.address_text) {
        errors.push('Address is required');
    }

    // Calculate score
    let score = 100 - (errors.length * 20);
    score = Math.max(0, Math.min(100, score));

    await audit({
        actorType: 'agent',
        actorId,
        action: AuditActions.TOOL_LISTING_VALIDATE,
        entity: 'listing',
        entityId: data.listing_id,
        payload: { ok: errors.length === 0, score },
    });

    return { ok: errors.length === 0, errors, warnings, score };
}
