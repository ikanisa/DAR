import cron from 'node-cron';
import { query } from '../db.js';
import { logger } from '../observability/logger.js';
import { audit, AuditActions } from '../audit.js';

// Prune old inbound_events (30 days)
export async function pruneInboundEvents() {
    const result = await query(`
    DELETE FROM inbound_events
    WHERE received_at < NOW() - INTERVAL '30 days'
  `);

    logger.info({
        type: 'retention',
        table: 'inbound_events',
        deleted: result.rowCount,
    });

    await audit({
        actorType: 'system',
        actorId: 'retention-job',
        action: AuditActions.RETENTION_PRUNE,
        entity: 'inbound_events',
        payload: { deleted: result.rowCount },
    });

    return result.rowCount;
}

// Prune old chat_sessions (90 days)
export async function pruneChatSessions() {
    const result = await query(`
    DELETE FROM chat_sessions
    WHERE updated_at < NOW() - INTERVAL '90 days'
  `);

    logger.info({
        type: 'retention',
        table: 'chat_sessions',
        deleted: result.rowCount,
    });

    await audit({
        actorType: 'system',
        actorId: 'retention-job',
        action: AuditActions.RETENTION_PRUNE,
        entity: 'chat_sessions',
        payload: { deleted: result.rowCount },
    });

    return result.rowCount;
}

// Schedule jobs
export function scheduleRetentionJobs() {
    // Run daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
        logger.info({ type: 'job', name: 'retention', status: 'started' });

        try {
            await pruneInboundEvents();
            await pruneChatSessions();
            logger.info({ type: 'job', name: 'retention', status: 'completed' });
        } catch (error) {
            logger.error({ type: 'job', name: 'retention', status: 'failed', error });
        }
    });

    logger.info({ type: 'job', name: 'retention', status: 'scheduled' });
}
