/**
 * Schema.org Extractor
 * Parses JSON-LD structured data from HTML pages
 */

import * as cheerio from 'cheerio';

// Schema.org listing types we recognize
const LISTING_TYPES = [
    'RealEstateListing',
    'Apartment',
    'House',
    'Residence',
    'Product',
    'Place',
    'Accommodation',
];

export interface SchemaOrgPrice {
    '@type'?: string;
    price?: string | number;
    priceCurrency?: string;
}

export interface SchemaOrgAddress {
    '@type'?: string;
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
}

export interface SchemaOrgFloorSize {
    '@type'?: string;
    value?: number | string;
    unitCode?: string;
    unitText?: string;
}

export interface SchemaOrgListing {
    '@type': string;
    name?: string;
    description?: string;
    url?: string;
    price?: string | number | SchemaOrgPrice;
    offers?: {
        '@type'?: string;
        price?: string | number;
        priceCurrency?: string;
    };
    address?: string | SchemaOrgAddress;
    numberOfRooms?: number | string;
    numberOfBedrooms?: number | string;
    numberOfBathroomsTotal?: number | string;
    floorSize?: SchemaOrgFloorSize;
    image?: string | string[] | { url: string }[];
    photo?: string | string[] | { url: string }[];
}

export interface ExtractedListing {
    title: string;
    description: string | null;
    price: number | null;
    currency: string;
    bedrooms: number | null;
    bathrooms: number | null;
    area: string | null;
    address: string | null;
    sizeSqm: number | null;
    images: string[];
    canonicalUrl: string;
    extractionMethod: 'schema.org';
}

/**
 * Extract listing data from Schema.org JSON-LD
 */
export function extractSchemaOrg(
    html: string,
    sourceUrl: string
): ExtractedListing | null {
    const $ = cheerio.load(html);

    // Find all JSON-LD scripts
    const scripts = $('script[type="application/ld+json"]');

    for (const script of scripts.toArray()) {
        try {
            const jsonText = $(script).html();
            if (!jsonText) continue;

            const json = JSON.parse(jsonText);
            const listings = findListings(json);

            if (listings.length > 0) {
                return parseSchemaListing(listings[0], sourceUrl);
            }
        } catch {
            // Invalid JSON, continue to next script
            continue;
        }
    }

    return null;
}

/**
 * Find listing objects in JSON-LD data
 * Handles @graph arrays and nested structures
 */
function findListings(json: unknown): SchemaOrgListing[] {
    if (!json || typeof json !== 'object') {
        return [];
    }

    const listings: SchemaOrgListing[] = [];

    // Handle arrays
    if (Array.isArray(json)) {
        for (const item of json) {
            listings.push(...findListings(item));
        }
        return listings;
    }

    const obj = json as Record<string, unknown>;

    // Handle @graph container
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
        for (const item of obj['@graph']) {
            listings.push(...findListings(item));
        }
        return listings;
    }

    // Check if this object is a listing type
    const type = obj['@type'];
    if (typeof type === 'string' && LISTING_TYPES.includes(type)) {
        listings.push(obj as unknown as SchemaOrgListing);
    } else if (Array.isArray(type)) {
        // Handle multiple types
        if (type.some(t => LISTING_TYPES.includes(t))) {
            listings.push(obj as unknown as SchemaOrgListing);
        }
    }

    return listings;
}

/**
 * Parse a Schema.org listing into our format
 */
function parseSchemaListing(
    schema: SchemaOrgListing,
    sourceUrl: string
): ExtractedListing {
    // Parse price
    const { price, currency } = parsePrice(schema);

    // Parse images
    const images = parseImages(schema);

    // Parse floor size
    const sizeSqm = parseFloorSize(schema.floorSize);

    // Parse address
    const { area, address } = parseAddress(schema.address);

    return {
        title: schema.name || 'Untitled Listing',
        description: schema.description || null,
        price,
        currency,
        bedrooms: parseNumber(schema.numberOfBedrooms ?? schema.numberOfRooms),
        bathrooms: parseNumber(schema.numberOfBathroomsTotal),
        area,
        address,
        sizeSqm,
        images,
        canonicalUrl: schema.url || sourceUrl,
        extractionMethod: 'schema.org',
    };
}

