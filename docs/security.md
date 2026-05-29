# Security

## Headline guarantee

**One tenant cannot read or modify another tenant's feedback** — enforced by Postgres RLS with forced policies, verified by `isolation.test.ts` and manual adversarial checks (cross-tenant GET/PATCH → 404).

## Layers

| Layer | Mechanism |
|-------|-----------|
| Database | RLS `USING` + `WITH CHECK`; separate ingest role without read on `feedback` |
| API (admin) | Session → `withTenant(tenantId)`; no `tenant_id` from client for authorization |
| API (public) | Key → tenant lookup; insert only; forged body `tenant_id` ignored |
| App roles | Member cannot access `/settings` or `/team` (403) |
| Transport | Admin CORS pinned to dashboard; public routes credentialed off |
| XSS | Dashboard uses React text binding (no `dangerouslySetInnerHTML`) |

## CORS split

`apps/api/src/plugins/cors.ts` applies different options per URL prefix:

- `/api/v1/public/*` → `origin: true`, `credentials: false` (widget on any host site)
- All other `/api/v1/*` → `origin: ADMIN_CORS_ORIGIN`, `credentials: true`

This matches the design: public ingest is intentionally cross-origin; admin API must not be readable from arbitrary origins with cookies.

## Session cookie

- `HttpOnly`, `SameSite=Lax` (demo uses in-memory store; production → Redis/Postgres).
- Wrong password → 401 generic message.

## Public ingest abuse

- Bad key → 401
- Oversized payload → 400
- Rate limit → 429 (in-memory demo store)
- CAPTCHA: **stub** — `verifyCaptcha()` returns true; seam documented for Turnstile later

## What we do not claim

- Production DDoS defense (rate limits are demo-grade)
- Public key secrecy as sole abuse control (rotation + monitoring documented)
- Forgeable demo `submitter` attributes on mock host pages

## Test contract

```sh
cd pulsepoint && npm test
```

16 tests across `isolation`, `ingest`, `auth`, `adminFeedback` — do not skip or weaken assertions when changing code.
