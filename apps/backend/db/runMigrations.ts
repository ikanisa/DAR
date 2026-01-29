/**
 * Run Migrations Script
 * Applies all SQL migrations in order to the database
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

async function runMigrations() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }

    const client = new pg.Client({ connectionString: databaseUrl });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Create migrations tracking table if not exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Get list of applied migrations
        const { rows: applied } = await client.query(
            'SELECT name FROM _migrations ORDER BY name'
        );
        const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

        // Get all migration files
        const files = await readdir(migrationsDir);
        const sqlFiles = files
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`📁 Found ${sqlFiles.length} migration files`);

        let appliedCount = 0;

        for (const file of sqlFiles) {
            if (appliedSet.has(file)) {
                console.log(`⏭️  Skipping ${file} (already applied)`);
                continue;
            }

            console.log(`🔄 Applying ${file}...`);

            const sql = await readFile(join(migrationsDir, file), 'utf-8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(
                    'INSERT INTO _migrations (name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');
                console.log(`✅ Applied ${file}`);
                appliedCount++;
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed to apply ${file}:`, err);
                throw err;
            }
        }

        console.log(`\n✅ Migration complete. Applied ${appliedCount} new migrations.`);

    } finally {
        await client.end();
    }
}

runMigrations().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
