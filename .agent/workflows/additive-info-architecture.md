---
description: Information architecture workflow for chat + browse hybrid UX
---

# Additive Information Architecture Workflow

**Purpose**: Prevent the chat from becoming a maze. Users should never need to scroll through long chat history to complete a flow.

---

## The 3-Lane UX Model

Structure the app around three distinct lanes:

### Lane 1: Browse
**Purpose**: Discover and view content

- Vendors/venues list
- Listings/products grid
- Requests board
- Category/location hubs
- Search results

**Characteristics**:
- Read-mostly (view, filter, sort)
- Grid/list layouts
- Cards with key info + CTAs
- Every card links to detail view

---

### Lane 2: Chat (Create/Edit)
**Purpose**: AI-assisted content creation and modification

- Create new listing via Moltbot
- Edit existing content via chat
- Answer questions to refine
- Confirm and publish

**Characteristics**:
- Conversational UI
- Progressive disclosure
- Clear start/end states
- Visible progress indicator

---

### Lane 3: Inbox (Notifications + Inquiries)
**Purpose**: Manage incoming communications

- New inquiry notifications
- Order updates (if applicable)
- System messages
- Action-required items

**Characteristics**:
- Chronological feed
- Unread indicators
- Quick actions (reply, dismiss)
- Grouped by conversation

---

## Navigation CTAs

### "Jump Back to Chat" CTA

From any browse card, users should be able to:
- Start a new chat about this item
- Continue editing if they own it

**Placement**:
```tsx
<Card>
  <CardContent>...</CardContent>
  <CardActions>
    <Button onClick={handleViewDetails}>View</Button>
    <Button onClick={handleChatAbout}>💬 Ask Molty</Button>
  </CardActions>
</Card>
```

---

### "Edit This" Entry Points

Every piece of owned content must have visible edit access:

| Location           | Edit Entry Point                      |
|--------------------|---------------------------------------|
| Listing card       | "Edit" button (owner only)            |
| Listing detail     | "Edit" FAB or header action           |
| Venue page         | "Edit Venue" in settings              |
| Order (venue app)  | Status change buttons                 |

**Pattern**:
```tsx
{isOwner && (
  <IconButton onClick={() => navigate(`/chat/edit/${itemId}`)}>
    <EditIcon />
  </IconButton>
)}
```

---

## Route Structure

```
/                     → Home (lane 1: browse)
/vendors              → Vendor list (lane 1)
/vendors/:slug        → Vendor detail (lane 1)
/listings             → Listings grid (lane 1)
/listings/:id         → Listing detail (lane 1)
/requests             → Requests board (lane 1)
/category/:slug       → Category hub (lane 1)
/location/:slug       → Location hub (lane 1)
/search               → Search results (lane 1)

/chat                 → Moltbot chat (lane 2)
/chat/new             → Start new listing (lane 2)
/chat/edit/:id        → Edit existing (lane 2)

/inbox                → Notifications (lane 3)
/inbox/:threadId      → Conversation detail (lane 3)

/settings             → User settings
/settings/my-listings → My content management
```

---

## Flow Completion Test

**Acceptance**: Any flow can be completed without scrolling through long chat history.

### Test Scenarios

1. **Create Listing Flow**:
   - User starts at /chat/new
   - Answers Moltbot questions
   - Confirms and publishes
   - Can immediately see listing in /listings
   - Total chat messages: ≤10

2. **Edit Existing Flow**:
   - User clicks "Edit" on their listing
   - Chat loads with item context
   - User makes changes via chat
   - Changes visible immediately
   - No need to scroll through old messages

3. **Browse to Chat Flow**:
   - User browses /listings
   - Clicks "Ask Molty" on a card
   - Chat opens with context about that item
   - User can ask questions or request similar

---

## Implementation Checklist

- [ ] Bottom nav has exactly 3 items: Browse, Chat, Inbox
- [ ] Every browse card has "Ask Molty" or equivalent CTA
- [ ] Every owned item has visible "Edit" entry point
- [ ] Edit flow opens chat with pre-loaded context
- [ ] Chat has clear progress indicator (steps remaining)
- [ ] Chat has "Done" state that links back to browse
- [ ] Inbox shows unread count badge
- [ ] All 3 lanes are independently navigable

---

## Verification Steps

1. **Flow Audit**:
   - Walk through each test scenario
   - Count taps and scrolls required
   - Document any friction points

2. **Dead End Check**:
   - From any screen, can user get to all 3 lanes in ≤2 taps?
   - No page should be a "dead end"

3. **Context Preservation**:
   - Starting edit from browse preserves item context
   - No "which item are we editing?" confusion

---

## Acceptance Criteria

- [ ] 3-lane navigation model implemented
- [ ] "Jump to Chat" CTAs on all browse cards
- [ ] "Edit" entry points on all owned content
- [ ] Chat sessions have clear boundaries (not endless scroll)
- [ ] All flows completable without chat history digging
- [ ] Bottom nav reflects the 3 lanes
