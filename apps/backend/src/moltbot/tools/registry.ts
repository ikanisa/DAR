/**
 * Tool Registry
 *
 * Central registry mapping validated agent actions to backend handlers.
 * Integrates with P0 contract validation and P1 audit logging.
 */

import type { ContractType, SeekerOutput, AdminOutput, IngestionOutput, SeekerAction, AdminAction, IngestionAction } from '../contracts.js';
import { validateAgentOutput } from '../contracts.js';
import { logToolCall, createTimedAudit } from './auditLog.js';
import { logger } from '../../observability/logger.js';

// Import handlers
import { handleAskUser, handleShowListingDetails, type ToolResult } from './handlers/common.js';
import {
    handleSearchProperties,
    handleScheduleViewing,
    handleInquireListing,
    handleSaveToFavorites,
    handleShowShortlist,
    handleSubmitForReview,
} from './handlers/seeker.js';
import {
    handleApproveListing,
    handleRejectListing,
    handleRequestChanges,
    handleFlagModeration,
    handleViewQueue,
    handleViewListingDetails as handleAdminViewListingDetails,
    handleSuspendUser,
    handleUnblockUser,
    handleUpdateListingStatus,
    handleEscalate,
    handleRiskOverride,
} from './handlers/admin.js';
import {
    handleDiscoverProperties,
    handleIngestListings,
    handleGetFeedSources,
    handleGetPendingJobs,
    handleCompleteJob,
    handleGetListingStats,
    type IngestionParams,
} from './handlers/ingestion.js';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionContext {
    userId?: string;
    sessionId?: string;
    agentType: ContractType;
}

export interface ExecutionResult {
    success: boolean;
    action: string;
    result?: ToolResult;
    error?: string;
    durationMs: number;
}

// ============================================================================
// Seeker Action Handlers Map
// ============================================================================

type SeekerHandler = (
    params: SeekerOutput['params'],
    userId?: string,
    sessionId?: string
) => Promise<ToolResult>;

const seekerHandlers: Record<SeekerAction, SeekerHandler> = {
    ask_user: async (params) => handleAskUser(params),
    search_properties: handleSearchProperties,
    refine_criteria: handleSearchProperties, // Same as search with updated criteria
    show_shortlist: async (params) => handleShowShortlist(params),
    create_draft: async () => ({ success: true, message: 'Draft creation handled by flow' }),
    update_draft: async () => ({ success: true, message: 'Draft update handled by flow' }),
    submit_for_review: handleSubmitForReview,
    schedule_viewing: handleScheduleViewing,
    inquire_listing: handleInquireListing,
    show_listing_details: async (params) => handleShowListingDetails(params),
    save_to_favorites: handleSaveToFavorites,
    notify_poster: async () => ({ success: true, message: 'Poster notification queued' }),
};

// ============================================================================
// Admin Action Handlers Map
// ============================================================================

type AdminHandler = (
    params: AdminOutput['params'],
    adminUserId: string
) => Promise<ToolResult>;

const adminHandlers: Record<AdminAction, AdminHandler> = {
    ask_user: async (params) => handleAskUser(params),
    approve_listing: handleApproveListing,
    reject_listing: handleRejectListing,
    request_changes: handleRequestChanges,
    flag_moderation: handleFlagModeration,
    view_queue: async (params) => handleViewQueue(params),
    view_listing_details: async (params) => handleAdminViewListingDetails(params),
    escalate: handleEscalate,
    unblock_user: handleUnblockUser,
    suspend_user: handleSuspendUser,
    update_listing_status: handleUpdateListingStatus,
    risk_override: handleRiskOverride,
};

// ============================================================================
// Ingestion Action Handlers Map
// ============================================================================

type IngestionHandler = (
    params: IngestionParams
) => Promise<ToolResult>;

const ingestionHandlers: Record<IngestionAction, IngestionHandler> = {
    discover_properties: handleDiscoverProperties,
    ingest_listings: handleIngestListings,
    get_feed_sources: async () => handleGetFeedSources(),
    get_pending_jobs: async () => handleGetPendingJobs(),
    complete_job: handleCompleteJob,
    get_listing_stats: async () => handleGetListingStats(),
    report_status: async (params) => ({
        success: true,
        message: params.message || 'Status reported',
    }),
};

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Execute a validated agent output.
 *
 * This function:
 * 1. Validates the output against the contract schema (P0)
 * 2. Routes to the appropriate handler
 * 3. Logs the tool call to audit_events (P1)
 * 4. Returns the execution result
 */
export async function executeAgentOutput(
    rawOutput: unknown,
    context: ExecutionContext
): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { agentType, userId, sessionId } = context;

    // Step 1: Validate output against contract
    const validation = validateAgentOutput(rawOutput, agentType);

    if (!validation.valid || !validation.data) {
        const error = validation.errors?.join('; ') || 'Invalid output';

        await logToolCall({
            eventType: 'tool_call',
            agentType,
            toolName: 'unknown',
            input: rawOutput as Record<string, unknown>,
            outputStatus: 'rejected',
            userId,
            sessionId,
            errorMessage: error,
            durationMs: Date.now() - startTime,
        });

        return {
            success: false,
            action: 'unknown',
            error: `Contract validation failed: ${error}`,
            durationMs: Date.now() - startTime,
        };
    }

    const output = validation.data;
    const action = output.action;
    const params = output.params;

    // Step 2: Execute handler
    let result: ToolResult;
    let outputStatus: 'success' | 'error' = 'success';

    try {
        if (agentType === 'seeker') {
            const handler = seekerHandlers[action as SeekerAction];
            if (!handler) {
                throw new Error(`No handler for seeker action: ${action}`);
            }
            result = await handler(params as SeekerOutput['params'], userId, sessionId);
        } else if (agentType === 'admin') {
            const handler = adminHandlers[action as AdminAction];
            if (!handler) {
                throw new Error(`No handler for admin action: ${action}`);
            }
            result = await handler(params as AdminOutput['params'], userId || 'system');
        } else if (agentType === 'ingestion') {
            const handler = ingestionHandlers[action as IngestionAction];
            if (!handler) {
                throw new Error(`No handler for ingestion action: ${action}`);
            }
            result = await handler(params as IngestionParams);
        } else {
            throw new Error(`Unknown agent type: ${agentType}`);
        }

        if (!result.success) {
            outputStatus = 'error';
        }
    } catch (err) {
        outputStatus = 'error';
        result = {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
        logger.error({ err, action, agentType }, 'Tool execution failed');
    }

    const durationMs = Date.now() - startTime;

    // Step 3: Log to audit_events
    await logToolCall({
        eventType: 'tool_call',
        agentType,
        toolName: action,
        input: params as Record<string, unknown>,
        outputStatus,
        userId,
        sessionId,
        propertyId: (params as Record<string, unknown>).listing_id as string | undefined,
        errorMessage: result.error,
        durationMs,
        context: { thought: output.thought },
    });

    return {
        success: result.success,
        action,
        result,
        error: result.error,
        durationMs,
    };
}

/**
 * Get list of available actions for an agent type.
 */
export function getAvailableActions(agentType: ContractType): string[] {
    return agentType === 'admin'
        ? Object.keys(adminHandlers)
        : Object.keys(seekerHandlers);
}

/**
 * Check if an action has a handler registered.
 */
export function hasHandler(action: string, agentType: ContractType): boolean {
    return agentType === 'admin'
        ? action in adminHandlers
        : action in seekerHandlers;
}
