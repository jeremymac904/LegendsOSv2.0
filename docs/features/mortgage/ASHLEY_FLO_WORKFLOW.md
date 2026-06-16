# Ashley FLO Workflow (Processor Cockpit)

Branch: `feature/loan-brain-drive-browser`. A simple, capable processing cockpit for Ashley. No engineering complexity, no connectors, no provider settings — just her files and the tools to work them.

## Where it lives

- **Page:** `/processing` — `app/(app)/processing/page.tsx` (visible to `processor` + owner/admin)
- **UI:** `components/processing/ProcessorCockpit.tsx`
- **Nav:** "Processing (FLO)" under the Mortgage section, gated to the processor role (owner/admin also see it)

## What Ashley sees

A three-column board using the blocked/working/done/seen model:

- **Needs Ashley** (blocked) — files waiting on her next action
- **In progress** (working) — files she's actively processing
- **Done / submitted** (done/seen)

Selecting a file opens the detail panel: borrower header + Drive folder link, the **document tracker** (received/missing), **conditions**, **priority next steps**, the **draft tools**, and a private **processor notes** scratch pad (local to this build).

## Draft tools (draft-first, nothing sends)

Ashley's allowed generators: **processor handoff, missing items, Ashley email, condition response plan**. Each returns a markdown draft with warnings; she reviews and copies. Live sending is not wired — it stays behind the existing `ALLOW_LIVE_EMAIL_SEND` flag + a human approval step in a later phase.

## Data source

Sample "ACTIVE LOANS" borrowers for now (`lib/loanbrain/store.ts → sampleBoardRows()`), so the cockpit is demoable before live data. When the mortgage tables are populated and loans are assigned to Ashley (`assigned_processor_id`), RLS already scopes her to exactly her files.

## Safety

Drive is read-only (recommend, never modify). Emails are drafts. No invented borrower data, contacts, statuses, or guideline citations — unknowns are shown as unknown. Agency/AUS findings are never shown as lender approval.

## What Jeremy must confirm before this is "real" for Ashley

The expected-document checklist per loan program (so "missing" is accurate), the canonical borrower-folder structure in Drive, and where contacts (AE, AM, title, HOI, realtor) live so handoffs populate.
