# Legends OS — Next Local Build Sprint

**Status:** Awaiting Jeremy's approval to kick off.
**Date:** 2026-05-22
**Target branch:** `feat/legends-growth-academy-and-light-mode-phase-1` (single feature branch, multiple tracks)
**Production safety:** No push to `main`. No Netlify trigger. PR for Jeremy review only.

---

## 1. Sprint goal

Ship the first concrete slice of three Legends adaptations:

1. **Legends Growth Academy scaffold** under `/training/academy` with sales/marketing/AI tracks.
2. **Light mode token plumbing + toggle** (Phases 1–2 of the light mode plan).
3. **Three Legends Atlas assistants** seeded as catalog rows (no live model calls).

All three tracks are additive, share a single feature branch, and verify with lint + typecheck + build + Playwright smoke.

## 2. Acceptance criteria (sprint-level)

- [ ] `/training/academy` renders for authenticated members. Cards for Sales, Marketing, AI tracks each with at least 3 modules.
- [ ] Sidebar shows new "Legends Academy" nav row under Team.
- [ ] Sun/moon toggle visible in TopBar. Clicking flips between light and dark with persistence.
- [ ] Dark mode is **pixel-identical** to current.
- [ ] Light mode renders without broken layout on `/login`, `/dashboard`, `/atlas`, `/training`, `/training/academy` (other routes may still look dark-leaning — acceptable for this sprint).
- [ ] `/atlas` shows a "Choose assistant" chip row offering Legends Coach (default), Legends LO Support, Legends Marketing.
- [ ] Picking an assistant updates the active thread's assistant slug. No live model call — existing "live_action_blocked" response continues.
- [ ] `npm run lint` ✓
- [ ] `npm run typecheck` ✓
- [ ] `npm run build` ✓
- [ ] `npm run test:e2e` ✓ — smoke extended for the three changes
- [ ] `docs/STATUS.md` updated.
- [ ] PR opened. **Not merged.**

## 3. Tasks by track

### Track A — Legends Growth Academy scaffold (P0)

A1. Create `lib/legends/curriculum.ts` with typed module definitions:
```ts
export type AcademyTrack = "sales" | "marketing" | "ai" | "mastery";
export interface CurriculumModule {
  id: string;
  track: AcademyTrack;
  level: 101 | 201 | 301 | 401 | 501 | 601 | "track-only";
  title: string;
  summary: string;
  durationMinutes: number;
  status: "available" | "coming-soon";
  externalLinks?: { label: string; url: string }[];
}
```
Seed at least 3 modules per track in Legends voice.

A2. Add types to `types/database.ts` if needed (probably none — using static data file for Phase 1).

A3. Create `app/(app)/training/academy/page.tsx` — landing with track cards.

A4. Create `app/(app)/training/academy/[track]/page.tsx` — track index, lists modules.

A5. Create `app/(app)/training/academy/[track]/[module]/page.tsx` — module detail with summary, duration, links.

A6. Update `app/(app)/training/page.tsx` — add a hero card linking to `/training/academy`. Keep existing content.

A7. Update `lib/navigation.ts` — add Legends Academy row.

A8. Create `components/training/AcademyTrackCard.tsx`.

A9. Create `components/training/ModuleListItem.tsx`.

A10. Extend Playwright smoke to verify the four new routes redirect when unauthenticated and render when authenticated.

**Files added:** ~7. **Files modified:** 2–3. **No deletions.**

### Track B — Light mode token plumbing + toggle (P0)

B1. Extend `app/globals.css` with the `:root, .dark` + `.light` variable blocks (per `LEGENDS_LIGHT_MODE_IMPLEMENTATION_PLAN.md` §2).

B2. Rewrite the global layer in `globals.css` (body background, html background, scrollbar) to use the new variables.

B3. Create `lib/theme.ts` — constants (`THEME_STORAGE_KEY = "legendsTheme"`) and helpers.

B4. Create `components/ui/ThemeProvider.tsx` — context provider with `useTheme()` hook.

B5. Create `components/ui/ThemeToggle.tsx` — Sun/Moon icon button.

B6. Update `app/layout.tsx`:
- Remove hardcoded `className="dark"` from `<html>`.
- Add the inline boot script (in `<head>`) that sets initial class before paint.
- Wrap children with `<ThemeProvider>`.

B7. Update `components/shell/TopBar.tsx` to mount `<ThemeToggle />`.

B8. Add light-mode gradient fallback in `globals.css` body (no light background image needed yet).

B9. Verify dark mode looks identical to current — diff screenshots before/after.

B10. Verify light mode loads `/login`, `/dashboard`, `/atlas`, `/training`, `/training/academy` without layout breakage.

**Files added:** 3 (ThemeProvider, ThemeToggle, theme.ts). **Files modified:** 3 (layout.tsx, globals.css, TopBar.tsx). **No deletions.**

### Track C — Legends Atlas assistants (catalog only, P1)

