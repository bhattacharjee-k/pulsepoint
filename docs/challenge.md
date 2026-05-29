# Technical Challenge: Build "PulsePoint" — A Multi-Tenant Feedback Platform

> A single cohesive build that probes four competencies at once: **systems design**, **API design**, **multi-tenant architecture**, and **UI/UX**. Read the *For the Interviewer* section at the bottom before you hand this out — it tells you how to scope and grade it.

---

## The scenario

You're the first engineering hire at **PulsePoint**, a SaaS startup. The product is dead simple to describe and surprisingly deep to build:

> Companies sign up, drop a small JavaScript snippet onto their own website, and start collecting feedback from *their* end-users (bug reports, feature requests, ratings). They triage and respond to that feedback from a PulsePoint dashboard.

So there are two distinct audiences:

1. **Tenants** — the companies who pay for PulsePoint and log into the dashboard.
2. **End-users** — the (anonymous or semi-anonymous) people who submit feedback *through* a tenant's embedded widget. They never see PulsePoint directly.

Your job is to design and build a meaningful slice of this product and justify the decisions behind it.

---

## What we're actually testing

This is not a "can you center a div" exercise. We want to see whether you can hold a whole product in your head — from the embed snippet on a stranger's website all the way down to the row-level data isolation in the database — and make sane tradeoffs across all of it.

The four pillars:

1. **Multi-tenancy** — keeping tenants isolated, configurable, and cheap to run.
2. **API design** — a public ingestion surface and a private admin surface, with different threat models.
3. **Systems thinking** — data modeling, the architecture, and what breaks at scale.
4. **UI/UX** — a dashboard people enjoy using and an embeddable widget that doesn't wreck the host page.

---

## Core requirements

You will not finish all of this in the time given, and **that's the point**. Prioritize, go deep where you're strong, and leave clear notes on what you'd do with more time. We'd rather see two pillars done thoughtfully than four done shallowly.

### Pillar 1 — Multi-tenancy

- **Tenant lifecycle:** a company can sign up and get an isolated workspace.
- **Isolation strategy:** pick one — shared database with a `tenant_id` discriminator, schema-per-tenant, or database-per-tenant — and **justify it**. We care far more about *why* than *which*.
- **Per-tenant configuration:** each tenant can customize their widget (accent color, prompt text, which feedback types are enabled).
- **Roles within a tenant:** at minimum `admin` and `member`. An admin can invite teammates and change settings; a member can only triage feedback. Show how a user belongs to a tenant and how permissions are enforced.
- **The hard part:** make it *impossible* for Tenant A to ever read or write Tenant B's data, even with a crafted request. Show us where that guarantee lives in your code.

### Pillar 2 — APIs

You're building two APIs with deliberately different shapes:

**A. Public ingestion API** (the widget calls this)
- Unauthenticated by a user, but scoped by a **public tenant key** embedded in the snippet.
- Accepts a feedback submission (type, message, optional rating, optional contact email, plus context like page URL / user agent).
- Must be **rate-limited** and abuse-resistant — anyone can read the public key from page source.
- CORS: it'll be called from arbitrary origins. How do you handle that safely?

**B. Admin API** (the dashboard calls this)
- Authenticated (sessions, JWT, or API keys — your call, justify it).
- CRUD over feedback items: list, filter (by status/type/date), search, update status, add internal notes, assign.
- Team management and tenant settings.
- Production-grade conventions: consistent error format, pagination, and a clear stance on versioning.

For at least the admin API, provide a contract — an OpenAPI spec, a typed schema, or clear endpoint docs in the README.

### Pillar 3 — Systems & architecture

