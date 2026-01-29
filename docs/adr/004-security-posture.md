# ADR-004: Security Posture

**Status:** Accepted  
**Date:** 2026-01-29  
**Author:** AI Agent  

---

## Context

The Real Estate PWA handles sensitive user data and financial transactions. Security requirements include:
- Protecting user credentials and session tokens
- Preventing unauthorized access to listings and messages
- Defending against prompt injection in AI agents
- Ensuring Moltbot gateway is not exposed publicly

## Decision

We adopt a **defense-in-depth** security model with multiple layers of protection.

### Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Internet                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare (WAF, DDoS protection, rate limiting)       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PWA + Backend API (public endpoints only)              │
│  - JWT verification                                      │
│  - RBAC middleware                                       │
│  - Input validation                                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (internal only)
┌─────────────────────────────────────────────────────────┐
│  Moltbot Gateway (127.0.0.1:18789, loopback only)       │
│  - Gateway token auth                                    │
│  - Service token for tools                               │
└─────────────────────────────────────────────────────────┘
```

---

## Hard Rules (Non-Negotiable)

1. **No secrets in repo** — Use `.env.example` templates only
2. **Gateway binds to loopback** — `127.0.0.1:18789`, never `0.0.0.0`
3. **No direct DB writes from agents** — Must use backend API with service token
4. **Idempotent events** — Dedupe by `event_id` to prevent replay attacks
5. **Untrusted input** — Treat all external text, photos, URLs as hostile

---

## Authentication Layers

### 1. User Authentication (JWT)

```
Client → Backend: Authorization: Bearer <jwt>
Backend → Verify: Check signature, expiry, claims
Backend → Proceed: Extract user_id, role from token
```

| Claim | Purpose |
|-------|---------|
| `sub` | User ID |
| `role` | RBAC role (seeker/poster/admin/moderator) |
| `exp` | Token expiry (1 hour) |
| `iat` | Issued at timestamp |

### 2. Service Token (Moltbot → Backend)

```
Moltbot → Backend: X-Service-Token: <service_token>
Backend → Verify: Match against SERVICE_TOKEN env var
Backend → Proceed: Allow internal tool operations
```

### 3. Gateway Token (Backend → Moltbot)

```
Backend → Moltbot: Authorization: Bearer <gateway_token>
Moltbot → Verify: Match against MOLTBOT_TOKEN
Moltbot → Proceed: Accept agent commands
```

---

## Prompt Injection Defenses

### Input Sanitization

All user-provided text passed to agents must be:
1. **Wrapped** — Clearly delimited as user content
2. **Length-limited** — Max 4000 chars per message
3. **Logged** — Original input preserved in audit log

### Output Validation

Agent responses are validated against output contracts:
1. **Schema check** — Response matches expected structure
2. **Action whitelist** — Only declared tools can be invoked
3. **Parameter bounds** — Numeric values within expected ranges

### Example Defense

```typescript
// BAD: Direct injection risk
const prompt = `User says: ${userMessage}`;

// GOOD: Sandboxed input
const prompt = `
<user_message>
${sanitize(userMessage)}
</user_message>

Respond only with actions from the allowed set.
`;
```

---

## Rate Limiting

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Public API | 100 req | 1 min |
| Auth endpoints | 10 req | 1 min |
| File uploads | 5 req | 1 min |
| Agent interactions | 30 req | 1 min |

---

## Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| JWT_SECRET | Env var | 90 days |
| SERVICE_TOKEN | Env var | 90 days |
| MOLTBOT_TOKEN | Env var | 90 days |
| DATABASE_URL | Env var | On incident |

---

## Consequences

### Positive
- Defense-in-depth prevents single point of failure
- Clear separation between public and internal services
- Auditable security events

### Negative
- Additional latency from token verification
- Complexity in local development setup
- Requires secret rotation procedures

### Mitigation
- Cache token verification results (5 min TTL)
- Provide `docker-compose.yml` for easy local setup
- Document rotation runbook in ops docs

---

## References

- Backend middleware: `apps/backend/src/middleware/`
- Rate limiter: `apps/backend/src/utils/rateLimiter.ts`
- Moltbot config: `infra/moltbot/moltbot.json`
