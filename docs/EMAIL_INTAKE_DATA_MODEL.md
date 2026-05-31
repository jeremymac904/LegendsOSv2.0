# Email Intake — Data Model (Phase 1)

LegendsOS is the brain; n8n is the outside runner. This document describes the
**native LegendsOS side**: the intake DB, classification queue, attachment review
queue, loan-match review, alert + human-approval queue, team routing,
notification preferences, and an append-only audit log.

> **Source of truth:** `supabase/migrations/20260531000000_email_intake.sql`
> and the hand-typed mirror in `lib/emailIntake/types.ts`.

## Safety posture (non-negotiable, Phase 1)

This schema only **RECORDS + QUEUES for human review**. It does not, and the
Phase 1 code must not:

- send customer-facing email,
- delete anything,
- auto-mark emails read,
- auto-write to borrower folders,
- store real borrower PII or real team emails in the migration.

Sample/demo rows are flagged `is_sample = true` at the **app layer only** — the
migration seeds nothing.

## ⚠️ The migration is NOT auto-applied

`20260531000000_email_intake.sql` is **not** applied to the live database by any
build step. The owner applies it manually (Supabase SQL editor or CLI). All
intake code **degrades gracefully if a table is missing** — pages show a
setup-needed state and webhooks record nothing rather than crash. RLS lives in a
companion `*_email_intake_rls.sql` file and is applied separately.

---

## The 5 tables

### 1. `email_intake_team`
Which mailbox owners LegendsOS watches and how they want to be notified.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `profile_id` | uuid → `profiles(id)` | links to an app user when one exists; null otherwise |
| `full_name` | text NOT NULL | |
| `gmail_address` | text, **UNIQUE** | watched Gmail/Workspace address; **NULL = "admin setup needed"** |
| `role_label` | text | `owner` \| `loan_officer` \| `processor` \| `coordinator` \| `assistant` \| `other` |
| `intake_enabled` | boolean, default **false** | intake is OFF until the owner enables it (Phase 1: all off) |
| `notify_preferences` | jsonb, default `{}` | per-user channels, severities, quiet hours |
| `sort_order` | int, default 100 | |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

### 2. `email_intake_messages`
One row per ingested email (metadata only — full body stays in Gmail).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `source_account` | text NOT NULL | watched mailbox the email arrived in |
| `team_member_id` | uuid → `email_intake_team(id)` | |
| `gmail_message_id` | text NOT NULL | idempotency key |
| `gmail_thread_id` | text | |
| `from_address` / `from_name` / `to_address` | text | |
| `subject` / `snippet` | text | snippet stored for triage only |
| `received_at` | timestamptz | |
| `has_attachments` | boolean, default false | |
| `classification` | text | one of the **13 categories** (see below); nullable until classified |
| `classification_confidence` | numeric(4,3) | 0.000–1.000 |
| `classified_by` | text, default `none` | `rule` (cheap) \| `ai` (DeepSeek hard pass) \| `none` |
| `status` | text, default `needs_review` | lifecycle below |
| `loan_match_id` | uuid → `loans(id)` | never auto-filed; human approves first |
| `loan_match_confidence` | numeric(4,3) | |
| `loan_match_status` | text, default `unmatched` | lifecycle below |
| `internal_alert_decision` | text, default `undecided` | lifecycle below |
| `reviewed_by` | uuid → `profiles(id)` | |
| `reviewed_at` | timestamptz | |
| `is_sample` | boolean, default false | |
| `raw_headers` | jsonb, default `{}` | |
| `created_at` / `updated_at` | timestamptz | |
| **UNIQUE** | `(source_account, gmail_message_id)` | **dedupe key** |

### 3. `email_intake_attachments`
Attachment review queue. Unknown/suspicious files route to a Google Drive
**"Needs Review"** folder only — never the borrower file.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `message_id` | uuid NOT NULL → `email_intake_messages(id)` ON DELETE CASCADE | |
| `file_name` / `mime_type` | text | |
| `size_bytes` | bigint | |
| `gmail_attachment_id` | text | |
| `drive_location` | text, default `pending` | `pending` \| `needs_review_folder` \| `borrower_folder` \| `not_uploaded` — **Phase 1 only ever targets `needs_review_folder`** |
| `drive_file_id` / `drive_url` | text | |
| `status` | text, default `pending_review` | `pending_review` \| `needs_review` \| `suspicious` \| `approved` \| `filed` \| `rejected` |
| `suspicious_reason` | text | |
| `loan_match_id` | uuid → `loans(id)` | |
| `loan_match_confidence` | numeric(4,3) | |
| `is_sample` | boolean, default false | |
| `created_at` / `updated_at` | timestamptz | |

