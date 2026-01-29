import { z } from 'zod';
import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';

const InputSchema = z.object({
    listing_id: z.string().uuid(),
});

export async function dedupeListing(input: unknown, actorId: string) {
    const data = InputSchema.parse(input);
    const duplicates: string[] = [];

    const listingResult = await query('SELECT * FROM listings WHERE id = $1', [data.listing_id]);
    const listing = listingResult.rows[0] as any;

    if (!listing) {
        throw new Error('Listing not found');
    }

    // Rule 1: Same poster + similar address
    if (listing.poster_id && listing.address_text) {
        const result = await query(
            `SELECT id FROM listings 
       WHERE poster_id = $1 
       AND id != $2 
       AND address_text ILIKE $3
       AND status != 'archived'`,
            [listing.poster_id, listing.id, listing.address_text]
        );
        result.rows.forEach(row => duplicates.push(row.id));
    }

    // Rule 2: Geo + Price proximity (if we had geo, simplified for now to price + title similarity)
    // This is a placeholder for more advanced logic if PostGIS was active. 
    // For now, we'll check price within 5% and title fuzzy match if we could (but SQL LIKE is simple)

    await audit({
        actorType: 'agent',
        actorId,
        action: AuditActions.TOOL_LISTING_DEDUPE,
        entity: 'listing',
        entityId: data.listing_id,
        payload: { duplicateCount: duplicates.length },
    });

    return { duplicates: [...new Set(duplicates)], reason: duplicates.length > 0 ? 'Potential duplicates found' : undefined };
}
