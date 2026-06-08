# Design Doc: PulsePoint at Scale — Multi-Tenancy & Scalability

| | |
|---|---|
| **Status** | Draft — for review |
| **Author** | kunalbh99@gmail.com |
| **Reviewers** | _Platform, Billing, SRE_ |
| **Last updated** | 2026-06-08 |
| **Supersedes** | Round-one single-DB design (`docs/architecture.md`) |
| **Related** | Interactive companion: `docs/scale/pulsepoint-at-scale.html` |

---

## 1. Summary (TL;DR)

PulsePoint has expanded from human-paced **feedback** capture into machine-paced **product-analytics** ingestion. Load is now ~50k events/sec average, ~250k/sec peak, distributed under a brutal power law — one tenant ("the whale") emits ~15k/sec by itself. The round-one architecture (one shared Postgres, a `tenant_id` column, RLS, dashboard reading the write store) cannot meet the new requirements and is failing in production: noisy-neighbor latency, a retry-driven double-count that produced a wrong invoice, dashboard queries blowing the 300ms SLA, and schema changes requiring maintenance windows.

This document proposes:

1. **Lookup-based placement** (a tenant directory) over hash sharding, so a hot tenant can be isolated onto dedicated infrastructure.
2. **A pooled → cell → dedicated isolation spectrum**, with tiers mapped directly to pricing.
3. **Per-tenant, tier-aware rate limiting + bulkheads** to kill noisy-neighbor effects.
4. **Zero-downtime, exactly-once live migration** for promoting a hot tenant.
5. **Idempotent, effectively-once ingestion** so billing counts are exact under retries.
6. **Pre-aggregated rollups** with a raw/warm/cold storage split to meet the read SLA and escape the 130 TB storage trap.
7. **Expand→migrate→contract** schema evolution with no maintenance window.
8. **Per-tenant observability and cost attribution** to detect hot tenants and reason about profitability.

---

## 2. Context & problem statement

### 2.1 Round-one architecture (current)

A single Postgres instance holds all tenants. Isolation is enforced with **Postgres Row-Level Security**: each transaction sets `app.current_tenant_id` (see `apps/api/src/db/withTenant.ts`) and RLS policies scope every query to that tenant. Two connection pools exist (`appPool`, `ingestPool`) but point at the same database. Ingestion (`apps/api/src/routes/public/feedback.ts`) inserts one row per request with a **server-generated** UUID. The dashboard (`apps/api/src/routes/stats.ts`) computes aggregates with `GROUP BY` over the raw table on every request. Rate limiting is an in-process `Map` (`apps/api/src/plugins/rateLimit.ts`).

This is a correct, well-built design for low-volume feedback. It does not survive the new load profile.

### 2.2 Operating environment

| Dimension | Value |
|---|---|
| Tenants | 40,000 active |
| Avg ingestion | ~50,000 events/sec |
| Peak ingestion | ~250,000 events/sec |
| Distribution | top 0.5% (~200 tenants) generate ~80% of events |
| The whale | one tenant ~15,000 events/sec (~30% of avg load) |
| Event size | ~1 KB |
| Retention | raw 30 days; rolled-up aggregates indefinite |
| Read SLA | "usage this month" < 300 ms p95, per tenant |
| Tiers | Free, Pro, Enterprise (isolation + SLA contracts) |

### 2.3 Observed production symptoms → root cause

| Symptom | Root cause (file) |
|---|---|
| Whale spikes cause dashboard latency for unrelated tenants | Reads & writes share one database (`db/pools.ts`); RLS isolates data, not physical resources |
| Retry storm double-counted usage → wrong invoice | Server generates `randomUUID()` per request (`feedback.ts:31`); no client idempotency key |
| "Usage this month" blows 300ms SLA | `GROUP BY` over raw rows on every request (`stats.ts:11`); no rollups |
| Schema change required a maintenance window | Single shared table; `ALTER` locks the table all 40k tenants depend on |

---

## 3. Goals / Non-goals

