# Mortgage Data Model (Loan Brain — Phase 1)

Branch: `feature/loan-brain-drive-browser`. Not deployed, not pushed, not committed by the build agent.

This is the first mortgage-operations data model for LegendsOS. It adds ten Supabase tables plus row-level security, on top of the existing `profiles` / `organizations` foundation. No borrower PII is seeded — sample records live only in the app layer (`lib/loanbrain/sampleData.ts`) and are flagged `is_sample`.

## Migrations

- `supabase/migrations/20260530000000_mortgage_data_model.sql` — tables, indexes, `updated_at` triggers, adds the `coordinator` role to the `user_role` enum, and (defensively) (re)creates `public.set_updated_at()`.
- `supabase/migrations/20260530000100_mortgage_rls_policies.sql` — RLS + two SECURITY DEFINER helpers (`can_view_loan`, `owns_loan`).

These follow the existing repo conventions: `gen_random_uuid()` ids, `timestamptz` defaults, `public.is_admin_or_owner()` / `public.is_owner()` helpers from the init migration, and idempotent enum extension matching `20260513000000_extend_user_roles.sql`.

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `loans` | One row per loan file | `owner_id` (LO), `assigned_processor_id` (Ashley), `assigned_coordinator_id` (Geraldine), `stage`, `stage_status` (blocked/working/done/seen), `priority`, `drive_folder_id`, `drive_url`, `is_sample` |
| `borrowers` | Borrowers on a loan | `loan_id`, `full_name`, `email`, `phone`, `is_primary` |
| `loan_documents` | Received/missing tracker | `loan_id`, `category`, `name`, `status` (received/missing/pending/waived), `drive_file_id`, `drive_url` |
| `loan_conditions` | UW/AUS/lender conditions | `loan_id`, `source` (aus/uw/lender/other), `description`, `status`, `response_plan`, `citation_source` |
| `loan_contacts` | AE, AM, title, HOI, realtor… | `loan_id`, `contact_type`, `name`, `email`, `phone`, `company` |
| `loan_status_events` | Append-only stage/status history | `loan_id`, `from_*`, `to_*`, `note`, `created_by` |
| `loan_tasks` | Processor/coordinator tasks | `loan_id`, `title`, `assignee_role`, `assignee_id`, `status` (todo/doing/blocked/done), `priority`, `due_at` |
| `loan_approvals` | Human-in-the-loop queue | `loan_id`, `action_type` (send_email/move_file/pipeline_push…), `payload`, `status` (pending/approved/rejected/cancelled) |
| `loan_activity_log` | Append-only audit trail | `loan_id`, `actor_id`, `action`, `detail` |
| `drive_folder_links` | Read-only Drive references | `owner_id`, `loan_id?`, `folder_kind`, `label`, `drive_folder_id`, `drive_url` |

Every tenant table carries `owner_id` and (where relevant) `is_sample`. `drive_*` columns are **references only** — LegendsOS never writes to Google Drive.

## Status vocabulary

Loan `stage_status` and the boards use the **blocked / working / done / seen** model (a concept borrowed from herdr, reimplemented here — no third-party code). `loan_tasks.status` uses **todo / doing / blocked / done**.

## RLS — who can see what

Helper `can_view_loan(loan_id)` is the visibility spine. A user can view a loan when any of these is true:

- they are **owner/admin** (Jeremy) — sees all loans and all children;
- they are the loan **owner** (`owner_id`) — the loan officer;
- they are the **assigned processor** (`assigned_processor_id`) — Ashley;
- they are the **assigned coordinator** (`assigned_coordinator_id`) — Geraldine.

Child tables (`borrowers`, `loan_documents`, `loan_conditions`, `loan_contacts`, `loan_tasks`, `loan_approvals`, `loan_status_events`, `loan_activity_log`) inherit visibility through `can_view_loan(loan_id)`. Deletes on child tables are gated by `owns_loan(loan_id)` (owner/admin or the LO who owns the loan). Append-only tables expose **select + insert only** (no update/delete policy). `drive_folder_links` are owner-scoped (root links) and loan-scoped (per-borrower links). `service_role` bypasses RLS for server jobs, exactly as the rest of the app already relies on.

This is **not** frontend-only security: the database enforces it. Server pages additionally check role with `lib/permissions.ts` and `getEffectiveProfile()` before rendering, and API routes check `getCurrentProfile()`.

## Types

`types/database.ts` gains a hand-typed `Database` table map plus the `coordinator` role in `UserRole`. The app primarily uses the existing per-interface exports; the new `Database`/`Tables<>` types are available for future typed queries.

## What is NOT in this migration

No borrower data. No Drive credentials. No secrets. No writes to any external system. Applying these migrations creates empty, RLS-protected tables — the app shows sample data until real loans are inserted and a read-only Drive connection is live.

## How to apply (when Jeremy approves)

Through the normal Supabase migration path for this project (the same way the existing `2026051x` migrations were applied). The build agent did **not** apply them.
