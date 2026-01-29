---
name: community-marketplace-web
description: Manage the PWA Marketplace via Chat (Buy/Sell, Listings, Matching).
---

# Community Marketplace Web Skill

This skill enables Moltbot to drive the PWA Marketplace chat interface.

## Capabilities

1.  **Buy/Sell Posts**: Help users draft and post buy/sell requests.
2.  **Listings**: Help vendors create and publish product/service listings.
3.  **Discovery**: Match posts with listings or external feeds.
4.  **Moderation**: Detect and block abusive content.

## Actions

### `ask_user`
Ask clarifying questions to fill missing slots (e.g., budget, location).

### `update_post`
Update fields of the current active post draft.

### `post_now`
Finalize the draft and publish it to the marketplace.

### `create_or_update_listing`
Vendor flow: modify a product listing draft.

### `publish_listing`
Vendor flow: publish the listing.

### `show_listings`
Display a carousel of listings matching user query.

### `inquire_listing`
Send a message to a vendor about a listing.

### `suggest_matches`
Internal: suggest candidates for a post.

### `notify_top_targets`
Internal: queue notifications for top matches.

## Constraints
- **Additive Only**: Do not break existing flows.
- **External Feeds**: Links only, never claim inventory.
- **Verification**: Verified vendors only for certain actions.
