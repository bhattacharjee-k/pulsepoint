# Codex Handoff — PulsePoint Implementation Plan

> **Author:** Claude Opus 4.8 (architect, Stage 2b) · **Builder:** Codex CLI (Stage 3)
> **Source of truth for status:** [`workspace_plan.md`](./workspace_plan.md) · **Requirements:** [`TECHNICAL_REQUIREMENTS.md`](./TECHNICAL_REQUIREMENTS.md) · **Roles:** [`AGENTS.md`](./AGENTS.md)
>
> This file is **self-contained**: everything you need to build PulsePoint is here. Build the tasks **in order**. The architecture is locked — do not redesign it. If something is ambiguous or blocked, **stop and log it in `workspace_plan.md` → `## Implementation Notes`** rather than guessing.

---

## 0. Codex operating rules (read first)

1. **No git.** Never run `git commit`, `git push`, or amend history. Composer handles all git.
2. **Do not change the locked isolation/auth model** (shared Postgres + `tenant_id` + RLS; session-cookie auth; three DB roles). If you believe it must change, stop and log it — that requires a Claude amendment.
3. **Tests are part of "done," not optional.** Every task lists the tests that must pass. Do **not** stub a test to make it green, skip it silently, or weaken an assertion to pass. A failing test you can't fix → log it in `## Implementation Notes`.
4. **Code quality is graded.** See §3. Clean, small, readable modules; consistent naming; comments only where intent is non-obvious (especially around RLS).
5. **No new external/paid dependencies** without logging it first. The whole app must run offline via `docker compose up` with nothing to sign up for. (CAPTCHA stays a stub — see §8 Task 4.)
6. **Honesty over completeness.** If you run out of time or hit a wall, leave it clearly stubbed/commented and note it. A labeled stub is fine; a silent gap is not.
7. **Self-verify before declaring done.** Run the full test suite *and* the 30-second demo path (§9) yourself, and report the result in `## Implementation Notes`.

> ℹ️ **Note on QA independence:** In Stage 4, Claude will run an **independent adversarial security test set that you will not see**. Do not code only to the tests in this document — implement the *behavior* correctly. The tests here define the contract; they are a floor, not a ceiling.

---

## 1. Tech stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Language | **TypeScript** everywhere | API, dashboard, and tests |
| API server | **Fastify** | use `app.inject()` for tests (no live port needed) |
| Database | **PostgreSQL 16** | shared tables + `tenant_id` + RLS |
| DB driver | **`pg`** (node-postgres) | **raw parameterized SQL** on tenant-critical paths — no ORM hiding RLS |
| Migrations | **plain numbered `.sql` files** + a tiny runner | RLS policies must be visible as SQL |
| Validation | **`zod`** | one schema per endpoint payload |
| Passwords | **`bcrypt`** | never log or return plaintext/hash |
| Sessions | **`@fastify/session` + `@fastify/cookie`** | in-memory store for demo (labeled stub); HttpOnly + SameSite=Lax |
| Rate limit | **`@fastify/rate-limit`** (per IP) + custom per-key counter (in-memory) | labeled stub; note Redis for prod |
| CORS | **`@fastify/cors`** | permissive on public routes, locked on admin routes |
| Dashboard | **React + Vite + TypeScript** | React Router; plain `fetch` (no heavy data lib needed) |
| Widget | **vanilla TS/JS, no framework** | bundled to one small `embed.js`; Shadow DOM |
| Tests | **Vitest** | unit + integration; Fastify `inject` for HTTP; a real test Postgres for RLS tests |
| Orchestration | **Docker Compose** | one command brings up Postgres + API + serves dashboard/widget/demo pages |

---

## 2. Project structure (create exactly this tree)

