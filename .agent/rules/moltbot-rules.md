# Moltbot Agent Governance Rules

> **Version**: 1.0  
> **Applies to**: Real Estate PWA + Moltbot (Internal Agent API)

---

## 1. Phase Gates

Before advancing to the next phase, ALL acceptance criteria for the current phase MUST pass.

| Phase | Gate Criteria |
|-------|---------------|
| P0 | Output contracts exist; validation utility has passing tests |
| P1 | DB migrations applied; RLS verified (public read only approved, drafts private) |
| P2 | Public pages SSR; sitemap.xml valid; private routes noindex |
| P3 | All tools audit to `audit_events`; E2E draft→approve→publish works |
| P4 | Gateway loopback-only; token auth enforced; agents respond |
| P5 | Chat endpoint validates JSON; invalid output rejected + fallback |
| P6 | Image pipeline resizes; min photos enforced; OCR gated |
| P7 | E2E tests pass; rate limits active; flags off = baseline |

---

## 2. Tool Call Caps

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max tool calls per turn | 10 | Prevent runaway loops |
| Max search results returned | 20 | UX + performance |
| Max concurrent media uploads | 5 | Rate limit protection |
| Max message length | 2000 chars | UI constraints |

If an agent attempts to exceed these caps, the orchestration layer MUST reject the turn and log to `audit_events`.

---

## 3. No Cold Outreach

Agents MUST NOT:
- Initiate contact with users who have not started a conversation
- Send push notifications without explicit user opt-in
- Email users without prior interaction in the same session

Agents MAY only respond to or continue conversations initiated by the user.

---

## 4. Audit Requirements

**Every tool call MUST be logged** to the `audit_events` table with:

| Field | Description |
|-------|-------------|
| `event_type` | `tool_call` |
| `agent_type` | `seeker`, `poster`, or `admin` |
| `tool_name` | Name of the tool invoked |
| `input_hash` | SHA256 of input params (for deduplication) |
| `output_status` | `success`, `error`, `rejected` |
| `user_id` | If authenticated |
| `session_id` | Conversation session |
| `created_at` | Timestamp |

---

## 5. Output Validation

All agent outputs MUST be validated against the appropriate JSON Schema contract:

| Agent | Contract |
|-------|----------|
| Seeker / Poster | `realestate-output-contract.v1.json` |
| Admin | `realestate-admin-output-contract.v1.json` |

Invalid outputs MUST:
1. Be rejected (not executed)
2. Be logged to `audit_events` with `output_status: rejected`
3. Trigger a deterministic fallback reply to the user

---

## 6. Moderation Holds

Content flagged by automated moderation MUST:
- NOT be published automatically
- Be queued for admin review
- Have `status: moderation_hold` in the database

Agents MUST NOT override moderation holds.

---

## 7. Rate Limits

| Scope | Limit |
|-------|-------|
| Per user per minute | 30 requests |
| Per user per hour | 200 requests |
| Per IP (unauthenticated) | 10 requests/min |

Exceeded limits MUST return HTTP 429 and log to `audit_events`.
