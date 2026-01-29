# Monitoring Setup

## Metrics Endpoint

Prometheus metrics available at:
```
GET /metrics
```

## Scrape Config (Prometheus)

```yaml
scrape_configs:
  - job_name: 'realestate-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
```

## Key Metrics

| Metric | Description |
|--------|-------------|
| http_requests_total | Total HTTP requests by method/route/status |
| http_request_duration_ms | Request latency histogram |
| webhook_failures_total | Failed webhook deliveries |
| tool_calls_total | Moltbot tool invocations |
| tool_call_duration_ms | Tool call latency |
| pairing_failures_total | Failed DM pairing attempts |
| active_sessions | Currently active chat sessions (Gauge) |

## Alerting Rules (Prometheus)

```yaml
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
```

## Logs

Structured JSON logs written to stdout. Ship to:
- CloudWatch Logs
- Datadog
- Loki
- ELK Stack

Example log entry:
```json
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
```

## Retention

| Table | Retention | Pruned |
|-------|-----------|--------|
| inbound_events | 30 days | Daily at 3 AM |
| chat_sessions | 90 days | Daily at 3 AM |

Audit logs are NOT pruned (compliance requirement).
