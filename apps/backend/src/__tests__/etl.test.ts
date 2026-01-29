/**
 * ETL Module Tests
 * Unit tests for Schema.org extraction, fallback extraction, normalization, and deduplication
 */

import { describe, it, expect } from 'vitest';
import { extractSchemaOrg } from '../etl/extractSchemaOrg.js';
import { extractFallback } from '../etl/extractFallback.js';
import {
    normalizeListing,
    inferPropertyType,
    parseAllowedFields,
    type AllowedField,
} from '../etl/normalizeListing.js';
import { computeSimilarity } from '../etl/dedupe.js';

describe('extractSchemaOrg', () => {
    it('extracts RealEstateListing from JSON-LD', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "RealEstateListing",
                    "name": "Beautiful 3-bedroom apartment in Sliema",
                    "description": "Spacious apartment with sea views",
                    "price": "350000",
                    "priceCurrency": "EUR",
                    "numberOfRooms": 3,
                    "numberOfBathroomsTotal": 2,
                    "floorSize": { "@type": "QuantitativeValue", "value": 120, "unitCode": "MTK" },
                    "address": { "@type": "PostalAddress", "addressLocality": "Sliema" },
                    "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
                    "url": "https://maltaproperty.com/listing/123"
                }
                </script>
            </head>
            <body></body>
            </html>
        `;

        const result = extractSchemaOrg(html, 'https://maltaproperty.com/listing/123');

        expect(result).not.toBeNull();
        expect(result!.title).toBe('Beautiful 3-bedroom apartment in Sliema');
        expect(result!.description).toBe('Spacious apartment with sea views');
        expect(result!.price).toBe(350000);
        expect(result!.currency).toBe('EUR');
        expect(result!.bedrooms).toBe(3);
        expect(result!.bathrooms).toBe(2);
        expect(result!.sizeSqm).toBe(120);
        expect(result!.area).toBe('Sliema');
        expect(result!.images).toHaveLength(2);
        expect(result!.extractionMethod).toBe('schema.org');
    });

    it('extracts Apartment type', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Apartment",
                    "name": "Modern studio in Valletta",
                    "price": "€180,000"
                }
                </script>
            </head>
            <body></body>
            </html>
        `;

        const result = extractSchemaOrg(html, 'https://example.com/apt');

        expect(result).not.toBeNull();
        expect(result!.title).toBe('Modern studio in Valletta');
        expect(result!.price).toBe(180000);
    });

    it('handles missing Schema.org data', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head><title>Just a page</title></head>
            <body></body>
            </html>
        `;

        const result = extractSchemaOrg(html, 'https://example.com');

        expect(result).toBeNull();
    });

    it('parses European price format (€1.200.000)', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "House",
                    "name": "Villa in Malta",
                    "price": "€1.200.000"
                }
                </script>
            </head>
            <body></body>
            </html>
        `;

        const result = extractSchemaOrg(html, 'https://example.com');

        expect(result).not.toBeNull();
        expect(result!.price).toBe(1200000);
    });
});

