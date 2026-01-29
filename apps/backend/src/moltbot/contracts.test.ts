/**
 * Unit tests for Moltbot output contract validation
 */

import { describe, it, expect } from 'vitest';
import {
    validateAgentOutput,
    isValidAction,
    getValidActions,
    SeekerActions,
    AdminActions,
} from './contracts.js';

// ============================================================================
// Helper: Generate valid UUIDs for tests
// ============================================================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ============================================================================
// Seeker/Poster Contract Tests
// ============================================================================

describe('Seeker Output Validation', () => {
    describe('valid outputs', () => {
        it('should accept valid ask_user action', () => {
            const output = {
                thought: 'User wants to find a property, asking for more details.',
                action: 'ask_user',
                params: {
                    message: 'What location are you interested in?',
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
            expect(result.data).toEqual(output);
        });

        it('should accept valid search_properties action', () => {
            const output = {
                thought: 'User wants 2-bed apartments in Sliema under €1500.',
                action: 'search_properties',
                params: {
                    criteria: {
                        location: 'Sliema',
                        max_price: 1500,
                        bedrooms: 2,
                        property_type: 'apartment',
                    },
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(true);
        });

        it('should accept valid show_shortlist action', () => {
            const output = {
                thought: 'Found matching properties to show the user.',
                action: 'show_shortlist',
                params: {
                    message: 'Here are 3 apartments matching your criteria:',
                    candidates: [
                        {
                            listing_id: VALID_UUID,
                            title: 'Modern 2-bed in Sliema',
                            price: 1200,
                            match_score: 0.95,
                        },
                    ],
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(true);
        });

        it('should accept valid submit_for_review action', () => {
            const output = {
                thought: 'Draft is complete, submitting for admin review.',
                action: 'submit_for_review',
                params: {
                    draft_id: VALID_UUID,
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(true);
        });

        it('should accept valid schedule_viewing action', () => {
            const output = {
                thought: 'User wants to schedule a viewing for this property.',
                action: 'schedule_viewing',
                params: {
                    viewing: {
                        listing_id: VALID_UUID,
                        proposed_dates: ['2026-02-01T10:00:00Z', '2026-02-02T14:00:00Z'],
                        notes: 'Prefer morning viewings',
                    },
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(true);
        });
    });

    describe('invalid outputs', () => {
        it('should reject missing thought', () => {
            const output = {
                action: 'ask_user',
                params: { message: 'Hello' },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('thought: Required');
        });

        it('should reject thought too short', () => {
            const output = {
                thought: 'Short', // Less than 10 chars
                action: 'ask_user',
                params: { message: 'Hello' },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('thought'))).toBe(true);
        });

        it('should reject invalid action', () => {
            const output = {
                thought: 'This is a valid thought with enough characters.',
                action: 'invalid_action',
                params: {},
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('action'))).toBe(true);
        });

        it('should reject ask_user without message', () => {
            const output = {
                thought: 'Asking the user a question about their preferences.',
                action: 'ask_user',
                params: {},
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('message'))).toBe(true);
        });

        it('should reject search_properties without criteria', () => {
            const output = {
                thought: 'Searching properties based on user requirements.',
                action: 'search_properties',
                params: {},
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('criteria'))).toBe(true);
        });

        it('should reject show_shortlist without candidates', () => {
            const output = {
                thought: 'Showing shortlist to the user based on their criteria.',
                action: 'show_shortlist',
                params: {
                    message: 'Here are some options',
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('candidates'))).toBe(true);
        });

        it('should reject invalid UUID format', () => {
            const output = {
                thought: 'Submitting draft for review with all required info.',
                action: 'submit_for_review',
                params: {
                    draft_id: 'not-a-uuid',
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('uuid'))).toBe(true);
        });

        it('should reject too many candidates (>20)', () => {
            const output = {
                thought: 'Showing a large shortlist to the user with matches.',
                action: 'show_shortlist',
                params: {
                    message: 'Many options',
                    candidates: Array(25)
                        .fill(null)
                        .map((_, i) => ({
                            listing_id: VALID_UUID,
                            title: `Listing ${i}`,
                        })),
                },
            };

            const result = validateAgentOutput(output, 'seeker');
            expect(result.valid).toBe(false);
        });
    });
});

// ============================================================================
// Admin Contract Tests
// ============================================================================

describe('Admin Output Validation', () => {
    describe('valid outputs', () => {
        it('should accept valid approve_listing action', () => {
            const output = {
                thought: 'Listing meets all requirements and is ready to publish.',
                action: 'approve_listing',
                params: {
                    listing_id: VALID_UUID,
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid reject_listing action', () => {
            const output = {
                thought: 'Listing has prohibited content that violates terms.',
                action: 'reject_listing',
                params: {
                    listing_id: VALID_UUID,
                    reason: 'Contains prohibited content',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid request_changes action', () => {
            const output = {
                thought: 'Listing needs better photos and clearer description.',
                action: 'request_changes',
                params: {
                    listing_id: VALID_UUID,
                    changes_requested: [
                        { field: 'photos', issue: 'Need at least 5 photos', suggestion: 'Add more interior shots' },
                        { field: 'description', issue: 'Too brief' },
                    ],
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid flag_moderation action', () => {
            const output = {
                thought: 'This listing appears to be a duplicate of another listing.',
                action: 'flag_moderation',
                params: {
                    listing_id: VALID_UUID,
                    moderation_category: 'duplicate',
                    reason: 'Same photos and description as listing XYZ',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid escalate action', () => {
            const output = {
                thought: 'Potential fraud detected, needs senior review urgently.',
                action: 'escalate',
                params: {
                    listing_id: VALID_UUID,
                    severity: 'high',
                    reason: 'Suspected fraudulent listing with stolen photos',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid suspend_user action', () => {
            const output = {
                thought: 'User has repeatedly posted spam listings, needs suspension.',
                action: 'suspend_user',
                params: {
                    user_id: VALID_UUID,
                    reason: 'Repeated spam violations',
                    suspension_duration: '7d',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid view_queue action', () => {
            const output = {
                thought: 'Admin wants to see the pending review queue.',
                action: 'view_queue',
                params: {
                    queue_filter: {
                        status: 'pending',
                        priority: 'newest',
                        limit: 10,
                    },
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });

        it('should accept valid risk_override action', () => {
            const output = {
                thought: 'Overriding risk hold because user is trusted.',
                action: 'risk_override',
                params: {
                    listing_id: VALID_UUID,
                    decision: 'allow',
                    notes: 'Verified manually',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(true);
        });
    });

    describe('invalid outputs', () => {
        it('should reject reject_listing without reason', () => {
            const output = {
                thought: 'Rejecting this listing due to policy violations.',
                action: 'reject_listing',
                params: {
                    listing_id: VALID_UUID,
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('reason'))).toBe(true);
        });

        it('should reject flag_moderation without category', () => {
            const output = {
                thought: 'Flagging this listing for moderation review.',
                action: 'flag_moderation',
                params: {
                    listing_id: VALID_UUID,
                    reason: 'Suspicious listing',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('moderation_category'))).toBe(true);
        });

        it('should reject invalid moderation_category', () => {
            const output = {
                thought: 'Flagging listing for unknown category issue.',
                action: 'flag_moderation',
                params: {
                    listing_id: VALID_UUID,
                    moderation_category: 'invalid_category',
                    reason: 'Some reason',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(false);
        });

        it('should reject suspend_user without duration', () => {
            const output = {
                thought: 'Suspending user for multiple violations.',
                action: 'suspend_user',
                params: {
                    user_id: VALID_UUID,
                    reason: 'Violations',
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('suspension_duration'))).toBe(true);
        });

        it('should reject invalid suspension_duration', () => {
            const output = {
                thought: 'Suspending user for a custom duration period.',
                action: 'suspend_user',
                params: {
                    user_id: VALID_UUID,
                    reason: 'Violations',
                    suspension_duration: '2w', // Invalid - not in enum
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(false);
        });

        it('should reject risk_override without decision', () => {
            const output = {
                thought: 'Overriding risk assessment without providing a decision.',
                action: 'risk_override',
                params: {
                    listing_id: VALID_UUID,
                },
            };

            const result = validateAgentOutput(output, 'admin');
            expect(result.valid).toBe(false);
            expect(result.errors?.some((e) => e.includes('decision'))).toBe(true);
        });
    });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
    describe('isValidAction', () => {
        it('should return true for valid seeker actions', () => {
            expect(isValidAction('ask_user', 'seeker')).toBe(true);
            expect(isValidAction('search_properties', 'seeker')).toBe(true);
            expect(isValidAction('show_shortlist', 'seeker')).toBe(true);
        });

        it('should return true for valid admin actions', () => {
            expect(isValidAction('approve_listing', 'admin')).toBe(true);
            expect(isValidAction('reject_listing', 'admin')).toBe(true);
            expect(isValidAction('escalate', 'admin')).toBe(true);
        });

        it('should return false for invalid actions', () => {
            expect(isValidAction('hack_system', 'seeker')).toBe(false);
            expect(isValidAction('delete_database', 'admin')).toBe(false);
        });

        it('should return false for cross-contract actions', () => {
            // suspend_user is admin-only
            expect(isValidAction('suspend_user', 'seeker')).toBe(false);
            // schedule_viewing is seeker-only
            expect(isValidAction('schedule_viewing', 'admin')).toBe(false);
        });
    });

    describe('getValidActions', () => {
        it('should return seeker actions for seeker contract', () => {
            const actions = getValidActions('seeker');
            expect(actions).toEqual(SeekerActions);
            expect(actions).toContain('search_properties');
            expect(actions).not.toContain('suspend_user');
        });

        it('should return admin actions for admin contract', () => {
            const actions = getValidActions('admin');
            expect(actions).toEqual(AdminActions);
            expect(actions).toContain('approve_listing');
            expect(actions).not.toContain('search_properties');
        });
    });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
    it('should handle empty params object', () => {
        const output = {
            thought: 'Creating a new draft listing for the user.',
            action: 'create_draft',
            params: {},
        };

        const result = validateAgentOutput(output, 'seeker');
        // create_draft with empty params should be valid (no required params)
        expect(result.valid).toBe(true);
    });

    it('should handle null input', () => {
        const result = validateAgentOutput(null, 'seeker');
        expect(result.valid).toBe(false);
    });

    it('should handle undefined input', () => {
        const result = validateAgentOutput(undefined, 'seeker');
        expect(result.valid).toBe(false);
    });

    it('should handle non-object input', () => {
        const result = validateAgentOutput('string', 'seeker');
        expect(result.valid).toBe(false);
    });

    it('should handle array input', () => {
        const result = validateAgentOutput([], 'seeker');
        expect(result.valid).toBe(false);
    });

    it('should strip extra properties (additionalProperties)', () => {
        const output = {
            thought: 'Valid thought with enough characters for validation.',
            action: 'ask_user',
            params: { message: 'Hello' },
            extra_field: 'should be ignored',
        };

        // Zod by default strips extra fields, this should still validate
        const result = validateAgentOutput(output, 'seeker');
        // Note: additionalProperties in JSON Schema = strict() in Zod
        // Our schema doesn't use strict(), so extra fields are stripped
        expect(result.valid).toBe(true);
    });
});
