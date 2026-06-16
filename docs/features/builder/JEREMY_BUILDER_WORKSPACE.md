# Jeremy's Builder Workspace (`/builder`)

**Route:** `/builder` — **owner-only** (gated with `isOwner(profile)`; non-owners are redirected to `/dashboard`).

The Builder Workspace is Jeremy's personal **build cockpit** inside LegendsOS. It is the
private command center where the platform itself gets planned, captured, specced, and handed
off to AI coding agents (Claude Code + Codex) and to the LegendsOS team. It is intentionally
separate from the team-facing surfaces — nothing here is visible to LOs, processors, or
coordinators.

Think of it as: *"Where Jeremy turns a loose idea or a screen recording into a concrete,
agent-ready build plan, tracks it through to a handoff, and keeps a QA gate in front of every
ship."*

---

## Who it's for

- **Jeremy only.** Owner-only gate. This is the build/ops side of the house, not a team tool.
- The team-facing counterpart is `/vibe-coding` (see `TEAM_LO_VIBE_CODING.md`).

---

## Sections

The workspace is organized into a tabbed/segmented client workspace. Each section below notes
what is **live** today vs. what is an intentional **placeholder** (empty states and
"coming soon" cards designed to look deliberate, not broken).

### 1. Projects
The top-level list of in-flight build efforts (e.g. "Builder Workspace," "Loan Brain Phase 3,"
"Light-mode Phase 2"). Each project is a container for captures, plans, handoffs, and QA.

- **Live:** Project cards UI, status chips (`chip-active` / `chip-warn` / `chip-ok`), local
  in-memory state for browsing and selecting a project.
- **Placeholder:** Persistence. Projects are **not yet written to Supabase** — see
  `LEGENDSOS_NEXT_ACTIONS.md`. Creating/editing is held in client state for now. A clear
  "Not yet persisted — Supabase migration pending Jeremy's approval" note is surfaced.

### 2. Capture
The "raw input" inbox. Drop a screen recording, a voice note idea, a screenshot, or a
free-text brain-dump that needs to become a build task.

- **Live:** Capture form (title + notes + type), capture list, empty state.
- **Placeholder:** Real **screen-recording upload + transcription**. Today this is a stub —
  the upload control and transcription panel render as a "coming soon" card. Wiring real upload
  to storage and transcription is a top next-action.

### 3. Plan
Turns a capture into an **implementation plan**: scoped tasks, file lists, acceptance criteria,
and the agent prompt(s) to execute it.

- **Live:** Plan editor scaffold, the **Claude Code + Codex prompt builders** (below).
- **Placeholder:** The **implementation-plan generator** that auto-drafts a plan from a capture.
  It is wired to a local template now; connecting it to **Atlas** (so Atlas drafts the plan
  from the capture + repo context) is a next-action.

### 4. Handoffs
The bridge between Jeremy's plan and execution — either to an AI agent (Claude Code / Codex) or
to a human on the team. A handoff packages the plan, the prompt, the file list, and the QA
checklist into one shareable unit.

- **Live:** Handoff card layout, copy-to-clipboard of the assembled handoff/prompt.
- **Placeholder:** Status tracking back from agents (e.g. "PR opened," "merged"). Shown as a
  deliberate "coming soon" status lane.

### 5. QA Checklists
A reusable, per-project QA gate. Before anything is considered shipped, it runs through a
checklist (type-safe, lint, build, route resolution, role-gating verified, no live writes, etc.).

- **Live:** Checklist UI, check/uncheck, per-project checklist templates.
- **Placeholder:** Persisting QA results and auto-pulling CI status. Manual for now.

### 6. Incubator
A holding area for half-formed product ideas that aren't yet a project — the "someday/maybe"
shelf. Promote an incubator idea into a full Project when it's ready.

- **Live:** Idea cards + empty state.
- **Placeholder:** Promotion flow into Projects, and persistence.

### 7. Website / Blog Starter
A starter surface for spinning up the LegendsOS marketing site and blog content from inside the
cockpit — outline a page, draft a post, queue it for the public site.

- **Live:** Starter cards / outline scaffolding.
- **Placeholder:** Actual publish pipeline and connection to a real site/CMS. Clearly labeled
  as a starter, not a live publisher.

---

## Prompt builders (Claude Code + Codex)

The heart of the Plan/Handoff flow is a pair of **prompt builders** that assemble
agent-ready prompts from the project's conventions, file list, and acceptance criteria:

- **Claude Code prompt builder** — produces a prompt formatted for Claude Code subagents:
  includes the LegendsOS conventions block, the assigned file list, the task description, and
  the guardrails (type-safe, no out-of-scope edits, no npm/build, no secrets, no live writes).
- **Codex prompt builder** — produces an equivalent prompt shaped for Codex.

Both are **copy-to-clipboard** outputs today. They do **not** call any model from the app and do
**not** write anything server-side — they are deterministic prompt assemblers. This keeps the
cockpit safe to use without tripping any paid-generation or write gates.

---

## Live vs. placeholder — quick reference

| Section            | Live now                                  | Placeholder (next-actions)                          |
|--------------------|-------------------------------------------|-----------------------------------------------------|
| Projects           | Cards, status chips, local selection      | Supabase persistence (needs Jeremy's migration OK)  |
| Capture            | Capture form + list                       | Screen-recording upload + transcription             |
| Plan               | Plan editor, prompt builders              | Atlas-connected plan generator                      |
| Handoffs           | Handoff packaging, copy-to-clipboard      | Agent status tracking                               |
| QA Checklists      | Checklist UI + templates                  | Result persistence + CI status                      |
| Incubator          | Idea cards + empty state                  | Promotion flow + persistence                        |
| Website/Blog       | Starter scaffolding                       | Real publish pipeline / CMS                          |

---

## Safety notes

- **Owner-only.** Enforced server-side via `isOwner(profile)` redirect.
- **No live writes.** Nothing in `/builder` writes to Supabase yet; persistence is deferred
  until Jeremy approves the migration.
- **No live model calls.** Prompt builders assemble text only.
- This is the build/ops cockpit — it is deliberately kept out of the team navigation.
