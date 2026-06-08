# PulsePoint

Multi-tenant feedback platform practice build: tenants embed a widget on their site, submissions flow through a public ingest API, and staff triage feedback in a React dashboard. Tenant isolation is enforced in **PostgreSQL RLS**, not by trusting request parameters.

## Quick start

```sh
cd pulsepoint
npm install
docker compose up
```

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Dashboard | http://localhost:5173 |
| Demo sites | `pulsepoint/public/demo-alpha.html`, `demo-delta.html` |

**Demo logins** (password `password123`): `admin@alpha.com`, `member@alpha.com`, `admin@delta.com`

```sh
cd pulsepoint && npm test   # 16 tests — isolation, ingest, auth, admin
```

Operator details: [`pulsepoint/README.md`](./pulsepoint/README.md)

## Architecture (one screen)

```text
Tenant site (demo HTML)
    └── embed.js (Shadow DOM widget)
            └── POST /api/v1/public/feedback  (X-Tenant-Key, no cookies)

Dashboard (React)
    └── session cookie → /api/v1/*  (RLS via SET LOCAL app.current_tenant_id)

Postgres 16
    └── RLS FORCE on tenant tables; roles: migrate | app | ingest
```

## Security highlights

- **RLS** on `feedback`, `feedback_notes`, `memberships`, etc. — fail closed without tenant context
- **Split CORS**: public routes open, credentialed admin routes locked to dashboard origin
- **16 Vitest tests** including adversarial isolation cases
- **bcrypt** passwords, HttpOnly `SameSite=Lax` session cookie

More: [`docs/security.md`](./docs/security.md) · [`docs/architecture.md`](./docs/architecture.md)

## PulsePoint at Scale — multi-tenancy & scalability (round two)

Round two narrows to the two hardest pillars — **multi-tenancy and scalability** — at ~50k events/sec average, 250k/sec peak, under a power law where one tenant ("the whale") emits ~30% of all load. Three deliverables, all under `docs/scale/` and `spike/`:

| Deliverable | Where | What it is |
|---|---|---|
| **Design doc (RFC)** | [`docs/scale/DESIGN.md`](./docs/scale/DESIGN.md) | Review-ready Markdown: all 8 pillars, capacity math, alternatives, failure modes, rollout, "what breaks next" |
| **Interactive design doc** | [`docs/scale/pulsepoint-at-scale.html`](./docs/scale/pulsepoint-at-scale.html) | Mobile-friendly, animated walkthrough of the same design with 5 interactive demos |
| **The spike** | [`spike/idempotent-ingestion/`](./spike/idempotent-ingestion/) | Zero-dependency idempotent-ingestion proof — `node bench.mjs` shows counts stay exact under a retry storm, with graphs |

**One-command benchmark:** `cd spike/idempotent-ingestion && node bench.mjs` → writes `report.html` (graphs) and `results.json`. Headline: 10k events sent 3× → idempotent bills exactly 10,000 (20k retries absorbed); naïve bills 30,000 (3× wrong invoice).

## Repository layout

```text
pulsepoint/          Application monorepo (API, web, widget, migrations, seed)
docs/
  challenge.md       Original interview brief
  architecture.md    Systems overview
  security.md        Threat model and guarantees
  archive/           Agent pipeline notes (build diary — optional reading)
  teaching/          HTML walkthroughs from architecture review
  scale/             Round-two scale design (RFC + interactive artifact)
spike/
  idempotent-ingestion/   Round-two spike: idempotent ingestion + benchmark
```

## Built vs stubbed

See [`pulsepoint/README.md`](./pulsepoint/README.md#built-vs-stubbed). Highlights: real RLS + two APIs + dashboard UI; stubs for CAPTCHA verify, in-memory sessions/rate limits, seed-only signup.

## License

Practice / portfolio project. Font: Noto Sans (OFL). See package licenses under `pulsepoint/`.
