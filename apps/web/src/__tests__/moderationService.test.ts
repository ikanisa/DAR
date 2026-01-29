/**
 * Moderation Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { recordAction, getAllLimits } from '../lib/rateLimiter';

describe('moderationService', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('risk score calculation', () => {
        it('should return low risk for clean sessions', () => {
            const limits = getAllLimits('clean-session');

            // Clean session should have full remaining quota
            expect(limits.message.allowed).toBe(true);
            expect(limits.post.allowed).toBe(true);
            expect(limits.listing.allowed).toBe(true);
        });

        it('should detect when rate limits exceeded', () => {
            const session = 'rate-exceed-session';

            // Exceed message limit
            for (let i = 0; i < 25; i++) {
                recordAction(session, 'message');
            }

            const limits = getAllLimits(session);

            expect(limits.message.allowed).toBe(false);
            expect(limits.message.remaining).toBe(0);
        });
    });

    describe('rate limit integration', () => {
        it('should track all action types independently', () => {
            const session = 'multi-action-session';

            // Record different action types
            recordAction(session, 'message');
            recordAction(session, 'post');
            recordAction(session, 'listing');

            const limits = getAllLimits(session);

            // Each should have limit - 1 remaining
            expect(limits.message.remaining).toBe(19);
            expect(limits.post.remaining).toBe(9);
            expect(limits.listing.remaining).toBe(9);
        });
    });

    describe('session isolation', () => {
        it('should not share limits between sessions', () => {
            // Record on session A
            for (let i = 0; i < 5; i++) {
                recordAction('session-a', 'message');
            }

            // Session B should be unaffected
            const limitsB = getAllLimits('session-b');
            expect(limitsB.message.remaining).toBe(20);
        });
    });
});