describe('extractFallback', () => {
    it('extracts from Open Graph meta tags', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:title" content="3 bedroom apartment for sale in Gzira - €250,000">
                <meta property="og:description" content="Beautiful apartment near the seafront">
                <meta property="og:image" content="https://example.com/photo.jpg">
                <meta property="og:url" content="https://example.com/property/456">
            </head>
            <body></body>
            </html>
        `;

        const result = extractFallback(html, 'https://example.com/property/456');

        expect(result).not.toBeNull();
        expect(result!.title).toBe('3 bedroom apartment for sale in Gzira - €250,000');
        expect(result!.description).toBe('Beautiful apartment near the seafront');
        expect(result!.price).toBe(250000);
        expect(result!.bedrooms).toBe(3);
        expect(result!.area).toBe('Gzira');
        expect(result!.extractionMethod).toBe('meta');
    });

    it('falls back to page title and heuristics', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>2 Bedroom Apartment in Msida EUR 180000</title>
            </head>
            <body>
                <div class="price">EUR 180,000</div>
            </body>
            </html>
        `;

        const result = extractFallback(html, 'https://example.com/listing');

        expect(result).not.toBeNull();
        expect(result!.title).toContain('2 Bedroom Apartment');
        expect(result!.bedrooms).toBe(2);
        expect(result!.area).toBe('Msida');
        expect(result!.extractionMethod).toBe('heuristic');
    });

    it('returns null when no useful data found', () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head><title>Contact Us</title></head>
            <body><p>Just some text</p></body>
            </html>
        `;

        const result = extractFallback(html, 'https://example.com/contact');

        expect(result).toBeNull();
    });
});

describe('normalizeListing', () => {
    const mockExtracted = {
        title: '3-bedroom Apartment in Sliema with Sea Views',
        description: 'A beautiful apartment facing the sea',
        price: 450000,
        currency: 'EUR',
        bedrooms: 3,
        bathrooms: 2,
        sizeSqm: 150,
        address: 'Tower Road, Sliema',
        area: 'Sliema',
        images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        canonicalUrl: 'https://property.mt/listing/789',
        extractionMethod: 'schema.org' as const,
    };

    it('normalizes with all fields allowed', () => {
        const allFields: AllowedField[] = [
            'title', 'description', 'price', 'bedrooms', 'bathrooms',
            'area', 'address', 'images', 'size', 'url'
        ];

        const result = normalizeListing(mockExtracted, 'property.mt', allFields, 'partner');

        expect(result.title).toBe('3-bedroom Apartment in Sliema with Sea Views');
        expect(result.description).toBe('A beautiful apartment facing the sea');
        expect(result.price_amount).toBe(450000);
        expect(result.bedrooms).toBe(3);
        expect(result.bathrooms).toBe(2);
        expect(result.image_url).toBe('https://example.com/img1.jpg');
        expect(result.source_type).toBe('partner');
    });

    it('redacts fields based on allowed list (link-out mode)', () => {
        const limitedFields: AllowedField[] = ['title', 'price', 'bedrooms', 'url'];

        const result = normalizeListing(mockExtracted, 'property.mt', limitedFields, 'linkout');

        expect(result.title).toBe('3-bedroom Apartment in Sliema with Sea Views');
        expect(result.description).toBeNull(); // Not in allowed fields
        expect(result.price_amount).toBe(450000);
        expect(result.bedrooms).toBe(3);
        expect(result.bathrooms).toBeNull(); // Not in allowed fields
        expect(result.image_url).toBeNull(); // Not in allowed fields
        expect(result.source_type).toBe('linkout');
    });

    it('truncates long titles', () => {
        const longTitle = 'A'.repeat(200);
        const extracted = { ...mockExtracted, title: longTitle };

        const result = normalizeListing(extracted, 'property.mt', ['title'], 'linkout');

        expect(result.title.length).toBeLessThanOrEqual(100);
        expect(result.title.endsWith('...')).toBe(true);
    });

    it('computes content hash', () => {
        const result = normalizeListing(mockExtracted, 'property.mt', ['title'], 'linkout');

        expect(result.content_hash).toBeDefined();
        expect(result.content_hash.length).toBe(32); // MD5 hex length
    });
});

describe('inferPropertyType', () => {
    it('identifies apartments', () => {
        expect(inferPropertyType('Luxury Apartment in Sliema')).toBe('apartment');
        expect(inferPropertyType('2 bedroom flat for sale')).toBe('apartment');
        expect(inferPropertyType('Penthouse with terrace')).toBe('apartment');
        expect(inferPropertyType('Studio near University')).toBe('apartment');
        expect(inferPropertyType('Maisonette in Mosta')).toBe('apartment');
    });

    it('identifies houses', () => {
        expect(inferPropertyType('Traditional Townhouse in Valletta')).toBe('house');
        expect(inferPropertyType('Villa with pool')).toBe('house');
        expect(inferPropertyType('Bungalow for sale')).toBe('house');
        expect(inferPropertyType('Farmhouse in Gozo')).toBe('house');
    });

    it('identifies commercial properties', () => {
        expect(inferPropertyType('Office space for rent')).toBe('commercial');
        expect(inferPropertyType('Shop in busy area')).toBe('commercial');
        expect(inferPropertyType('Warehouse for lease')).toBe('commercial');
    });

    it('identifies land', () => {
        expect(inferPropertyType('Building plot for sale')).toBe('land');
        expect(inferPropertyType('Development site')).toBe('land');
    });

    it('defaults to apartment', () => {
        expect(inferPropertyType('Property for sale')).toBe('apartment');
    });
});

describe('parseAllowedFields', () => {
    it('parses valid field arrays', () => {
        const fields = ['title', 'price', 'bedrooms', 'url'];
        const result = parseAllowedFields(fields);

        expect(result).toEqual(['title', 'price', 'bedrooms', 'url']);
    });

    it('filters invalid fields', () => {
        const fields = ['title', 'invalid_field', 'price', 'another_bad'];
        const result = parseAllowedFields(fields);

        expect(result).toEqual(['title', 'price']);
    });

    it('returns defaults for non-array input', () => {
        expect(parseAllowedFields(null)).toEqual(['title', 'price', 'bedrooms', 'url']);
        expect(parseAllowedFields(undefined)).toEqual(['title', 'price', 'bedrooms', 'url']);
        expect(parseAllowedFields('not an array')).toEqual(['title', 'price', 'bedrooms', 'url']);
    });
});

describe('computeSimilarity', () => {
    it('returns 1.0 for identical listings', () => {
        const listing = {
            title: '3 bedroom apartment in Sliema',
            price: 300000,
            bedrooms: 3,
            area: 'Sliema',
        };

        const similarity = computeSimilarity(listing, listing);

        expect(similarity).toBe(1);
    });

    it('returns high similarity for very similar listings', () => {
        const listing1 = {
            title: '3 bedroom apartment in Sliema for sale',
            price: 300000,
            bedrooms: 3,
            area: 'Sliema',
        };

        const listing2 = {
            title: '3 bedroom apartment in Sliema',
            price: 305000,
            bedrooms: 3,
            area: 'Sliema',
        };

        const similarity = computeSimilarity(listing1, listing2);

        expect(similarity).toBeGreaterThan(0.8);
    });

    it('returns low similarity for different listings', () => {
        const listing1 = {
            title: '3 bedroom apartment in Sliema',
            price: 300000,
            bedrooms: 3,
            area: 'Sliema',
        };

        const listing2 = {
            title: 'Villa in Gozo with pool',
            price: 800000,
            bedrooms: 5,
            area: 'Gozo',
        };

        const similarity = computeSimilarity(listing1, listing2);

        expect(similarity).toBeLessThan(0.3);
    });

    it('handles null values gracefully', () => {
        const listing1 = {
            title: 'Apartment for sale',
            price: null,
            bedrooms: null,
            area: null,
        };

        const listing2 = {
            title: 'Apartment for rent',
            price: null,
            bedrooms: null,
            area: null,
        };

        const similarity = computeSimilarity(listing1, listing2);

        expect(similarity).toBeGreaterThan(0);
        expect(similarity).toBeLessThanOrEqual(1);
    });
});
