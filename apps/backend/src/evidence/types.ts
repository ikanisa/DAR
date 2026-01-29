/**
 * Evidence Pack Types
 * TypeScript interfaces for regulator-friendly audit dossiers
 */

/**
 * Redacted user info for privacy compliance
 */
export interface RedactedUser {
    id: string;
    name: string | null;
    phone: string;
    email: string;
}

/**
 * Media manifest item (URLs only, no embedded content)
 */
export interface MediaItem {
    kind: string;
    url: string;
    meta: Record<string, unknown> | null;
}

/**
 * Listing snapshot at time of evidence generation
 */
export interface ListingSnapshot {
    id: string;
    title: string;
    description: string;
    type: string;
    price_amount: number;
    price_currency: string;
    status: string;
    bedrooms: number | null;
    bathrooms: number | null;
    size_sqm: number | null;
    address_text: string | null;
    lat: number | null;
    lng: number | null;
    created_at: string;
    updated_at: string;
    poster_id: string | null;
}

/**
 * Review record
 */
export interface ReviewSnapshot {
    id: string;
    rating: number;
    comment: string | null;
    reviewer_id_redacted: string;
    created_at: string;
}

/**
 * Match record (seeker-listing match)
 */
export interface MatchSnapshot {
    id: string;
    seeker_id_redacted: string;
    status: string;
    created_at: string;
}

/**
 * Viewing record
 */
export interface ViewingSnapshot {
    id: string;
    seeker_id_redacted: string;
    status: string;
    proposed_dates: unknown[];
    confirmed_date: string | null;
    created_at: string;
}

/**
 * Source references for audit trail
 */
export interface SourceRefs {
    inbound_event_id?: string;
    request_id?: string;
}

/**
 * Individual timeline entry with cryptographic hash
 */
export interface TimelineEntry {
    ts: string;                     // ISO8601
    actor_type: string;
    actor_id_redacted: string;
    action: string;
    entity: string;
    entity_id: string;
    payload_redacted: Record<string, unknown>;
    source_refs: SourceRefs;
    entry_hash: string;             // SHA-256
}

/**
 * Integrity section with hash chain
 */
export interface IntegrityInfo {
    timeline_hash_chain: string;    // SHA-256 of concatenated entry hashes
    pack_hash: string;              // SHA-256 of JSON (excluding this field)
    row_count: {
        audit_log: number;
        reviews: number;
        viewings: number;
    };
}

/**
 * Evidence pack subject data
 */
export interface EvidenceSubject {
    listing: ListingSnapshot;
    poster: RedactedUser;
    media_manifest: MediaItem[];
    reviews: ReviewSnapshot[];
    matches: MatchSnapshot[];
    viewings?: ViewingSnapshot[];
}

/**
 * Evidence pack metadata
 */
export interface EvidenceMeta {
    generated_at: string;           // ISO8601
    generated_by: {
        actor_type: string;
        actor_id_redacted: string;
        role: string;
    };
    format: 'json' | 'pdf' | 'zip';
    schema_version: '1.0';
    timezone: string;
}

/**
 * Complete evidence pack structure
 */
export interface EvidencePack {
    meta: EvidenceMeta;
    subject: EvidenceSubject;
    timeline: TimelineEntry[];
    integrity: IntegrityInfo;
}

/**
 * Requester info for audit trail
 */
export interface EvidenceRequester {
    type: string;
    id: string;
    role: string;
}
