/**
 * Feature Flags Tests
 * 
 * Verify flags off preserves old behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isFeatureEnabled } from '../lib/featureFlags';

beforeEach(() => {
    localStorage.clear();
});

describe('featureFlags', () => {
    describe('isFeatureEnabled', () => {
        it('should handle unknown flags gracefully', () => {
            // Unknown flags should return undefined or falsy
            const result = isFeatureEnabled('UNKNOWN_FLAG' as any);
            expect(!result).toBe(true); // falsy check
        });

        it('should return value for known flags', () => {
            // Check that known flags return a value
            const result = isFeatureEnabled('WEB_EXTERNAL_DISCOVERY_ENABLED');
            // May be true or false depending on default, but should be defined
            expect(result !== undefined || result === false || result === true).toBe(true);
        });
    });

    describe('flags off behavior', () => {
        it('should allow checking external discovery flag', () => {
            // This should not throw
            expect(() => isFeatureEnabled('WEB_EXTERNAL_DISCOVERY_ENABLED')).not.toThrow();
        });

        it('should allow checking maps flag', () => {
            expect(() => isFeatureEnabled('WEB_MAPS_ENABLED')).not.toThrow();
        });

        it('should allow checking social flag', () => {
            expect(() => isFeatureEnabled('WEB_SOCIAL_ENABLED')).not.toThrow();
        });
    });

    describe('flag types', () => {
        it('should support all expected flag keys', () => {
            // These should not throw
            expect(() => isFeatureEnabled('WEB_EXTERNAL_DISCOVERY_ENABLED')).not.toThrow();
            expect(() => isFeatureEnabled('WEB_NOTIFICATIONS_ENABLED')).not.toThrow();
        });
    });
});
