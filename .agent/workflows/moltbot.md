---
description: 
---

v: "1.0"
name: "Real Estate PWA + Moltbot (Internal Agent API) — Additive Only"
mode: "additive_only"
goal: >
  Build a real estate PWA where seekers browse properties and chat to refine needs; posters submit listings;
  admins review/approve; Moltbot runs as internal multi-agent brain accessed only by backend tools.
  Must be secure: loopback/private gateway, token auth, strict output schema validation, audit-every-tool-call.

non_negotiables:
  additive_only: true
  gateway_not_public: true
  gateway_auth_token_required: true
  validate_agent_output_json: true
  tools_backend_only: true
  audit_every_tool_call: true
  seo_public_only: true
  private_routes_noindex: true

references:
  moltbot_gateway_docs: "https://docs.molt.bot/gateway"
  config_path_note: "Default config path is ~/.clawdbot/clawdbot.json (docs)."
  dm_pairing_note: "DM pairing supported; approve via moltbot pairing approve (docs)."

phases:
  - id: "P0"
    name: "Control plane (rules + contracts)"
    deliver:
      - ".agent/rules/* (phase gates, caps, no cold outreach, audit)"
      - "docs/moltbot/realestate-output-contract.v1.json"
      - "docs/moltbot/realestate-admin-output-contract.v1.json"
    acceptance:
      - "Schemas exist and validation utility is wired (unit tests)."

  - id: "P1"
    name: "Real estate DB + RLS (no AI)"
    deliver:
      - "supabase migrations for: properties, property_media, property_features, inquiries, viewings"
      - "admin_review_queue, verification_requests, audit_events, moderation_events"
      - "RLS: public read only approved properties; posters can edit own drafts; admins full access"
    acceptance:
      - "public can only read approved listings"
      - "drafts are private"
      - "audit_events writes work"

  - id: "P2"
    name: "PWA (SSR/prerender public pages) + SEO"
    deliver:
      - "Public routes: /properties, /property/{slug}, /locations/{area}, /categories/{type}"
      - "robots.txt + sitemap.xml segmented"
      - "noindex for /chat, /me, /draft, /admin"
      - "Schema.org: RealEstateAgent/LocalBusiness (where appropriate), Offer, ItemList, BreadcrumbList"
    acceptance:
      - "property page HTML renders content without JS"
      - "sitemap includes only approved properties"
      - "private routes noindex"

  - id: "P3"
    name: "Backend tool registry (no Moltbot yet)"
    deliver:
      - "tools.properties.create_draft, update_fields, upload_media, submit_for_review"
      - "tools.search.query_properties, rank_results_with_reasons"
      - "tools.admin.review_approve_or_reject, request_more_info"
      - "tools.notify.send_poster, send_seeker (channel-agnostic)"
      - "all tools write audit_events"
    acceptance:
      - "end-to-end: poster draft -> submit -> admin approve -> visible on public pages"

  - id: "P4"
    name: "Moltbot deployment (internal only) + multi-agent config"
    deliver:
      - "deploy moltbot gateway bound to loopback/private network with token auth"
      - "config file uses documented default path (~/.clawdbot/clawdbot.json)"
      - "agents: poster, seeker, admin"
      - "bindings: webchat routes to seeker/admin based on context; optional WhatsApp routes to poster"
      - "DM pairing enabled where relevant"
    acceptance:
      - "gateway not reachable publicly"
      - "token required"
      - "agents respond to test turns"

  - id: "P5"
    name: "Chat orchestration endpoint (PWA -> backend -> Moltbot -> tools)"
    deliver:
      - "POST /api/chat: builds context pack, calls Moltbot, validates JSON output, executes tools"
      - "invalid output => reject + audit + deterministic fallback reply"
      - "caps: max results shown, max tool calls per turn"
    acceptance:
      - "seeker can chat: needs -> gets shortlist"
      - "poster can chat: creates draft listing checklist"
      - "admin can chat: sees review queue actions"

  - id: "P6"
    name: "Media + quality automation"
    deliver:
      - "image pipeline: resize thumb/med/full, EXIF strip"
      - "min photo rules (e.g., 5) enforced at submit_for_review"
      - "optional OCR on docs/images (Gemini Vision) gated by confidence"
      - "moderation hold for suspicious content"
    acceptance:
      - "low confidence OCR triggers clarification (no auto publish)"
      - "media loads fast with placeholders"

  - id: "P7"
    name: "Observability + safety + tests"
    deliver:
      - "rate limits + abuse throttles"
      - "admin debug trace (redacted): last agent plan + tool calls"
      - "e2e tests: seeker flow, poster flow, admin approval flow, SEO checks"
    acceptance:
      - "all tests pass"
      - "flags off preserves baseline behavior"

antigravity_prompt:
  title: "Implement Real Estate PWA + Moltbot (Internal Agent API) — Additive Only"
  instructions: >
    Implement phases P0..P7 in order. Do not skip acceptance checks.
    Keep gateway private (loopback/Tailscale) and require token auth.
    Use backend-only tools; validate Moltbot JSON outputs strictly against schemas.
    Ensure SEO public pages are SSR/prerendered; private routes are noindex.
    After each phase: output files changed, commands run, test output, rollback notes.
