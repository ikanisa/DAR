/**
 * Tools Module Exports
 */

export { executeAgentOutput, getAvailableActions, hasHandler } from './registry.js';
export type { ExecutionContext, ExecutionResult } from './registry.js';

export { logToolCall, createTimedAudit } from './auditLog.js';
export type { ToolAuditEntry, ToolOutputStatus } from './auditLog.js';

export type { ToolResult } from './handlers/common.js';