/**
 * Parse price from various Schema.org formats
 */
function parsePrice(schema: SchemaOrgListing): { price: number | null; currency: string } {
    let price: number | null = null;
    let currency = 'EUR';

    // Try offers first (common pattern)
    if (schema.offers) {
        if (typeof schema.offers.price === 'number') {
            price = schema.offers.price;
        } else if (typeof schema.offers.price === 'string') {
            price = parseFloat(schema.offers.price.replace(/[^0-9.]/g, '')) || null;
        }
        currency = schema.offers.priceCurrency || 'EUR';
        if (price !== null) return { price, currency };
    }

    // Try direct price field
    if (typeof schema.price === 'number') {
        price = schema.price;
    } else if (typeof schema.price === 'string') {
        // Extract currency from string like "€1,200" or "EUR 1200"
        const currencyMatch = schema.price.match(/([A-Z]{3}|[€$£])/);
        if (currencyMatch) {
            const sym = currencyMatch[1];
            currency = sym === '€' ? 'EUR' : sym === '$' ? 'USD' : sym === '£' ? 'GBP' : sym;
        }
        price = parseFloat(schema.price.replace(/[^0-9.]/g, '')) || null;
    } else if (schema.price && typeof schema.price === 'object') {
        const priceObj = schema.price as SchemaOrgPrice;
        if (typeof priceObj.price === 'number') {
            price = priceObj.price;
        } else if (typeof priceObj.price === 'string') {
            price = parseFloat(priceObj.price.replace(/[^0-9.]/g, '')) || null;
        }
        currency = priceObj.priceCurrency || 'EUR';
    }

    return { price, currency };
}

/**
 * Parse images from various formats
 */
function parseImages(schema: SchemaOrgListing): string[] {
    const images: string[] = [];
    const sources = [schema.image, schema.photo];

    for (const source of sources) {
        if (!source) continue;

        if (typeof source === 'string') {
            images.push(source);
        } else if (Array.isArray(source)) {
            for (const item of source) {
                if (typeof item === 'string') {
                    images.push(item);
                } else if (item && typeof item === 'object' && 'url' in item) {
                    images.push(item.url);
                }
            }
        }
    }

    return images;
}

/**
 * Parse floor size to square meters
 */
function parseFloorSize(floorSize: SchemaOrgFloorSize | undefined): number | null {
    if (!floorSize) return null;

    const value = typeof floorSize.value === 'string'
        ? parseFloat(floorSize.value)
        : floorSize.value;

    if (typeof value !== 'number' || isNaN(value)) return null;

    // Convert to sqm if needed
    const unit = floorSize.unitCode?.toUpperCase() || floorSize.unitText?.toLowerCase() || '';
    if (unit === 'FTK' || unit === 'sqft' || unit.includes('feet')) {
        return Math.round(value * 0.092903); // sq ft to sqm
    }

    return Math.round(value);
}

/**
 * Parse address from string or object
 */
function parseAddress(
    addr: string | SchemaOrgAddress | undefined
): { area: string | null; address: string | null } {
    if (!addr) {
        return { area: null, address: null };
    }

    if (typeof addr === 'string') {
        // Try to extract locality from comma-separated address
        const parts = addr.split(',').map(p => p.trim());
        return {
            area: parts[1] || parts[0] || null,
            address: addr,
        };
    }

    const parts = [
        addr.streetAddress,
        addr.addressLocality,
        addr.addressRegion,
        addr.addressCountry,
    ].filter(Boolean);

    return {
        area: addr.addressLocality || addr.addressRegion || null,
        address: parts.join(', ') || null,
    };
}

/**
 * Parse number from various formats
 */
function parseNumber(val: unknown): number | null {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}
