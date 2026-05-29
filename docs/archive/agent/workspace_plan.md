# Workspace Plan — PulsePoint Challenge

> **Source of truth** for milestones and task status. **Build plan:** [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md). Roles: [`AGENTS.md`](./AGENTS.md). Requirements: [`TECHNICAL_REQUIREMENTS.md`](./TECHNICAL_REQUIREMENTS.md) + [`pulsepoint-challenge.md`](./pulsepoint-challenge.md).

## Pipeline Status

| Stage | Agent | Status |
|-------|-------|--------|
| 1 | Composer (PM) | **Complete** — sparring + decisions locked |
| 2a | Claude Opus — think + architecture review **with user** | **Complete** — architecture reviewed with user (5-part walkthrough) |
| 2b | Claude Opus — spec + Codex boilerplate tasks | **Complete** — see `## Technical Specifications` + [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) |
| 3 | Codex CLI GPT-5.5 (Terminal) | **Complete** — see `## Implementation Notes` (Composer verified 2026-05-28) |
| 4 | Claude Opus — integration + security QA | **Complete** — see `## Claude QA Report` (16/16 tests; isolation airtight; CORS finding found + **fixed** + re-verified) |
| 5 | Composer (Validation + Git) | **Ready** — QA done; commit recommendation in `## Ready for Composer` |

## Guardrails (All Agents)

- [x] Read `CODEX_HANDOFF.md` + `workspace_plan.md` + `AGENTS.md` before file changes
- [ ] **Codex CLI:** Do NOT run `git commit`, `git push`, or amend history
- [ ] **Collision rule:** One agent per file; update File Ownership Lock before handoff
- [ ] **Composer:** Review `@Git Diff` before any commit

---

## Current Feature

**Name:** PulsePoint — full four-pillar build (learning + practice)

**Business goal:** Multi-tenant feedback SaaS: embed widget on tenant sites → ingest → dashboard triage. Alpha & Delta demo tenants with Postgres RLS isolation.

### Demo cast

| Mock site | Tenant slug | Dashboard admin | Stub host user | Public key (seed) |
|-----------|-------------|-----------------|----------------|-------------------|
| Alpha.com | `alpha` | `admin@alpha.com` (+ member `member@alpha.com` Casey) | Alice (`alpha-1`) | `pk_alpha_demo` |
| Delta.com | `delta` | `admin@delta.com` | Bob (`delta-1`) | `pk_delta_demo` |

### Milestones

- [x] **M0 — Intake:** Challenge + user goals captured
- [x] **M1 — Plan:** Composer sparring; decisions in `AGENTS.md`
- [x] **M1b — Technical requirements:** [`TECHNICAL_REQUIREMENTS.md`](./TECHNICAL_REQUIREMENTS.md)
- [x] **M2a — Architecture dialogue:** Claude thinks through requirements; user reviewed 5-part walkthrough until aligned
- [x] **M2b — Spec + Codex handoff:** `## Technical Specifications` (below) + [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md)
- [x] **M3 — Implementation:** Codex — Tasks 0–11; tests 16/16, lint/build/docker per Implementation Notes
- [x] **M4 — Claude QA:** Integration + security tests done; `## Claude QA Report` written (16/16 pass; 1 MAJOR CORS finding documented)
- [ ] **M5 — Composer:** Diff review, cleanup, git init/commit if requested

### Acceptance criteria (high level)

- [x] `docker compose up` or `make dev` runs app + Postgres (Codex smoke — see Implementation Notes)
- [x] Seed: 2 tenants, 3 dashboard users (incl. Casey member), sample feedback; demo in ~30s (Codex API path)
- [x] Widget submit on both mock pages → correct tenant rows only (Claude QA: API path verified `201`+tenant; browser-visual recommended)
- [x] RLS: cross-tenant read/write impossible (document where policies live) — `002_rls.sql` + tests + Claude adversarial sweep
- [x] Dashboard login for both admins; inbox isolated (Claude QA: verified via API for all 3 users)
- [x] Rate limits on public ingest (minimal implementation) — `ingest.test.ts`
- [x] README: isolation, auth, built vs stubbed, with more time
- [x] Architecture diagram + admin API contract (HTML walkthroughs + `openapi.yaml`)

