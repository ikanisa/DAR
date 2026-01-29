/**
 * Risk Service - P6A Anti-duplicate + Anti-scam
 * 
 * Computes fingerprints for listings and scores them for risk.
 * High-risk listings are held for admin review.
 */

import { query } from '../db.js';
import { logger } from '../observability/logger.js';
import crypto from 'crypto';

// Risk thresholds
const RISK_THRESHOLDS = {
    HIGH: 70,
    MEDIUM: 40,
};

// Price bucket ranges (EUR)
const PRICE_BUCKETS = [
    { max: 100000, label: 'under_100k' },
    { max: 250000, label: '100k_250k' },
    { max: 500000, label: '250k_500k' },
    { max: 1000000, label: '500k_1m' },
    { max: 2000000, label: '1m_2m' },
    { max: Infinity, label: 'over_2m' },
];

export interface FingerprintResult {
    fingerprint_hash: string;
    photo_hashes: string[];
    geo_cell: string;
    norm_fields: {
        address_norm: string | null;
        title_norm: string | null;
        phone_hash: string | null;
        price_bucket: string;
    };
}

export interface RiskScoreResult {
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high';
    status: 'ok' | 'hold' | 'review_required';
    reasons: string[];
}

/**
 * Normalize text for comparison (lowercase, strip special chars, trim)
 */
function normalizeText(text: string | null | undefined): string | null {
    if (!text) return null;
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Hash a string using SHA256
 */
function hashString(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * Get price bucket label
 */
function getPriceBucket(price: number | null): string {
    if (!price || price <= 0) return 'unknown';
    const bucket = PRICE_BUCKETS.find(b => price <= b.max);
    return bucket?.label || 'unknown';
}

/**
 * Compute geo cell from lat/lng (simple grid-based)
 * Uses ~1km precision grid cells
 */
function computeGeoCell(lat: number | null, lng: number | null): string {
    if (lat == null || lng == null) return 'unknown';
    // Round to ~1km precision (0.01 degrees ≈ 1.1km)
    const latCell = Math.round(lat * 100);
    const lngCell = Math.round(lng * 100);
    return `${latCell}_${lngCell}`;
}

/**
 * Simple perceptual hash simulation (in production, use sharp + phash library)
 * For now, we hash the image URL as a placeholder
 */
function computeImageHash(imageUrl: string): string {
    // TODO: Replace with actual pHash computation using image processing
    // This is a placeholder that hashes the URL
    return hashString(imageUrl);
}

/**
 * Compute listing fingerprint for duplicate detection
 */
export async function computeFingerprint(propertyId: string): Promise<FingerprintResult> {
    // Fetch listing data
    const result = await query<{
        id: string;
        title: string;
        link: string;
        price: number;
        location: string;
        image_url: string;
        source: string;
    }>(
        `SELECT id, title, link, price, location, image_url, source
     FROM property_listings WHERE id = $1`,
        [propertyId]
    );

    if (result.rows.length === 0) {
        throw new Error(`Listing not found: ${propertyId}`);
    }

    const listing = result.rows[0];

    // Normalize fields
    const titleNorm = normalizeText(listing.title);
    const addressNorm = normalizeText(listing.location);
    const priceBucket = getPriceBucket(listing.price);

    // Extract phone from various fields (simplified)
    const phoneHash = null; // Would extract from description/contact info

    // Compute geo cell (would need lat/lng in table)
    const geoCell = 'malta_general'; // Simplified for now

    // Compute fingerprint hash from key fields
    const fingerprintData = [
        titleNorm || '',
        addressNorm || '',
        priceBucket,
        listing.source || '',
    ].join('|');

    const fingerprintHash = hashString(fingerprintData);

    // Compute photo hashes
    const photoHashes: string[] = [];
    if (listing.image_url) {
        photoHashes.push(computeImageHash(listing.image_url));
    }

    // Store fingerprint
    await query(
        `INSERT INTO listing_fingerprints 
     (property_id, fingerprint_hash, phone_hash, address_norm, title_norm, price_bucket, geo_cell, photo_hashes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (property_id) DO UPDATE SET
       fingerprint_hash = EXCLUDED.fingerprint_hash,
       phone_hash = EXCLUDED.phone_hash,
       address_norm = EXCLUDED.address_norm,
       title_norm = EXCLUDED.title_norm,
       price_bucket = EXCLUDED.price_bucket,
       geo_cell = EXCLUDED.geo_cell,
       photo_hashes = EXCLUDED.photo_hashes`,
        [propertyId, fingerprintHash, phoneHash, addressNorm, titleNorm, priceBucket, geoCell, photoHashes]
    );

    logger.info({ propertyId, fingerprintHash }, 'Computed listing fingerprint');

    return {
        fingerprint_hash: fingerprintHash,
        photo_hashes: photoHashes,
        geo_cell: geoCell,
        norm_fields: {
            address_norm: addressNorm,
            title_norm: titleNorm,
            phone_hash: phoneHash,
            price_bucket: priceBucket,
        },
    };
}

/**
 * Score a listing for risk
 */
export async function scoreListing(propertyId: string): Promise<RiskScoreResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. Check for duplicate fingerprint
    const dupCheck = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM listing_fingerprints 
     WHERE fingerprint_hash = (
       SELECT fingerprint_hash FROM listing_fingerprints WHERE property_id = $1
     ) AND property_id != $1`,
        [propertyId]
    );

    if (parseInt(dupCheck.rows[0]?.count || '0') > 0) {
        riskScore += 40;
        reasons.push('Duplicate fingerprint detected: similar listing already exists');
    }

    // 2. Check for matching photo hash from different poster
    // 2. Check for matching photo hash from different poster
    const photoCheck = await query<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM photo_hash_index phi1
         JOIN property_media pm1 ON pm1.id = phi1.media_id
         JOIN property_listings pl1 ON pl1.id = pm1.property_id
         JOIN photo_hash_index phi2 ON phi1.phash = phi2.phash
         JOIN property_media pm2 ON pm2.id = phi2.media_id
         JOIN property_listings pl2 ON pl2.id = pm2.property_id
         WHERE pl1.id = $1 
         AND pl2.id != $1
         AND pl2.poster_id != pl1.poster_id`,
        [propertyId]
    );

    if (parseInt(photoCheck.rows[0]?.count || '0') > 0) {
        riskScore += 35;
        reasons.push('Photo matches listing from different poster: possible stolen image');
    }

    // 3. Check listing completeness
    const listingCheck = await query<{
        title: string;
        location: string;
        image_url: string;
        price: number;
    }>(
        `SELECT title, location, image_url, price FROM property_listings WHERE id = $1`,
        [propertyId]
    );

    if (listingCheck.rows.length > 0) {
        const listing = listingCheck.rows[0];

        // Missing address
        if (!listing.location) {
            riskScore += 10;
            reasons.push('Missing location/address');
        }

        // Single photo or no photo
        if (!listing.image_url) {
            riskScore += 15;
            reasons.push('No photos provided');
        }

        // Price outlier check (very rough heuristic)
        if (listing.price && (listing.price < 10000 || listing.price > 50000000)) {
            riskScore += 20;
            reasons.push('Price appears to be an extreme outlier');
        }
    }

    // Determine risk level and status
    let riskLevel: 'low' | 'medium' | 'high';
    let status: 'ok' | 'hold' | 'review_required';

    if (riskScore >= RISK_THRESHOLDS.HIGH) {
        riskLevel = 'high';
        status = 'hold';
    } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
        riskLevel = 'medium';
        status = 'review_required';
    } else {
        riskLevel = 'low';
        status = 'ok';
    }

    // Store risk score
    await query(
        `INSERT INTO listing_risk_scores 
     (property_id, risk_score, risk_level, reasons, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (property_id) DO UPDATE SET
       risk_score = EXCLUDED.risk_score,
       risk_level = EXCLUDED.risk_level,
       reasons = EXCLUDED.reasons,
       status = EXCLUDED.status,
       updated_at = now()`,
        [propertyId, riskScore, riskLevel, JSON.stringify(reasons), status]
    );

    logger.info({ propertyId, riskScore, riskLevel, status, reasons }, 'Scored listing risk');

    return { risk_score: riskScore, risk_level: riskLevel, status, reasons };
}

