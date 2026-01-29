
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateWeeklyBrief } from '../reports/weeklyMarketBrief';
import { detectAnomalies } from '../reports/anomalyDetector';
import { db } from '../db';

// Mock dependencies
vi.mock('../integrations/aiResearch', () => ({
    researchClient: {
        deepResearch: vi.fn().mockResolvedValue({
            content: 'Mocked Research Content',
            citations: [{ title: 'Source 1', url: 'http://example.com' }],
            model: 'mock-model',
            tokensUsed: 100
        }),
        webSearch: vi.fn(),
    }
}));

vi.mock('../audit', () => ({
    writeAudit: vi.fn().mockResolvedValue(undefined),
    audit: vi.fn().mockResolvedValue(undefined),
}));

// We'll mock db queries but testing sql logic is better with integration tests.
// For this unit/integration hybrid, we'll spy on db.query but assume a real DB connection 
// might fail if not set up, so we'll mock the query responses for safety.
vi.mock('../db', () => ({
    db: {
        query: vi.fn(),
        getPool: vi.fn(),
    }
}));

const mockDb = db as any;

describe('Ops Research Reports', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateWeeklyBrief', () => {
        it('should generate a brief with mocked stats and research', async () => {
            // Mock db responses for getInternalStats
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ new_listings: 10, active_listings: 50, linkout_listings: 5, avg_rent: 1200 }] }) // listings stats
                .mockResolvedValueOnce({ rows: [{ area: 'Sliema', count: 20 }] }) // top areas
                .mockResolvedValueOnce({ rows: [{ new_anomalies: 2, unresolved: 1 }] }) // anomalies stats
                .mockResolvedValueOnce({ rows: [] }); // Insert report result

            const report = await generateWeeklyBrief();

            expect(report).toContain('Mocked Research Content');
            expect(report).toContain('New listings this week: 10');
            expect(report).toContain('Sliema');

            expect(mockDb.query).toHaveBeenCalledTimes(4); // 3 stats queries + 1 insert
        });
    });

    describe('detectAnomalies', () => {
        it('should detect price outliers', async () => {
            mockDb.query
                // Price outliers query result
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'list-1', title: 'Expensive Flat', price_amount: 5000,
                        type: 'apartment', area: 'Sliema', mean: 1500, stddev: 500, z_score: 7.0
                    }]
                })
                // Stale listings query result
                .mockResolvedValueOnce({ rows: [] })
                // Duplicate suspects query result
                .mockResolvedValueOnce({ rows: [] })
                // Insert query
                .mockResolvedValueOnce({ rows: [] });

            const anomalies = await detectAnomalies();

            expect(anomalies).toHaveLength(1);
            expect(anomalies[0].type).toBe('price_outlier');
            expect(anomalies[0].severity).toBe('high');
            expect(anomalies[0].listingId).toBe('list-1');
        });
    });
});
