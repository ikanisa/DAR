/**
 * Evidence Pack Builder
 * Constructs regulator-friendly audit dossiers for listings
 */

import { query } from '../db.js';
import { audit, AuditActions } from '../audit.js';
import { logger } from '../observability/logger.js';
import { canonicalStringify, sha256 } from './canonical.js';
import { redactPhone, redactEmail, redactPeerId, redactPayload, redactUserId } from './redact.js';
import type {
    EvidencePack,
    EvidenceRequester,
    TimelineEntry,
    ListingSnapshot,
    RedactedUser,
    MediaItem,
    ReviewSnapshot,
    ViewingSnapshot,
    IntegrityInfo,
} from './types.js';

/**
 * Default timezone for evidence packs
 */
const EVIDENCE_TIMEZONE = 'Europe/Malta';

/**
 * Current schema version
 */
const SCHEMA_VERSION = '1.0' as const;

/**
 * Fetch listing by ID
 */
async function fetchListing(listingId: string): Promise<ListingSnapshot | null> {
    // Try property_listings first (main table)
    const result = await query<ListingSnapshot>(
        `SELECT id, title, description, type, price_amount, price_currency, status,
                bedrooms, bathrooms, size_sqm, address_text, lat, lng,
                created_at, updated_at, poster_id
         FROM property_listings
         WHERE id = $1`,
        [listingId]
    );

    if (result.rows[0]) {
        return result.rows[0];
    }

    // Fallback to listings table if exists
    const fallback = await query<ListingSnapshot>(
        `SELECT id, title, description, type, price_amount, price_currency, status,
                bedrooms, bathrooms, size_sqm, address_text, lat, lng,
                created_at, updated_at, poster_id
         FROM listings
         WHERE id = $1`,
        [listingId]
    );

    return fallback.rows[0] || null;
}

/**
 * Fetch poster info with redaction
 */
async function fetchRedactedPoster(posterId: string | null): Promise<RedactedUser> {
    if (!posterId) {
        return {
            id: '[none]',
            name: null,
            phone: '[none]',
            email: '[none]',
        };
    }

    // Try auth.users first (Supabase)
    const result = await query<{ id: string; raw_user_meta_data: Record<string, unknown> }>(
        `SELECT id, raw_user_meta_data FROM auth.users WHERE id = $1`,
        [posterId]
    );

    if (result.rows[0]) {
        const user = result.rows[0];
        const meta = user.raw_user_meta_data || {};
        return {
            id: redactUserId(user.id),
            name: (meta.name as string) || (meta.full_name as string) || null,
            phone: redactPhone(meta.phone as string),
            email: redactEmail(meta.email as string),
        };
    }

    // Fallback to users table if exists
    const fallback = await query<{ id: string; name: string; phone: string; email: string }>(
        `SELECT id, name, phone, email FROM users WHERE id = $1`,
        [posterId]
    );

    if (fallback.rows[0]) {
        const user = fallback.rows[0];
        return {
            id: redactUserId(user.id),
            name: user.name,
            phone: redactPhone(user.phone),
            email: redactEmail(user.email),
        };
    }

    return {
        id: redactUserId(posterId),
        name: null,
        phone: '[none]',
        email: '[none]',
    };
}

/**
 * Fetch media manifest for listing
 */
async function fetchMediaManifest(listingId: string): Promise<MediaItem[]> {
    // Try property_media first
    const result = await query<{ type: string; url: string; alt_text: string | null }>(
        `SELECT type, url, alt_text FROM property_media WHERE property_id = $1 ORDER BY position`,
        [listingId]
    );

    if (result.rows.length > 0) {
        return result.rows.map(m => ({
            kind: m.type,
            url: m.url,
            meta: m.alt_text ? { alt_text: m.alt_text } : null,
        }));
    }

    // Fallback to listing_media if exists
    const fallback = await query<{ kind: string; url: string; meta: Record<string, unknown> | null }>(
        `SELECT kind, url, meta FROM listing_media WHERE listing_id = $1`,
        [listingId]
    );

    return fallback.rows.map(m => ({
        kind: m.kind || 'photo',
        url: m.url,
        meta: m.meta,
    }));
}

/**
 * Fetch reviews for listing
 */
