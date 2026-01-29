import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateListing } from '../tools/validateListing';
import { dedupeListing } from '../tools/dedupeListing';
import { submitAdminDecision } from '../tools/adminDecision';
import { audit } from '../audit';
import * as db from '../db';

vi.mock('../db', () => ({
    query: vi.fn(),
    transaction: vi.fn((fn) => fn({ query: vi.fn(() => ({ rowCount: 1, rows: [{ id: 'test-id', status: 'approved' }] })) })),
}));

vi.mock('../audit', () => ({
    audit: vi.fn(),
    AuditActions: {
        TOOL_LISTING_VALIDATE: 'tool.listing.validate',
        TOOL_LISTING_DEDUPE: 'tool.listing.dedupe',
        TOOL_ADMIN_DECISION: 'tool.admin.decision',
    },
}));

describe('Backend Tools', () => {

    describe('validateListing', () => {
        it('should detect missing listing', async () => {
            // @ts-ignore
            db.query
                .mockResolvedValueOnce({ rows: [] }) // listing search
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // photo count check

            const result = await validateListing({ listing_id: '00000000-0000-0000-0000-000000000000' }, 'test-actor');
            expect(result.ok).toBe(false);
            expect(result.errors).toContain('Listing not found');
        });

        it('should validate valid payload', async () => {
            const result = await validateListing({
                listing_payload: {
                    title: 'Nice house',
                    description: 'A very nice house with a long description that is definitely more than 100 characters long. It checks all the boxes for a good description on our platform.',
                    price_amount: 1000,
                    address_text: '123 Test St',
                }
            }, 'test-actor');

            expect(result.ok).toBe(true);
            expect(result.score).toBe(100);
        });

        it('should fail short description', async () => {
            const result = await validateListing({
                listing_payload: {
                    title: 'Nice house',
                    description: 'Too short',
                    price_amount: 1000,
                    address_text: '123 Test St',
                }
            }, 'test-actor');

            expect(result.ok).toBe(false);
            expect(result.errors).toContain('Description must be at least 100 characters');
        });
    });

    describe('dedupeListing', () => {
        it('should detect duplicates by poster and address', async () => {
            // @ts-ignore
            db.query
                // First call gets listing
                // @ts-ignore
                .mockResolvedValueOnce({ rows: [{ id: '00000000-0000-0000-0000-000000000000', poster_id: 'p1', address_text: 'Test St' }] })
                // Second call finds duplicate
                .mockResolvedValueOnce({ rows: [{ id: 'dup-1' }] });

            const result = await dedupeListing({ listing_id: '00000000-0000-0000-0000-000000000000' }, 'test-actor');
            expect(result.duplicates).toContain('dup-1');
        });
    });

    describe('submitAdminDecision', () => {
        it('should allow valid transition', async () => {
            const result = await submitAdminDecision({
                listing_id: '00000000-0000-0000-0000-000000000000',
                result: 'approved',
                nextStatus: 'approved'
            }, 'admin-1');

            expect(result.listing.status).toBe('approved');
            expect(audit).toHaveBeenCalled();
        });

        it('should block invalid transition', async () => {
            await expect(submitAdminDecision({
                listing_id: '00000000-0000-0000-0000-000000000000',
                result: 'rejected',
                nextStatus: 'approved' // Invalid
            }, 'admin-1')).rejects.toThrow('Invalid status transition');
        });
    });
});
