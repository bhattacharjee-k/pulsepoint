# Technical Requirements — PulsePoint

> **Composer-owned** requirements baseline from PM sparring.  
> Claude **thinks through and refines** these in Stage 2a (architecture), then **implements normative detail** in Stage 2b (`workspace_plan.md` → Technical Specifications).  
> Challenge rubric: [`pulsepoint-challenge.md`](./pulsepoint-challenge.md). Roles: [`AGENTS.md`](./AGENTS.md).

**Status:** Baseline requirements — architecture locked in Stage 2a/2b. **Implementation spec:** [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) + `workspace_plan.md` § Technical Specifications.

---

## 1. Purpose

Build a **multi-tenant feedback platform** slice:

- Tenants embed a **widget** on their websites (mock: Alpha.com, Delta.com).
- **Anonymous / stub-identified** visitors submit feedback via a **public ingest API**.
- **Tenant staff** triage feedback in a **PulsePoint dashboard** (authenticated).
- **Tenant isolation** must be enforced at the database layer via **Postgres RLS**.

Project owner is **learning software engineering**; requirements favor clarity and defensible design over feature maximalism.

---

## 2. Audiences

| Audience | Description | PulsePoint auth |
|----------|-------------|-----------------|
| **End-user** | Visitor on tenant’s website | None (optional stub `submitter` from host) |
| **Tenant staff** | `admin@alpha.com`, `admin@delta.com`, future members | Email + password → session |
| **Public internet** | Can see `pk_…` in page source | Ingest only, rate-limited |

---

## 3. Demo tenants (required)

| Tenant slug | Org name | Dashboard login | Mock page | Public key (seed) | Stub host user |
|-------------|----------|-----------------|-----------|-------------------|----------------|
| `alpha` | Alpha Corp | `admin@alpha.com` | `demo-alpha.html` | `pk_alpha_demo` | Alice, `externalId`: `alpha-1` |
| `delta` | Delta Inc | `admin@delta.com` | `demo-delta.html` | `pk_delta_demo` | Bob, `externalId`: `delta-1` |

**Seed script must** create both tenants, both admins, and sample feedback so a reviewer sees multi-tenancy in ~30 seconds without manual setup.

---

## 4. Pillar 1 — Multi-tenancy

### 4.1 Must have

- [ ] **Tenant lifecycle:** sign-up path (can be minimal) creating isolated workspace + public key.
- [ ] **Isolation strategy:** shared Postgres, `tenant_id` on all tenant-owned rows, **RLS as primary guarantee** (document why in README).
- [ ] **DB roles:** `pulsepoint_migrate`, `pulsepoint_app`, `pulsepoint_ingest` — app must not use superuser in runtime.
- [ ] **Per-tenant widget config:** accent color, prompt text, enabled feedback types (`jsonb` or equivalent).
- [ ] **Roles:** `admin` and `member` minimum — admin invites/settings; member triages only (member can be stubbed if labeled).
- [ ] **Cross-tenant guarantee:** Tenant A cannot read/write Tenant B data via crafted request; document **where** (RLS policies + session `SET LOCAL`).

### 4.2 Must not

- Trust `tenant_id` from client body on admin routes.
- Connect production app as migration/superuser role.

### 4.3 Open for Claude (Stage 2a)

- [ ] Sign-up UX vs seed-only for v1.
- [ ] Member role enforcement: app-only vs additional RLS.

---

## 5. Pillar 2 — APIs

### 5.1 Public ingestion API

| Requirement | Detail |
|-------------|--------|
| **Auth** | `X-Tenant-Key: pk_…` (or documented equivalent); key maps to `tenant_id` server-side |
| **Endpoint** | `POST /api/v1/public/feedback` (versioned prefix) |
| **Payload** | See §8 |
| **Response** | `201` or `202` + feedback `id`; consistent error JSON |
| **Rate limiting** | Per public key + per IP (minimum viable numbers in spec) |
| **CORS** | Callable from arbitrary origins; document policy |
| **Abuse** | Payload size caps, type enum validation, sanitization |
| **DB** | Use `pulsepoint_ingest`; `SET LOCAL app.ingest_tenant_id`; insert-only policies |

