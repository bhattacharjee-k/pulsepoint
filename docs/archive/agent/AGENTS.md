# Multi-Agent Team — PulsePoint Challenge

> Defines **roles and handoff rules**. Claude Opus **chooses its own subagents** — this file does not prescribe subagent types.  
> Task state: [`workspace_plan.md`](./workspace_plan.md). Build plan: [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md). Requirements: [`TECHNICAL_REQUIREMENTS.md`](./TECHNICAL_REQUIREMENTS.md) + [`pulsepoint-challenge.md`](./pulsepoint-challenge.md).

---

## Human context (read first, Claude)

The project owner is **learning software engineering** through this challenge. Limited prior coding experience is expected.

**How to work with them:**
- Prefer **clear explanations** over jargon; define terms when first used.
- **Think out loud** — show reasoning and tradeoffs, not only conclusions.
- Use **back-and-forth**: propose → ask what’s unclear → refine. Do not rush to a monolithic spec.
- It’s OK to go deep on architecture in dialogue **before** locking Codex tasks.
- When testing, describe **what you ran, what passed/failed, and why it matters** in plain language.

---

## Pipeline

```text
Stage 1   Composer (PM)              → Sparring, decisions, workspace_plan.md
Stage 2a  Claude Opus 4.8            → Think → propose architecture → review WITH user
Stage 2b  Claude Opus 4.8            → Lock spec + boilerplate Codex task list
Stage 3   Codex CLI GPT-5.5          → Implement (NO git commits)
Stage 4   Claude Opus 4.8            → Integration testing + security testing of Codex output
Stage 5   Composer                   → Final diff review, cleanup, git (only Composer commits)
```

**Collision rule:** One primary owner per file at a time. Update File Ownership Lock in `workspace_plan.md` before handoff.

**Git rule:** Only **Composer** runs `git commit` / `git push`.

---

## Locked product decisions (from Composer sparring)

Do not re-litigate without `[NEEDS USER CONFIRMATION]`.

| Topic | Decision |
|-------|----------|
| **Tenants** | Alpha (`admin@alpha.com`), Delta (`admin@delta.com`) |
| **Mock sites** | `demo-alpha.html`, `demo-delta.html` |
| **Host users** | Stub Alice/Bob + `submitter` in payload; no host OAuth build |
| **Isolation** | Shared Postgres + `tenant_id` + **RLS** |
| **DB roles** | `pulsepoint_migrate`, `pulsepoint_app`, `pulsepoint_ingest` |
| **Public path** | `pk_…` → ingest; rate limits; rotation = abuse response |
| **Dashboard** | Password (hashed) + session → `SET LOCAL app.current_tenant_id` |
| **Scope** | Four pillars; label stubs honestly in README |

---

## Agent: Composer (Cursor — PM)

**Owns:** `workspace_plan.md`, git, Stage 5 validation.

**Does:** Sparring before Claude; milestone tracking; diff review before commit.

**Does not:** Replace Claude’s architecture dialogue or Codex implementation by default.

**Receives from Claude (Stage 4 complete):** Test report, security findings, “ready for Composer” summary in `workspace_plan.md`.

---

## Agent: Claude Opus 4.8 (Architect + QA)

Claude is the **technical lead** for Stages **2a, 2b, and 4**. The user informs this role; Claude decides **how** to divide work (including **which subagents to spawn**, if any).

### Stage 2a — Think & architecture (collaborative)

**Goal:** Deep mental model + architecture the user understands.

**Does:**
- Read `TECHNICAL_REQUIREMENTS.md`, `pulsepoint-challenge.md`, `workspace_plan.md`, this file.
- Reason through problem space (multi-tenancy, two APIs, RLS, widget, dashboard).
- Present architecture (diagram, data model, threat model) in **digestible chunks**.
- **Pause for user review** — treat architecture as a conversation, not a dump.
- Spawn subagents **only if Claude chooses** — no fixed list in this repo. Examples Claude might invent: “RLS policy reviewer”, “API contract drafter”, “threat model”. Claude names them, merges output, stays accountable.

**Does not (2a):**
- Hand off to Codex yet.
- Git commit/push.
- Assume user already knows terms (explain RLS, public key, migration, etc. when relevant).

**Exit 2a when:** User confirms architecture direction (or documents open questions).

---

### Stage 2b — Spec & Codex boilerplate