### File Ownership Lock

| File / Area | Owner | Status |
|-------------|-------|--------|
| `AGENTS.md` | Composer | Updated — Codex points to `CODEX_HANDOFF.md` §0–§3 |
| `TECHNICAL_REQUIREMENTS.md` | Composer | Locked unless user requests |
| `workspace_plan.md` § Technical Specifications | Claude (M2b) | **Done** |
| `CODEX_HANDOFF.md` | Claude (M2b) | **Done** — locked for Codex |
| **`pulsepoint/`** (all app code) | **Codex (M3)** | **Built** — API, web, widget, migrations, tests, docker |
| Stage-4 adversarial security tests | Claude (M4) | Held back — NOT shared with Codex |

---

## Where the code lives (for Claude / Cursor file tree)

Codex did **not** put source at the repo root. Open the **`pulsepoint/`** folder:

```text
pulsepoint/
├── apps/api/          ← Fastify API, RLS, routes, Vitest tests
├── apps/web/          ← React dashboard (main UI in src/main.tsx)
├── widget/            ← embed source
├── public/            ← embed.js, demo-alpha.html, demo-delta.html
├── migrations/        ← schema + 002_rls.sql
├── seed/              ← Alpha, Delta, Casey, sample feedback
├── docker-compose.yml
└── README.md          ← how to run
```

Repo root (`AGENTS.md`, `CODEX_HANDOFF.md`, `*.html` walkthroughs) = planning only.

**Claude Stage 4:** read and test under `pulsepoint/`, not only root-level markdown.

---

## Requirements baseline

Composer sparring is captured in **[`TECHNICAL_REQUIREMENTS.md`](./TECHNICAL_REQUIREMENTS.md)**. Claude maps architecture to those sections in M2a and normative specs in M2b.

---

## Technical Specifications

> Locked architecture from the Stage 2a dialogue. Full implementation detail lives in [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md).

**Stack:** TypeScript end-to-end — Fastify API + React/Vite dashboard + vanilla-JS Shadow-DOM widget + PostgreSQL 16 with raw parameterized SQL on tenant-critical paths. Vitest for tests. Docker Compose to run.

**Isolation (the headline guarantee):** shared Postgres, `tenant_id` on every tenant-owned table, enforced by **RLS** — `ENABLE` + `FORCE ROW LEVEL SECURITY`, policies with both `USING` (read gate) and `WITH CHECK` (write gate), tables owned by a non-runtime role. Three DB roles: `pulsepoint_migrate` (owns tables), `pulsepoint_app` (dashboard runtime), `pulsepoint_ingest` (insert-only public runtime, no read grant). Every request runs in a transaction with `SET LOCAL app.current_tenant_id` (admin) / `app.ingest_tenant_id` (public); unset → **fail closed** (zero rows). RLS lives in `migrations/002_rls.sql`; the safety helper in `apps/api/src/db/withTenant.ts`.

**Two APIs, two threat models:**
- *Public ingest* — `X-Tenant-Key: pk_…` (routing label, not secret), insert-only, permissive CORS + no cookies, rate-limited per key + per IP, zod-validated, stored-XSS handled by output encoding, CAPTCHA seam stubbed.
- *Admin* — session cookie (HttpOnly + SameSite=Lax), tenant derived from session not query param, RLS backstop, app-layer admin/member role checks, consistent error shape, pagination, `/v1` versioning.

**Data model:** `tenants`, `users` (global identity), `memberships` (user×tenant×role), `feedback`, `feedback_notes`. UUID PKs (unguessable). Dashboard stats are aggregate queries over `feedback` (no new table). Details + DDL: `CODEX_HANDOFF.md` §4–§6.

**Locked product decisions (Stage 2a):** seed-only signup (stub documented); admin/member enforced in app code, RLS for tenant only; seed 3 dashboard users (Alpha admin, Casey=Alpha member, Delta admin); Shadow-DOM widget; build all four pillars (learning project — time not the constraint) data-first; feedback **stats panel** included; **CAPTCHA designed-in but verification stubbed**.