### Goals
- Sustain 250k events/sec peak ingestion without data loss.
- Meet "usage this month" < 300ms p95 per tenant.
- **Exactly-once billing semantics** under retries, reordering, and partial failures.
- Contain any single tenant's blast radius (noisy-neighbor elimination).
- Promote a hot tenant to dedicated infra with **zero downtime and zero lost/double-counted events**.
- Evolve the schema with no maintenance window.
- Attribute cost and latency to a specific tenant.

### Non-goals
- Re-designing the dashboard UI or feedback CRUD (unchanged).
- Sub-second freshness on rollups (a few seconds of lag is acceptable).
- Multi-cloud portability (single cloud assumed).
- Solving the >10× "super-whale" case now (tracked in §13, "What breaks next").

---

## 4. Requirements & SLAs

| Requirement | Target |
|---|---|
| Ingestion availability | 99.95% |
| Ingestion durability | no acknowledged event lost |
| Billing correctness | counts exact (no over/under-count) |
| Read latency | "usage this month" < 300ms p95 |
| Enterprise isolation | dedicated DB; defined blast radius = self |
| Schema change | no maintenance window |
| Hot-tenant migration | zero downtime, exactly-once |

---

## 5. Capacity model (the arithmetic)

Assumptions: 1 KB/event, 86,400 s/day, ~25k events/sec safely sustained per ingest node.

| Quantity | Arithmetic | Result |
|---|---|---|
| Avg write bandwidth | 50k/s × 1 KB | 50 MB/s |
| Peak write bandwidth | 250k/s × 1 KB | **250 MB/s sustained** |
| Raw storage, 30 days | 50 MB/s × 86,400 × 30 | **~130 TB** |
| The whale, 30 days | 15k/s × 1 KB × 86,400 × 30 | **~39 TB (one tenant)** |
| Ingest nodes at peak | 250 MB/s ÷ ~25k events/node | **~10 nodes + headroom** |

**Implications that drive the design:**

- **130 TB of raw events cannot live in a fast database forever** and cannot be scanned in 300ms → forces (a) 30-day raw retention then deletion, and (b) pre-aggregated rollups (§11).
- **The whale's 39 TB is proof it cannot share a pooled shard** → forces dedicated placement (§7) and live migration (§9).
- **250 MB/s sustained exceeds a single Postgres writer** → forces a durable ingestion queue fronting many ingest workers (§10).

**Cost-to-serve sketch** (order of magnitude, not a bill):

| Tenant | Events/mo | Storage | Cost/mo | Verdict |
|---|---|---|---|---|
| One Free tenant | small | MBs | cents (fixed overhead dominates) | profitable only in bulk |
| The whale | ~39B | ~39 TB raw + rollups | thousands (dedicated DB + ingest + archive) | must be priced Enterprise |

---

## 6. Architecture overview

```
                      ┌─────────────────────────────────────────────┐
   Widget snippet ───►│  Edge / CDN (widget JS + config, per region) │
   (page views,       └───────────────────┬─────────────────────────┘
    clicks, events)                        │  POST /v2/events  (+ Idempotency-Key)
                                           ▼
                          ┌──────────────────────────────┐
                          │  Ingest API (stateless, ~10x) │
                          │  • verify signed tenant key    │
                          │  • per-tenant rate limit       │
                          │  • cache: key → tenant/tier/shard
                          └───────────────┬───────────────┘
                                          │ append (at-least-once)
                                          ▼
                          ┌──────────────────────────────┐
                          │   Durable log / queue (Kafka)  │  partitioned by tenant_id
                          └───────────────┬───────────────┘
                                          │
                ┌─────────────────────────┴───────────────────────────┐
                ▼                                                       ▼
   ┌────────────────────────┐                          ┌───────────────────────────┐
   │  Dedup + write workers  │  idempotency store       │  Rollup workers            │
   │  (effectively-once)     │  (key → seen)            │  (raw → daily/hourly totals)│
   └───────────┬─────────────┘                          └─────────────┬─────────────┘
               ▼                                                       ▼
   ┌────────────────────────────────────────┐          ┌───────────────────────────┐
   │  Tenant directory  (tenant_id → region, │          │  Rollup store (warm)       │◄─ Dashboard
   │  shard, tier)  — cached at every node   │          │  ~30 rows/tenant/month     │   GET /stats
   └───────────┬────────────────────────────┘          └───────────────────────────┘
               ▼
   ┌──────── Pooled shards ───────┐   ┌──── Cell/pod ────┐   ┌──── Dedicated (whale) ────┐
   │  Free/Pro, many per shard,    │   │  bounded group   │   │  one tenant, own DB,       │
   │  RLS isolation                │   │  own stack       │   │  SLA + residency           │
   └──────────────────────────────┘   └──────────────────┘   └────────────────────────────┘

   Raw (hot, 30d) ──aging──► Object storage (cold archive, compressed, cheap)
```