/**
 * Admin override for risk decision
 */
export async function adminOverride(
    propertyId: string,
    decision: 'allow' | 'hold' | 'reject',
    adminId: string,
    notes?: string
): Promise<{ finalStatus: string }> {
    const statusMap = {
        allow: 'ok',
        hold: 'hold',
        reject: 'review_required',
    };

    const newStatus = statusMap[decision];

    await query(
        `UPDATE listing_risk_scores 
     SET status = $1, reviewed_by = $2, reviewed_at = now(), review_notes = $3
     WHERE property_id = $4`,
        [newStatus, adminId, notes || null, propertyId]
    );

    // Update listing status based on decision
    const listingStatus = decision === 'allow'
        ? 'approved'
        : decision === 'reject'
            ? 'rejected'
            : 'hold_for_review';

    await query(
        `UPDATE property_listings SET status = $1 WHERE id = $2`,
        [listingStatus, propertyId]
    );

    logger.info({ propertyId, decision, adminId, notes }, 'Admin override applied');

    return { finalStatus: listingStatus };
}

/**
 * Get risk status for a listing
 */
export async function getRiskStatus(propertyId: string): Promise<RiskScoreResult | null> {
    const result = await query<{
        risk_score: number;
        risk_level: string;
        status: string;
        reasons: string;
    }>(
        `SELECT risk_score, risk_level, status, reasons FROM listing_risk_scores WHERE property_id = $1`,
        [propertyId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        risk_score: row.risk_score,
        risk_level: row.risk_level as 'low' | 'medium' | 'high',
        status: row.status as 'ok' | 'hold' | 'review_required',
        reasons: JSON.parse(row.reasons),
    };
}

/**
 * Check if risk scoring is enabled
 */
export function isRiskScoringEnabled(): boolean {
    return process.env.RISK_SCORING_ENABLED !== 'false';
}