**Admin API contract:** `CODEX_HANDOFF.md` §6 (source of truth); transcribed to `openapi.yaml` in Task 7.

---

## Codex Handoff

> **Full plan:** [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md). Build the tasks **in order**; tests must pass per task. No git. Log blockers below in `## Implementation Notes`.

Ordered task index (detail in the handoff §7):

0. Scaffold & tooling (workspaces, Docker Compose, lint/test config)
1. Migrations — schema + roles + **RLS** (`001_schema.sql`, `002_rls.sql`)
2. DB access layer — separate pools + `withTenant` helper
3. Seed — 2 tenants, 3 users, widget configs, sample feedback (idempotent)
4. Public ingest API — config + feedback endpoints, rate limit, validation, CAPTCHA stub
5. Auth + session — bcrypt, session cookie, role resolution middleware
6. Admin API — feedback CRUD, notes, stats, settings/team (role-gated)
7. OpenAPI — transcribe §6 contract to `openapi.yaml`
8. Widget — vanilla TS, Shadow DOM, config-themed, CAPTCHA placeholder
9. Dashboard — login, inbox, detail, stats, empty/loading/error states, keyboard, role-aware
10. Demo pages — `demo-alpha.html`, `demo-delta.html`
11. README — run, isolation, auth, built/stubbed/skipped, with-more-time

**Required tests (contract):** `isolation.test.ts` ⭐, `ingest.test.ts`, `auth.test.ts`, `adminFeedback.test.ts` — see handoff §8. Claude runs a **separate, unseen** adversarial security set in Stage 4.

---

## Claude QA Report

> Stage 4 — Claude Opus integration + security QA, 2026-05-28. App under `pulsepoint/`. No git performed.

### A. Integration — pass/fail

| Check | Result | Notes |
|---|---|---|
| Services up (`docker compose`) | ✅ PASS | Postgres (healthy) :5432, API :3000, web :5173 |
| Migrations + seed run clean | ✅ PASS | `001/002` applied; seed = 2 tenants, 3 users, 5 feedback |
| `npm test` | ✅ PASS | **16/16** green, ~3.6s, no flake |
| Contract tests genuine (not weakened/skipped) | ✅ PASS | read all 4 files; real assertions, no `.skip`/`.only` |
| 30-sec demo — API path | ✅ PASS | both tenants submit `201`; admin lists are tenant-isolated; Casey `403` on settings |
| 30-sec demo — **browser visual** | ⚠️ NOT RUN | no live browser available to me; widget code + demo wiring verified, **needs a human click-through** |
| Dashboard UX states + keyboard | ✅ PASS (code) | `loading/empty/error` + `j`/`k`/`Esc` handlers present in `apps/web/src/main.tsx`; visual confirmation recommended |

### B. Security (adversarial) — pass/fail

