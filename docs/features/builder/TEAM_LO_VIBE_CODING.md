# Team Vibe-Coding Hub (`/vibe-coding`)

**Route:** `/vibe-coding` — **team page** (no owner gate; available to loan officers and the
broader team).

The Vibe-Coding Hub is the team-facing creative workspace where Legends LOs can build their own
**marketing and web assets with AI** — without touching code and without going off-brand or
off-compliance. It's the friendly, guard-railed counterpart to Jeremy's owner-only `/builder`
cockpit (see `JEREMY_BUILDER_WORKSPACE.md`).

The vibe: *"Describe what you want, use a proven prompt template, generate a draft, run a quick
self-check, and submit it to Jeremy for review before it goes live."*

---

## Who it's for

- **Team loan officers** (and other team members). This is a team tool, intentionally
  **not** owner-gated.
- Designed for non-technical users — no code required, prompt templates do the heavy lifting.

---

## What LOs can build here

- **Realtor landing pages** — co-branded pages for referral-partner agents.
- **Blog posts** — educational, top-of-funnel mortgage content.
- **Simple sites** — basic single-purpose pages (event, open house, first-time buyer guide).
- **Content** — social captions, email blurbs, short-form copy.
- **Marketing ideas** — campaign concepts and angles to bring to a marketing review.

Everything starts from a template and stays inside the Legends brand and compliance guardrails.

---

## Prompt template library

The hub ships a **library of prompt templates** so LOs don't start from a blank page. Each
template is a fill-in-the-blanks prompt tuned for a specific output (realtor landing page, blog
post, listing-agent intro, rate-environment explainer, etc.) and pre-loaded with brand voice and
compliance-safe framing.

- **Live:** Browsable template cards, select a template, fill in fields, copy/assemble the prompt.
- **Placeholder:** A larger catalog and per-template live generation. Expanding the template set
  is an explicit next-action (see `LEGENDSOS_NEXT_ACTIONS.md`).

---

## Compliance-safe copy guidance

Mortgage marketing is regulated, so the hub bakes guidance directly into the experience:

- **No guarantees / no specific-rate promises** unless properly disclosed.
- **No "approved" / "pre-approved" language** misused; use compliant phrasing.
- **Required disclosures / NMLS / Equal Housing** reminders surfaced on relevant templates.
- **Avoid trigger terms** and unsubstantiated claims.
- Every draft is framed as a **draft pending review** — nothing an LO generates here is
  publish-ready until Jeremy signs off.

Guidance is presented as inline helper text, chips/badges, and a short checklist on the
self-check step — designed to teach good habits, not just block.

---

## Jeremy review workflow

The hub enforces a simple, safe lifecycle on everything an LO creates:

1. **Draft** — LO picks a template, fills it in, and generates/assembles a draft.
2. **Self-check** — LO runs the built-in compliance checklist (disclosures present, no
   guarantees, brand voice, links work). This is the LO's first gate.
3. **Submit** — LO submits the draft to Jeremy for review. It leaves the LO's hands as a
   "submitted / pending review" item.
4. **Publish** — Jeremy reviews, requests edits or approves, and only approved items are
   published / handed back as live-ready.

- **Live:** The workflow stages, status chips (draft / self-check / submitted / approved), and
  the self-check checklist UI.
- **Placeholder:** Real submission persistence + Jeremy's review queue and live publishing.
  These are deferred until Supabase persistence is approved (see next-actions). Today the
  states are tracked in client state and the submit step is a deliberate "coming soon — your
  draft will route to Jeremy" affordance.

---

## Live vs. placeholder — quick reference

| Area                     | Live now                                | Placeholder (next-actions)                    |
|--------------------------|-----------------------------------------|-----------------------------------------------|
| Build types              | Cards for landing pages, blogs, etc.    | Per-type live generation                      |
| Prompt template library  | Browse + fill + assemble                | Bigger catalog, live generation               |
| Compliance guidance      | Inline guidance + self-check checklist  | Automated compliance scoring                  |
| Review workflow          | Stage UI + status chips                 | Persistence + Jeremy's live review queue      |
| Publish                  | "Pending review" state                  | Real publish pipeline                         |

---

## Safety notes

- **Team-safe by design.** Nothing publishes without Jeremy's approval.
- **No live writes yet.** Submissions are client-state until Supabase persistence is approved.
- **No paid model calls fired from the app** in this pass — templates assemble prompts; live
  generation is gated and deferred.
- Compliance guidance is advisory UI — it does not replace formal compliance review.
