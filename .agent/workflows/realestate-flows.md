---
description: Core product flows (listing, seeker, onboarding) for Real Estate PWA
---

# W5 — Real Estate Flows Workflow

Implement end-to-end orchestration for the three core product flows with full auditability.

---

## Goal

Implement orchestration for:
- **A) Listing Flow**: Poster submits → Admin reviews → Approve/Reject → Notify poster
- **B) Seeker Flow**: Chat → Search → Shortlist → Schedule viewing → Notify parties
- **C) Onboarding Flow**: New user → Welcome → Preference capture → Tutorials

---

## Hard Rules

- Orchestration lives in backend, not PWA
- Moltbot triggers via backend `MoltbotClient`
- Notifications through backend provider interfaces (mock for now)
- Every step writes audit_log with actor_type

---

## Files to Create

```
/apps/backend/src/
├── moltbot/
│   └── MoltbotClient.ts     # Gateway communication
├── flows/
│   ├── listingFlow.ts       # Listing submission flow
│   ├── seekerFlow.ts        # Seeker chat flow
│   └── onboardingFlow.ts    # User onboarding flow
├── routes/flows.ts           # Flow endpoints
└── test/flows.test.ts        # Flow tests
```

---

## Flow A: Listing Submission

### Trigger
`POST /api/listings` (after insert)

### Steps

```
1. Poster submits listing → status='submitted'
2. Backend calls MoltbotClient.notifyAdminNewListing(listing_id)
3. Admin agent calls tools: validate → dedupe → quality score
4. Admin agent uses adminDecision tool
5. Backend updates listing status
6. Backend sends notification to poster (WhatsApp/Telegram) with decision
```

### Implementation

```typescript
// flows/listingFlow.ts
export async function onListingSubmitted(listingId: string, posterId: string) {
  await writeAudit({
    actorType: 'system',
    actorId: 'listing-flow',
    action: 'listing.submitted',
    entity: 'listing',
    entityId: listingId,
  });
  
  // Notify admin agent
  await moltbotClient.notifyAdminNewListing(listingId);
}

export async function onListingDecision(
  listingId: string,
  decision: 'approved' | 'rejected' | 'needs_changes',
  notes: string
) {
  // Get poster info
  const listing = await getListingWithPoster(listingId);
  
  // Build message
  const message = decision === 'approved'
    ? 'Your listing has been approved and is now published!'
    : decision === 'rejected'
    ? `Your listing was not approved. Reason: ${notes}`
    : `Please update your listing: ${notes}`;
  
  // Send notification
  if (listing.poster.whatsapp_id) {
    await notifyWhatsApp(listing.poster.whatsapp_id, message);
  } else if (listing.poster.telegram_id) {
    await notifyTelegram(listing.poster.telegram_id, message);
  }
  
  await writeAudit({
    actorType: 'system',
    actorId: 'listing-flow',
    action: 'listing.notification.sent',
    entity: 'listing',
    entityId: listingId,
    payload: { decision, channel: listing.poster.whatsapp_id ? 'whatsapp' : 'telegram' },
  });
}
```

---

## Flow B: Seeker Chat

### Endpoint
`POST /api/flows/seeker/message`

### Input
```typescript
{
  user_id: string;
  channel: 'webchat' | 'telegram' | 'whatsapp';
  peer_id: string;
  text: string;
}
```

### Steps

```
1. Load/create seeker_profile
2. Parse preferences from message text (simple JSON rules)
3. Update seeker_profile.prefs
4. Call /api/listings/search with prefs
5. Rank results, return top 3 with explanation
6. Create match rows
7. If user requests viewing → create viewing row → notify poster/admin
```

### Implementation

```typescript
// flows/seekerFlow.ts
export async function processSeekerMessage(input: SeekerMessageInput) {
  const { user_id, channel, peer_id, text } = input;
  
  // Get or create session
  let session = await getOrCreateChatSession(user_id, channel, peer_id, 'seeker');
  
  // Update preferences from text
  const prefs = parsePreferences(text, session.state.prefs || {});
  await updateSeekerProfile(user_id, prefs);
  
  // Search listings
  const results = await searchListings({
    type: prefs.type,
    bedrooms: prefs.bedrooms,
    min_price: prefs.budget_min,
    max_price: prefs.budget_max,
    areas: prefs.areas,
  });
  
  // Rank and take top 3
  const top3 = results.slice(0, 3);
  
  // Create match rows
  for (const listing of top3) {
    await createMatch(user_id, listing.id, listing.score, listing.reasons);
  }
  
  await writeAudit({
    actorType: 'user',
    actorId: user_id,
    action: 'seeker.search',
    entity: 'match',
    payload: { count: top3.length, prefs },
  });
  
  return {
    message: formatSearchResults(top3),
    listings: top3,
    session_id: session.id,
  };
}

// Viewing request
export async function scheduleViewing(input: ViewingInput) {
  const { user_id, listing_id, scheduled_at } = input;
  
  const viewing = await db.query(`
    INSERT INTO viewings (listing_id, seeker_id, scheduled_at, status)
    VALUES ($1, $2, $3, 'proposed')
    RETURNING *
  `, [listing_id, user_id, scheduled_at]);
  
  // Notify poster
  const listing = await getListingWithPoster(listing_id);
  await notifyPoster(listing.poster_id, `New viewing request for: ${listing.title}`);
  
  await writeAudit({
    actorType: 'user',
    actorId: user_id,
    action: 'viewing.created',
    entity: 'viewing',
    entityId: viewing.rows[0].id,
  });
  
  return viewing.rows[0];
}
```