| Attack | Expected | Result |
|---|---|---|
| Alpha session → GET Delta feedback id | 404 | ✅ 404 |
| Alpha session → PATCH Delta feedback id | 404 | ✅ 404 |
| Admin route with no cookie | 401 | ✅ 401 |
| Login wrong password | 401 | ✅ 401 |
| Casey (member) → GET/PATCH `/settings` | 403 | ✅ 403 / 403 |
| Casey (member) → GET `/team` | 403 | ✅ 403 |
| Casey (member) → GET `/feedback` (control) | 200 | ✅ 200 |
| Public ingest, bad key | 401 | ✅ 401 |
| Public ingest, oversized message (>5000) | 400 | ✅ 400 |
| Public ingest, **forged `tenant_id` in body** | stored as key's tenant | ✅ stored as alpha |
| Rate limit (rapid submits) | 429 | ✅ 429 |
| **Ingest DB role** SELECT `feedback` | denied | ✅ permission denied |
| Ingest DB role SELECT `users` | denied | ✅ permission denied |
| RLS enabled **+ forced** on tenant tables | yes | ✅ `feedback/feedback_notes/tenants/memberships` all `t`/`t` |
| Fail-closed (no tenant context) | 0 rows | ✅ (isolation.test #3) |
| Stored XSS (`<script>` in message) | not executed | ✅ stored raw; **no** `dangerouslySetInnerHTML`/`innerHTML` in web → React auto-escapes |
| Session cookie flags | HttpOnly + SameSite | ✅ `HttpOnly; SameSite=Lax` |
| **CORS — admin route** | locked to dashboard origin | ✅ **PASS** (after fix — see bug #1; admin ACAO pinned to `localhost:5173`, public open + no credentials) |

### Bugs found

**#1 — CORS misconfiguration on the admin API — `MAJOR` → ✅ FIXED & re-verified (2026-05-28, with user approval)**
- **Repro:** `curl -D- -H 'Origin: https://evil.example' http://localhost:3000/api/v1/feedback` → response returns `Access-Control-Allow-Origin: https://evil.example` **and** `Access-Control-Allow-Credentials: true`. Same on public routes.
- **Root cause:** `apps/api/src/plugins/cors.ts` — the `origin()` callback checks for the allowed origin but then has a fall-through `callback(null, true)` that **allows every origin anyway** (dead-code check). One global CORS config is applied to both public and admin routes.
- **Why it matters:** the design (README + spec) was "admin CORS locked to the dashboard origin." Reflecting an *arbitrary* origin with `Allow-Credentials: true` is the classic dangerous CORS pattern — it would let any website read a logged-in admin's responses cross-origin.
- **Why it's not a live breach right now:** the session cookie is `SameSite=Lax`, so a cross-site `fetch()` from `evil.example` won't carry the cookie → the request is unauthenticated → 401. So tenant isolation and data are **not** currently exposed. But this is a *single defense* holding up a hole the design intended to close — if the cookie ever becomes `SameSite=None` (a common change to support cross-subdomain dashboards), it becomes a real credentialed-read vulnerability.
- **Recommended fix (per-route CORS):** public routes → reflect origin, `credentials: false` (the widget sends no cookies); admin routes → allow only `config.ADMIN_CORS_ORIGIN`, `credentials: true`. ~15 lines across `cors.ts` + route registration.
- **Fix applied (`apps/api/src/plugins/cors.ts`):** replaced the single global config with per-request dynamic options (`@fastify/cors` delegator). Public routes (`/api/v1/public/*`) → reflect origin, `credentials: false`; everything else (admin) → `origin: ADMIN_CORS_ORIGIN`, `credentials: true`.
- **Re-verified after fix:** admin route now returns `Allow-Origin: http://localhost:5173` even when probed with `Origin: https://evil.example` (browser blocks the mismatch); dashboard origin still allowed + credentialed; public route still open to any origin with **no** `Allow-Credentials`. Regression: login `200`, no-cookie `401`, cross-tenant `404`, own-tenant `200` — all unchanged. `npm test` still **16/16**; lint clean.

**#2 — `Access-Control-Allow-Credentials: true` on the public ingest route — `MINOR` → ✅ FIXED**
- Public ingest is now credential-less (`credentials: false`), folded into bug #1's fix.

**#3 — Contract test count: 16 vs the 17 in handoff §8 — `NIT`**
- `ingest.test.ts` merges "bad key → 401" and "invalid payloads → 400" into one `it()` block. **Coverage is complete** — it's a grouping difference, not a missing test.

**Observation (not a bug):** the `pulsepoint_ingest` role can read *all* rows of `tenants` (needed to map key → tenant). That data (name, public key, widget config) is non-sensitive/public-facing, so this is by design — noted for awareness.

### UI/UX gaps for a follow-up pass (not fixed now)
- **Visual/browser confirmation** of the widget theming (Alpha blue / Delta amber) and the dashboard empty/loading/error states + keyboard nav — I verified these in code and via the API, but did not click through a live browser. Recommend the owner does the 30-second demo visually once.

### UI pass (M6 — Claude)
- **Brand source of truth:** [`pulsepoint/docs/brand-ui.md`](./pulsepoint/docs/brand-ui.md) — sleek professional voice, **dark mode preferred**, palette, Noto Sans, motion rules, UX copy spec.
- **Implementer:** **Claude Opus** (not Composer/Codex) — `apps/web` only; no API/RLS/CORS/widget unless blocker.
- **Stack:** shadcn/ui + Tailwind + Motion (`motion/react`) per brand doc.
- **Status:** [x] **Complete (2026-05-29)** — Claude refactored `apps/web` to the dark brand UI. See `## Implementation Notes`.

### Prompt for Claude (M6 UI — paste to Claude terminal)

```text
You are Claude Opus for PulsePoint M6 — dashboard UI only.

Read first:
1. pulsepoint/docs/brand-ui.md (dark mode, palette, Noto Sans, UX copy verbatim, motion rules)
2. workspace_plan.md (M6 section)
3. AGENTS.md — NO git commit/push

Scope: pulsepoint/apps/web ONLY. Do not change API, RLS, cors.ts, widget, migrations, or tests unless a UI blocker.

Implement:
- shadcn/ui + Tailwind + Motion (motion/react) + @fontsource/noto-sans
- Dark mode default per brand-ui.md (ink-black / mint-cream / cotton-rose)
- Refactor src/main.tsx → src/pages/ + src/components/ + src/copy.ts
- Use UX copy from brand-ui.md exactly (copy.ts)
- Professional motion: list stagger, detail transition, skeleton loading — no parallax/gimmicks
- Settings: structured UI (not JSON dump); embed snippet; demo public keys pk_alpha_demo / pk_delta_demo from logged-in email
- Detail: internal notes via api.getFeedback / api.addNote
- Keep keyboard j/k/Esc

Verify: npm --workspace apps/web run build. Do not run git.

Explain changes for a learner.
```

### Plain-language summary (for the project owner)
The build is **genuinely solid where it matters most.** The headline guarantee — *no tenant can ever see or touch another tenant's data* — held up against every attack I threw at it: I logged in as Alpha and tried to read, edit, and guess Delta's records, and the database refused every time (404 / empty / rejected). The public widget path can only *insert* and can't read anything, even at the database level. Passwords are hashed, logins are required, and the member-vs-admin wall works (Casey can triage but can't reach settings). The `<script>` injection test was neutralized because the dashboard escapes text. All 16 automated tests pass and are real (I read them to be sure they weren't faked).

I found **one real issue** and (with your approval) **fixed it**: the admin API's CORS was misconfigured to accept requests from *any* website instead of just the dashboard. It was never actually exploitable (the `SameSite=Lax` login cookie was a second lock holding the door), but it defeated a defense we deliberately designed in. The fix splits CORS by surface — the public widget endpoint stays open to any site (no cookies), and the admin API is now locked to the dashboard origin. I re-tested: a malicious origin is now refused on the admin API, the dashboard and widget still work, and all 16 tests + the isolation/auth attacks still pass.

Bottom line: **strong on the hard parts (isolation, the two-API split, auth), and the one CORS issue is now closed.**

---

## Ready for Composer

- **Run command:** `cd pulsepoint && npm install && docker compose up` → API :3000, dashboard :5173, demo pages in `pulsepoint/public/`. Logins: `admin@alpha.com` / `member@alpha.com` / `admin@delta.com`, password `password123`.
- **Tests:** `cd pulsepoint && npm test` → 16/16.
- **Known stubs (by design, in README):** CAPTCHA verify = no-op; in-memory session + rate-limit stores; seed-only signup; no email; queue described-not-built; forgeable demo `submitter`.
- **Open findings:** none blocking. CORS bug #1 + #2 **fixed & re-verified** (`apps/api/src/plugins/cors.ts`). Remaining items are nits + a recommended human browser-visual pass.
- **Changed files since Codex (for Composer's diff review):** `apps/api/src/plugins/cors.ts` (CORS split fix). Root-level `workspace_plan.md` (this report). No other app code touched.
- **Commit recommendation:** ✅ **Safe to commit.** Isolation, auth, the two-API split, and all 16 tests are sound; the CORS finding is resolved. Suggest a single commit covering Codex's build + the CORS fix. (Internet-facing deploy would still want the README's "with more time" hardening — Redis-backed sessions/rate-limit, real CAPTCHA — but those are documented stubs, not blockers for this milestone.)

---

## Prompt for Codex (Stage 3 — paste to start)

```text
You are Codex GPT-5.5, Stage 3 builder for PulsePoint. Read and follow exactly:

1. CODEX_HANDOFF.md — full build plan (§0 operating rules, Tasks 0–11 in order, §8 tests, §9 done bar)
2. workspace_plan.md — status, log blockers in ## Implementation Notes
3. AGENTS.md — your role: implement handoff only; NO git commit/push

Locked stack: TypeScript, Fastify, pg (raw SQL on tenant paths), Postgres 16 + RLS, React/Vite dashboard, vanilla Shadow-DOM widget, Vitest, Docker Compose.

Start at Task 0. Create the pulsepoint/ tree per handoff §2. Do not redesign RLS or auth.

Critical:
- isolation.test.ts is the crown jewel — implement §8 tests; do not skip or weaken assertions
- Every admin DB call uses withTenant + SET LOCAL
- CAPTCHA: stub only (verifyCaptcha returns true)
- Seed: admin@alpha.com, member@alpha.com (Casey), admin@delta.com, pk_alpha_demo / pk_delta_demo
- When stuck, log in workspace_plan.md ## Implementation Notes and stop guessing

When Tasks 0–11 are done: run npm test (all green), run §9 30-second demo, log results in Implementation Notes. Do not git commit.
```

---

## Prompt for Claude (Stage 4 — QA — paste now)

```text
Stage 4: Integration + security QA for PulsePoint.

Read first:
1. AGENTS.md — your Stage 4 role (no git commit/push)
2. workspace_plan.md — ## Implementation Notes (what Codex claims is done)
3. CODEX_HANDOFF.md §8–§9 — contract tests + done bar (you already know the listed tests; also run adversarial checks Codex was warned about)
4. pulsepoint/README.md — how to run

All implementation is under pulsepoint/ (not repo root). Do not redesign architecture unless you find a security blocker — flag [BLOCKER] and fix minimally.

## Your job

### A. Integration testing (run the app)
1. From pulsepoint/: docker compose up (or confirm services on 5432/3000/5173).
2. Run npm test — confirm 16/16 still pass; note any flake.
3. Browser/manual 30-second demo from README:
   - demo-alpha.html + demo-delta.html widget submits
   - login admin@alpha.com, admin@delta.com, member@alpha.com (Casey)
   - Alpha admin sees only Alpha; Delta only Delta; Casey no Settings
4. Dashboard UX smoke: empty/loading/error paths if reachable; keyboard j/k/Esc if implemented.

### B. Security testing (adversarial — beyond contract tests)
Try and document results (pass/fail + repro):
- Cross-tenant: Alpha session fetching/patching Delta feedback UUID → must 404 or empty
- Public ingest: bad key, oversized payload, forged tenant_id in body (must ignore), rate limit → 429
- Ingest role: cannot SELECT feedback (DB or API)
- Session: no cookie → 401 on admin routes; wrong password → 401
- Member vs admin: Casey → GET/PATCH /settings or /team → 403
- Stored XSS: submit <script> in message; dashboard must not execute (escaped text)
- CORS: note public vs admin stance (document, do not confuse with auth)

### C. Deliverable
Append workspace_plan.md ## Claude QA Report with:
- Checklist (integration + security items above)
- Pass/fail table
- Bugs found (severity: blocker / major / minor / nit)
- UI/UX gaps for a follow-up pass (do not fix UI now unless blocker)
- Plain-language summary for the learner (project owner)
- End with: ## Ready for Composer (run command, known stubs, recommend commit or not)

Update pipeline: mark M4 complete when report is written.
Do NOT git commit. Small security fixes OK if you document them; large changes need user approval.
Explain findings in teaching tone — the owner is learning.
```

---

## Prompts for Claude

### Stage 2b (after you approve architecture)

```text
Architecture direction approved. Proceed to Stage 2b per AGENTS.md:
- Append ## Technical Specifications and ## Codex Handoff to workspace_plan.md
- Update File Ownership Lock
- Mark M2a and M2b complete
Still no git commit. Explain Codex tasks in plain language for me before I send them to Codex.
```

---

## Implementation Notes

<!-- Codex CLI logs blockers during Stage 3 -->

2026-05-28 — Codex Stage 3 implementation complete.

- Created `pulsepoint/` per handoff: Fastify API, Postgres roles/migrations/RLS, seed, React/Vite dashboard, vanilla Shadow DOM widget, demo pages, OpenAPI, README.
- RLS implemented in `pulsepoint/migrations/002_rls.sql`; admin tenant context goes through `pulsepoint/apps/api/src/db/withTenant.ts`; ingest uses separate `ingestPool` and `app.ingest_tenant_id`.
- CAPTCHA is intentionally stubbed in `pulsepoint/apps/api/src/lib/captcha.ts` and widget sends `captchaToken: "stub"`.
- Verification:
  - `npm test` passed: 4 test files, 16 tests, including `isolation.test.ts`.
  - `npm run lint` passed.
  - `npm --workspace apps/web run build` passed.
  - Docker Compose smoke passed after using separate container-local `api_node_modules` and `web_node_modules` volumes so native `bcrypt` is installed for Linux containers. Services running: Postgres `5432`, API `3000`, web `5173`.
  - 30-second demo path exercised via API: Alpha public key submission returned `201`, Delta public key submission returned `201`, Alpha admin saw only Alpha demo feedback, Delta admin saw only Delta demo feedback, Casey logged in as member and `GET /settings` returned `403`.
- No git commit/push performed.

**Composer verification (2026-05-28):** Re-ran `npm test` → 16/16 passed; `npm run lint` → passed. M3 marked complete; Stage 4 ready for Claude.

---

2026-05-29 — **Claude M6 dashboard UI pass complete** (scope: `apps/web/` only).

- Refactored the `main.tsx` monolith into: `copy.ts` (all UX strings verbatim from `docs/brand-ui.md`), `App.tsx` shell + thin `main.tsx`, `pages/` (Login, Inbox, Detail, Settings), `components/` (Sidebar, StatsStrip, Filters, FeedbackList, EmptyState, LoadingState, ErrorState), and shadcn-style `components/ui/` primitives (Button, Card, Input, Textarea, Label, Badge, Select).
- **Stack added:** Tailwind v3 + the ink-black / mint-cream / cotton-rose brand scales (`tailwind.config.js`), dark-mode tokens, `@fontsource/noto-sans` (Latin subset), `motion/react` (restrained: login fade/slide, list stagger, detail cross-fade via AnimatePresence, stats scale-in, skeleton loaders), `clsx`+`tailwind-merge` (`cn()`). shadcn brought in **hand-authored** (per user decision) rather than via the interactive CLI.
- **Behavior preserved:** all existing API contracts; j/k/Esc keyboard nav; admin-only Settings (members see the brand "admins only" message). **Added:** `api.logout()` (only api.ts change), notes in Detail (`getFeedback`+`addNote`), a11y labels + `role="alert"` errors. Settings is a structured UI (appearance + embed snippet + key hint/rotation), **not** a raw JSON dump; demo public key inferred from admin email domain.
- **Verification:** `npm --workspace apps/web run build` → passes; `tsc -p apps/web --noEmit` → 0 errors; web container restarted, vite dev serves on `:5173`, entry + `motion/react` resolve, dashboard origin still allowed by admin CORS. Visual/browser click-through left for the owner (no live browser in QA env).
- **Did NOT touch:** `apps/api`, migrations, RLS, `cors.ts`, seed, docker, backend tests. No git.

2026-05-29 — **M6 follow-up (owner-requested):** restyled the widget + demo pages to the PulsePoint design language. Updated `widget/src/embed.ts` + hand-maintained `public/embed.js` (Noto Sans self-loaded via Google Fonts, design-system card/input/button components, icon launcher, rating field shown only for `rating` type, "Powered by PulsePoint" footer; per-tenant accent color retained). Rebuilt `public/demo-alpha.html` + `public/demo-delta.html` into clean mock tenant sites (Noto Sans, nav/hero/cards/footer). Verified: `node --check embed.js` ok, pages serve, live submit → `201` (flow intact), CORS unchanged. Still no API/RLS/seed/docker changes; no git.

---

## Review & Git Log

<!-- Composer after Stage 5 -->
