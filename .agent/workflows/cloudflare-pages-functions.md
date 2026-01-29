---
description: Use Pages Functions safely (edge logic) without breaking routing/headers
---

# Cloudflare Pages Functions Workflow

This workflow ensures that Cloudflare Pages Functions are implemented correctly, respecting the unique behavior of the Pages platform regarding headers, routing, and RBAC.

## Rules

1. **Headers & Requests**:
   - `_headers` file rules DO NOT apply to Function responses.
   - You must set headers (CORS, caching, security) explicitly in the code for any route handled by a Function.
   - `_redirects` file rules still apply before Functions if they match, but Functions can also intercept.

2. **Function Size & Scope**:
   - Keep Functions small, fast, and testable.
   - Use them for:
     - Auth middleware (validating tokens)
     - API proxying (hiding secrets)
     - Dynamic SEO injection (if not pre-rendered)
     - Simple data fetching
   - Do NOT use them for:
     - Heavy computation (use a proper backend or heavy Worker)
     - Long running tasks

3. **RBAC & Security**:
   - If a Function gates access to content, it must validate the user's role server-side (using Supabase Auth or similar).
   - Never rely on client-side state alone.

## Checklist

- [ ] Check if `functions/` directory exists (in root or app specific).
- [ ] If `_headers` defines security headers, replicate them in `functions/_middleware.ts` or per-function.
- [ ] Verify that `wrangler pages dev` (Preview) behaves the same as Production.
- [ ] Ensure no secrets are hardcoded; use `context.env`.

## Definition of Done

- Functions behave the same in Preview and Prod.
- RBAC is enforced server-side if Functions gate access.
- No regression in headers (security headers are present on Function responses).
