import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

// Collect default metrics
collectDefaultMetrics({ register: registry });

// Custom metrics
export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
});

export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route'],
    buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
    registers: [registry],
});

export const webhookFailuresTotal = new Counter({
    name: 'webhook_failures_total',
    help: 'Total webhook failures',
    labelNames: ['source'],
    registers: [registry],
});

export const toolCallsTotal = new Counter({
    name: 'tool_calls_total',
    help: 'Total Moltbot tool calls',
    labelNames: ['tool', 'status'],
    registers: [registry],
});

export const toolCallDuration = new Histogram({
    name: 'tool_call_duration_ms',
    help: 'Tool call duration in milliseconds',
    labelNames: ['tool'],
    buckets: [50, 100, 200, 500, 1000, 2000, 5000],
    registers: [registry],
});

export const pairingFailuresTotal = new Counter({
    name: 'pairing_failures_total',
    help: 'Total pairing failures',
    labelNames: ['channel'],
    registers: [registry],
});

export const activeSessionsGauge = new Gauge({
    name: 'active_sessions',
    help: 'Currently active chat sessions',
    registers: [registry],
});

// Middleware
export function metricsMiddleware(request: any, reply: any, done: () => void) {
    const start = Date.now();

    reply.addHook('onSend', (req: any, rep: any, payload: any, done: () => void) => {
        const duration = Date.now() - start;
        const route = req.routeOptions?.url || req.url;

        httpRequestsTotal.inc({
            method: req.method,
            route,
            status: rep.statusCode,
        });

        httpRequestDuration.observe(
            { method: req.method, route },
            duration
        );

        done();
    });

    done();
}
