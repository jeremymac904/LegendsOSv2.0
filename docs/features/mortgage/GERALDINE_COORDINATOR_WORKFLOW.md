# Geraldine Coordinator Workflow (Follow-Up Board)

Branch: `feature/loan-brain-drive-browser`. A calm follow-up board for Geraldine — lead follow-up, document collection, borrower status, missing-item chases, pipeline notes, and one-tap escalation to Jeremy. No connector, provider, model, or admin complexity.

## Where it lives

- **Page:** `/coordinator` — `app/(app)/coordinator/page.tsx` (visible to `coordinator` + owner/admin)
- **UI:** `components/coordinator/CoordinatorBoard.tsx`
- **Nav:** "Coordinator" under the Mortgage section, gated to the coordinator role (owner/admin also see it)

## What Geraldine sees

A three-column board:

- **Reach out today** (blocked) — leads/borrowers overdue for contact
- **Waiting on borrower** (working) — requested docs not yet received
- **Handled** (done/seen)

Selecting a borrower opens: header + **Escalate to Jeremy** button, the **draft tools**, and a **pipeline notes** pad (local to this build). The escalate button flags the file for Jeremy's command center with context — it does not send a message in this build.

## Draft tools (draft-first)

Geraldine's allowed generators: **missing items** (her "draft borrower message" / document-request starter) and **pipeline update**. Both are drafts she reviews and sends from her own tools or queues for approval later. Nothing auto-sends.

## Document collection

Shares the same received/missing tracker as Ashley's cockpit (one source of truth), framed for collection: who to chase and for what. When a borrower uploads to Drive (in a later live phase), the item flips from missing to received via read-only detection — LegendsOS never moves or renames anything.

## Data source

Sample "LEADS" + "PROSPECTS" borrowers for now (`sampleBoardRows()`); RLS scopes Geraldine to loans where `assigned_coordinator_id` is her once real data exists.

## Safety

Read-only Drive (recommend, never modify/delete/overwrite). Draft-first communication. No invented borrower data or guideline claims. Escalation is a button to a human, not an automated decision.