**Public key is not secret.** Rotation = incident response for abuse, not sole DDoS defense (document layers).

### 5.2 Admin API

| Requirement | Detail |
|-------------|--------|
| **Auth** | Session cookie or JWT — **justify choice** in architecture |
| **Session binding** | Derive `tenant_id` from session + membership, never from query param alone |
| **DB** | `pulsepoint_app`; `SET LOCAL app.current_tenant_id` each request |
| **Feedback CRUD** | List, filter (status/type/date), search, get detail, update status, assign |
| **Notes** | Internal notes on feedback (admin/member), tenant-scoped |
| **Team / settings** | Admin-only tenant settings + widget config update |
| **Conventions** | Pagination, consistent errors, API versioning stance |
| **Contract** | OpenAPI (or equivalent) for admin API — deliverable |

### 5.3 Open for Claude (Stage 2a)

- [ ] Stack (Next.js monolith vs FastAPI + separate static, etc.).
- [ ] Idempotency keys on ingest (stretch vs v1).

---

## 6. Pillar 3 — Systems & architecture

### 6.1 Must have (documentation + reasonable code)

- [ ] **Architecture diagram** (Mermaid or image).
- [ ] **Data model** — tables, keys, indexes, `tenant_id` threading.
- [ ] **Migrations** — versioned schema + RLS policy migrations.
- [ ] **Run locally** — single documented command (`docker compose up` or `make dev`).
- [ ] **Bursty ingest** — describe queue/backpressure (implementation or labeled stub).
- [ ] **Noisy neighbor** — per-tenant rate limits + “with more time” monitoring story.

### 6.2 Interview depth (README or architecture doc)

Answer in prose for follow-up questions:

- End-to-end submit flow.
- Cross-tenant leak triage.
- 80% traffic on one tenant (week vs quarter).
- EU residency tenant (what changes).
- Adding `tags` without downtime (migration story).
- First failure mode at 100× scale.

---

## 7. Pillar 4 — UI / UX

### 7.1 Dashboard

- [ ] Feedback **inbox** — list with filter/search, sensible density.
- [ ] **Detail view** — message, submitter, context, status, notes.
- [ ] **Status workflow** — e.g. `open`, `in_progress`, `resolved`, `closed`.
- [ ] **States** — empty, loading, error (required).
- [ ] **Keyboard** — basic navigation (e.g. j/k or documented shortcut set).
- [ ] **Onboarding** — signup → snippet + public key → mock page → first feedback in inbox (can stub email).

### 7.2 Embeddable widget

- [ ] Lightweight bundle; load via script tag on mock pages.
- [ ] **Style isolation** from host (shadow DOM or iframe — **decide in 2a**).
- [ ] Reflect **per-tenant config** (colors, copy, enabled types).
- [ ] Capture `context.pageUrl`, `userAgent`; pass stub `submitter` on demos.

### 7.3 Mock host sites

- [ ] `demo-alpha.html`, `demo-delta.html` — each loads correct `pk_…` and stub user.
- [ ] Labeled as stand-ins for Alpha.com / Delta.com.

---

## 8. Ingest payload (requirements)

**Headers:** `Content-Type: application/json`, `X-Tenant-Key`.

**Body fields:**

| Field | Required | Rules |
|-------|----------|--------|
| `type` | Yes | `bug` \| `feature` \| `rating` \| `other` |
| `message` | Conditional | Required except rating-only; max length TBD in spec |
| `rating` | Conditional | 1–5 when `type === rating` |
| `contactEmail` | No | Valid email if present |
| `submitter.externalId` | Recommended on demos | Opaque host user id |
| `submitter.email` | No | |
| `submitter.displayName` | No | |
| `context.pageUrl` | Recommended | |
| `context.userAgent` | Recommended | |
| `context.referrer` | No | |

**Server:** reject unknown `tenant_id` in body; set `tenant_id` only from public key lookup. Default `status = open`.

**Storage:** map to `feedback` table per architect spec in Stage 2b.

---

## 9. Data model (requirements-level)

### 9.1 Required entities