```text
pulsepoint/
├── docker-compose.yml            # postgres + api (+ serves web/widget/demo)
├── .env.example                  # documented env vars (copy to .env)
├── package.json                  # npm workspaces: apps/api, apps/web
├── README.md                     # Task 11
├── openapi.yaml                  # Task 7 (transcribe the §6 contract)
│
├── db/
│   └── 000_roles.sql             # CREATE ROLE migrate/app/ingest (run by superuser at init)
├── migrations/
│   ├── 001_schema.sql            # tables, keys, indexes (owned by pulsepoint_migrate)
│   ├── 002_rls.sql               # ENABLE + FORCE RLS + policies + grants
│   └── run.ts                    # tiny runner: applies *.sql in order as pulsepoint_migrate
│
├── seed/
│   └── seed.ts                   # 2 tenants, 3 users, widget_config, sample feedback
│
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts          # Fastify bootstrap + plugin registration
│   │   │   ├── config.ts         # env parsing (zod)
│   │   │   ├── db/
│   │   │   │   ├── pools.ts       # appPool + ingestPool (separate pools!)
│   │   │   │   └── withTenant.ts  # transaction + SET LOCAL helper (THE core safety fn)
│   │   │   ├── plugins/
│   │   │   │   ├── cors.ts
│   │   │   │   ├── session.ts
│   │   │   │   └── rateLimit.ts
│   │   │   ├── lib/
│   │   │   │   ├── errors.ts      # consistent { error: { code, message } } + send helper
│   │   │   │   ├── password.ts    # bcrypt hash/verify
│   │   │   │   ├── captcha.ts     # STUB verifyCaptcha(token) -> true
│   │   │   │   └── validation.ts  # shared zod helpers
│   │   │   ├── routes/
│   │   │   │   ├── public/
│   │   │   │   │   ├── feedback.ts      # POST /api/v1/public/feedback
│   │   │   │   │   └── widgetConfig.ts  # GET  /api/v1/public/widget-config
│   │   │   │   ├── auth.ts        # POST /api/v1/auth/login, /logout
│   │   │   │   ├── feedback.ts    # GET/PATCH admin feedback + notes subroutes
│   │   │   │   ├── stats.ts       # GET /api/v1/stats
│   │   │   │   ├── settings.ts    # GET/PATCH /api/v1/settings (admin only)
│   │   │   │   └── team.ts        # GET /api/v1/team (admin only)
│   │   │   └── middleware/
│   │   │       ├── requireSession.ts   # resolves session -> { userId, tenantId, role }
│   │   │       └── requireAdmin.ts     # 403 if role !== 'admin'
│   │   ├── test/
│   │   │   ├── helpers/db.ts      # spin up/clean test schema, set tenant context
│   │   │   ├── isolation.test.ts  # ⭐ the crown-jewel RLS contract tests
│   │   │   ├── ingest.test.ts
│   │   │   ├── auth.test.ts
│   │   │   └── adminFeedback.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   └── web/                       # React/Vite dashboard
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx
│       │   ├── api.ts             # typed fetch wrappers
│       │   ├── pages/  (Login.tsx, Inbox.tsx, Detail.tsx, Settings.tsx)
│       │   └── components/ (FeedbackList, StatsStrip, Filters, EmptyState, LoadingState, ErrorState)
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── widget/
│   ├── src/embed.ts              # vanilla widget source (Shadow DOM)
│   └── (build to) public output  # bundled embed.js
│
└── public/
    ├── demo-alpha.html           # loads embed.js with pk_alpha_demo + stub Alice
    └── demo-delta.html           # loads embed.js with pk_delta_demo + stub Bob
```

---

## 3. Code-quality standards (graded — follow these)

- **TypeScript `strict: true`.** No `any` except at genuine boundaries, and comment why.
- **Small, single-purpose modules.** A route file handles routing + calls a focused function; no 400-line files.
- **Naming:** `camelCase` for vars/functions, `PascalCase` for types/React components, `snake_case` for DB columns. Be consistent.
- **No dead code, no commented-out blocks, no `console.log` left in.** Use the Fastify logger.
- **Comment the *why*, not the *what*** — especially around RLS, `SET LOCAL`, and the captcha stub. One clear comment per non-obvious decision.
- **Errors:** never swallow them; always return the consistent error shape (§6.4) with the right HTTP status.
- **No secrets in code.** Everything via `.env` (documented in `.env.example`).
- **Formatting:** include Prettier + ESLint configs and ensure the tree is clean (`lint` script passes).