C1. Create `lib/legends/assistants.ts` — typed list of three assistants with metadata:
```ts
export const LEGENDS_ASSISTANTS = [
  { slug: "legends-coach", displayName: "Legends Coach", description: "...", systemPrompt: "..." },
  { slug: "legends-lo-support", displayName: "Legends LO Support", description: "...", systemPrompt: "..." },
  { slug: "legends-marketing", displayName: "Legends Marketing", description: "...", systemPrompt: "..." },
];
```
System prompts drafted from sources in `LEGENDS_AI_ASSISTANT_HUB_ADAPTATION_PLAN.md` §3.

C2. Extend `scripts/seed-atlas-assistants-from-local.ts` to upsert three rows into `atlas_assistants` with the metadata above. Owner-managed.

C3. Create `components/atlas/AssistantPicker.tsx` — chip row UI.

C4. Update `app/(app)/atlas/page.tsx` — show `AssistantPicker` on new-thread view.

C5. Update `app/(app)/atlas/[threadId]/page.tsx` — show active assistant label in the thread header.

C6. Persist active assistant on a thread via `chat_threads.metadata.assistantSlug` (no schema change; metadata is JSONB).

C7. Verify: creating a new thread, picking an assistant, sending a message → message lands in thread → assistant slug captured in metadata. Live model call still gated by `ALLOW_PAID_TEXT_GENERATION`; existing block response continues.

C8. Add audit log entries for assistant selection (`recordAudit("atlas.assistant.selected", { slug })`).

**Files added:** 2 (assistants.ts, AssistantPicker.tsx). **Files modified:** 3 (seed script, atlas pages). **No deletions.**

### Track D — Verification + docs

D1. Run lint, typecheck, build, e2e smoke. All green.

D2. Extend `tests/e2e/smoke.spec.ts` with:
- Theme toggle flips html class.
- Theme persists across reloads.
- Academy nav row visible.
- Academy track page renders for authenticated user.
- Assistant picker visible on `/atlas`.

D3. Update `docs/STATUS.md` with the sprint summary.

D4. Take screenshots:
- `/login` dark + light
- `/dashboard` dark + light
- `/atlas` dark + light + assistant picker open
- `/training/academy` dark + light
- `/training/academy/sales/sales-101` dark + light

Save under `.playwright-mcp/legends-sprint-2026-05-22/`.

D5. Open PR titled `feat: Legends Growth Academy scaffold + light mode toggle + Atlas assistants` with the sprint deliverables list. Do **not** merge. Tag Jeremy.

## 4. Out of scope for this sprint

- Coaching trackers, Roleplay Lab, Scripts Library, Audio Library — Phase 2+.
- Team Lead OS — Phase 4.
- Coach Hub — deferred.
- FaceGram — deferred.
- Light mode component pass beyond the priority five routes — Phase 3 of the light mode plan.
- Live AI provider wiring — gated by `ALLOW_PAID_TEXT_GENERATION` + provider key.
- New Supabase migrations — Phase 2.
- Multi-role expansion beyond `owner | admin | member`.
- Borrower-PII redaction tooling.
- Persona library code — write doc only this sprint.

## 5. Estimated effort

| Track | Effort |
|---|---|
| Track A — Academy scaffold | 1.0 day |
| Track B — Light mode tokens + toggle | 1.0 day |
| Track C — Atlas assistants catalog | 0.5 day |
| Track D — Verification + docs | 0.5 day |

**Total:** ~3 dev days for one branch, one PR, ready for Jeremy review.

## 6. Production safety reminders

- Branch only. No push to `main`.
- No Netlify deploy.
- No `.env` writes.
- No secrets in commits.
- No live AI calls (still gated).
- No n8n triggers.
- No social publishes, no email sends.
- No live DB writes against production Supabase (the seed script is idempotent and safe for dev/sandbox Supabase only).

## 7. After this sprint

If Jeremy approves and merges:

**Sprint 2 candidates** (pick one or stack):
- Phase 2 of Light Mode (component pass across all 18 routes).
- Phase 3 of Adaptation Plan (Scripts Library + Roleplay Lab + Persona Library seed).
- Phase 2 of Adaptation Plan (trackers + progress migration).
- AI provider live wiring (gated by Jeremy on env flip).
- Coaching Calendar extension + recognition log.

Jeremy decides the next sprint scope after seeing this one land.

## 8. Files-touched summary (sprint preview)

```
NEW
  lib/legends/curriculum.ts
  lib/legends/assistants.ts
  lib/theme.ts
  app/(app)/training/academy/page.tsx
  app/(app)/training/academy/[track]/page.tsx
  app/(app)/training/academy/[track]/[module]/page.tsx
  components/training/AcademyTrackCard.tsx
  components/training/ModuleListItem.tsx
  components/ui/ThemeProvider.tsx
  components/ui/ThemeToggle.tsx
  components/atlas/AssistantPicker.tsx

MODIFIED
  app/layout.tsx
  app/globals.css
  app/(app)/training/page.tsx
  app/(app)/atlas/page.tsx
  app/(app)/atlas/[threadId]/page.tsx
  components/shell/TopBar.tsx
  lib/navigation.ts
  scripts/seed-atlas-assistants-from-local.ts
  tests/e2e/smoke.spec.ts
  docs/STATUS.md

DELETED
  (none)
```

Total: 11 new files, 10 modified, 0 deleted.
