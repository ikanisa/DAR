# ADR-003: Audit Logging Strategy

**Status:** Accepted  
**Date:** 2026-01-29  
**Author:** AI Agent  

---

## Context

All Moltbot-triggered actions must be auditable for:
- Debugging agent behavior and tool calls
- Compliance and dispute resolution
- Performance monitoring and optimization
- Security incident investigation

## Decision

We implement a **centralized audit log** in PostgreSQL with structured event capture at multiple layers.

### Audit Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Moltbot   │────▶│   Backend   │────▶│  audit_log  │
│   Gateway   │     │     API     │     │   (PG)      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│ moltbot_    │     │   tool_     │
│ jobs        │     │   calls     │
└─────────────┘     └─────────────┘
```

### Audit Events Captured

| Event Type | Source | Data Captured |
|------------|--------|---------------|
| `tool_call` | Backend | Tool name, params, result, duration |
| `agent_response` | Moltbot | Agent ID, prompt, response hash |
| `listing_mutation` | API | Before/after state, actor |
| `auth_event` | API | Login, logout, token refresh |
| `moderation_action` | Admin | Decision, reason, target |

### Schema

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID,
  actor_type VARCHAR(20), -- 'user', 'agent', 'system'
  resource_type VARCHAR(50),
  resource_id UUID,
  action VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_log (actor_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_type ON audit_log (event_type, created_at DESC);
```

### Retention Policy

| Environment | Retention | Archive Strategy |
|-------------|-----------|------------------|
| Production | 90 days | Export to S3 before purge |
| Development | 7 days | No archive |

### Query Patterns

```sql
-- Find all actions by a specific user
SELECT * FROM audit_log 
WHERE actor_id = $1 
ORDER BY created_at DESC LIMIT 100;

-- Find all tool calls for a conversation
SELECT * FROM audit_log 
WHERE event_type = 'tool_call' 
  AND metadata->>'conversation_id' = $1;

-- Debug agent behavior
SELECT * FROM audit_log 
WHERE actor_type = 'agent' 
  AND created_at > NOW() - INTERVAL '1 hour';
```

## Consequences

### Positive
- Complete audit trail for all system actions
- Enables debugging without log file searches
- Supports compliance requirements
- Queryable with standard SQL

### Negative
- Storage growth requires monitoring
- Write amplification on high-volume operations
- Sensitive data must be redacted (PII, tokens)

### Mitigation
- Implement async write queue for high-volume events
- Add PII scrubbing middleware before audit insert
- Set up storage alerts and automated archival

---

## References

- Audit service: `apps/backend/src/services/auditService.ts`
- Inbound events: `supabase/migrations/*_inbound_events.sql`
