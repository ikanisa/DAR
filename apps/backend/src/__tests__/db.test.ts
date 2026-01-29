/**
 * Database Tests
 * W1 Workflow: Verify core database functionality
 *
 * Tests:
 * - Table existence
 * - Audit log insert
 * - Inbound events idempotency (reject duplicates)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const { Client } = pg;

// Test database URL - use test env or fallback
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/dar_test';

let client: pg.Client;

describe('Database Schema', () => {
    beforeAll(async () => {
        client = new Client({ connectionString: DATABASE_URL });
        try {
            await client.connect();
        } catch (err) {
            console.warn('Could not connect to database, skipping DB tests');
            throw err;
        }
    });

    afterAll(async () => {
        if (client) {
            await client.end();
        }
    });

    describe('Table Existence', () => {
        const coreTables = [
            'users',
            'listings',
            'listing_media',
            'reviews',
            'seeker_profiles',
            'matches',
            'viewings',
            'chat_sessions',
            'audit_log',
            'inbound_events',
        ];

        it.each(coreTables)('should have table: %s', async (tableName) => {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);

            expect(result.rows[0].exists).toBe(true);
        });
    });

    describe('Audit Log', () => {
        it('should insert audit log entry', async () => {
            const result = await client.query(`
                INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
                VALUES ('system', 'test-runner', 'db.test', 'test', 'test-entity', '{"test": true}')
                RETURNING id
            `);

            expect(result.rowCount).toBe(1);
            expect(result.rows[0].id).toBeDefined();

            // Clean up
            await client.query('DELETE FROM audit_log WHERE actor_id = $1', ['test-runner']);
        });

        it('should auto-populate created_at timestamp', async () => {
            const before = new Date();

            const result = await client.query(`
                INSERT INTO audit_log (actor_type, actor_id, action, entity)
                VALUES ('system', 'test-runner', 'timestamp.test', 'test')
                RETURNING created_at
            `);

            const after = new Date();
            const createdAt = new Date(result.rows[0].created_at);

            expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
            expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);

            // Clean up
            await client.query('DELETE FROM audit_log WHERE actor_id = $1', ['test-runner']);
        });
    });

    describe('Inbound Events Idempotency', () => {
        const testEventId = 'test-event-' + Date.now();

        afterAll(async () => {
            // Clean up test events
            await client.query('DELETE FROM inbound_events WHERE id LIKE $1', ['test-event-%']);
        });

        it('should insert new event', async () => {
            const result = await client.query(`
                INSERT INTO inbound_events (id, source, payload)
                VALUES ($1, 'test', '{"test": true}')
                RETURNING id
            `, [testEventId]);

            expect(result.rowCount).toBe(1);
            expect(result.rows[0].id).toBe(testEventId);
        });

        it('should reject duplicate event (primary key violation)', async () => {
            // Try to insert the same event again
            await expect(
                client.query(`
                    INSERT INTO inbound_events (id, source, payload)
                    VALUES ($1, 'test', '{"duplicate": true}')
                `, [testEventId])
            ).rejects.toThrow(/duplicate key/i);
        });

        it('should allow ON CONFLICT DO NOTHING for idempotent inserts', async () => {
            const result = await client.query(`
                INSERT INTO inbound_events (id, source, payload)
                VALUES ($1, 'test', '{"duplicate": true}')
                ON CONFLICT (id) DO NOTHING
                RETURNING id
            `, [testEventId]);

            // Should return empty (no insert happened)
            expect(result.rowCount).toBe(0);
        });

        it('should insert different event IDs', async () => {
            const newEventId = 'test-event-new-' + Date.now();

            const result = await client.query(`
                INSERT INTO inbound_events (id, source, payload)
                VALUES ($1, 'test', '{"different": true}')
                RETURNING id
            `, [newEventId]);

            expect(result.rowCount).toBe(1);
            expect(result.rows[0].id).toBe(newEventId);
        });
    });

    describe('Index Existence', () => {
        const expectedIndexes = [
            'idx_listings_status',
            'idx_listings_poster_id',
            'idx_audit_log_created_at',
            'idx_inbound_events_received_at',
        ];

        it.each(expectedIndexes)('should have index: %s', async (indexName) => {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM pg_indexes 
                    WHERE schemaname = 'public' 
                    AND indexname = $1
                )
            `, [indexName]);

            expect(result.rows[0].exists).toBe(true);
        });
    });

    describe('Enum Types', () => {
        const expectedEnums = [
            'user_role',
            'listing_status',
            'property_type',
            'actor_type',
        ];

        it.each(expectedEnums)('should have enum type: %s', async (enumName) => {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM pg_type 
                    WHERE typname = $1
                )
            `, [enumName]);

            expect(result.rows[0].exists).toBe(true);
        });
    });
});

describe('Data Integrity', () => {
    beforeAll(async () => {
        client = new Client({ connectionString: DATABASE_URL });
        try {
            await client.connect();
        } catch {
            // Skip if no connection
        }
    });

    afterAll(async () => {
        if (client) {
            await client.end();
        }
    });

    it('should enforce actor_type enum constraint on audit_log', async () => {
        await expect(
            client.query(`
                INSERT INTO audit_log (actor_type, actor_id, action, entity)
                VALUES ('invalid_type', 'test', 'test', 'test')
            `)
        ).rejects.toThrow(/invalid input value for enum/i);
    });

    it('should enforce price_amount > 0 on listings', async () => {
        // First we need a user
        const userResult = await client.query(`
            INSERT INTO users (role, name)
            VALUES ('poster', 'Test User')
            RETURNING id
        `);
        const userId = userResult.rows[0].id;

        await expect(
            client.query(`
                INSERT INTO listings (poster_id, title, description, type, price_amount, status)
                VALUES ($1, 'Test', 'Test', 'apartment', -100, 'draft')
            `, [userId])
        ).rejects.toThrow(/violates check constraint/i);

        // Clean up
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
    });
});
