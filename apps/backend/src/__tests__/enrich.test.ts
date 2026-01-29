/**
 * Enrichment Tests
 * Tests for geo enrichment functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies
vi.mock('../db.js', () => ({
    query: vi.fn(),
}));

vi.mock('../integrations/aiGeocode.js', () => ({
    geocodeClient: {
        geocode: vi.fn(),
        getNearbyPOIs: vi.fn(),
    },
}));

vi.mock('../observability/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../audit.js', () => ({
    audit: vi.fn(),
    AuditActions: {
        ENRICH_RUN: 'enrich.run',
    },
}));

import { query } from '../db.js';
import { geocodeClient } from '../integrations/aiGeocode.js';
import { runEnrichment, getEnrichmentStats, clearOldCache } from '../jobs/enrichJob.js';

const mockQuery = query as unknown as ReturnType<typeof vi.fn>;
const mockGeocode = geocodeClient.geocode as unknown as ReturnType<typeof vi.fn>;
const mockGetNearbyPOIs = geocodeClient.getNearbyPOIs as unknown as ReturnType<typeof vi.fn>;

describe('Enrichment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('runEnrichment', () => {
        it('should skip listings without address or title', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'test-1',
                    location: null,
                    title: null,
                    lat: null,
                    lng: null,
                }],
            });

            const stats = await runEnrichment(10);

            expect(stats.skipped).toBe(1);
            expect(stats.geocoded).toBe(0);
            expect(mockGeocode).not.toHaveBeenCalled();
        });

        it('should geocode listings without coordinates', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'test-1',
                    location: 'Sliema, Malta',
                    title: 'Modern Apartment',
                    lat: null,
                    lng: null,
                }],
            });

            mockGeocode.mockResolvedValueOnce({
                lat: 35.9125,
                lng: 14.5014,
                formattedAddress: 'Sliema, Malta',
                locality: 'Sliema',
                neighborhood: null,
                confidence: 80,
            });

            mockGetNearbyPOIs.mockResolvedValueOnce([
                { name: 'Sliema Bus Stop', type: 'transit', distance: 200 },
                { name: 'Tower Supermarket', type: 'supermarket', distance: 300 },
            ]);

            mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

            const stats = await runEnrichment(10);

            expect(stats.geocoded).toBe(1);
            expect(stats.poiEnriched).toBe(1);
            expect(mockGeocode).toHaveBeenCalledWith('Sliema, Malta');
            expect(mockGetNearbyPOIs).toHaveBeenCalledWith(35.9125, 14.5014);
        });

        it('should NOT overwrite user-provided coordinates', async () => {
            // Listing already has coordinates
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'test-1',
                    location: 'Valletta, Malta',
                    title: 'Historic House',
                    lat: 35.8989, // User provided
                    lng: 14.5146, // User provided
                }],
            });

            mockGetNearbyPOIs.mockResolvedValueOnce([
                { name: 'Valletta Bus Terminal', type: 'transit', distance: 100 },
            ]);

            mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

            const stats = await runEnrichment(10);

            // Should NOT call geocode since lat/lng already exist
            expect(mockGeocode).not.toHaveBeenCalled();
            // Should still get POIs
            expect(mockGetNearbyPOIs).toHaveBeenCalledWith(35.8989, 14.5146);
            expect(stats.poiEnriched).toBe(1);
            expect(stats.geocoded).toBe(0);
        });

        it('should extract locality from title as fallback', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'test-1',
                    location: null, // No location field
                    title: 'Beautiful 2BR in St Julian\'s', // Has locality in title
                    lat: null,
                    lng: null,
                }],
            });

            mockGeocode.mockResolvedValueOnce({
                lat: 35.9186,
                lng: 14.4892,
                formattedAddress: "St. Julian's, Malta",
                locality: "St. Julian's",
                neighborhood: 'Paceville',
                confidence: 60,
            });

            mockGetNearbyPOIs.mockResolvedValueOnce([]);
            mockQuery.mockResolvedValueOnce({ rowCount: 1 });

            const stats = await runEnrichment(10);

            expect(stats.geocoded).toBe(1);
            // The geocode should have been called with extracted locality
            expect(mockGeocode).toHaveBeenCalled();
        });
    });

    describe('getEnrichmentStats', () => {
        it('should return aggregated statistics', async () => {
            mockQuery
                .mockResolvedValueOnce({
                    rows: [{
                        total: '100',
                        geocoded: '75',
                        with_pois: '60',
                        high_confidence: '50',
                    }],
                })
                .mockResolvedValueOnce({
                    rows: [{
                        geo_size: '200',
                        poi_size: '150',
                    }],
                });

            const stats = await getEnrichmentStats();

            expect(stats.listings.total).toBe(100);
            expect(stats.listings.geocoded).toBe(75);
            expect(stats.listings.withPois).toBe(60);
            expect(stats.listings.highConfidence).toBe(50);
            expect(stats.cache.geoSize).toBe(200);
            expect(stats.cache.poiSize).toBe(150);
        });
    });

    describe('clearOldCache', () => {
        it('should clear cache entries older than 30 days', async () => {
            mockQuery
                .mockResolvedValueOnce({ rowCount: 10 }) // geo_cache deleted
                .mockResolvedValueOnce({ rowCount: 5 });  // poi_cache deleted

            const result = await clearOldCache();

            expect(result.geo).toBe(10);
            expect(result.poi).toBe(5);

            // Check both DELETE queries were called
            expect(mockQuery).toHaveBeenCalledTimes(2);
        });
    });

    describe('POI grouping', () => {
        it('should group POIs by type in listing update', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'test-1',
                    location: 'Mosta, Malta',
                    title: 'Family Home',
                    lat: null,
                    lng: null,
                }],
            });

            mockGeocode.mockResolvedValueOnce({
                lat: 35.9094,
                lng: 14.4256,
                formattedAddress: 'Mosta, Malta',
                locality: 'Mosta',
                neighborhood: null,
                confidence: 70,
            });

            // Return mixed POI types
            mockGetNearbyPOIs.mockResolvedValueOnce([
                { name: 'Mosta Primary School', type: 'school', distance: 300 },
                { name: 'Mosta Health Centre', type: 'hospital', distance: 500 },
                { name: 'Mosta Bus Stop', type: 'transit', distance: 150 },
                { name: 'Smart Supermarket', type: 'supermarket', distance: 200 },
            ]);

            mockQuery.mockResolvedValueOnce({ rowCount: 1 });

            await runEnrichment(10);

            // Verify the UPDATE was called with grouped POIs
            const updateCall = mockQuery.mock.calls[1];
            expect(updateCall).toBeDefined();

            // The 6th parameter (index 5) should be the poi_context JSON
            const poiContextArg = updateCall[1][5];
            if (poiContextArg) {
                const parsed = JSON.parse(poiContextArg);
                expect(parsed.school).toBeDefined();
                expect(parsed.hospital).toBeDefined();
                expect(parsed.transit).toBeDefined();
                expect(parsed.supermarket).toBeDefined();
            }
        });
    });
});
