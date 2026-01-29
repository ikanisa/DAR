---
description: Convert "world-class PWA UI/UX research" into a concrete mobile-first UI/UX + frontend implementation plan (native-like feel, perf budgets, a11y, PWA architecture, testing + monitoring)
---

# PWA Marketplace UI/UX Standard — Midnight Savory Clay+Glass

**Goal**: Mobile-first PWA marketplace. Chat-first creation (no classic forms). Moltbot drives flow.

**Mode**: Additive only — no breaking changes.

---

## Design System: Midnight Savory

### Palette (Dark Mode)

| Token        | Value                     | Usage                    |
|--------------|---------------------------|--------------------------|
| `bg`         | `#1A1A2E`                 | Main background          |
| `glass-bg`   | `rgba(0,0,0,0.40)`        | Glass overlays           |
| `clay-action`| `#FF6B6B`                 | Primary action buttons   |
| `clay-card`  | `#16213E`                 | Card backgrounds         |
| `text`       | `#F8F8F8`                 | Primary text             |
| `muted-text` | `rgba(248,248,248,0.72)`  | Secondary text           |
| `pending`    | `#FFCC00`                 | Pending/unverified state |
| `ready`      | `#00E676`                 | Ready/verified state     |

### Design Tokens

```css
:root {
  /* Radius */
  --radius: 28px;
  
  /* Clay Shadows */
  --clay-shadow-drop: 0 18px 40px rgba(0,0,0,0.55);
  --clay-inset-light: inset 10px 10px 18px rgba(255,255,255,0.06);
  --clay-inset-dark: inset -12px -12px 18px rgba(0,0,0,0.35);
  --clay-edge: 1px solid rgba(255,255,255,0.08);
  
  /* Glass */
  --glass-blur: 18px;
  --glass-border: rgba(255,255,255,0.12);
  --glass-shadow: 0 14px 40px rgba(0,0,0,0.45);
  
  /* Layout */
  --bento-gap: 14px;
  --min-card-h: 120px;
}
```

---

## Style Stack

| Layer       | Style           | Usage                        |
|-------------|-----------------|------------------------------|
| Layout      | Bento Grid      | Dashboard, listings, vendors |
| Hero        | Claymorphism    | Primary actions, CTAs        |
| Containers  | Glassmorphism   | Nav, sheets, modals          |
| Typography  | Big Bold Sans   | Headlines, labels            |
| Motion      | Micro + Physics | Squish, spring, slide        |

---

## Component Library

### Clay Components

| Component        | Behavior                           |
|------------------|------------------------------------|
| `ClayCard`       | Soft shadow, subtle inset          |
| `ClayButton`     | Squish scale 0.96 on press         |
| `ClayInput`      | Subtle inset, focus glow           |
| `ClayPill`       | Quick reply chips                  |
| `StatusChip`     | Pending (yellow) / Ready (green)   |

### Glass Components

| Component          | Behavior                         |
|--------------------|----------------------------------|
| `GlassNavBar`      | Blur backdrop, subtle border     |
| `GlassBottomSheet` | Slide up, physics spring         |
| `GlassModal`       | Center, blur + shadow            |

---

## Accessibility Requirements

| Requirement          | Target                  |
|----------------------|-------------------------|
| Text contrast        | ≥ 4.5:1 (WCAG AA)       |
| Touch targets        | ≥ 44px                  |
| Reduce motion        | Respect preference      |
| Focus visible        | High-contrast ring      |
| Screen reader labels | All interactive elements|

---

## UI Tabs

| Tab           | Content                                |
|---------------|----------------------------------------|
| Vendors       | Verified vendors only                  |
| Listings      | Published listings (badge: ✓/⚠)        |
| Requests      | Posted buy/sell requests               |
| Chat          | Moltbot creation flow (no classic forms)|
| Notifications | Match + inquiry alerts                 |

### Badge Rules

```tsx
// Verified vendor listing
<Badge bg="rgba(0,230,118,0.16)" fg="#00E676">Verified</Badge>

// Unverified seller listing
<Badge bg="rgba(255,204,0,0.14)" fg="#FFCC00">Unverified</Badge>
```

---

## Implementation Phases

### F1: DB + RLS (Core + Listings)

- [ ] `0100_web_marketplace_core.sql`
- [ ] `0101_web_marketplace_rls.sql`
- [ ] `0103_marketplace_listings_products.sql`

**Accept**: Anon CRUD own drafts; public reads published only; vendors = verified only.

---

### F2: Anon Bootstrap + Flags

- [ ] Session bootstrap in `apps/web/*`
- [ ] `web.create_or_get_session` tool

**Accept**: Session persists; flags off = no new behavior.

---

### F3: Moltbot Web Skill + Schema

- [ ] `docs/moltbot/web-marketplace-output-contract.v1.json`
- [ ] `skills/community-marketplace-web/*`

**Accept**: Examples validate schema; injection blocked.

---

### F4: Chat Endpoint + Tool Execution

- [ ] `src/web/chatEndpoint.*`
- [ ] `src/tools/web/*`

**Accept**: Buy/sell post via chat; listing created+published via chat.

---

### F5: PWA UI (Bento + Clay/Glass + Midnight)

- [ ] Apply Midnight Savory palette
- [ ] Implement Clay + Glass components
- [ ] Bento grid layout
- [ ] Verified/Unverified badges

**Accept**: Tabs work; badges correct; reduce motion works; contrast OK.

---

### F6: Matching + Notify Top 10

- [ ] `web.query_internal_matches`
- [ ] `web.rank_matches` (≤10)
- [ ] `web.queue_notifications` (≤10)

**Accept**: ≤10 suggestions with reasons; ≤10 notifications queued.

---

### G1: External Feeds (Links Only)

- [ ] `discovery.web_search_items`
- [ ] `discovery.maps_places_items`
- [ ] `discovery.social_profile_items`

**Accept**: Flags off = none; flags on = link cards only; no inventory claims.

---

### H1: Moderation + Abuse

- [ ] `web.moderation_log`
- [ ] `web.moderation_enforce`
- [ ] Rate limits (20 msgs/min, 10 posts/hr, 10 listings/hr)

**Accept**: Spam triggers moderation + block.

---

### I1: E2E + CI + Runbooks

- [ ] All tests pass
- [ ] Flags off preserves old behavior

---

## Caps & Constraints

| Cap                      | Limit |
|--------------------------|-------|
| Max suggestions          | 10    |
| Max notifications        | 10    |
| Discovery calls/source   | 2     |

### Non-Negotiables

- ✅ Additive only
- ✅ Vendor directory = verified only
- ✅ Chat is the only creation UI
- ✅ External discovery = links only (no inventory claims)
- ✅ No cold outreach to external vendors
- ✅ Moltbot output must validate schema

---

## Moltbot Actions

```
ask_user, update_post, post_now, create_or_update_listing,
publish_listing, show_listings, inquire_listing, suggest_matches,
notify_top_targets, show_feed_options, moderate_or_block
```

### Safety Rules

- Reject invalid schema → audit → fallback UI reply
- Clamp caps → audit `policy.caps_clamped`
- Block cold outreach → audit `policy.no_cold_outreach_blocked`
- Discovery is not truth: never assert in-stock/price from web/maps/social
