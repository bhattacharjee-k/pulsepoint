# Architecture

## Product slice

PulsePoint serves two audiences:

1. **Tenants** — companies using the dashboard (admin / member roles).
2. **End-users** — visitors on tenant sites who submit via the embedded widget (no PulsePoint account).

## Stack

| Layer | Choice |
|-------|--------|
| API | TypeScript, Fastify, raw `pg` on tenant paths |
| Database | PostgreSQL 16, migrations + RLS |
| Dashboard | React 18, Vite, Tailwind, Motion |
| Widget | Vanilla JS, Shadow DOM (`public/embed.js`) |
| Tests | Vitest (API contract + isolation) |

## Multi-tenancy

- Shared database, `tenant_id` on tenant-owned rows.
- **RLS** with `ENABLE` + `FORCE ROW LEVEL SECURITY` in `pulsepoint/migrations/002_rls.sql`.
- Runtime sets tenant per transaction:
  - Dashboard: `SET LOCAL app.current_tenant_id` via `apps/api/src/db/withTenant.ts`
  - Ingest: `SET LOCAL app.ingest_tenant_id` via `withIngestTenant`
- Unset context → policies return no rows (fail closed).

**DB roles:** `pulsepoint_migrate` (schema), `pulsepoint_app` (dashboard), `pulsepoint_ingest` (insert-only public path).

## Two APIs, two threat models

### Public (`/api/v1/public/*`)

- Auth: `X-Tenant-Key` (routing label; rate-limited per key + IP).
- CORS: any origin, **credentials: false** (widget does not use cookies).
- Ingest role cannot `SELECT` feedback rows.

### Admin (`/api/v1/*`)

- Auth: session cookie after bcrypt login; tenant from session, not body.
- CORS: dashboard origin only, **credentials: true**.
- App-layer checks for admin vs member (e.g. Settings → admin only).

## Data model (core tables)

- `tenants` — slug, `public_key`, `widget_config` JSON
- `users` + `memberships` — global identity, per-tenant role
- `feedback` — widget submissions
- `feedback_notes` — internal triage notes

OpenAPI: `pulsepoint/openapi.yaml`

## Code map (where to start reading)

| Question | Start here |
|----------|------------|
| Is isolation real? | `pulsepoint/apps/api/test/isolation.test.ts` |
| How is tenant set? | `pulsepoint/apps/api/src/db/withTenant.ts` |
| RLS policies | `pulsepoint/migrations/002_rls.sql` |
| Public vs admin CORS | `pulsepoint/apps/api/src/plugins/cors.ts` |
| Widget embed | `pulsepoint/widget/src/embed.ts` → `public/embed.js` |
| Dashboard UI | `pulsepoint/apps/web/src/pages/` |

## Demo tenants (seed)

| Tenant | Admin | Public key |
|--------|-------|------------|
| Alpha | `admin@alpha.com` | `pk_alpha_demo` |
| Alpha member | `member@alpha.com` (Casey) | — |
| Delta | `admin@delta.com` | `pk_delta_demo` |

## With more time

Redis sessions/rate limits, real CAPTCHA (Turnstile), async ingest queue, audit log, key rotation UI, signed host-user identity from tenant backends.