---

## 7. Detailed design

### 7.1 Tenant placement & sharding

**Shard key:** `tenant_id`. All of a tenant's data stays co-located so queries and rollups never cross shards.

**Placement is a lookup, not a formula.** A **tenant directory** maps `tenant_id → (region, shard, tier)`. We deliberately reject `hash(tenant_id) % N`: hashing spreads *tenants* evenly but pins the *whale* to one shard, which melts it. A directory lets us move a tenant by editing one row, which is the precondition for both hot-tenant isolation (§9) and re-sharding (§12).

**Geo is the outer key.** Region is chosen first (latency + data residency); the directory selects a shard within the region. This answers the "EU data residency, same dashboard" requirement: residency is satisfied by region placement, while the dashboard code and rollup format stay identical everywhere.

**Skew is handled by placement.** When a tenant exceeds a pooled shard's capacity, the directory repoints it to a dedicated node (§9). We do not assume uniform load.

> Trade-off: a directory adds a lookup on the hot path. Mitigated by caching the directory at every ingest node (§11.3) with short TTLs.

### 7.2 Isolation tiers / cells

| Tier | Placement | Blast radius | Cost | Sold as |
|---|---|---|---|---|
| **Pooled** | many tenants/DB, RLS | one shard | lowest | Free, Pro |
| **Cell / pod** | bounded group, own stack | one cell | medium | Pro+, small Enterprise |
| **Dedicated** | one tenant, own DB | self only | highest | Enterprise, the whale |

The application code is identical across tiers; **only placement changes**. Upgrading a tier = migrating data (§9), not rebuilding. Tiers map directly to pricing: the dedicated database *is* the Enterprise product, and the subscription funds it.

### 7.3 Noisy-neighbor & fairness

- **Per-tenant token-bucket rate limiter**, tier-aware, backed by a shared store (Redis) so limits hold across all ingest nodes — replacing the in-process `Map`.
- **Bulkheads:** each tenant gets its own bucket/queue slice so one tenant's flood cannot consume another's capacity.
- **Backpressure:** when downstream is saturated, the queue absorbs bursts rather than dropping silently.

Degradation is **defined per tier**:

| Tier | Over-limit behavior |
|---|---|
| Free | Hard cliff — `429`, excess dropped |
| Pro | Soft throttle — slowed, accepted to a burst ceiling |
| Enterprise | Ramp, never a wall — burst absorbed, overage billed, upsell-to-dedicated triggered (dropping data would breach SLA) |

> CAPTCHA is **not** used on the event firehose: analytics events are machine-fired (no human to solve a challenge, and 50k/sec is infeasible). CAPTCHA remains on the human feedback form. Machine-traffic abuse defense = signed tenant key + rate limits + idempotency.

### 7.4 Hot-tenant live migration (centerpiece)

**Detection:** per-tenant metrics (§7.8) flag a tenant whose sustained rate or storage crosses a threshold.

**Cutover sequence (every step reversible):**

1. **Dual-write** — new events written to *both* old and new shard. Reads unchanged.
2. **Backfill** — copy history to the new shard in the background; dual-write keeps it current.
3. **Verify counts** — compare event counts and rollup totals old vs new; must match exactly. **This is the billing-protection gate.**
4. **Cutover reads** — flip the directory entry; reads now hit the new shard. Continue dual-writing briefly.
5. **Decommission** — stop writing the old shard, reclaim space.

