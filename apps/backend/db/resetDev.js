/**
 * Reset Dev Database Script
 * Drops all tables and re-runs migrations + seed
 * WARNING: Destructive operation - dev only!
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');
async function resetDev() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }
    // Safety check: refuse to run in production
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ FATAL: Cannot reset database in production!');
        process.exit(1);
    }
    const client = new pg.Client({ connectionString: databaseUrl });
    try {
        await client.connect();
        console.log('✅ Connected to database');
        console.log('⚠️  WARNING: This will DELETE ALL DATA!\n');
        // Drop all custom types and tables
        console.log('🗑️  Dropping all objects...');
        await client.query(`
      -- Drop all tables in public schema
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
      
      -- Drop all custom types
      DROP TYPE IF EXISTS user_role CASCADE;
      DROP TYPE IF EXISTS listing_status CASCADE;
      DROP TYPE IF EXISTS property_type CASCADE;
      DROP TYPE IF EXISTS media_kind CASCADE;
      DROP TYPE IF EXISTS review_result CASCADE;
      DROP TYPE IF EXISTS viewing_status CASCADE;
      DROP TYPE IF EXISTS chat_channel CASCADE;
      DROP TYPE IF EXISTS actor_type CASCADE;
    `);
        console.log('✅ All objects dropped');
        // Get all migration files
        const files = await readdir(migrationsDir);
        const sqlFiles = files
            .filter(f => f.endsWith('.sql'))
            .sort();
        console.log(`\n📁 Applying ${sqlFiles.length} migrations...`);
        for (const file of sqlFiles) {
            console.log(`🔄 Applying ${file}...`);
            const sql = await readFile(join(migrationsDir, file), 'utf-8');
            try {
                await client.query(sql);
                console.log(`✅ Applied ${file}`);
            }
            catch (err) {
                console.error(`❌ Failed to apply ${file}:`, err);
                throw err;
            }
        }
        // Record applied migrations
        for (const file of sqlFiles) {
            await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        }
        console.log('\n✅ Database reset complete!');
        // Show counts
        const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM listings) as listings,
        (SELECT COUNT(*) FROM audit_log) as audit_entries
    `);
        console.log('\n📊 Seed data summary:');
        console.log(`   Users: ${counts.rows[0].users}`);
        console.log(`   Listings: ${counts.rows[0].listings}`);
        console.log(`   Audit entries: ${counts.rows[0].audit_entries}`);
    }
    finally {
        await client.end();
    }
}
resetDev().catch(err => {
    console.error('Reset failed:', err);
    process.exit(1);
});
//# sourceMappingURL=resetDev.js.map