### Preference Parsing

```typescript
function parsePreferences(text: string, existing: Prefs): Prefs {
  const prefs = { ...existing };
  
  // Property type
  if (/apartment/i.test(text)) prefs.type = 'apartment';
  else if (/house/i.test(text)) prefs.type = 'house';
  else if (/land/i.test(text)) prefs.type = 'land';
  
  // Bedrooms
  const bedroomMatch = text.match(/(\d+)\s*(?:bed|bedroom|br)/i);
  if (bedroomMatch) prefs.bedrooms = parseInt(bedroomMatch[1]);
  
  // Budget
  const budgetMatch = text.match(/under\s*(\d+)/i);
  if (budgetMatch) prefs.budget_max = parseInt(budgetMatch[1]);
  
  const minBudgetMatch = text.match(/(?:from|above|at least)\s*(\d+)/i);
  if (minBudgetMatch) prefs.budget_min = parseInt(minBudgetMatch[1]);
  
  // Location
  const areas = ['kacyiru', 'kimihurura', 'nyarutarama', 'kigali'];
  for (const area of areas) {
    if (text.toLowerCase().includes(area)) {
      prefs.areas = [...(prefs.areas || []), area];
    }
  }
  
  return prefs;
}
```

---

## Flow C: User Onboarding

### Endpoint
`POST /api/flows/onboarding/new-user`

### Input
```typescript
{
  user_id: string;
  channel: 'webchat' | 'telegram' | 'whatsapp';
  role: 'seeker' | 'poster';
}
```

### Steps

```
1. Create chat_session
2. Send welcome message
3. If poster: send listing tutorial + photo rules
4. If seeker: send preference capture prompts
5. Write audit entries
```

### Implementation

```typescript
// flows/onboardingFlow.ts
const WELCOME_MESSAGES = {
  seeker: `Welcome! I'm here to help you find your perfect property. 
Tell me what you're looking for:
- Property type (apartment, house, land)?
- Budget range?
- Preferred area?`,
  
  poster: `Welcome! Ready to list your property?
I'll guide you through the process. You'll need:
✓ Property title and description (100+ words)
✓ At least 5 photos
✓ Price and location

Let's start! What's your property type?`,
};

export async function onboardNewUser(input: OnboardingInput) {
  const { user_id, channel, role } = input;
  
  // Create session
  const session = await createChatSession(user_id, channel, role);
  
  // Send welcome
  const message = WELCOME_MESSAGES[role];
  await sendMessage(user_id, channel, message);
  
  await writeAudit({
    actorType: 'system',
    actorId: 'onboarding-flow',
    action: 'user.onboarded',
    entity: 'user',
    entityId: user_id,
    payload: { role, channel },
  });
  
  return { session_id: session.id, message };
}
```

---

## MoltbotClient

```typescript
// moltbot/MoltbotClient.ts
export class MoltbotClient {
  private baseUrl: string;
  private token: string;
  
  constructor() {
    this.baseUrl = process.env.MOLTBOT_GATEWAY_URL || 'http://127.0.0.1:18789';
    this.token = process.env.MOLTBOT_TOKEN!;
  }
  
  async notifyAdminNewListing(listingId: string) {
    return this.post('/hooks/admin/new-listing', {
      listing_id: listingId,
      action: 'review_requested',
    });
  }
  
  private async post(path: string, body: object) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return response.json();
  }
}
```

---

## Tests

```typescript
// flows.test.ts
describe('Listing Flow', () => {
  it('triggers MoltbotClient on submission', async () => {});
  it('sends notification on approval', async () => {});
});

describe('Seeker Flow', () => {
  it('parses preferences from message', async () => {});
  it('creates matches for search results', async () => {});
  it('creates viewing and notifies poster', async () => {});
});

describe('Onboarding Flow', () => {
  it('creates session and sends welcome', async () => {});
  it('writes audit entry', async () => {});
});
```

---

## Acceptance Criteria

- [ ] Listing submission triggers MoltbotClient call
- [ ] Decision sends notification to poster
- [ ] Seeker message produces matches
- [ ] Seeker prefs saved to profile
- [ ] Viewing scheduling notifies poster
- [ ] All steps emit audit_log events

---

## Rollback

```bash
git checkout HEAD~1 -- apps/backend/src/flows/
git checkout HEAD~1 -- apps/backend/src/moltbot/
```
