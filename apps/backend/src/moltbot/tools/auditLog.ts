/**
 * Tool Audit Logger
 *
 * Logs all tool calls to the audit_events table (P1).
 * Used by the tool registry to maintain an immutable audit trail.
 */

import { query } from '../../db.js';
import { logger } from '../../observability/logger.js';
import type { ContractType } from '../contracts.js';
import * as crypto from 'crypto';

export type ToolOutputStatus = 'success' | 'error' | 'rejected' | 'timeout';

export interface ToolAuditEntry {
    eventType: 'tool_call';
    agentType: ContractType | 'system';
    toolName: string;
    input: Record<string, unknown>;
    outputStatus: ToolOutputStatus;
    userId?: string;
    sessionId?: string;
    propertyId?: string;
    errorMessage?: string;
    durationMs?: number;
    context?: Record<string, unknown>;
}

/**
 * Generate a SHA256 hash of the input for deduplication
 */
function hashInput(input: Record<string, unknown>): string {
    const json = JSON.stringify(input, Object.keys(input).sort());
    return crypto.createHash('sha256').update(json).digest('hex').substring(0, 32);
}

/**
 * Log a tool call to the audit_events table
 */
export async function logToolCall(entry: ToolAuditEntry): Promise<void> {
    const {
        eventType,
        agentType,
        toolName,
        input,
        outputStatus,
        userId,
        sessionId,
        propertyId,
        errorMessage,
        durationMs,
        context,
    } = entry;

    const inputHash = hashInput(input);

    try {
        await query(
            `INSERT INTO audit_events (
                event_type, agent_type, tool_name, input_hash,
                output_status, user_id, session_id, property_id,
                error_message, duration_ms, context
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                eventType,
                agentType,
                toolName,
                inputHash,
                outputStatus,
                userId ?? null,
                sessionId ?? null,
                propertyId ?? null,
                errorMessage ?? null,
                durationMs ?? null,
                context ? JSON.stringify(context) : '{}',
            ]
        );

        logger.debug({ toolName, agentType, outputStatus }, 'Tool call audited');
    } catch (err) {
        // Audit failures should not crash the operation
        logger.error({ err, toolName, agentType }, 'Failed to log tool call');
    }
}

/**
 * Create a timed audit wrapper for tool execution
 */
export function createTimedAudit(
    agentType: ContractType,
    toolName: string,
    userId?: string,
    sessionId?: string
) {
    const startTime = Date.now();

    return async (
        outputStatus: ToolOutputStatus,
        input: Record<string, unknown>,
        options?: {
            propertyId?: string;
            errorMessage?: string;
            context?: Record<string, unknown>;
        }
    ) => {
        const durationMs = Date.now() - startTime;

        await logToolCall({
            eventType: 'tool_call',
            agentType,
            toolName,
            input,
            outputStatus,
            userId,
            sessionId,
            durationMs,
            ...options,
        });
    };
}
