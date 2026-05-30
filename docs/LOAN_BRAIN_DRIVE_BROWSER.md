# Loan Brain — Google Drive Browser (read-only)

Branch: `feature/loan-brain-drive-browser`. The Loan Brain is the mortgage command center inside Atlas. Phase 2 ships the **read-only** Drive browser, connection status, and the draft generators. It runs on safe **sample data** until a live read-only Drive connection is configured.

## Safety frame (non-negotiable)

Read-only. The Loan Brain never writes, moves, renames, uploads, overwrites, or deletes anything in Google Drive, and never sends email or publishes. The API surface has **no** POST/PUT/PATCH/DELETE that touches Drive — the only POST (`/api/loanbrain/generate`) returns draft text. No secrets are exposed; status checks read env var **presence** only.

## Where it lives

- **Page:** `/loan-brain` (owner-only) — `app/(app)/loan-brain/page.tsx`
- **Browser UI:** `components/loanbrain/LoanBrainBrowser.tsx`
- **Generators UI:** `components/loanbrain/GeneratorPanel.tsx`
- **Status pills:** `components/loanbrain/statusPill.tsx` (blocked/working/done/seen)
- **Settings panel:** `components/settings/DriveLoanBrainSetup.tsx` (rendered on `/settings`)
- **API:** `app/api/loanbrain/drive/route.ts` (GET only), `app/api/loanbrain/generate/route.ts` (POST → draft)
- **Library:** `lib/loanbrain/{types,sampleData,driveStatus,generators,store}.ts`

## What the browser does

Left rail lists the pipeline roots from the handoff doc: **ACTIVE LOANS, LEADS, PROSPECTS, PAST CLIENTS, Loan Factory Loan Brain, UW Guides**, plus a borrower search. Picking a section lists its borrower folders; picking a borrower shows the file list (received/missing), an **inline preview placeholder**, the borrower summary, and the draft generators.

## Draft generators (all draft-first)

From a borrower folder, the Loan Brain can generate: **loan summary, processor handoff** (the 21-field Ashley handoff), **missing items list, Ashley email, condition response plan, lender overlay risk note, pipeline update**. Each is a markdown **draft** with explicit warnings. Unknown fields render as `❓ not found — confirm` — the generators never invent borrower data or guideline citations, and never present AUS/agency findings as lender approval.

## Connection status & modes

`lib/loanbrain/driveStatus.ts` reports `live` vs `sample`:

- **sample** (default): no Google OAuth client, or the read-only opt-in flag is off. UI shows safe demo borrowers.
- **live**: requires `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` **and** `LOAN_BRAIN_DRIVE_READONLY=true`, plus the pipeline folder shared read-only to the connected identity. Even in live mode the connection is read-only.

Optional env (names only — set on the host, never in the repo): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `LOAN_BRAIN_DRIVE_READONLY`, `LOAN_BRAIN_PIPELINE_FOLDER_URL`.

## What's real vs placeholder

Real now: routes, UI, data model, RLS, connection-status logic, draft generators, role gating, sample data. Placeholder until a later phase: live Drive file listing/preview (currently sample + a preview placeholder), real document classification, real 3.4/AUS parsing, and persisting drafts/notes server-side. The store (`lib/loanbrain/store.ts`) already prefers real `loans` rows when the tables exist and falls back to sample on `42P01`.

## Patterns borrowed (not copied)

Inline preview + workspace feel (AionUi), draft-first review (Hermes Desktop), blocked/working/done/seen (herdr), permission-tier "approve before send" thinking (openhuman), board concept (paperclip). No third-party code is vendored; Atlas remains the single brain.
