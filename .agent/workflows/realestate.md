---
description: 
---

patch: "REAL-ESTATE-PLUS"
adds_workflows:
  - id: "P6A"
    name: "Anti-duplicate + Anti-scam (Hold + Review) Workflow"
    purpose: >
      Prevent duplicate listings, stolen-photo reposts, and scam patterns. Automatically hold suspicious
      drafts before approval. Provide explainable reasons to admins and a clean correction path to posters.
    deliver:
      db_migrations:
        - table: "listing_fingerprints"
          fields:
            - "id uuid pk"
            - "property_id uuid fk properties"
            - "fingerprint_hash text unique"     # computed server-side
            - "phone_hash text null"
            - "address_norm text null"
            - "title_norm text null"
            - "price_bucket text null"
            - "geo_cell text null"               # geohash/cell for proximity
            - "photo_hashes text[] default {}"   # perceptual hashes
            - "created_at timestamptz default now()"
        - table: "listing_risk_scores"
          fields:
            - "id uuid pk"
            - "property_id uuid fk properties unique"
            - "risk_score int not null"          # 0..100
            - "risk_level text not null"         # low/medium/high
            - "reasons jsonb not null"           # explainable list
            - "status text not null"             # ok/hold/review_required
            - "created_at timestamptz default now()"
            - "updated_at timestamptz default now()"
        - table: "photo_hash_index"
          fields:
            - "id uuid pk"
            - "media_id uuid fk property_media"
            - "phash text not null"
            - "created_at timestamptz default now()"
          indexes:
            - "(phash)"
      rls_updates:
        - "posters can read their own risk status summary (no sensitive signals)"
        - "admins can read full reasons"
        - "public cannot read risk tables"
      tools:
        - name: "risk.compute_listing_fingerprint"
          inputs: ["property_id"]
          outputs: ["fingerprint_hash", "photo_hashes", "geo_cell", "norm_fields"]
          notes:
            - "Normalize address/title; bucket price; compute geo cell; compute photo pHash"
        - name: "risk.score_listing"
          inputs: ["property_id"]
          outputs: ["risk_score", "risk_level", "status", "reasons"]
          rules:
            - "If duplicate fingerprint detected => high risk"
            - "If photo pHash matches existing approved listing from different poster => high risk"
            - "If price is extreme outlier for area/type => medium/high"
            - "If address missing + phone missing + 1 photo only => medium/high"
        - name: "admin.risk_override"
          inputs: ["property_id", "decision(allow|hold|reject)", "notes?"]
          outputs: ["final_status"]
      backend_workflow:
        trigger_points:
          - "on submit_for_review"
          - "on media upload complete"
        steps:
          - "compute fingerprint"
          - "score listing"
          - "if status=hold/review_required => set property.status='hold_for_review' and enqueue admin review"
          - "if ok => proceed to standard admin review (or auto-approve if you later enable it)"
        messaging:
          poster:
            - "If held: explain what’s missing or suspicious in non-accusatory terms"
            - "Ask for verification: exact address, ownership proof (optional), more photos"
          admin:
            - "Show risk score + top reasons + similar listing links"
      acceptance:
        - "near-duplicate listing triggers hold_for_review with reasons"
        - "reposted photo triggers hold_for_review"
        - "normal listing passes without hold"
        - "admin can override and audit is written"
      rollback:
        - "RISK_SCORING_ENABLED=false (keeps tables, disables enforcement)"

  - id: "P6B"
    name: "Viewing Scheduling Workflow (Seeker ↔ Poster ↔ Admin Optional)"
    purpose: >
      Enable scheduling property viewings without payments. Chat-first scheduling with confirmations,
      time windows, reminders, and auditability. Works across WebChat and WhatsApp/Telegram if enabled.
    deliver:
      db_migrations:
        - table: "viewing_requests"
          fields:
            - "id uuid pk"
            - "property_id uuid fk properties"
            - "seeker_id uuid null"                # anon session or registered user
            - "seeker_session_id uuid null fk web_sessions"
            - "poster_id uuid fk users"
            - "status text not null default 'proposed'"   # proposed/confirmed/rescheduled/cancelled/completed
            - "notes text null"
            - "created_at timestamptz default now()"
            - "updated_at timestamptz default now()"
        - table: "viewing_time_options"
          fields:
            - "id uuid pk"
            - "viewing_request_id uuid fk viewing_requests on delete cascade"
            - "start_at timestamptz not null"
            - "end_at timestamptz not null"
            - "timezone text not null default 'Africa/Kigali'"
            - "source text not null"               # seeker/poster/admin
            - "status text not null default 'offered'"     # offered/selected/rejected
            - "created_at timestamptz default now()"
        - table: "viewing_events"
          fields:
            - "id uuid pk"
            - "viewing_request_id uuid fk viewing_requests"
            - "event_type text not null"           # created/offered/selected/confirmed/rescheduled/cancelled/reminded/completed
            - "actor text not null"                # seeker/poster/admin/system
            - "payload jsonb"
            - "created_at timestamptz default now()"
      rls_updates:
        - "seeker can read only their own viewing_requests via seeker_session_id"
        - "poster can read requests for their properties"
        - "admin can read all"
        - "public none"
      tools:
        - name: "viewing.create_request"
          inputs: ["property_id", "seeker_session_id", "notes?"]
          outputs: ["viewing_request_id"]
        - name: "viewing.offer_times"
          inputs: ["viewing_request_id", "time_options[]", "source"]
          outputs: ["offered_count"]
          rules:
            - "max 5 options at a time"
        - name: "viewing.select_time"
          inputs: ["viewing_request_id", "time_option_id"]
          outputs: ["status"]
        - name: "viewing.confirm"
          inputs: ["viewing_request_id"]
          outputs: ["status"]
        - name: "viewing.reschedule"
          inputs: ["viewing_request_id", "new_time_options[]", "by"]
          outputs: ["status"]
        - name: "viewing.cancel"
          inputs: ["viewing_request_id", "by", "reason?"]
          outputs: ["status"]
        - name: "notify.viewing_update"
          inputs: ["viewing_request_id", "to(seeker|poster)", "channel", "message"]
          outputs: ["sent"]
      chat_flows:
        seeker_flow:
          - "User: 'I want to visit this property'"
          - "Agent: collect preferred days + time windows + phone (optional) + constraints"
          - "Create viewing_request + offer 3-5 options"
          - "Seeker selects option"
        poster_flow:
          - "Poster receives request + options"
          - "Poster confirms or proposes new options"
        admin_optional:
          - "Admin can intervene if disputes or repeated reschedules"
      reminders:
        policy:
          - "send reminder 24h before and 2h before (if viewing confirmed)"
          - "respect channel opt-in"
        implementation:
          - "use existing scheduler/cron/queue system; log viewing_events"
      acceptance:
        - "seeker can propose options; poster confirms; status=confirmed"
        - "reschedule path works and is audited"
        - "cancel path works and is audited"
        - "reminders fire (in staging via simulated time)"
      rollback:
        - "VIEWINGS_ENABLED=false (keeps DB, disables scheduling UI/actions)"

integration_updates:
  phase_order_insert:
    - "Insert P6A and P6B after P6 (Media + quality automation) and before P7 (Observability + tests)."
  moltbot_skills_update:
    - "Poster agent: must call risk score tools before submit_for_review; if hold, guide poster to fix."
    - "Seeker agent: can initiate viewing workflow from property detail or chat."
  seo_note:
    - "Viewing pages are private => noindex; never add to sitemap."