- `tenants` — `id`, `name`, `slug`, `public_key`, `widget_config`, timestamps
- `users` — dashboard users, `email`, `password_hash`
- `memberships` — `user_id`, `tenant_id`, `role`
- `feedback` — tenant-scoped submission fields (§8) + `status`, assignee optional
- `feedback_notes` — tenant-scoped internal notes

### 9.2 Required indexes (minimum)

- `feedback (tenant_id, created_at DESC)`
- `feedback (tenant_id, status)`
- Unique `tenants.public_key`, unique `users.email`

### 9.3 RLS (requirements)

- [ ] RLS enabled on all tenant-owned tables.
- [ ] Consider `FORCE ROW LEVEL SECURITY` on critical tables.
- [ ] `pulsepoint_app`: policies use `app.current_tenant_id`.
- [ ] `pulsepoint_ingest`: insert-only with `app.ingest_tenant_id`.
- [ ] Fail closed if session variables unset.

---

## 10. Security requirements

| Area | Requirement |
|------|-------------|
| **Passwords** | Bcrypt/argon2; never log plaintext |
| **Sessions** | HttpOnly cookie if cookie-based; CSRF stance documented |
| **Public vs admin** | Separate threat models documented |
| **IDOR** | Admin cannot access feedback by UUID across tenants |
| **Ingest** | No read of other tenants’ data from public role |
| **Host submitter** | Demos may send forged `submitter`; README notes signed identity for production |
| **Key rotation** | Document admin-triggered regenerate `public_key` (implement or stub) |

### Stage 4 QA (Claude) must exercise

- [ ] Alpha admin sees only Alpha feedback.
- [ ] Delta admin sees only Delta feedback.
- [ ] Cross-tenant ID/access attempt fails.
- [ ] Invalid/revoked public key rejected.
- [ ] Rate limit triggers (smoke test).
- [ ] Widget submit → correct tenant in DB/dashboard.

---

## 11. Deliverables checklist

| # | Deliverable | Owner phase |
|---|-------------|-------------|
| 1 | Runnable app + Postgres | Codex (M3) |
| 2 | README — run, isolation, auth, built/stubbed/skipped, with more time | Codex + Claude review |
| 3 | Architecture diagram + data model | Claude 2a/2b |
| 4 | Admin API contract (OpenAPI) | Claude 2b |
| 5 | Seed ≥2 tenants + feedback | Codex |
| 6 | `TECHNICAL_REQUIREMENTS.md` satisfied or gaps listed | Claude QA |

---

## 12. Explicit stubs (allowed if labeled)

- Host-site OAuth (use stub Alice/Bob).
- Email sending (invites, notifications).
- Queue workers (describe; optional in-memory/no-op).
- Webhooks, SSE, audit log, metering, EU region — stretch / README.
- `sk_` admin API keys — document future; session auth for v1.

---

## 13. Out of scope for requirements debate

- Git commits by Codex or Claude.
- Premature application directory tree (see §14).

---

## 14. Repository layout (deferred)

**Application tree:** `pulsepoint/` per [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) §2 — Codex implements (Stage 3).

**Allowed now (docs only):**

```text
pulsepoint-challenge.md      # interview brief
AGENTS.md                    # team roles
workspace_plan.md            # milestones + specs + handoffs
TECHNICAL_REQUIREMENTS.md    # this file
.claude/                     # existing
```

**Created in Stage 2b/3 (examples — architect finalizes):**

```text
docker-compose.yml
migrations/
apps/ or src/
public/embed.js
demo-alpha.html
demo-delta.html
openapi.yaml
README.md
```

---

## 15. Traceability to challenge

| Challenge pillar | This document |
|------------------|---------------|
| Multi-tenancy | §4, §9, §10 |
| APIs | §5, §8 |
| Systems | §6, §9, §14 |
| UI/UX | §7 |

---

## 16. Claude Stage 2a instructions

When user says **begin Stage 2a**, use this file as the **requirements checklist**:

1. Walk pillar by pillar — confirm, question, or propose changes.
2. Resolve open items in §4.3, §5.3, §7.2.
3. Produce **Architecture for your review** mapped to each § requirement.
4. Flag gaps as `[GAP]` or `[NEEDS USER CONFIRMATION]`.

Do **not** duplicate this file into code until Stage 2b locks specs in `workspace_plan.md`.