async function fetchReviews(listingId: string): Promise<ReviewSnapshot[]> {
    const result = await query<{
        id: string;
        rating: number;
        comment: string | null;
        reviewer_id: string | null;
        seeker_id: string | null;
        created_at: Date;
    }>(
        `SELECT id, rating, comment, 
                COALESCE(reviewer_id, seeker_id) as reviewer_id,
                created_at
         FROM reviews
         WHERE listing_id = $1 OR property_id = $1
         ORDER BY created_at`,
        [listingId]
    );

    return result.rows.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewer_id_redacted: redactUserId(r.reviewer_id),
        created_at: r.created_at.toISOString(),
    }));
}

/**
 * Fetch viewings for listing
 */
async function fetchViewings(listingId: string): Promise<ViewingSnapshot[]> {
    const result = await query<{
        id: string;
        seeker_id: string | null;
        status: string;
        proposed_dates: unknown[];
        confirmed_date: Date | null;
        created_at: Date;
    }>(
        `SELECT id, seeker_id, status, proposed_dates, confirmed_date, created_at
         FROM property_viewings
         WHERE property_id = $1
         ORDER BY created_at`,
        [listingId]
    );

    return result.rows.map(v => ({
        id: v.id,
        seeker_id_redacted: redactUserId(v.seeker_id),
        status: v.status,
        proposed_dates: v.proposed_dates || [],
        confirmed_date: v.confirmed_date?.toISOString() || null,
        created_at: v.created_at.toISOString(),
    }));
}

/**
 * Fetch timeline from audit_events
 */
async function fetchTimeline(listingId: string): Promise<TimelineEntry[]> {
    // Try audit_events first (new P1 schema)
    const result = await query<{
        id: string;
        event_type: string;
        agent_type: string | null;
        tool_name: string | null;
        user_id: string | null;
        context: Record<string, unknown>;
        created_at: Date;
    }>(
        `SELECT id, event_type, agent_type, tool_name, user_id, context, created_at
         FROM audit_events
         WHERE property_id = $1
            OR (context->>'listing_id' = $1)
            OR (context->>'property_id' = $1)
         ORDER BY created_at, event_type, id`,
        [listingId]
    );

    const entries: TimelineEntry[] = [];
    const entryHashes: string[] = [];

    for (const row of result.rows) {
        // Build entry without hash first
        const entryBase = {
            ts: row.created_at.toISOString(),
            actor_type: row.agent_type || 'system',
            actor_id_redacted: redactUserId(row.user_id),
            action: row.tool_name || row.event_type,
            entity: 'listing',
            entity_id: listingId,
            payload_redacted: redactPayload(row.context),
            source_refs: row.context?.inbound_event_id
                ? { inbound_event_id: row.context.inbound_event_id as string }
                : {},
        };

        // Compute hash
        const entryHash = sha256(canonicalStringify(entryBase));

        const entry: TimelineEntry = {
            ...entryBase,
            entry_hash: entryHash,
        };

        entryHashes.push(entryHash);
        entries.push(entry);
    }

    // Also try audit_log table if exists
    const fallback = await query<{
        id: string;
        actor_type: string;
        actor_id: string;
        action: string;
        entity: string;
        entity_id: string | null;
        payload: Record<string, unknown>;
        created_at: Date;
    }>(
        `SELECT id, actor_type, actor_id, action, entity, entity_id, payload, created_at
         FROM audit_log
         WHERE (entity = 'listing' AND entity_id = $1)
            OR (entity = 'listings' AND entity_id = $1)
            OR (payload->>'listing_id' = $1)
            OR (payload->>'property_id' = $1)
         ORDER BY created_at, action, entity_id`,
        [listingId]
    );

    for (const row of fallback.rows) {
        const entryBase = {
            ts: row.created_at.toISOString(),
            actor_type: row.actor_type,
            actor_id_redacted: redactUserId(row.actor_id),
            action: row.action,
            entity: row.entity,
            entity_id: row.entity_id || listingId,
            payload_redacted: redactPayload(row.payload),
            source_refs: row.payload?.inbound_event_id
                ? { inbound_event_id: row.payload.inbound_event_id as string }
                : {},
        };

        const entryHash = sha256(canonicalStringify(entryBase));

        const entry: TimelineEntry = {
            ...entryBase,
            entry_hash: entryHash,
        };

        entryHashes.push(entryHash);
        entries.push(entry);
    }

    // Sort all entries by timestamp
    entries.sort((a, b) => a.ts.localeCompare(b.ts));

    return entries;
}

/**
 * Get count of viewings for a listing
 */
