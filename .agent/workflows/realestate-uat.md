---
description: End-to-end User Acceptance Testing script for Real Estate PWA + Moltbot
---

# UAT Workflow — Real Estate PWA + Moltbot

Complete end-to-end testing script for Poster → Listing → Admin → Seeker → Viewing flows.

---

## Goal

Validate:
- All core flows work end-to-end
- Security controls are enforced
- Idempotency prevents duplicates
- Audit trail is complete

---

## Pre-UAT Setup

### A1) Services Running

```bash
docker compose -f docker-compose.yml ps
```

**Expected**:
- postgres = running/healthy
- backend = running/healthy
- pwa = running/healthy
- moltbot = running

### A2) Health Endpoints

```bash
curl http://localhost:3000/health
```

**Expected**: `{"status":"ok","db":"connected"}`

### A3) Seed Data

```bash
cd apps/backend
npm run db:reset
```

**Expected**: Seed users exist (poster, seeker, admin)

---

## B. Security Tests

### B1) Gateway Token Not Exposed to Browser

1. Open PWA in browser
2. Open DevTools → Network tab
3. Send a chat message
4. Inspect request headers

**Expected**:
- No `MOLTBOT_TOKEN` in headers
- Browser only talks to `/api/chat/send`

### B2) Unpaired DM User (Telegram/WhatsApp)

1. Send DM from new Telegram account to bot
2. Observe response

**Expected**:
- Bot returns pairing request/code
- User cannot interact until approved

3. Admin approves pairing:
```bash
moltbot pairing approve <pairing_id>
```

4. Retry message

**Expected**: Message routes to correct agent

---

## C. Poster Listing Flow

### C1) Submit Listing (Valid)

**Actor**: Poster

1. Go to Poster Dashboard
2. Create listing:
   - Title: "2BR Apartment in Kacyiru"
   - Description: 120+ words
   - Type: apartment
   - Price: 650,000 RWF
   - Bedrooms: 2, Bathrooms: 2
   - Address: "Kacyiru, Kigali"
   - Photos: 5+
3. Submit

**Expected**:
- [ ] Status = `submitted`
- [ ] UI shows "Submitted for review"
- [ ] `audit_log` contains `listing.submit`

### C2) Admin Review

**Actor**: Admin Agent

1. Check admin panel or chat
2. Verify listing appears in queue

**Expected**:
- [ ] Listing in queue as `submitted` or `under_review`
- [ ] Agent runs tools: `validate`, `dedupe`
- [ ] Audit entries for tool calls

### C3) Approve Listing

**Actor**: Admin

1. Approve listing
2. Optionally set to `published`

**Expected**:
- [ ] Status = `approved` or `published`
- [ ] `audit_log` contains `listing.review`
- [ ] Poster receives notification
- [ ] Listing visible on public page

### C4) Submit Low-Quality Listing (Negative Test)

1. Submit listing with:
   - Description: 20 words only
   - Photos: 2 only

**Expected**:
- [ ] Validation returns errors
- [ ] Admin decision: `needs_changes` or `rejected`
- [ ] Poster notified with required fixes

---

## D. Seeker Flow

### D1) Search Properties

**Actor**: Seeker (PWA Chat)

1. Send message:
   > "I need a 2 bedroom apartment in Kacyiru under 700,000 RWF"

**Expected**:
- [ ] Agent parses: type=apartment, bedrooms=2, max_price=700000
- [ ] `seeker_profiles` updated
- [ ] Top 3 results returned with explanations
- [ ] `matches` rows created
- [ ] Audit entries: `chat.ingest`, `seeker.search`

### D2) Request Details

1. Send: "Tell me more about option 1"

**Expected**:
- [ ] Full description returned
- [ ] Photos displayed
- [ ] CTA: "Schedule viewing?"

### D3) Schedule Viewing

1. Send: "Schedule a viewing tomorrow at 10:00"

**Expected**:
- [ ] `viewings` row created, status=`proposed`
- [ ] scheduled_at = next day 10:00 (Kigali time)
- [ ] Poster/admin notified
- [ ] Audit: `viewing.create`, `notify.*`

---

## E. Idempotency Tests

### E1) Replay Chat Event

```bash
# Send same event_id twice
curl -X POST http://localhost:3001/api/chat/ingest \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_id": "test-123", "source": "telegram", "channel": "telegram", "peer_id": "user1", "text": "hello"}'

# Second request with same event_id
curl -X POST http://localhost:3001/api/chat/ingest \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_id": "test-123", "source": "telegram", "channel": "telegram", "peer_id": "user1", "text": "hello"}'
```

**Expected**:
- [ ] First request: 200 OK
- [ ] Second request: 409 Conflict
- [ ] No duplicate `chat_sessions` or `matches`

### E2) Replay Listing Webhook

Same principle: duplicate `event_id` → rejected

---

## F. Auditability Tests

### F1) Verify Audit Trail

```sql
SELECT * FROM audit_log 
WHERE entity = 'listing' AND entity_id = '<listing_id>'
ORDER BY created_at;
```

**Expected entries**:
- [ ] `listing.submit` (actor_type=user)
- [ ] `tool.listing.validate` (actor_type=agent)
- [ ] `tool.listing.dedupe` (actor_type=agent)
- [ ] `listing.review` (actor_type=user/admin)
- [ ] `notify.*` (actor_type=system)

**Verify**: Each row has timestamp, actor_type, action, payload

---

## G. Resilience Tests

### G1) Search Latency

Run 10 searches rapidly

**Expected**:
- [ ] API responds consistently
- [ ] No rate limit blocking normal usage
- [ ] No 5xx errors

### G2) Moltbot Down

1. Stop Moltbot: `docker compose stop moltbot`
2. Submit listing

**Expected**:
- [ ] Backend accepts listing
- [ ] Error logged or retry queued
- [ ] Admin can manually review from panel

---

## Pass/Fail Criteria

### PASS if:
- [ ] Poster flow works (submit → review → approve → notify)
- [ ] Seeker flow works (chat → search → results → viewing)
- [ ] No gateway token in browser
- [ ] Pairing prevents unknown DMs
- [ ] Duplicate events rejected
- [ ] Audit log reconstructs events

### FAIL if:
- Token leaks to browser
- Duplicate event creates duplicate records
- Listing published without review trail
- System crashes when Moltbot down

---

## Evidence Collection

For each test, record:
- Screenshot or log snippet
- Database query result
- Pass/fail status

---

## Next Steps

After UAT passes:
1. Run `/realestate-evidence-pack` for audit dossier
2. Document any issues in runbook
3. Proceed to production deployment
