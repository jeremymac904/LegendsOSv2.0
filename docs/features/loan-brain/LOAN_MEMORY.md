# Loan Memory

Loan Memory is the retrieval-first "where are we on this loan?" brain for
LegendsOS. When anyone on the team asks the assistant about a borrower, a
property, or a file — or tells it to update a loan — the assistant **looks up the
loan's memory before it answers or writes**. It never guesses borrower identity
when more than one loan matches, never invents missing values, and never marks a
loan as clear-to-close / closed / denied / suspended / dead without source
evidence.

This doc covers the architecture, the data model, the retrieval flow, the
memory/confidence/priority/response rules, and what Jeremy must configure to turn
it on.

> Status: the database migration is **not applied yet**. Everything degrades
> gracefully ("migration not applied / sample mode") until it is — no crashes.
> See [Configuration](#what-jeremy-must-configure).

---

## 1. Architecture

```
              user message ("Where are we on Judith?" / "Update this file…")
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  detect.ts       │  isLoanRelated? isPipelineUpdate?
                          │  (no I/O)        │  extractHints (names/#/address)
                          └────────┬─────────┘
                                   │ loan-related → MUST retrieve first
                                   ▼
                          ┌──────────────────┐
                          │  resolve.ts      │  loan# → name → address → co-borrower
                          │  resolveLoanCtx  │  → matched | multiple_matches |
                          └────────┬─────────┘     low_confidence | no_match
                                   │ matched (single, high-confidence)
                                   ▼
                          ┌──────────────────┐
                          │  bundle.ts       │  memory + events + open tasks +
                          │  loadLoanMemory  │  documents + email intake + drive
                          │  Bundle          │  links  → writes a retrieval LOG
                          └────────┬─────────┘
                                   │ context
                                   ▼
                          ┌──────────────────┐
                          │  voices.ts       │  voice profile + LOAN_RESPONSE_FORMAT
                          │  answer / draft  │  status · what matters · next · missing
                          └────────┬─────────┘
                                   │  (write path only)
                                   ▼
                          ┌──────────────────┐
                          │  events.ts       │  writeMemoryEvent → timeline event +
                          │  (guardrails)    │  guarded snapshot advance
                          └──────────────────┘
```

The foundation lib (`lib/loanMemory/*`, owned by the orchestrator) is pure and
typed; every Supabase call is wrapped so an unapplied table or empty result
degrades to "empty / no match" instead of throwing. RLS is enforced in the
database, not in code — callers pass an auth'd (user-session) Supabase client so
only rows the user may see come back.

---

## 2. Data model

Migration: `supabase/migrations/20260531100000_loan_memory.sql` (tables) +
`supabase/migrations/20260531100100_loan_memory_rls.sql` (RLS + helpers).

### New tables

**`loan_memory`** — the durable per-loan snapshot (one row per active loan/file).
Key columns:

- Identity: `loan_id` (FK, nullable), `owner_id`, `borrower_name`,
  `co_borrower_name`, `property_address`, `loan_number`.
- People: `primary_loan_officer`, `processor`, `loan_coordinator`,
  `referral_source`.
- Loan: `loan_purpose`, `loan_type`, `lender`.
- Live status: `current_stage`, `approval_status`, `appraisal_status`,
  `title_status`, `insurance_status`, `main_blocker`, `next_action`,
  `closing_date`, `last_known_activity`.
- Memory quality: `priority` (`highest…lowest`), `confidence`
  (`high|medium|low`), `source_summary` (append-style provenance), `source_file`,
  `is_sample`.

**`loan_memory_events`** — append-style chronological timeline. Each event has an
`event_type` (one of `MEMORY_EVENT_TYPES`: `borrower_update`, `email_summary`,
`document_received`, `condition_update`, `approval_update`, `appraisal_update`,
`title_update`, `insurance_update`, `pricing_update`, `lender_update`,
`processor_note`, `ai_note`, `task_update`, `closing_update`), an
`event_summary`, source fields (`source_type`/`source_name`/`source_url_or_path`/
`source_timestamp`), `created_by`, and `confidence`. Events are **never silently
rewritten**; the snapshot's `source_summary` is always preserved.

**`loan_ai_retrieval_logs`** — audit trail of what context the assistant loaded
*before* it answered: `loan_memory_id`, `assistant_user_id`, `query_text`,
`match_status`, `retrieved_sources` (JSON list), `retrieval_summary`,
`response_id`.

**`user_ai_preferences`** — per-user voice/communication settings: `tone_profile`
(jeremy/scott/eric/…), `communication_rules`, `approval_required`,
`default_signature`, `preferred_response_format`.

### Extended table

**`loan_documents`** gains: `loan_memory_id` (FK), `folder_category` (the Drive
folder: `00_LOAN_OVERVIEW … 06_FINAL` / `Customer Team Uploads`), `received_from`,
`submitted_to_lender`, `submitted_date`, `review_status`.

### Existing tables read (never owned here)

`loans`, `borrowers`, `loan_tasks`, `loan_conditions`, `loan_status_events`,
`drive_folder_links`, `email_intake_messages`.

### RLS helpers

- `is_admin_or_owner()` — admin/owner sees everything.
- `can_view_loan(loan_id)` — loan-level visibility.
- `can_view_loan_memory(memory_id)` — true if the user is admin/owner, OR the
  memory's `owner_id` / `primary_loan_officer` / `processor` / `loan_coordinator`,
  OR can view the linked loan. Events, retrieval logs, and documents inherit this.

---

## 3. Retrieval flow (detect → resolve → bundle → log → answer)

1. **Detect** (`detect.ts`). `isLoanRelated(text)` decides whether retrieval must
   run before answering (loan vocabulary, or a bare 7–12 digit loan-number-like
   token). `isPipelineUpdate(text)` decides whether this is a **write** intent
   (e.g. "update this file", "review this loan") vs a question.
   `extractHints(text)` pulls candidate loan number / names / address — used only
   to *bias* matching, never to guess.

2. **Resolve** (`resolve.ts`). `resolveLoanContext(client, input)` queries
   `loan_memory` (RLS-respecting) in strict priority order:
   `loan_id` → loan number → borrower name → property address → co-borrower name.
   It returns a `match_status`:
   - `matched` — a single strong candidate (or a clear top with a ≥0.2 confidence
     gap). Proceed.
   - `multiple_matches` — two or more plausible candidates. **Ask the user to
     choose. Never guess.**
   - `low_confidence` — one weak candidate; confirm before trusting it.
   - `no_match` — nothing found (also the graceful-degradation result when the
     table isn't applied). Ask for borrower / address / loan number.
   - `not_loan_related` — skip retrieval.

3. **Bundle** (`bundle.ts`). For a resolved memory,
   `loadLoanMemoryBundle(client, memoryId, opts)` loads the snapshot, the last 25
   events, linked documents, open tasks, recent email intake matches, and drive
   links — each guarded so missing tables degrade to empty. It returns
   `retrieval_summary` and `sources_checked`.

4. **Log** (`bundle.ts`, when `logRetrieval: true`). Writes one
   `loan_ai_retrieval_logs` row recording the query, match status, and which
   sources were checked — the audit trail proving retrieval happened before the
   answer. Logging never breaks the answer path.

5. **Answer / write** (`voices.ts`, `events.ts`). The answer is shaped by the
   user's voice profile and `LOAN_RESPONSE_FORMAT`. Pipeline updates go through
   `writeMemoryEvent`, which records a timeline event and advances the snapshot
   only within the memory-quality rules.

---

## 4. Rules

### Response format (`voices.ts`)

Every loan answer is structured: **1) Current status · 2) What matters · 3) Next
action · 4) Missing or needs verification.** Missing values render as "Unknown"
or blank — never guessed. `pipelineUpdateConfirmation()` produces the same
status / next-action / missing shape for write confirmations.