- An **architecture diagram** (a photo of a whiteboard sketch is totally fine).
- The **data model** — tables/collections, keys, indexes, and how `tenant_id` threads through everything.
- **Bursty traffic:** the widget could fire thousands of submissions in a spike (e.g. a tenant's site goes viral, or a bot finds the endpoint). How do you keep ingestion from taking down the dashboard? Talk us through queues, write paths, backpressure — whatever applies.
- **Noisy neighbor:** one tenant generating 90% of load shouldn't degrade everyone else. How would you detect and contain that?

### Pillar 4 — UI / UX

- **Dashboard:** a feedback inbox someone could use for an hour without getting annoyed. List view with filtering/search, a detail view, and the ability to change status and leave a note. We're looking for thoughtful empty / loading / error states, sensible information density, and keyboard-friendliness — not visual flash.
- **The embeddable widget:** the actual thing end-users interact with. It must be lightweight, not leak styles into (or inherit junk from) the host page, and reflect the tenant's per-tenant config.
- **Onboarding:** show the path from "I just signed up" to "feedback is appearing in my dashboard." Even a stubbed/storyboarded version is valuable — this is where multi-tenancy, the public key, and the widget all meet.

---

## Deliverables

1. **Code** — running locally with a single documented command (`docker compose up`, `make dev`, etc.). Partial is expected.
2. **README** covering: how to run it, the isolation strategy and why, the auth approach, what you built vs. stubbed vs. skipped, and known shortcuts.
3. **Architecture artifact** — the diagram + data model.
4. **API contract** — OpenAPI / schema / endpoint docs.
5. **A "with more time" section** — the single most honest signal of seniority in the whole submission.

---

## Scope & ground rules

- **Time:** budget roughly **6–8 hours**. Stop at 8 even if unfinished — we grade on judgment, not free labor.
- **Stack:** entirely your choice. Use what you're fastest in. Don't learn a new framework for this.
- **AI tools:** allowed and assumed. Be ready to explain and defend every line in a follow-up.
- **Faking is fine:** stub the email sender, hardcode one tenant, mock the queue — as long as you *say so* and explain how the real version would differ.
- **Seeded data:** ship a seed script with ≥2 tenants and some feedback so a reviewer sees the multi-tenant behavior in 30 seconds without manual setup.

---

## Stretch goals (only if the core is solid)

- Real-time dashboard updates (websockets / SSE) when new feedback lands.
- Webhooks so a tenant can pipe feedback into Slack.
- A per-tenant widget theming editor with live preview.
- Audit log of admin actions, scoped per tenant.
- Usage metering / plan tiers (Free caps submissions per month).
- EU data residency for a specific tenant.

---

## Live follow-up questions

Use these in a 30–45 min review call. They reveal depth fast and let strong candidates who ran out of build time still shine.

1. Walk me through exactly what happens, end to end, when an end-user clicks "submit" in the widget.
2. A tenant emails: *"I can see another company's feedback in my dashboard."* How do you triage, and how would your design have prevented it?
3. A single tenant is now 80% of total traffic. What do you change — this week vs. this quarter?
4. An enterprise prospect demands their data physically stay in the EU. What in your architecture has to change?
5. You need to add "tags" to feedback. Walk through the migration across all tenants without downtime.
6. Where would your current design fall over first as you grow 100×, and what's the fix?

---

## For the interviewer

**What this challenge is good for:** mid-to-senior full-stack / product engineers and platform engineers. The breadth means almost no one nails all four pillars — that's a feature. You're grading *prioritization and reasoning* as much as output.

**Adapting by level:**
- *Mid-level:* drop Pillar 3's bursty-traffic and noisy-neighbor parts to discussion-only; focus the build on multi-tenancy + a clean admin API + a usable dashboard.
- *Senior/Staff:* lean on the architecture write-up and the live questions; the running code matters less than the depth of the tradeoff reasoning.
- *Frontend-leaning:* weight the widget (style isolation, bundle size, host-page safety) and dashboard UX heavily; accept a mocked backend.
- *Backend/platform-leaning:* weight isolation guarantees, the two-API split, and ingestion scaling; accept a barebones UI.

**Format options:** works as a take-home (8 hrs), a paired half-day on-site, or — stripped to the diagram + data model + the six follow-up questions — a 60-minute system design interview with zero code.

### Scoring rubric

Score each pillar 1–4. A strong hire typically lands 3+ on two pillars and is at least credible (2+) on the rest. A great "with more time" section can lift a thin submission.

| Pillar | 1 — Weak | 2 — Okay | 3 — Strong | 4 — Exceptional |
|---|---|---|---|---|
| **Multi-tenancy** | tenant_id sprinkled around, isolation easily broken | works for the happy path; isolation enforced in app code | clear strategy, justified, enforced in one defensible layer (middleware/RLS/policy) | isolation impossible to bypass by construction; thought through migrations, config, and roles |
| **APIs** | one undifferentiated API; no auth story | two surfaces exist; basic auth; some inconsistency | distinct threat models, rate limiting, clean errors + pagination, real contract | versioning stance, abuse resistance, idempotency, contract you'd ship to real customers |
| **Systems** | no diagram or model; no scaling thought | reasonable model; scaling is hand-wavy | solid model + indexes; concrete answer to bursty traffic | identifies the real bottleneck, separates write/read paths, names the failure modes |
| **UI/UX** | renders, but rough or broken states | usable dashboard; basic widget | thoughtful empty/loading/error states, real widget isolation, coherent onboarding | a tool you'd actually want to use daily; widget is genuinely production-safe |

**Cross-cutting signals to weight heavily:**
- Did they *prioritize on purpose* and say so, or just run out of time silently?
- Is the "with more time" section specific and honest, or generic?
- Can they defend a decision *and* name its downside? (The single best senior signal.)

**Red flags:** claims of full coverage that don't survive five minutes of probing; an isolation model that breaks with one altered request; copy-pasted architecture with no answer to "why."
