/**
 * Database Connection Pool
 * PostgreSQL connection with proper lifecycle management
 */

import pg from 'pg';
import { getConfig } from './config.js';
import { logger } from './observability/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
    if (!pool) {
        const config = getConfig();
        pool = new Pool({
            connectionString: config.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            logger.error({ err }, 'Unexpected database pool error');
        });

        pool.on('connect', () => {
            logger.debug('New database connection established');
        });
    }

    return pool;
}

export async function query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    const result = await getPool().query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug({ query: text.slice(0, 100), duration, rows: result.rowCount }, 'Query executed');

    return result;
}

export async function transaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const client = await getPool().connect();

    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function healthCheck(): Promise<boolean> {
    try {
        await query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database pool closed');
    }
}
