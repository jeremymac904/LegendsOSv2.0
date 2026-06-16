# Loan Memory — Test Plan & Proof

This document maps every required Loan Memory behavior to the test that proves
it, and explains which scenarios are **runnable** (JS, via `tsx`) vs **asserted
in SQL** (RLS, which only runs in Postgres).

All tests import the orchestrator-owned foundation lib (`lib/loanMemory/*`) and
call its pure functions. The only test double is a tiny in-memory fake Supabase
client (`tests/loan-memory/fakeClient.ts`) that returns canned rows and records
inserts/updates so side effects can be asserted **without any live database,
network, or real borrower data**. Every sample row is fictional and flagged
`is_sample: true`.

## How to run

The repo has no JS unit-test runner configured (only Playwright e2e + `tsc`).
These unit tests run under `tsx`, which is already a devDependency.

```bash
# From the repo root:
npx tsx tests/loan-memory/run.ts          # run all runnable scenarios
npx tsc --noEmit -p tests/loan-memory/tsconfig.json   # typecheck the tests (strict)
```

`tests/` is excluded from the root `tsconfig.json`, so the test files ship with
their own `tests/loan-memory/tsconfig.json` (extends the root config) for
on-demand strict typechecking. A clean `tsc` run = pass; `run.ts` exits non-zero
if any case fails.

RLS scenarios (7 & 8) run against Postgres:

```bash
# Against a LOCAL / throwaway Supabase only — never production:
#   1. apply supabase/migrations/20260531100000_loan_memory.sql
#   2. apply supabase/migrations/20260531100100_loan_memory_rls.sql
psql "$DATABASE_URL" -f tests/loan-memory/rls.assertions.sql
```

The SQL runs inside a transaction that is **rolled back** at the end — nothing is
committed. Each assertion `RAISE EXCEPTION`s on failure, so a clean run = pass.

## Scenario map

| # | Scenario | Type | Proven by | What it asserts |
|---|----------|------|-----------|-----------------|
| 1 | "Where are we on Judith?" → retrieval attempted before any answer | Runnable | `S1` | The resolver queries `loan_memory` first (retrieval-first); a single strong match resolves to `matched`. Documents the detection nuance: the bare name question has no loan keyword, so `isLoanRelated` is `false` on the bare phrase but `true` with a loan keyword — and the agent always attempts retrieval for a name query regardless. |
| 2 | "Update this file, appraisal is back and title is still pending" | Runnable | `S2` | `isPipelineUpdate` is `true`; `writeMemoryEvent` inserts exactly one event, advances `appraisal_status` → `received`, keeps `title_status` `pending`, and **preserves + extends** `source_summary` (old line retained, new line appended). |
| 3 | "Write Ashley a note on what we need for CTC" | Runnable | `S3` | `isLoanRelated` is `true` (retrieval-first), and it is **not** a pipeline-write (`isPipelineUpdate` false) — drafting a note must not silently mutate the loan. |
| 4 | Multiple borrower matches → clarification, not a guess | Runnable | `S4` | Two "Smith" memories resolve to `multiple_matches` with ≥2 candidates and **no** auto-picked `match`. |
| 5 | Processor upload path | Runnable | `S5` | `writeMemoryEvent({event_type: "document_received"})` inserts a document event carrying the source file name. |
| 6 | `weeklyDraft` produces drafts from a memory bundle | Runnable | `S6` | `loadLoanMemoryBundle` → `weeklyDraft` yields one item per active memory with borrower/status/blocker/next-action and applies the chosen voice signature. |
| 7 | RLS: a Loan Officer sees only assigned memories | SQL (documented) | `rls.assertions.sql` (S7 block) | `can_view_loan_memory()` is `true` for the LO's assigned memory and `false` for one assigned to someone else. |
| 8 | RLS: Jeremy / admin sees all | SQL (documented) | `rls.assertions.sql` (S8 block) | An admin/owner (`is_admin_or_owner()`) can view memories they don't personally own. |
| 9 | `loadLoanMemoryBundle` writes a retrieval-log row | Runnable | `S9` | With `logRetrieval: true`, exactly one `loan_ai_retrieval_logs` insert is recorded, referencing the resolved memory, the `match_status`, and the list of sources checked. |
| 10 | Response format includes status + blocker + next action | Runnable | `S10` | `pipelineUpdateConfirmation` output contains "Current status", "Next action", "Missing or needs verification", and the borrower name; `LOAN_RESPONSE_FORMAT` enforces those sections plus the no-guess rule on protected statuses. |

### Bonus guardrail scenarios (runnable)

These aren't in the numbered list but prove the safety contract the foundation
lib enforces, and protect against the prior "crash on unapplied migration"
incident:

- **`S-degrade` (resolve):** a missing `loan_memory` table degrades to
  `no_match` instead of throwing.
- **`S-degrade` (events):** `writeMemoryEvent` against a missing memory returns
  `{ ok: false, error: "memory_not_found" }` instead of throwing.
- **`S-guard`:** setting `current_stage = clear_to_close` with
  `source_evidence: false` records the timeline event but **blocks** the
  protected-status change (`blocked_updates` names `current_stage`).

## Why RLS is SQL-only

RLS policies and the `can_view_loan_memory()` / `is_admin_or_owner()` helpers run
inside Postgres. The JS unit tests pass an in-memory fake client that has **no**
policy engine, so they cannot honestly prove row visibility. Proving RLS in JS
would require either bypassing RLS (forbidden) or standing up a real database
(out of scope for fast pure unit tests). Therefore scenarios 7 & 8 are asserted
in `rls.assertions.sql`, which exercises the real helper against fictional sample
rows in a rolled-back transaction.

> Note on S8: if your environment satisfies `is_admin_or_owner()` from a role/
> claim rather than the JWT `sub` alone, run the S8 block as the admin/owner
> role. The script emits a `RAISE WARNING` (not a hard pass) in that case and
> documents exactly what to set, so the intent is never silently skipped.

## Files

- `tests/loan-memory/fakeClient.ts` — in-memory Supabase double (records writes;
  can simulate "migration not applied" tables that throw).
- `tests/loan-memory/harness.ts` — zero-dependency test registrar + assertions.
- `tests/loan-memory/weeklyDraft.ts` — test-owned pure `weeklyDraft` helper
  (see note below).
- `tests/loan-memory/loanMemory.test.ts` — scenarios 1–6, 9, 10 + bonus guards.
- `tests/loan-memory/run.ts` — entrypoint (`npx tsx tests/loan-memory/run.ts`).
- `tests/loan-memory/rls.assertions.sql` — scenarios 7 & 8.
- `tests/loan-memory/tsconfig.json` — strict typecheck config for the tests.

### On `weeklyDraft`

`weeklyDraft` is **not** part of the foundation lib shipped this sprint
(`detect`/`resolve`/`bundle`/`events`/`voices`/`types`), and Agent TESTS must not
edit `lib/loanMemory/*`. So the helper lives with the tests as a small **pure**
reference implementation that consumes a `LoanMemoryBundle` and proves the shape
a weekly pipeline draft must take (borrower / status / blocker / next action, in
the selected voice, with "Unknown" for missing values — never guessed). The
UI/agent team can lift it into `lib/loanMemory/` later unchanged.