---

## 4. Data model (DDL outline — `migrations/001_schema.sql`)

Use `uuid` primary keys (`gen_random_uuid()`), `timestamptz` timestamps. Implement these tables (types abbreviated — fill in NOT NULL / defaults sensibly):

- **tenants** — `id pk`, `name`, `slug unique`, `public_key unique`, `widget_config jsonb`, `created_at`, `updated_at`
- **users** — `id pk`, `email unique`, `password_hash`, `created_at`, `updated_at`  *(global identity — no tenant_id)*
- **memberships** — `id pk`, `user_id → users`, `tenant_id → tenants`, `role` (`'admin'|'member'` via CHECK or enum), `created_at`, **`unique(user_id, tenant_id)`**
- **feedback** — `id pk`, **`tenant_id → tenants`**, `type` (`bug|feature|rating|other`), `message text NULL`, `rating int NULL` (CHECK 1–5), `contact_email NULL`, `submitter_external_id NULL`, `submitter_email NULL`, `submitter_display_name NULL`, `context_page_url NULL`, `context_user_agent NULL`, `context_referrer NULL`, `status` (`open|in_progress|resolved|closed`, default `open`), `assignee_membership_id → memberships NULL`, `created_at`, `updated_at`
- **feedback_notes** — `id pk`, **`tenant_id → tenants`** (denormalized on purpose), `feedback_id → feedback`, `author_membership_id → memberships`, `body text`, `created_at`

**Indexes (minimum):**
```sql
CREATE INDEX ON feedback (tenant_id, created_at DESC);
CREATE INDEX ON feedback (tenant_id, status);
CREATE INDEX ON feedback (tenant_id, type);
CREATE INDEX ON feedback_notes (tenant_id, feedback_id);
-- plus the UNIQUE constraints above
```

---

## 5. RLS + roles (CRITICAL — implement these exactly)

This is the security heart of the product. **Do not deviate** without logging it.

### 5.1 Roles — `db/000_roles.sql` (run as superuser at DB init)
```sql
CREATE ROLE pulsepoint_migrate LOGIN PASSWORD '...';  -- owns tables; runs migrations
CREATE ROLE pulsepoint_app     LOGIN PASSWORD '...';  -- dashboard runtime (NOT an owner)
CREATE ROLE pulsepoint_ingest  LOGIN PASSWORD '...';  -- public ingest runtime (NOT an owner)
```
Run `001_schema.sql` and `002_rls.sql` **as `pulsepoint_migrate`** so it owns the tables.

### 5.2 RLS policies — `migrations/002_rls.sql`
For **every tenant-owned table** (`tenants`, `memberships`, `feedback`, `feedback_notes`):

```sql
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback FORCE  ROW LEVEL SECURITY;   -- applies even to the owner

-- dashboard role: read/write only its own tenant
CREATE POLICY tenant_rw ON feedback
  FOR ALL TO pulsepoint_app
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- public role: INSERT only, locked to the key's tenant
CREATE POLICY ingest_insert ON feedback
  FOR INSERT TO pulsepoint_ingest
  WITH CHECK (tenant_id = current_setting('app.ingest_tenant_id', true)::uuid);
```
- The `true` second arg to `current_setting` = "return NULL if unset" → comparison fails → **zero rows (fail closed)**. Never omit it in a way that errors loudly *or* opens access.
- **Grants:** `pulsepoint_app` gets `SELECT, INSERT, UPDATE, DELETE` on tenant tables (as appropriate). `pulsepoint_ingest` gets **`INSERT` only** on `feedback` and **`SELECT` only** on `tenants` (it needs to map key→tenant + read widget_config). It must have **no SELECT on `feedback`/`feedback_notes`/`users`/`memberships`**.
- `tenants` policy for `pulsepoint_app`: `USING (id = current_setting('app.current_tenant_id', true)::uuid)`.

