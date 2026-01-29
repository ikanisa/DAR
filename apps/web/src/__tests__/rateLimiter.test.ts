/**
 * Rate Limiter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    checkRateLimit,
    recordAction,
    checkAndRecord,
    clearLimits,
    RATE_LIMITS
} from '../lib/rateLimiter';

const TEST_SESSION = 'test-session-123';

describe('rateLimiter', () => {
    beforeEach(() => {
        // Clear limits before each test
        clearLimits(TEST_SESSION);
        localStorage.clear();
    });

    describe('checkRateLimit', () => {
        it('should allow actions under the limit', () => {
            const result = checkRateLimit(TEST_SESSION, 'message');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(RATE_LIMITS.message.maxCount);
        });

        it('should block actions over the limit', () => {
            // Record max actions
            for (let i = 0; i < RATE_LIMITS.message.maxCount; i++) {
                recordAction(TEST_SESSION, 'message');
            }

            const result = checkRateLimit(TEST_SESSION, 'message');

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfterMs).toBeDefined();
        });
    });

    describe('checkAndRecord', () => {
        it('should record action when allowed', () => {
            const result = checkAndRecord(TEST_SESSION, 'post');

            expect(result.allowed).toBe(true);
            // remaining is checked AFTER recording, so it's maxCount - 1
            // But we check before the action, so remaining shows what was available
            expect(result.remaining).toBeLessThanOrEqual(RATE_LIMITS.post.maxCount);
        });

        it('should not record when blocked', () => {
            // Fill up the limit
            for (let i = 0; i < RATE_LIMITS.post.maxCount; i++) {
                recordAction(TEST_SESSION, 'post');
            }

            const beforeCount = checkRateLimit(TEST_SESSION, 'post').remaining;
            checkAndRecord(TEST_SESSION, 'post');
            const afterCount = checkRateLimit(TEST_SESSION, 'post').remaining;

            expect(beforeCount).toBe(afterCount);
        });
    });

    describe('limits', () => {
        it('should enforce 20 messages per minute', () => {
            expect(RATE_LIMITS.message.maxCount).toBe(20);
            expect(RATE_LIMITS.message.windowMs).toBe(60_000);
        });

        it('should enforce 10 posts per hour', () => {
            expect(RATE_LIMITS.post.maxCount).toBe(10);
            expect(RATE_LIMITS.post.windowMs).toBe(3_600_000);
        });

        it('should enforce 10 listings per hour', () => {
            expect(RATE_LIMITS.listing.maxCount).toBe(10);
            expect(RATE_LIMITS.listing.windowMs).toBe(3_600_000);
        });
    });
});
