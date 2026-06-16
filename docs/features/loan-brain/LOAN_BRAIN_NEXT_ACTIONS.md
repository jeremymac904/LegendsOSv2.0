# Next Actions — Loan Brain (Phase 1 + 2)

Branch: `feature/loan-brain-drive-browser`. Built locally, not pushed/committed/deployed by the agent. This is the mortgage Loan Brain foundation: data model + RLS + read-only Drive browser + role surfaces, all draft-first and sample-backed.

> Note: this file was renamed from `docs/NEXT_ACTIONS.md` during stabilization. The original `docs/NEXT_ACTIONS.md` (prior UI/UX sprint content) was restored to its committed version so unrelated work was not lost.

## To review (preview before merge)

1. Migrations — `supabase/migrations/20260530000000_mortgage_data_model.sql` and `..._20260530000100_mortgage_rls_policies.sql`.
2. RLS summary — see `docs/MORTGAGE_DATA_MODEL.md`.
3. Routes — `app/api/loanbrain/drive` (GET), `app/api/loanbrain/generate` (POST → draft).
4. Pages — `/loan-brain` (owner), `/processing` (Ashley), `/coordinator` (Geraldine), `/my-loans` (LO).
5. Settings — `components/settings/DriveLoanBrainSetup.tsx` on `/settings`.

## To confirm (inputs needed before "live")

1. Which Google identity owns the **read-only** Drive connection (Loan Factory corporate vs. mcdonald-mtg.com), and that the Jeremy Applicants Pipeline folder is shared read-only to it.
2. The canonical **borrower-folder structure** in Drive, so document classification is reliable.
3. The **expected-document checklist per loan program**, so "missing items" are accurate.
4. Which connection path to standardize on for read-only Drive (Google Workspace OAuth vs. Google Drive MCP vs. Zapier MCP).

## To apply (only after Jeremy approves)

- Apply the two migrations through the project's normal Supabase migration path.
- Optionally set live env (names only; on the host, never in the repo): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `LOAN_BRAIN_DRIVE_READONLY=true`, `LOAN_BRAIN_PIPELINE_FOLDER_URL`.

## Next build phase (Phase 3 candidates)

- Live read-only Drive listing + real inline preview (replace placeholder).
- Real document classification vs. the program checklist.
- 3.4 / AUS extraction via the existing AI gateway (read-only vision for screenshots).
- Persist drafts, processor/coordinator notes, and the approval queue to Supabase.
- Wire the human-approval step in front of `ALLOW_LIVE_EMAIL_SEND` before any real send.

## Guardrails carried forward

Read-only Drive · draft-first (send off by default) · no invented data/citations · agency ≠ lender approval · no borrower data in GitHub · no secrets printed/committed · least-privilege scopes · role-scoped views so LOs are never overwhelmed.