async function getViewingsCount(listingId: string): Promise<number> {
    const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM property_viewings WHERE property_id = $1`,
        [listingId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Build a complete evidence pack for a listing
 */
export async function buildEvidencePack(
    listingId: string,
    requester: EvidenceRequester,
    options: {
        includeViewings?: boolean;
        format?: 'json' | 'pdf' | 'zip';
    } = {}
): Promise<EvidencePack> {
    const { includeViewings = true, format = 'json' } = options;

    logger.info({ listingId, requester: requester.id, format }, 'Building evidence pack');

    // Fetch listing
    const listing = await fetchListing(listingId);
    if (!listing) {
        throw new Error(`Listing not found: ${listingId}`);
    }

    // Fetch all related data in parallel
    const [poster, media, reviews, timeline, viewings, viewingsCount] = await Promise.all([
        fetchRedactedPoster(listing.poster_id),
        fetchMediaManifest(listingId),
        fetchReviews(listingId),
        fetchTimeline(listingId),
        includeViewings ? fetchViewings(listingId) : Promise.resolve([]),
        getViewingsCount(listingId),
    ]);

    // Compute timeline hash chain
    const entryHashes = timeline.map(e => e.entry_hash);
    const chainHash = sha256(entryHashes.join(''));

    // Build pack without pack_hash
    const packBase: Omit<EvidencePack, 'integrity'> & { integrity: Omit<IntegrityInfo, 'pack_hash'> } = {
        meta: {
            generated_at: new Date().toISOString(),
            generated_by: {
                actor_type: requester.type,
                actor_id_redacted: redactUserId(requester.id),
                role: requester.role,
            },
            format,
            schema_version: SCHEMA_VERSION,
            timezone: EVIDENCE_TIMEZONE,
        },
        subject: {
            listing: {
                ...listing,
                created_at: typeof listing.created_at === 'object' && listing.created_at !== null
                    ? (listing.created_at as unknown as Date).toISOString()
                    : String(listing.created_at),
                updated_at: typeof listing.updated_at === 'object' && listing.updated_at !== null
                    ? (listing.updated_at as unknown as Date).toISOString()
                    : String(listing.updated_at),
            },
            poster,
            media_manifest: media,
            reviews,
            matches: [], // Matches not implemented yet
            ...(includeViewings ? { viewings } : {}),
        },
        timeline,
        integrity: {
            timeline_hash_chain: chainHash,
            row_count: {
                audit_log: timeline.length,
                reviews: reviews.length,
                viewings: viewingsCount,
            },
        },
    };

    // Compute pack hash
    const packHash = sha256(canonicalStringify(packBase));

    const pack: EvidencePack = {
        ...packBase,
        integrity: {
            ...packBase.integrity,
            pack_hash: packHash,
        },
    };

    // Audit this generation
    await audit({
        actorType: requester.type as 'user' | 'agent' | 'system',
        actorId: requester.id,
        action: AuditActions.EVIDENCE_GENERATE,
        entity: 'listing',
        entityId: listingId,
        payload: {
            format,
            pack_hash: packHash,
            row_counts: pack.integrity.row_count,
        },
    });

    logger.info({ listingId, packHash, format }, 'Evidence pack built successfully');

    return pack;
}

/**
 * Check if a user can access evidence for a listing
 */
export async function canAccessEvidence(
    user: { sub?: string; role?: string } | null | undefined,
    listingId: string
): Promise<{ allowed: boolean; reason?: string }> {
    // No user = no access
    if (!user || !user.sub) {
        return { allowed: false, reason: 'Authentication required' };
    }

    // Admin/moderator = full access
    if (user.role === 'admin' || user.role === 'moderator') {
        return { allowed: true };
    }

    // Poster = own listings only
    if (user.role === 'poster') {
        const listing = await fetchListing(listingId);
        if (!listing) {
            return { allowed: false, reason: 'Listing not found' };
        }
        if (listing.poster_id === user.sub) {
            return { allowed: true };
        }
        return { allowed: false, reason: 'Access denied: not your listing' };
    }

    // Seeker = blocked
    if (user.role === 'seeker') {
        return { allowed: false, reason: 'Seekers cannot access evidence packs' };
    }

    // Unknown role = assume poster, check ownership
    const listing = await fetchListing(listingId);
    if (!listing) {
        return { allowed: false, reason: 'Listing not found' };
    }
    if (listing.poster_id === user.sub) {
        return { allowed: true };
    }

    return { allowed: false, reason: 'Access denied' };
}
