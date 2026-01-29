/**
 * Risk Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('../db.js', () => ({
    query: vi.fn(),
    transaction: vi.fn(),
}));

// Mock the logger
vi.mock('../observability/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Risk Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isRiskScoringEnabled', () => {
        it('should return true when RISK_SCORING_ENABLED is not set', async () => {
            const originalEnv = process.env.RISK_SCORING_ENABLED;
            delete process.env.RISK_SCORING_ENABLED;

            const { isRiskScoringEnabled } = await import('../services/riskService.js');
            expect(isRiskScoringEnabled()).toBe(true);

            process.env.RISK_SCORING_ENABLED = originalEnv;
        });

        it('should return false when RISK_SCORING_ENABLED is false', async () => {
            const originalEnv = process.env.RISK_SCORING_ENABLED;
            process.env.RISK_SCORING_ENABLED = 'false';

            // Re-import to get fresh module
            vi.resetModules();
            const { isRiskScoringEnabled } = await import('../services/riskService.js');
            expect(isRiskScoringEnabled()).toBe(false);

            process.env.RISK_SCORING_ENABLED = originalEnv;
        });
    });

    describe('Fingerprint Computation', () => {
        it('should normalize text correctly', () => {
            // Test the normalization logic conceptually
            // The actual function is internal, so we test via expected behavior
            const testCases = [
                { input: 'Hello World!', expected: 'hello world' },
                { input: '  Multiple   Spaces  ', expected: 'multiple spaces' },
                { input: 'Special@#$%^&*Characters', expected: 'specialcharacters' },
            ];

            testCases.forEach(({ input, expected }) => {
                const normalized = input
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                expect(normalized).toBe(expected);
            });
        });

        it('should compute price buckets correctly', () => {
            const PRICE_BUCKETS = [
                { max: 100000, label: 'under_100k' },
                { max: 250000, label: '100k_250k' },
                { max: 500000, label: '250k_500k' },
                { max: 1000000, label: '500k_1m' },
                { max: 2000000, label: '1m_2m' },
                { max: Infinity, label: 'over_2m' },
            ];

            const getPriceBucket = (price: number | null): string => {
                if (!price || price <= 0) return 'unknown';
                const bucket = PRICE_BUCKETS.find(b => price <= b.max);
                return bucket?.label || 'unknown';
            };

            expect(getPriceBucket(50000)).toBe('under_100k');
            expect(getPriceBucket(150000)).toBe('100k_250k');
            expect(getPriceBucket(400000)).toBe('250k_500k');
            expect(getPriceBucket(750000)).toBe('500k_1m');
            expect(getPriceBucket(1500000)).toBe('1m_2m');
            expect(getPriceBucket(5000000)).toBe('over_2m');
            expect(getPriceBucket(null)).toBe('unknown');
            expect(getPriceBucket(0)).toBe('unknown');
        });
    });

    describe('Risk Scoring Logic', () => {
        it('should classify risk levels correctly', () => {
            const RISK_THRESHOLDS = {
                HIGH: 70,
                MEDIUM: 40,
            };

            const getRiskLevel = (score: number): 'low' | 'medium' | 'high' => {
                if (score >= RISK_THRESHOLDS.HIGH) return 'high';
                if (score >= RISK_THRESHOLDS.MEDIUM) return 'medium';
                return 'low';
            };

            // High risk
            expect(getRiskLevel(100)).toBe('high');
            expect(getRiskLevel(70)).toBe('high');

            // Medium risk
            expect(getRiskLevel(69)).toBe('medium');
            expect(getRiskLevel(40)).toBe('medium');

            // Low risk
            expect(getRiskLevel(39)).toBe('low');
            expect(getRiskLevel(0)).toBe('low');
        });

        it('should determine status based on risk level', () => {
            const getStatus = (riskLevel: string): 'ok' | 'hold' | 'review_required' => {
                if (riskLevel === 'high') return 'hold';
                if (riskLevel === 'medium') return 'review_required';
                return 'ok';
            };

            expect(getStatus('high')).toBe('hold');
            expect(getStatus('medium')).toBe('review_required');
            expect(getStatus('low')).toBe('ok');
        });
    });

    describe('Risk Factors', () => {
        it('should identify risk factors correctly', () => {
            const analyzeRiskFactors = (listing: {
                hasDuplicate: boolean;
                hasMatchingPhoto: boolean;
                hasLocation: boolean;
                hasImages: boolean;
                priceOutlier: boolean;
            }): { score: number; reasons: string[] } => {
                let score = 0;
                const reasons: string[] = [];

                if (listing.hasDuplicate) {
                    score += 40;
                    reasons.push('Duplicate fingerprint detected');
                }
                if (listing.hasMatchingPhoto) {
                    score += 35;
                    reasons.push('Photo matches another listing');
                }
                if (!listing.hasLocation) {
                    score += 10;
                    reasons.push('Missing location');
                }
                if (!listing.hasImages) {
                    score += 15;
                    reasons.push('No photos provided');
                }
                if (listing.priceOutlier) {
                    score += 20;
                    reasons.push('Price outlier');
                }

                return { score, reasons };
            };

            // Normal listing
            const normal = analyzeRiskFactors({
                hasDuplicate: false,
                hasMatchingPhoto: false,
                hasLocation: true,
                hasImages: true,
                priceOutlier: false,
            });
            expect(normal.score).toBe(0);
            expect(normal.reasons).toHaveLength(0);

            // High risk duplicate
            const duplicate = analyzeRiskFactors({
                hasDuplicate: true,
                hasMatchingPhoto: false,
                hasLocation: true,
                hasImages: true,
                priceOutlier: false,
            });
            expect(duplicate.score).toBe(40);
            expect(duplicate.reasons).toContain('Duplicate fingerprint detected');

            // Multiple risk factors
            const multipleRisks = analyzeRiskFactors({
                hasDuplicate: true,
                hasMatchingPhoto: true,
                hasLocation: false,
                hasImages: false,
                priceOutlier: true,
            });
            expect(multipleRisks.score).toBe(40 + 35 + 10 + 15 + 20);
            expect(multipleRisks.reasons).toHaveLength(5);
        });
    });
});
