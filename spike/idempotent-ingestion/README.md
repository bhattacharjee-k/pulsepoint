# Spike: Idempotent Ingestion

> Part B of the *PulsePoint at Scale* challenge. The one experiment that proves the
> design's billing claim: **counts stay exact under a retry storm.**

This is the running proof of §7.5 of [`../../docs/scale/DESIGN.md`](../../docs/scale/DESIGN.md):
the public ingest endpoint is hit by retrying clients, and usage drives billing, so we
**cannot over- or under-count**. The round-one code (`apps/api/src/routes/public/feedback.ts`)
generates the event id **server-side** (`randomUUID()`), so a retried request becomes a
second counted event — which is exactly how a misconfigured snippet produced a wrong invoice.

## Run it (one command, zero dependencies)

```bash
node bench.mjs
```

No `npm install`, no Postgres, no Docker — just Node 18+. It starts the server in-process,
fires the load test, and writes **`report.html`** (graphs) and **`results.json`** (raw data).
Open `report.html` in any browser.

Tune the workload with env vars: `U` (unique events), `R` (retry multiplier), `C` (concurrency),
`LOAD_N` (requests per load level). Example: `U=50000 R=5 C=200 node bench.mjs`.

## What it proves

Two endpoint modes, selected per request via `?mode=`:

| Mode | Behavior | Mirrors |
|---|---|---|
| `naive` | counts **every request** | today's `feedback.ts` (server makes the id) |
| `idempotent` | client sends a unique key; server counts each key **once** and replays the stored response for duplicates | the fix |

### Headline result (defaults: 10,000 events, each sent 3×)

| | billed count | truth | verdict | throughput | p95 |
|---|---|---|---|---|---|
| **idempotent** | **10,000** | 10,000 | ✅ exact (20,000 retries absorbed) | ~9,400 req/s | ~15 ms |
| **naive** | 30,000 | 10,000 | ❌ 3× over → wrong invoice | ~11,900 req/s | ~10 ms |

> Sample numbers from one run on a shared CI box — yours will vary, but the **exactness does not**.

### The two failure-mode behaviors the graphs show

1. **Correctness — graceful vs cliff.** As clients retry harder (1× → 8×), the naive count
   climbs linearly away from truth (a *billing cliff*); the idempotent count sits exactly on
   truth regardless (graceful). Correctness is independent of how many times a client retries.
2. **Performance — graceful saturation.** Pushing concurrency 25 → 800, throughput rises then
   saturates (~12k req/s on one node) and latency grows by *queueing*, not crashing. Past the
   knee, that's the production signal to add ingest nodes (the design's ~10-node fleet).

A nice property visible in the data: duplicate requests are **cheaper** to serve than originals
(a hash-set lookup + replayed response, no write), so a retry storm degrades the idempotent
endpoint *less* than it degrades the naive one's correctness.

## How this maps to production

This spike keeps the "seen keys" set **in-memory** so it runs with one command. The real design
swaps the store, not the mechanism:

- **Hot dedupe:** Redis `SET key NX` with a TTL covering the retry horizon (e.g. 24–48h).
- **Backstop:** a `UNIQUE (tenant_id, idempotency_key)` constraint in the event store, so a
  duplicate that slips past the cache fails the insert instead of double-counting.
- **Late / out-of-order events:** events carry a client timestamp and land in the correct rollup
  bucket; windows stay open briefly for stragglers, then seal.
- **Reconciliation:** a nightly job recomputes counts from raw and compares against billed totals,
  catching any drift *before* the invoice.

## Files

| File | Purpose |
|---|---|
| `server.mjs` | the ingest server (`naive` + `idempotent` modes), runnable standalone |
| `bench.mjs` | load test + SVG report generator; doubles as a test (exits non-zero if billing isn't exact) |
| `report.html` | generated — the graphs |
| `results.json` | generated — raw numbers |
