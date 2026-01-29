/**
 * Listing Normalizer
 * Normalizes extracted data into the internal listings schema
 * Applies field restrictions based on domain policy
 */

import crypto from 'crypto';
import type { ExtractedListing } from './extractSchemaOrg.js';
import type { FallbackExtractedListing } from './extractFallback.js';

export type ExtractedData = ExtractedListing | FallbackExtractedListing;

export interface NormalizedListing {
    title: string;
    description: string | null;
    type: 'apartment' | 'house' | 'commercial' | 'land';
    price_amount: number | null;
    price_currency: string;
    bedrooms: number | null;
    bathrooms: number | null;
    size_sqm: number | null;
    address_text: string | null;
    area: string | null;
    source_type: 'linkout' | 'partner';
    source_url: string;
    source_domain: string;
    content_hash: string;
    image_url: string | null;
    external_link: string;
}

/**
 * Allowed field keys for domain policy
 */
export type AllowedField =
    | 'title'
    | 'description'
    | 'price'
    | 'bedrooms'
    | 'bathrooms'
    | 'area'
    | 'address'
    | 'images'
    | 'size'
    | 'url';

/**
 * Normalize extracted listing data
 */
export function normalizeListing(
    extracted: ExtractedData,
    domain: string,
    allowedFields: AllowedField[],
    sourceType: 'linkout' | 'partner' = 'linkout'
): NormalizedListing {
    // Infer property type from title
    const type = inferPropertyType(extracted.title);

    // Apply field restrictions
    const title = isFieldAllowed('title', allowedFields)
        ? truncate(extracted.title, 100)
        : 'Property Listing';

    const description = isFieldAllowed('description', allowedFields)
        ? extracted.description
        : null;

    const priceAmount = isFieldAllowed('price', allowedFields)
        ? extracted.price
        : null;

    const bedrooms = isFieldAllowed('bedrooms', allowedFields)
        ? extracted.bedrooms
        : null;

    const bathrooms = isFieldAllowed('bathrooms', allowedFields)
        ? extracted.bathrooms
        : null;

    const area = isFieldAllowed('area', allowedFields)
        ? extracted.area
        : null;

    const addressText = isFieldAllowed('address', allowedFields)
        ? extracted.address
        : null;

    const sizeSqm = isFieldAllowed('size', allowedFields)
        ? extracted.sizeSqm
        : null;

    const imageUrl = isFieldAllowed('images', allowedFields) && extracted.images.length > 0
        ? extracted.images[0]
        : null;

    // Compute content hash for deduplication
    const contentHash = computeContentHash({
        url: extracted.canonicalUrl,
        price: extracted.price,
        bedrooms: extracted.bedrooms,
        area: extracted.area,
        title: extracted.title,
    });

    return {
        title,
        description,
        type,
        price_amount: priceAmount,
        price_currency: extracted.currency,
        bedrooms,
        bathrooms,
        size_sqm: sizeSqm,
        address_text: addressText,
        area,
        source_type: sourceType,
        source_url: domain,
        source_domain: domain,
        content_hash: contentHash,
        image_url: imageUrl,
        external_link: extracted.canonicalUrl,
    };
}

/**
 * Infer property type from title
 */
export function inferPropertyType(title: string): NormalizedListing['type'] {
    const lower = title.toLowerCase();

    // Check for apartment indicators
    if (
        lower.includes('apartment') ||
        lower.includes('flat') ||
        lower.includes('penthouse') ||
        lower.includes('studio') ||
        lower.includes('maisonette')
    ) {
        return 'apartment';
    }

    // Check for house indicators
    if (
        lower.includes('house') ||
        lower.includes('villa') ||
        lower.includes('bungalow') ||
        lower.includes('townhouse') ||
        lower.includes('farmhouse') ||
        lower.includes('palazzo')
    ) {
        return 'house';
    }

    // Check for commercial indicators
    if (
        lower.includes('office') ||
        lower.includes('shop') ||
        lower.includes('commercial') ||
        lower.includes('retail') ||
        lower.includes('warehouse') ||
        lower.includes('industrial')
    ) {
        return 'commercial';
    }

    // Check for land indicators
    if (
        lower.includes('land') ||
        lower.includes('plot') ||
        lower.includes('site') ||
        lower.includes('development')
    ) {
        return 'land';
    }

    // Default to apartment (most common in Malta)
    return 'apartment';
}

/**
 * Check if a field is in the allowed list
 */
function isFieldAllowed(field: AllowedField, allowed: AllowedField[]): boolean {
    return allowed.includes(field);
}

/**
 * Truncate string to max length
 */
function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max - 3) + '...';
}

/**
 * Compute MD5 hash of key fields for deduplication
 */
function computeContentHash(data: {
    url: string;
    price: number | null;
    bedrooms: number | null;
    area: string | null;
    title: string;
}): string {
    const hashInput = [
        data.url,
        data.price?.toString() || '',
        data.bedrooms?.toString() || '',
        data.area || '',
        // Include first 50 chars of title for similarity
        data.title.slice(0, 50).toLowerCase().replace(/\s+/g, ' ').trim(),
    ].join('|');

    return crypto.createHash('md5').update(hashInput).digest('hex');
}

/**
 * Parse allowed fields from database JSONB
 */
export function parseAllowedFields(fieldsJson: unknown): AllowedField[] {
    if (Array.isArray(fieldsJson)) {
        return fieldsJson.filter((f): f is AllowedField =>
            typeof f === 'string' && isValidAllowedField(f)
        );
    }
    // Default fields for link-out
    return ['title', 'price', 'bedrooms', 'url'];
}

function isValidAllowedField(field: string): field is AllowedField {
    return [
        'title', 'description', 'price', 'bedrooms', 'bathrooms',
        'area', 'address', 'images', 'size', 'url'
    ].includes(field);
}