**Rollback:** at any point before step 4, flip the directory back. Because the old shard never stops receiving writes until step 5, rollback is **instant and lossless**. Exactly-once is preserved because (a) dual-write loses no event and (b) verification blocks cutover to an incomplete shard.

### 7.5 Ingestion correctness (idempotency)

- The **client generates a unique `Idempotency-Key` per event** (replacing server-side `randomUUID()`).
- Ingest workers dedupe on the key against an idempotency store before counting → **effectively-once aggregation**; retries and reordering become harmless.
- **Late/out-of-order events** carry a client timestamp and land in the correct time bucket; rollup windows stay open briefly for stragglers, then seal.
- **Reconciliation:** a nightly job recomputes counts from raw and compares against billed totals; drift is caught before invoicing.

This is the same mechanism payment APIs use (e.g. Stripe's `Idempotency-Key`) and directly fixes the round-one double-count.

### 7.6 Read & aggregation path

- **Rollup workers** continuously fold raw events into per-tenant daily/hourly totals.
- "Usage this month" reads **~30 rollup rows** instead of scanning millions → clears the 300ms SLA with headroom (raw scan ≈ seconds; rollup read ≈ tens of ms).
- **Storage split:**

| Layer | Holds | Serves | Lifetime |
|---|---|---|---|
| Hot (raw) | last 30 days of events | drill-down, recompute | 30 days, then deleted |
| Warm (rollups) | daily/hourly totals | the dashboard SLA | indefinite |
| Cold (archive) | raw, compressed in object storage | rare backfills | cheap, long-term |

Rollups stay correct under late arrivals via the open-window + reconciliation approach in §7.5.

### 7.7 Zero-downtime schema evolution

**Expand → migrate → contract:** (1) add the new field as optional + deploy code writing old and new; (2) backfill existing rows in small batches; (3) drop the old field once unused. The table is never locked and the app never goes down.

| Isolation model | Adding a field | Trade-off |
|---|---|---|
| Shared table | one nullable `ADD COLUMN` (instant in modern Postgres) + batched backfill | one change for all; one mistake hits all |
| Schema-per-tenant | roll tenant-by-tenant | isolated blast radius; 40k migrations to orchestrate |
| DB-per-tenant | deploy per database, region by region | total isolation; slowest rollout |

### 7.8 Per-tenant observability & cost attribution

- **Every log, metric, and trace is tagged with `tenant_id`** → answers "which tenant is slow/expensive?" instantly and feeds hot-tenant detection (§7.4).
- **Cost-to-serve** attributes writes, storage, and compute back to the causing tenant (§5), so we can tell whether Free tenants are unprofitable and which lever to pull (tighten quotas, shorten Free retention, raise rollup ratio, increase Free density, or push heavy Free tenants to Pro).

---

## 8. Data model changes

- **`events` table** (new, per shard): `tenant_id`, `idempotency_key` (unique per tenant), `event_type`, `client_ts`, `received_ts`, `payload jsonb`. Unique constraint on `(tenant_id, idempotency_key)` enforces dedupe at the DB as a backstop.
- **`rollups` table** (warm store): `tenant_id`, `bucket` (day/hour), `event_type`, `count`, `last_sealed_at`.
- **`tenant_directory`** (control plane): `tenant_id`, `region`, `shard_id`, `tier`, `status` (`stable` | `migrating`).
- Existing `feedback` tables are unchanged.

---

## 9. Alternatives considered

| Decision | Chosen | Rejected alternative | Why |
|---|---|---|---|
| Sharding | directory lookup | `hash(tenant_id) % N` | hash pins the whale to one shard; no migration path |
| Dedupe | client idempotency key | server-side UUID + best-effort dedupe | server UUID cannot detect a retry; breaks billing |
| Reads | precomputed rollups | bigger box / more indexes on raw | cannot scan 130 TB in 300ms; indexes don't bound scan size |
| Hot tenant | dedicated DB + live migration | vertically scale the shared shard | one node can't hold 39 TB / 15k writes/s; doesn't isolate others |
| Rate limit | per-tenant distributed buckets | global limit / in-process `Map` | global limit punishes everyone; `Map` doesn't span nodes |
| Anti-abuse on events | signed key + limits | CAPTCHA per event | events are machine-fired; CAPTCHA is infeasible and meaningless |

---

## 10. Failure modes & mitigations

| Failure | Effect | Mitigation |
|---|---|---|
| Ingest node dies mid-request | possible client retry | idempotency key makes retry a no-op |
| Queue backlog grows | latency on rollups | backpressure + autoscale workers; raw still durable |
| Idempotency store unavailable | risk of double-count | DB unique constraint `(tenant_id, idempotency_key)` as backstop |
| Migration fails mid-flight | partial new shard | rollback via directory flip; old shard never stopped writing |
| Late event after window sealed | rollup undercount | reconciliation job recomputes from raw and corrects before billing |
| Directory unavailable | can't route | cached at every node with short TTL; replicated control plane |
| Region outage | tenants in region down | residency forbids cross-region failover for EU; documented per-tier RTO |

---

## 11. Rollout plan

1. **Phase 0 — directory + dual-read:** introduce the tenant directory; all tenants point at the existing DB. No behavior change.
2. **Phase 1 — ingestion v2:** stand up the queue + idempotent workers behind `/v2/events`; mirror writes; verify counts match v1.
3. **Phase 2 — rollups + read cutover:** build rollups from the stream; cut `GET /stats` over to rollups once parity is verified.
4. **Phase 3 — isolate the whale:** run the §7.4 migration to a dedicated shard. Highest-value, lowest-regret move.
5. **Phase 4 — tiers + autoscaling:** introduce cells, distributed rate limits, follow-the-sun compute scaling.

Each phase is independently shippable and reversible.

### 11.3 Caching (cross-cutting)
The hottest query today is the per-event tenant lookup (`feedback.ts:26`, `SELECT … FROM tenants` on every request → 50k/sec). Cache `key → (tenant_id, tier, shard)` at every ingest node with short TTL; cache rollup results for a few seconds. Invalidation is handled by short expiries so stale entries self-heal (tier upgrades / key rotation propagate within the TTL).

---

## 12. Re-sharding (16 → 64 shards, no downtime)

Because placement is a directory (not a hash), re-sharding is "migrate a subset of tenants" using the §7.4 sequence: dual-write the moving tenants to their new shards, backfill, verify, flip directory entries, decommission. No global rehash, no downtime; the blast radius is only the tenants being moved.

---

## 13. What breaks next (at 10× today's scale)

| Bottleneck | When | Fix type |
|---|---|---|
| Tenant directory becomes hot / SPOF | ~5–10× tenant count | **Incremental** — replicate + cache everywhere |
| Rollup write amplification | ~2.5M events/sec | **Incremental** — pre-aggregate in the stream before the DB |
| Cross-region global dashboard | first global Enterprise w/ residency | **New subsystem** — cross-region rollup federation |
| **Super-whale > one node** | one tenant exceeds a dedicated box | **Partial rewrite** — shard *within* a tenant (by event-type/time); breaks "one tenant = one shard" |

Three of four are incremental. The structural one is the **super-whale**: the day a single tenant exceeds a single node, the core placement assumption breaks. That is the real cliff and the next major design effort.

---

## 14. Open questions

1. Idempotency-key retention window — how long do we remember keys (cost vs. dedupe horizon)?
2. Rollup window seal delay — how long do we hold a bucket open for late events before billing?
3. Free-tier retention — shorten below 30 days to improve unit economics?
4. Per-tier RTO/RPO commitments for region outages (esp. EU residency).

---

## Appendix A — Glossary

- **Shard key** — value deciding which database a tenant lives on (here, `tenant_id`).
- **Idempotency key** — client-supplied unique id per event; lets retries be counted once.
- **Rollup** — precomputed aggregate (daily/hourly totals) serving the read SLA.
- **Bulkhead** — isolation boundary so one tenant's load can't consume another's capacity.
- **Cell/pod** — a bounded group of tenants on an independent stack to limit blast radius.
- **Effectively-once** — each event affects the count exactly once despite at-least-once delivery.
