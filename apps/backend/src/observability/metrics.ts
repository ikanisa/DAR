/**
 * Prometheus Metrics
 * HTTP and application metrics
 */

import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// HTTP request metrics
export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
});

export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register],
});

// Tool call metrics
export const toolCallsTotal = new Counter({
    name: 'tool_calls_total',
    help: 'Total number of tool API calls',
    labelNames: ['tool', 'success'],
    registers: [register],
});

export const toolCallDuration = new Histogram({
    name: 'tool_call_duration_seconds',
    help: 'Tool call duration in seconds',
    labelNames: ['tool'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
});

// Webhook metrics
export const webhookFailuresTotal = new Counter({
    name: 'webhook_failures_total',
    help: 'Total number of webhook failures',
    labelNames: ['source'],
    registers: [register],
});

// Chat metrics
export const chatMessagesTotal = new Counter({
    name: 'chat_messages_total',
    help: 'Total number of chat messages ingested',
    labelNames: ['channel'],
    registers: [register],
});

// Pairing metrics  
export const pairingFailuresTotal = new Counter({
    name: 'pairing_failures_total',
    help: 'Total number of pairing failures',
    labelNames: ['channel'],
    registers: [register],
});

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
    return register.metrics();
}

/**
 * Get content type for metrics
 */
export function getMetricsContentType(): string {
    return register.contentType;
}
