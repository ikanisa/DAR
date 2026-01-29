/**
 * Audit Logger
 * Immutable audit trail for all state-changing operations
 */

import { query } from './db.js';
import { logger } from './observability/logger.js';

export type ActorType = 'user' | 'agent' | 'system';

export interface AuditEntry {
    actorType: ActorType;
    actorId: string;
    action: string;
    entity: string;
    entityId?: string;
    payload?: Record<string, unknown>;
}

/**
 * Write an immutable audit log entry
 */
export async function audit(entry: AuditEntry): Promise<void> {
    const { actorType, actorId, action, entity, entityId, payload } = entry;

    try {
        await query(
            `INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [actorType, actorId, action, entity, entityId ?? null, payload ? JSON.stringify(payload) : '{}']
        );

        logger.info({ ...entry }, 'Audit entry created');
    } catch (err) {
        // Audit failures should be logged but not crash the operation

        logger.error({ err, ...entry }, 'Failed to write audit entry');
    }
}

// Alias for compatibility
export const writeAudit = audit;

/**
 * Create an audit function bound to a specific actor
 */
export function createAuditor(actorType: ActorType, actorId: string) {
    return async (action: string, entity: string, entityId?: string, payload?: Record<string, unknown>) => {
        await audit({ actorType, actorId, action, entity, entityId, payload });
    };
}

/**
 * Common audit actions
 */
export const AuditActions = {
    // Listings
    LISTING_CREATE: 'listing.create',
    LISTING_SUBMIT: 'listing.submit',
    LISTING_VALIDATE: 'listing.validate',
    LISTING_DEDUPE: 'listing.dedupe',
    LISTING_APPROVE: 'listing.approve',
    LISTING_REJECT: 'listing.reject',
    LISTING_PUBLISH: 'listing.publish',
    LISTING_ARCHIVE: 'listing.archive',

    // Risk
    ADMIN_OVERRIDE: 'admin.risk_override',

    // Viewings
    VIEWING_CREATE: 'viewing.create',
    VIEWING_CONFIRM: 'viewing.confirm',
    VIEWING_CANCEL: 'viewing.cancel',
    VIEWING_COMPLETE: 'viewing.complete',

    // Chat
    CHAT_INGEST: 'chat.ingest',
    CHAT_RESPONSE: 'chat.response',

    // Evidence
    EVIDENCE_GENERATE: 'evidence.generate',

    // System
    RETENTION_PRUNE: 'system.retention_prune',

    // Discovery
    DISCOVERY_RUN: 'discovery.run',
    DOMAIN_POLICY_UPDATE: 'discovery.domain_policy_update',
    DOMAIN_POLICY_DELETE: 'discovery.domain_policy_delete',

    // ETL
    ETL_RUN: 'etl.run',
    ETL_LISTING_CREATED: 'etl.listing_created',
    ETL_LISTING_UPDATED: 'etl.listing_updated',

    // Enrichment
    ENRICH_RUN: 'enrich.run',

    // Tools
    TOOL_LISTING_VALIDATE: 'tool.listing.validate',
    TOOL_LISTING_DEDUPE: 'tool.listing.dedupe',
    TOOL_ADMIN_DECISION: 'tool.admin.decision',
} as const;