### 5.3 The core safety helper — `apps/api/src/db/withTenant.ts`
Every admin DB operation goes through one helper that guarantees the transaction + `SET LOCAL`:
```ts
// pseudo-contract — implement the body
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]); // true = LOCAL
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```
The ingest path uses the same pattern with `app.ingest_tenant_id` on `ingestPool`. **No admin query may run outside `withTenant`.**

---

## 6. API contract (Claude-owned; implement to this — transcribe to `openapi.yaml` in Task 7)

All routes under `/api/v1`. JSON in/out.

### 6.1 Public (role: `pulsepoint_ingest`, permissive CORS, no cookies)
| Method · Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /public/widget-config` | `?key=pk_…` | — | `200 { accentColor, promptText, enabledTypes[] }` | `404` unknown key |
| `POST /public/feedback` | header `X-Tenant-Key: pk_…` | body §6.3 | `201 { id }` | `400` invalid, `401` bad key, `429` rate-limited |

### 6.2 Admin (role: `pulsepoint_app`, session cookie, locked CORS)
| Method · Path | Role | Notes |
|---|---|---|
| `POST /auth/login` | — | `{ email, password }` → sets session cookie; `401` on bad creds |
| `POST /auth/logout` | any | clears session |
| `GET /feedback` | member+ | query: `status`, `type`, `q` (search), `limit`, `offset` → `{ items[], total }` |
| `GET /feedback/:id` | member+ | item + its notes; `404` if not in tenant (RLS) |
| `PATCH /feedback/:id` | member+ | `{ status?, assigneeMembershipId? }` |
| `POST /feedback/:id/notes` | member+ | `{ body }` → created note |
| `GET /stats` | member+ | tenant-scoped counts by status/type + avg rating |
| `GET /team` | **admin** | memberships joined to users (tenant-scoped) |
| `GET /settings` · `PATCH /settings` | **admin** | read/update `widget_config` |

### 6.3 Ingest payload (validate with zod)
```jsonc
{
  "type": "bug|feature|rating|other",        // required
  "message": "string",                        // required UNLESS type==rating; max 5000 chars
  "rating": 1,                                // required & 1–5 ONLY when type==rating
  "contactEmail": "a@b.com",                  // optional, valid email
  "captchaToken": "stub",                     // optional in demo; passed to verifyCaptcha() stub
  "submitter": { "externalId": "alpha-1", "email": "?", "displayName": "?" },
  "context":   { "pageUrl": "...", "userAgent": "...", "referrer": "?" }
}
```
**Server rules:** ignore any `tenant_id` in the body; derive tenant from `X-Tenant-Key` only. Default `status='open'`.

### 6.4 Error format (every error, always)
```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "human-readable" } }
```
Use correct HTTP status: `400` validation, `401` unauth/bad key, `403` wrong role, `404` not found, `429` rate-limited, `500` unexpected.

### 6.5 Pagination: `?limit=&offset=` (default limit 25, max 100), always return `total`. Note in README that cursor-based is the scale upgrade.

---

## 7. Build order (do tasks in sequence — data-first)

> Each task: **goal → files → must pass**. A task isn't done until its tests are green and you've logged status.

### Task 0 — Scaffold & tooling
- **Files:** root `package.json` (workspaces), `docker-compose.yml` (Postgres + API), `.env.example`, both `tsconfig.json`, ESLint+Prettier, `vitest.config.ts`.
- **Must pass:** `docker compose up` starts Postgres; `npm install` succeeds; an empty `npm test` runs.

### Task 1 — Migrations (schema + RLS)
- **Files:** `db/000_roles.sql`, `migrations/001_schema.sql`, `migrations/002_rls.sql`, `migrations/run.ts`.
- **Implements:** §4 tables/indexes + §5 roles/RLS, applied by `pulsepoint_migrate`.
- **Must pass:** migration runner applies cleanly to a fresh DB; tables exist; RLS is enabled+forced (verify via `pg_tables`/`pg_policies`).

### Task 2 — DB access layer
- **Files:** `apps/api/src/db/pools.ts` (separate `appPool`, `ingestPool`), `apps/api/src/db/withTenant.ts`.
- **Must pass:** the **isolation tests** in Task-3-adjacent `isolation.test.ts` (see §8). This is the most important test file — write it now against the helper.

### Task 3 — Seed
- **Files:** `seed/seed.ts`.
- **Implements:** tenants Alpha/Delta (+ public keys + `widget_config`), users `admin@alpha.com`, `member@alpha.com` ("Casey", role member), `admin@delta.com` (hashed passwords), and ~8–12 sample feedback rows spread across tenants/types/statuses so the inbox + stats look alive.
- **Must pass:** seed is **idempotent** (re-runnable without dupes/crash); after seeding, each tenant has the expected counts.

### Task 4 — Public ingest API
- **Files:** `routes/public/feedback.ts`, `routes/public/widgetConfig.ts`, `plugins/rateLimit.ts`, `lib/captcha.ts`, `lib/validation.ts`, `plugins/cors.ts`.
- **Implements:** the two public endpoints; rate limit per key + per IP; zod validation; **`verifyCaptcha(token)` STUB returning `true`** with a comment marking where Turnstile `/siteverify` would go; tenant derived from key; insert via `ingestPool` + `app.ingest_tenant_id`.
- **Must pass:** `ingest.test.ts` (§8).

### Task 5 — Auth + session
- **Files:** `routes/auth.ts`, `plugins/session.ts`, `lib/password.ts`, `middleware/requireSession.ts`, `middleware/requireAdmin.ts`.
- **Implements:** login (bcrypt verify → session with `userId`); `requireSession` resolves `userId → membership → { tenantId, role }`; HttpOnly+SameSite cookie; logout.
- **Must pass:** `auth.test.ts` (§8).

### Task 6 — Admin API
- **Files:** `routes/feedback.ts` (+ notes subroutes), `routes/stats.ts`, `routes/settings.ts`, `routes/team.ts`, `lib/errors.ts`.
- **Implements:** §6.2 endpoints, all via `withTenant`; filtering/search/pagination; role checks (`requireAdmin` on team/settings); consistent errors.
- **Must pass:** `adminFeedback.test.ts` (§8).

### Task 7 — OpenAPI
- **Files:** `openapi.yaml`.
- **Implements:** transcribe the §6 contract into OpenAPI 3 (this is mechanical — the contract above is the source of truth).
- **Must pass:** validates as OpenAPI 3; covers every admin endpoint + the public ones.

### Task 8 — Widget
- **Files:** `widget/src/embed.ts` (build to `public/embed.js`).
- **Implements:** reads `data-public-key` from its `<script>` tag; `GET /public/widget-config`; renders launcher + form **inside a Shadow DOM** (`all: initial` reset); themes from config (accentColor, promptText, enabledTypes); a **CAPTCHA placeholder** in the form (visual stub, sends `captchaToken:"stub"`); captures `context.pageUrl`/`userAgent`; sends submitter from demo-page data attrs; states: idle/open/submitting/success/error. Keep the bundle small.
- **Must pass:** loads on both demo pages and themes correctly; a submit creates the right tenant's row (verified manually + in demo path).

### Task 9 — Dashboard
- **Files:** `apps/web/*` per §2.
- **Implements:** Login page; Inbox (list + filters by status/type + search + pagination + **StatsStrip**); Detail (message, submitter, context, status change, notes thread, assign); **empty / loading / error states**; **keyboard nav** (j/k move, Enter open, Esc back — document the set); **role-aware UI** (hide Settings/Team for members). Escape all user-supplied text on render (React does this by default — do not use `dangerouslySetInnerHTML`).
- **Must pass:** can log in as all 3 seeded users; Alpha users see only Alpha; member has no Settings; states render.

### Task 10 — Demo pages
- **Files:** `public/demo-alpha.html`, `public/demo-delta.html`.
- **Implements:** each is a believable mock host page that loads `embed.js` with the correct `pk_…` and stub submitter (Alice/Bob), clearly labeled as a stand-in.

### Task 11 — README
- **Files:** `README.md`.
- **Implements:** how to run (`docker compose up`); the 30-second demo script (§9); isolation strategy + **where RLS lives** (file/line); auth approach + why sessions; **built vs stubbed vs skipped** (must list: CAPTCHA stub, in-memory sessions/rate-limit, no real signup, queue described-not-built, no email); and a specific **"with more time"** section (queue + Redis rate-limit, Cloudflare Turnstile, read replicas, per-tenant quotas, cursor pagination, audit log).

---

## 8. Testing plan (Vitest) — these are the contract tests Codex must implement and pass

> Unit-test pure logic (validation, password, captcha stub, error helper). Integration-test the DB + routes against a **real test Postgres** (the RLS guarantee can't be unit-mocked — it must hit a real DB with the roles/policies).

### ⭐ `isolation.test.ts` — the crown jewel (write carefully)
1. Insert Alpha + Delta feedback (as migrate/seed). Under **Alpha** context (`withTenant(alphaId)`), `SELECT * FROM feedback` returns **only Alpha rows**.
2. Under Alpha context, attempting to **INSERT a row with `tenant_id = delta`** is **rejected** by `WITH CHECK`.
3. With **no** tenant context set, `SELECT * FROM feedback` returns **0 rows** (fail-closed) — not all rows.
4. Connecting as **`pulsepoint_ingest`** and running `SELECT` on `feedback` **errors / is denied** (no grant).
5. Fetching a **Delta feedback id while in Alpha context** returns nothing (→ route returns `404`).

### `ingest.test.ts`
- Valid submission → `201 { id }`; the stored row has `tenant_id` matching the key's tenant.
- A `tenant_id` placed in the body is **ignored** (row gets the key's tenant, not the body's).
- Unknown/garbage `X-Tenant-Key` → `401`.
- `type: rating` without a `1–5 rating` → `400`; `message` over max length → `400`; unknown `type` → `400`.
- Exceeding the rate limit → `429`.

### `auth.test.ts`
- Correct creds → `200` + session cookie set; wrong password → `401`.
- Stored `password_hash` is **not** the plaintext (bcrypt format).
- Calling an admin route with no session → `401`.

### `adminFeedback.test.ts`
- Logged in as Alpha admin: `GET /feedback` returns only Alpha items, paginated, `total` correct; filter by `status`/`type` works.
- `PATCH /feedback/:id` changes status within tenant; patching a Delta id as Alpha → `404`.
- **Casey (member)** `GET /settings` → `403`; **admin** `GET /settings` → `200`.
- `GET /stats` numbers equal the seeded Alpha counts (tenant-scoped).

**Done bar for tests:** all green, no `.skip`/`.only` left, no weakened assertions. Coverage of the isolation + ingest + auth paths is the priority over raw percentage.

---

## 9. Definition of Done / self-verification (run before declaring complete)

- [ ] `docker compose up` from a clean checkout brings up Postgres + API with no manual steps.
- [ ] Migrations + seed run automatically (or via one documented command).
- [ ] `npm test` → **all green**.
- [ ] `npm run lint` → clean.
- [ ] **30-second demo path works end to end:**
  1. open `demo-alpha.html` → blue widget → submit a bug → `201`.
  2. open `demo-delta.html` → amber widget → submit a feature.
  3. log in `admin@alpha.com` → see only Alpha incl. the new bug; stats updated.
  4. log in `admin@delta.com` → see only Delta.
  5. log in Casey (member) → can triage, no Settings.
- [ ] README's "built vs stubbed" list is accurate to what you actually did.
- [ ] Status + any blockers logged in `workspace_plan.md → ## Implementation Notes`.

---

## 10. Explicitly stubbed (build the seam, not the feature — and say so in README)

- **CAPTCHA:** placeholder in widget + `verifyCaptcha()` no-op returning `true`. (Prod: Cloudflare Turnstile `/siteverify`.)
- **Sessions & rate-limit store:** in-memory (single instance). (Prod: Redis/Postgres.)
- **Signup:** seed-only; no live signup flow (document the path).
- **Email** (invites/notifications): none.
- **Queue/workers** for bursty ingest: described in README, not built (v1 inserts synchronously → `201`).
- **Host-user identity:** forgeable stub `submitter` on demo pages. (Prod: signed token from host backend.)
