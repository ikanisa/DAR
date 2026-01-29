---
description: Monitoring + maintenance + alerts (logs, metrics, retention) for Real Estate PWA
---

# W8 — Monitoring Workflow

Add observability to backend: structured logs, metrics, alerting, retention jobs.

---

## Goal

Implement monitoring with:
- Structured JSON logging (pino)
- Prometheus metrics
- Basic alerting rules
- Data retention jobs

---

## Stack

- pino for structured logging
- prom-client for metrics
- node-cron for maintenance tasks

---

## Files to Create

```
/apps/backend/src/
├── observability/
│   ├── logger.ts           # Structured logging
│   └── metrics.ts          # Prometheus metrics
├── jobs/
│   └── retention.ts        # Data retention
├── routes/
│   └── health.ts           # Health + metrics endpoints
└── test/
    └── obs.test.ts         # Observability tests

/infra/
└── monitoring/
    └── README.md           # Monitoring runbook
```

---

## Logger (pino)

```typescript
// observability/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'realestate-backend',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Request logging middleware
export function requestLogger(request, reply, done) {
  const start = Date.now();
  
  reply.addHook('onSend', (req, rep, payload, done) => {
    const duration = Date.now() - start;
    logger.info({
      type: 'request',
      method: req.method,
      url: req.url,
      statusCode: rep.statusCode,
      duration,
      requestId: req.id,
    });
    done();
  });
  
  done();
}
```

---

## Metrics (Prometheus)

```typescript
// observability/metrics.ts
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
export function metricsMiddleware(request, reply, done) {
  const start = Date.now();
  
  reply.addHook('onSend', (req, rep, payload, done) => {
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
```

---

## Retention Jobs

```typescript
// jobs/retention.ts
import cron from 'node-cron';
import { db } from '../db';
import { logger } from '../observability/logger';
import { writeAudit } from '../audit';

// Prune old inbound_events (30 days)
export async function pruneInboundEvents() {
  const result = await db.query(`
    DELETE FROM inbound_events
    WHERE received_at < NOW() - INTERVAL '30 days'
  `);
  
  logger.info({
    type: 'retention',
    table: 'inbound_events',
    deleted: result.rowCount,
  });
  
  await writeAudit({
    actorType: 'system',
    actorId: 'retention-job',
    action: 'retention.prune',
    entity: 'inbound_events',
    payload: { deleted: result.rowCount },
  });
  
  return result.rowCount;
}

// Prune old chat_sessions (90 days)
export async function pruneChatSessions() {
  const result = await db.query(`
    DELETE FROM chat_sessions
    WHERE updated_at < NOW() - INTERVAL '90 days'
  `);
  
  logger.info({
    type: 'retention',
    table: 'chat_sessions',
    deleted: result.rowCount,
  });
  
  await writeAudit({
    actorType: 'system',
    actorId: 'retention-job',
    action: 'retention.prune',
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
```

---

## Health & Metrics Endpoints

```typescript
// routes/health.ts
import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { registry } from '../observability/metrics';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health
  fastify.get('/health', async (request, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch (error) {
      reply.code(503);
      return { status: 'error', db: 'disconnected' };
    }
  });
  
  // Detailed health
  fastify.get('/health/detailed', async (request, reply) => {
    const checks = {
      db: false,
      moltbot: false,
    };
    
    try {
      await db.query('SELECT 1');
      checks.db = true;
    } catch {}
    
    try {
      const res = await fetch(`${process.env.MOLTBOT_GATEWAY_URL}/health`);
      checks.moltbot = res.ok;
    } catch {}
    
    const allHealthy = Object.values(checks).every(Boolean);
    reply.code(allHealthy ? 200 : 503);
    
    return { status: allHealthy ? 'ok' : 'degraded', checks };
  });
  
  // Prometheus metrics
  fastify.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });
}
```

---

## Monitoring README

```markdown
# Monitoring Setup

## Metrics Endpoint

Prometheus metrics available at:
\`\`\`
GET /metrics
\`\`\`

## Scrape Config (Prometheus)

\`\`\`yaml
scrape_configs:
  - job_name: 'realestate-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
\`\`\`

## Key Metrics

| Metric | Description |
|--------|-------------|
| http_requests_total | Total HTTP requests by method/route/status |
| http_request_duration_ms | Request latency histogram |
| webhook_failures_total | Failed webhook deliveries |
| tool_calls_total | Moltbot tool invocations |
| tool_call_duration_ms | Tool call latency |
| pairing_failures_total | Failed DM pairing attempts |

## Alerting Rules (Prometheus)

\`\`\`yaml
groups:
  - name: realestate
    rules:
      - alert: HighWebhookFailures
        expr: rate(webhook_failures_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: High webhook failure rate

      - alert: HighToolLatency
        expr: histogram_quantile(0.95, rate(tool_call_duration_ms_bucket[5m])) > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High tool call latency (p95 > 5s)

      - alert: RepeatedPairingFailures
        expr: rate(pairing_failures_total[15m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Multiple pairing failures (possible attack)

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High 5xx error rate (>5%)
\`\`\`

## Logs

Structured JSON logs written to stdout. Ship to:
- CloudWatch Logs
- Datadog
- Loki
- ELK Stack

Example log entry:
\`\`\`json
{
  "level": "info",
  "time": "2026-01-29T12:00:00.000Z",
  "service": "realestate-backend",
  "type": "request",
  "method": "POST",
  "url": "/api/listings",
  "statusCode": 201,
  "duration": 125,
  "requestId": "abc123"
}
\`\`\`

## Retention

| Table | Retention | Pruned |
|-------|-----------|--------|
| inbound_events | 30 days | Daily at 3 AM |
| chat_sessions | 90 days | Daily at 3 AM |

Audit logs are NOT pruned (compliance requirement).
```

---

## Tests

```typescript
// test/obs.test.ts
describe('Health endpoints', () => {
  it('GET /health returns ok when DB connected', async () => {});
  it('GET /health returns 503 when DB disconnected', async () => {});
});

describe('Metrics', () => {
  it('GET /metrics returns Prometheus format', async () => {});
  it('http_requests_total increments', async () => {});
});

describe('Retention', () => {
  it('pruneInboundEvents removes old records', async () => {});
  it('pruneChatSessions removes old sessions', async () => {});
  it('writes audit entry on prune', async () => {});
});
```

---

## Acceptance Criteria

- [ ] GET /health returns ok with DB connectivity
- [ ] GET /metrics returns Prometheus format
- [ ] Retention job runs and prunes old data
- [ ] Audit entries written for retention runs
- [ ] Structured logs output to stdout

---

## Rollback

```bash
git checkout HEAD~1 -- apps/backend/src/observability/
git checkout HEAD~1 -- apps/backend/src/jobs/
git checkout HEAD~1 -- apps/backend/src/routes/health.ts
```