### 4. `email_intake_alerts`
Internal alert decision + **human approval queue**. An approved alert is an
**internal notification only** — never a customer reply.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `message_id` | uuid → `email_intake_messages(id)` ON DELETE CASCADE | |
| `alert_type` | text, default `review` | `review` \| `urgent_condition` \| `phishing_risk` \| `new_lead` \| `lender_update` \| `other` |
| `severity` | text, default `normal` | `low` \| `normal` \| `high` \| `urgent` |
| `target_team_member_id` | uuid → `email_intake_team(id)` | internal recipient |
| `decision` | text, default `pending` | `pending` \| `approved` \| `dismissed` — **nothing dispatches until approved** |
| `channel` | text, default `in_app` | `in_app` \| `email_internal` \| `telegram` \| `none` |
| `approved_by` | uuid → `profiles(id)` | |
| `approved_at` | timestamptz | |
| `dispatched_at` | timestamptz | set by the alert-intake webhook **after** n8n confirms an approved internal send |
| `payload` | jsonb, default `{}` | |
| `is_sample` | boolean, default false | |
| `created_at` / `updated_at` | timestamptz | |

### 5. `email_intake_audit`
Append-only audit log for every intake action.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `actor_id` | uuid → `profiles(id)` | null for system/webhook actions |
| `actor_label` | text, default `system` | |
| `action` | text NOT NULL | e.g. `webhook_received`, `classified`, `alert_approved` |
| `entity_type` | text | `message` \| `attachment` \| `alert` \| `team_member` \| `settings` \| `webhook` |
| `entity_id` | uuid | |
| `detail` | jsonb, default `{}` | |
| `created_at` | timestamptz | |

---

## The 13 classification categories

`customer_document_returned`, `customer_question`, `underwriting_condition`,
`lender_update`, `title_update`, `insurance_update`, `realtor_update`,
`processor_internal`, `new_lead`, `promotional`, `spam`, `phishing_risk`,
`unknown_needs_review`.

`unknown_needs_review` is the **safe default** for anything the cheap rule
classifier + DeepSeek hard pass cannot confidently resolve. The classifier never
guesses (see `lib/emailIntake/classify.ts`).

---

## Lifecycles

### Message status (`email_intake_messages.status`)
```
needs_review        ← default for anything uncertain
  → classified      ← a category was assigned (rule or ai)
  → loan_matched    ← a loan match was suggested/confirmed
  → alert_pending   ← an alert decision is in progress
  → awaiting_approval ← a human must approve an internal alert
  → approved        ← human-approved; internal action may proceed
  → archived        ← triaged + closed
```
Movement is human-gated past `classified`. Nothing auto-advances to `approved`.

### Loan-match status (`loan_match_status`)
```
unmatched   ← default; no loan associated
  → suggested ← classifier/n8n proposes a loan_match_id + confidence
  → confirmed ← a human approved the match (required before any filing)
  → rejected  ← a human rejected the suggestion
```
`loan_match_id` is **never** auto-filed to a borrower folder. Filing requires
`confirmed` + explicit human approval (a later phase).

### Internal alert decision (`internal_alert_decision`)
```
undecided
  → no_alert         ← triage decided no human needs pinging
  → alert_suggested  ← classifier/routing proposes an alert
  → alert_approved   ← a human approved the internal alert
```

### Alert decision (`email_intake_alerts.decision`)
```
pending → approved  → (n8n dispatches internal-only) → dispatched_at set
        → dismissed
```
`channel` is internal-only by design (`in_app` / `email_internal` / `telegram` /
`none`). There is no external/customer channel.

### Attachment status (`email_intake_attachments.status`)
```
pending_review
  → needs_review  ← lives in the Drive Needs Review folder
  → suspicious    ← flagged (suspicious_reason set); stays in Needs Review
  → approved      ← human approved a confident loan match
  → filed         ← moved to borrower_folder (later phase, post-approval)
  → rejected      ← human rejected
```

---

## RLS summary

- RLS is defined in a **companion** `*_email_intake_rls.sql` migration, applied
  separately from the table migration.
- **Webhooks** use the Supabase **service role** (`getSupabaseServiceClient()`),
  which bypasses RLS — webhooks have no user session.
- **App/page reads** use the user session and are gated in the application layer
  to **admin/owner** (`isAdminOrOwner`), redirecting non-admins to `/dashboard`.
- The audit table is **append-only** by intent.
- Until RLS is applied, treat all intake tables as admin-only at the app layer.

---

## Graceful degradation

If any intake table is missing (migration not applied):
- webhook routes record nothing and return a benign response (they do not 500),
- pages render a "setup needed" state,
- nothing crashes and no secrets/env values are printed.