**Goal:** Implementable tasks Codex can run without guessing.

**Does:**
- Append/refine `## Technical Specifications` in `workspace_plan.md`.
- Write **[`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md)** (canonical) and a short task index in `workspace_plan.md` → `## Codex Handoff`.
- Update **File Ownership Lock** for Codex.
- Mark **M2** complete in `workspace_plan.md`.

**Does not (2b):**
- Full app implementation (snippets/SQL outlines OK).
- Git commit/push.

**Exit 2b when:** Codex task list is explicit; user knows what will be built.

---

### Stage 3 — Codex (separate agent)

Codex executes **[`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md)** Tasks 0–11 in order. Summary index: `workspace_plan.md` → `## Codex Handoff`.

**Does:**
- Create the `pulsepoint/` tree per handoff §2 (only paths listed there unless blocked — log first).
- Implement migrations, RLS, APIs, widget, dashboard, seed, tests, README.
- Run `npm test` and the §9 demo path; log results in `workspace_plan.md` → `## Implementation Notes`.
- Follow operating rules in handoff §0 (tests required, code quality, no silent stubs).

**Forbidden:**
- `git commit`, `git push`, `git add` for committing.
- Redesigning isolation/auth (shared Postgres + RLS + session + three DB roles).
- Weakening/skipping contract tests to pass green without logging.
- New paid/external services (CAPTCHA stays stubbed per handoff §10).

**Reads first:** `CODEX_HANDOFF.md` → `workspace_plan.md` → `TECHNICAL_REQUIREMENTS.md` (context) → `AGENTS.md`.

**Note:** Stage 4 includes adversarial security tests Codex does not see — implement behavior correctly, not only to pass listed tests.

---

### Stage 4 — Integration & security testing (Claude, before Composer)

**Goal:** Verify Codex output works and isolation holds — **then** return to Composer.

**Does:**
- **Integration testing:** run app (`docker compose up` / documented command); walk Alpha/Delta flows (widget submit → dashboard inbox); note failures with repro steps.
- **Security testing:** cross-tenant access attempts, public key scope, ingest vs admin separation, RLS/session checks, rate limit smoke test. Document what was tried and result.
- Fix **small** integration issues inline if appropriate, or list fixes for Codex.
- Append **`## Claude QA Report`** to `workspace_plan.md` (pass/fail checklist, findings, remaining risks).
- Mark **M4** complete; signal **ready for Composer** in plan.

**Does not (4):**
- Git commit/push.
- Large redesign without user approval (escalate to 2a/2b amend).

**Exit 4 when:** QA report written; user-oriented summary of “is it safe enough to demo / what’s stubbed.”

---

### Subagents (Claude’s choice only)

- **Not defined in this repo.** Claude decides whether to spawn subagents, what to call them, and how many.
- Any subagent output is **merged and owned by Claude** before user review or Codex handoff.
- Subagents must not `git commit` or replace Codex unless Claude assigns a narrowly scoped file and records it in File Ownership Lock.

---

## Agent: Codex CLI GPT-5.5 (Terminal — Stage 3)

**Role:** Builder — implements [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) only (§0–§11).

**Forbidden:** `git commit`, `git push`; changing locked isolation/auth model without Claude amendment; skipping contract tests without logging.

See **Stage 3** under Claude's section above for full Does/Forbidden/Reads-first.

---

## Optional: Claude Editor (inline)

Same person/agent as Claude Opus — use for **small** edits during Stage 4. Not a separate pipeline stage unless the user explicitly splits it.

---

## Handoff snippets

### User → Claude (start)

First message: role + Stage 2a prompt (from Composer / project kickoff).

### Claude → Codex (after 2b)

See [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) (full plan). Task index: `workspace_plan.md` → `## Codex Handoff`.

### Claude → Composer (after Stage 4)

```text
## Ready for Composer
QA report: workspace_plan.md § Claude QA Report
Run command: ...
Known stubs: ...
Recommended commit scope: ...
```

---

## Glossary

| Term | Meaning here |
|------|----------------|
| **Public key** | `pk_…` in widget; tenant routing for ingest; not secret |
| **API key** | Server-only credential; not embedded in HTML |
| **Migration** | Versioned database schema change |
| **RLS** | Postgres row-level tenant filtering on DB connections |
| **Tenant** | Alpha or Delta organization |
