# PulsePoint (application)

PulsePoint is a multi-tenant feedback demo: mock tenant sites load a Shadow DOM widget, submissions go through a public ingest API, and staff triage feedback in a React dashboard.

## Run

```sh
npm install
docker compose up
```

The API runs on `http://localhost:3000`, the dashboard on `http://localhost:5173`, and demo pages are in `public/demo-alpha.html` and `public/demo-delta.html`.

Seeded logins all use `password123`:

- `admin@alpha.com`
- `member@alpha.com` (Casey)
- `admin@delta.com`

## 30-second demo

1. Open `public/demo-alpha.html`, use the blue widget, submit a bug.
2. Open `public/demo-delta.html`, use the amber widget, submit a feature.
3. Log in as `admin@alpha.com`; only Alpha feedback appears.
4. Log in as `admin@delta.com`; only Delta feedback appears.
5. Log in as Casey (`member@alpha.com`); triage works and Settings is hidden.

## Isolation

Tenant isolation is enforced by Postgres RLS, not by trusting request parameters. The policies live in `migrations/002_rls.sql`; the API sets tenant context with `SET LOCAL` in `apps/api/src/db/withTenant.ts`.

Runtime roles are split:

- `pulsepoint_app`: dashboard role, tenant-scoped via `app.current_tenant_id`.
- `pulsepoint_ingest`: public role, can read tenant config and insert feedback only.
- `pulsepoint_migrate`: owns and migrates schema.

The key test is `apps/api/test/isolation.test.ts`: it checks tenant-scoped reads, failed cross-tenant inserts, fail-closed reads without context, denied ingest reads, and cross-tenant `404`.

## Auth

Dashboard auth uses bcrypt password hashes and an HttpOnly, SameSite=Lax session cookie. The demo uses an in-memory session store because this is a single-process local build. In production, sessions and rate limits should move to Redis or Postgres.

## API

The OpenAPI contract is in `openapi.yaml`. Public routes are under `/api/v1/public/*`; admin routes use `/api/v1/*` with a session cookie.

## Built vs stubbed

Built:

- Fastify API with raw SQL on tenant paths.
- Postgres 16 schema, migrations, roles, RLS policies, and seed data.
- Public widget config and feedback ingest.
- Dashboard feedback list, filters, stats, status updates, settings gate, empty/loading/error states, and keyboard `j`/`k`/`Esc`.
- Vanilla Shadow DOM widget and Alpha/Delta demo pages.

Stubbed or skipped:

- CAPTCHA verification is a stub: `verifyCaptcha()` returns `true`.
- Session and rate-limit stores are in memory.
- Signup is seed-only; no live tenant signup.
- No email invites or notifications.
- Queue/workers are described but not built; v1 inserts synchronously.
- Host user identity is forgeable demo data from script attributes.

## With more time

Add Redis-backed rate limits and sessions, Cloudflare Turnstile, a durable ingest queue, per-tenant quotas, cursor pagination, audit logs, read replicas for analytics, key rotation UI, and signed host-user identity from the tenant backend.

## Docs

- [Repository README](../README.md) — portfolio overview
- [Architecture](../docs/architecture.md) · [Security](../docs/security.md)
- [Brand / UI](./docs/brand-ui.md) (dashboard design tokens)