Voices: `jeremy` (operator, direct), `scott` (calm, process-driven), `eric`
(straight shooter). `getVoice(id)` falls back to `jeremy` (`DEFAULT_VOICE_ID`).
`CHANNEL_RULES` shape email vs text vs processing-note output.

### Memory quality (`events.ts` guardrails)

- **Provenance preserved.** Each write appends to `source_summary`
  (`[date] event_type: summary`); existing summary is never replaced.
- **Protected statuses need evidence.** `clear_to_close`, `closed`, `denied`,
  `suspended`, `dead` (`PROTECTED_STATUSES`) are **blocked** unless
  `source_evidence: true`. Blocked changes are reported in `blocked_updates`,
  and the timeline event is still recorded.
- **Don't weaken verified data.** An incoming note with lower `confidence` than
  the current memory cannot overwrite status fields (it still records activity
  and `next_action`).
- **Don't silently clear a blocker.** An empty `main_blocker` won't erase an
  existing blocker without evidence.

### Identity

When multiple memories match, the resolver returns `multiple_matches` with
candidates and `required_clarification`. The assistant asks; it never picks one.

### Confidence & priority

`confidence`: `high|medium|low` — drives the weaken-protection above and how
assertively the assistant phrases an answer. `priority`:
`highest|high|medium|low|lowest` — drives pipeline ranking / weekly drafts.

### Safety (non-negotiable)

No live email/social/n8n sends, no n8n activation, **no Google Drive
writes/moves/deletes/uploads**, no real borrower data committed or hardcoded as
sample, never bypass RLS. The AI must **attempt retrieval before answering** loan
questions.

---

## 5. What Jeremy must configure

1. **Apply the migrations** (local/staging first, then production) in order:
   - `supabase/migrations/20260531100000_loan_memory.sql` (tables + `loan_documents` extension)
   - `supabase/migrations/20260531100100_loan_memory_rls.sql` (RLS + helpers)

   Until applied, Loan Memory runs in **sample / migration-not-applied mode**:
   the resolver returns `no_match`, bundles return empty, and the UI shows an
   honest setup notice — no crashes.

2. **Connect Drive read-only.** Map each active loan to its Drive folder via
   `drive_folder_links`, using the standard structure
   (`00_LOAN_OVERVIEW … 06_FINAL`, plus `Customer Team Uploads` for intake).
   Document `folder_category` on `loan_documents` accordingly. **Read-only** — no
   writes/moves/deletes/uploads to Drive from this system.

3. **Set up voices** (`user_ai_preferences`). Pick each user's `tone_profile`
   (`jeremy` / `scott` / `eric`, extendable for future LOs), `default_signature`,
   `communication_rules`, `approval_required`, and `preferred_response_format`.
   New users default to the `jeremy` operator voice.

4. **Verify RLS** before trusting visibility: run
   `tests/loan-memory/rls.assertions.sql` against a local DB (it rolls back) to
   confirm a Loan Officer sees only assigned memories and an admin/owner sees all.

---

## 6. Tests

See **`docs/LOAN_MEMORY_TESTS.md`** for the full scenario-to-test map. Quick
start:

```bash
npx tsx tests/loan-memory/run.ts                       # runnable unit scenarios
npx tsc --noEmit -p tests/loan-memory/tsconfig.json    # strict typecheck
psql "$DATABASE_URL" -f tests/loan-memory/rls.assertions.sql   # RLS (local only)
```
