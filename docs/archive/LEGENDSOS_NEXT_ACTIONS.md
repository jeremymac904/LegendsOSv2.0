# LegendsOS — Next Actions

Forward-looking, prioritized action list for the sprints following the Builder Workspace sprint
(2026-05-30). Items are ordered by priority within each tier. Each item notes scope, the files
or surfaces it touches, and any gate that blocks it.

> **Standing gate:** Any item that writes to the database requires **Jeremy's explicit approval
> of the Supabase migration** before it ships. No migrations have been applied in this sprint.

---

## P0 — Unblock persistence (highest leverage)

### 1. Persist Builder projects to Supabase  *(BLOCKED on Jeremy's migration approval)*
- **What:** Move `/builder` Projects, Captures, Plans, Handoffs, QA results, and Incubator ideas
  from client/in-memory state to Supabase tables.
- **Why first:** Almost every other Builder/Vibe-Coding item depends on real persistence.
- **Scope:** New tables (`builder_projects`, `builder_captures`, `builder_plans`,
  `builder_handoffs`, `builder_qa`, `builder_incubator`), RLS owner-only policies, server actions.
- **Gate:** Migration must be reviewed and approved by Jeremy before applying. Draft the
  migration, do **not** run it.

### 2. Persist Vibe-Coding submissions + Jeremy review queue  *(BLOCKED on migration approval)*
- **What:** Persist LO drafts and submissions; build Jeremy's review queue (approve / request
  edits / publish).
- **Scope:** `vibe_submissions` table (LO-owned read/write, owner review), status lifecycle
  (draft → self-check → submitted → approved/published), server actions.
- **Gate:** Same migration-approval gate as #1.

---

## P1 — Make the cockpit do real work

### 3. Wire real screen-recording upload + transcription
- **What:** Replace the Capture upload/transcription stub with real upload to storage and
  automatic transcription.
- **Scope:** Upload control → object storage; transcription job; surface transcript back into the
  Capture record so it can feed the Plan generator.
- **Depends on:** #1 (to store captures + transcripts).

### 4. Connect the implementation-plan generator to Atlas
- **What:** Let Atlas draft an implementation plan from a Capture (+ repo/convention context)
  instead of the local template.
- **Scope:** Plan section calls Atlas with the capture/transcript and LegendsOS conventions;
  returns scoped tasks, file list, acceptance criteria, and agent prompts.
- **Notes:** Respect the paid-generation gate; ship behind it. Keep the deterministic prompt
  builders as a fallback.

### 5. Expand the Vibe-Coding template library
- **What:** Grow the prompt-template catalog beyond the starter set.
- **Scope:** Add templates for more realtor landing-page variants, more blog angles, listing
  intros, rate-environment explainers, email sequences, social packs — each with baked-in
  compliance framing and brand voice.
- **Depends on:** Nothing hard; can proceed in parallel. Bigger value once #2 lands.

---

## P2 — Polish & test infrastructure

### 6. Compact-UX pass for Loan Brain / Processing / Coordinator cockpits
- **What:** Apply the compact-UX primitives (introduced this sprint) across the Loan Brain,
  Processing, and Coordinator cockpits for denser, faster-to-scan layouts.
- **Scope:** Swap roomy cards for compact list/row primitives, tighten spacing, consistent chip
  usage, keep light/dark parity. Match the dark-gold-glass aesthetic.
- **Why P2:** High UX value, no persistence dependency — safe to do anytime.

### 7. Role-preview test users
- **What:** Stand up seed test users for each role (owner, LO, processor, coordinator) so
  role-gated surfaces (`/builder` owner-only, `/vibe-coding` team, role cockpits) can be
  walked end-to-end via impersonation/role-preview.
- **Scope:** Seed file for test profiles (manual seed, not auto-applied), impersonation wiring
  check, smoke-test coverage per role.
- **Gate:** Seed is manual; do not auto-insert into a real environment without approval.

---

## Suggested sequencing

1. Draft migrations for #1 and #2 → get Jeremy's approval → apply.
2. With persistence live: ship #3 (upload/transcription) and #2's review queue.
3. In parallel (no DB dep): #5 templates and #6 compact-UX pass.
4. Layer in #4 (Atlas plan generator) behind the paid-generation gate.
5. Land #7 role-preview users to verify all role-gated surfaces end-to-end.

---

## Reminders / guardrails

- No migrations applied without Jeremy's sign-off.
- No live paid model calls unless the provider gate is enabled.
- Keep `/builder` owner-only and `/vibe-coding` team-accessible.
- Maintain light/dark parity and the dark-gold-glass aesthetic on all new UI.
- Type-safe throughout; no out-of-scope edits to `lib/navigation.ts`.
